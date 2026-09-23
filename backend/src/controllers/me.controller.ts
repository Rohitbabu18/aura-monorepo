import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.ts';
import { badRequest, conflict, currentUserId, getPagination, pageMeta, parse, phoneSchema } from '../lib/http.ts';
import { enumValues } from '../lib/meta.ts';
import { addressDto, addressInclude, doctorCard, doctorCardSelect, labelled } from '../lib/serializers.ts';
import { verifyVerificationToken } from '../lib/jwt.ts';
import { dateOnlySchema } from '../lib/http.ts';
import { isPastDate, toDateOnly, formatDateOnly } from '../lib/time.ts';
import { fileUrl, persistFiles } from '../lib/upload.ts';

const profileInclude = {
  address: addressInclude,
  healthProfile: true
} as const;

const loadProfile = (userId: string) =>
  prisma.user.findUniqueOrThrow({ where: { id: userId }, include: profileInclude });

type ProfileRecord = Awaited<ReturnType<typeof loadProfile>>;

const ageFrom = (dob: Date | null) => {
  if (!dob) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
};

/** Drives the "Profile NN% Completed" bar. */
const completion = (user: ProfileRecord) => {
  const h = user.healthProfile;
  const fields = [
    user.name,
    user.email,
    user.phoneVerifiedAt,
    user.avatarUrl,
    user.gender,
    user.dateOfBirth,
    user.bloodGroup,
    user.maritalStatus,
    user.heightFeet,
    user.weightKg,
    user.address?.complete,
    h?.allergyType,
    h?.medicationStatus,
    h?.diseaseStatus,
    h?.surgeryStatus,
    h?.smokingHabit,
    h?.alcoholConsumption,
    h?.activityLevel,
    h?.occupation
  ];
  return Math.round((fields.filter((v) => v !== null && v !== undefined && v !== '').length / fields.length) * 100);
};

const profileDto = (user: ProfileRecord) => {
  const h = user.healthProfile;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    phoneVerified: Boolean(user.phoneVerifiedAt),
    alternatePhone: user.alternatePhone,
    avatarUrl: user.avatarUrl,
    gender: labelled('gender', user.gender),
    dateOfBirth: user.dateOfBirth ? formatDateOnly(user.dateOfBirth) : null,
    age: ageFrom(user.dateOfBirth),
    bloodGroup: labelled('bloodGroup', user.bloodGroup),
    maritalStatus: labelled('maritalStatus', user.maritalStatus),
    heightFeet: user.heightFeet,
    weightKg: user.weightKg,
    address: addressDto(user.address),
    medical: {
      allergyType: labelled('allergyType', h?.allergyType),
      allergyDetails: h?.allergyDetails ?? null,
      medicationStatus: labelled('historyStatus', h?.medicationStatus),
      medicationDetails: h?.medicationDetails ?? null,
      diseaseStatus: labelled('historyStatus', h?.diseaseStatus),
      diseaseDetails: h?.diseaseDetails ?? null,
      surgeryStatus: labelled('historyStatus', h?.surgeryStatus),
      surgeryDetails: h?.surgeryDetails ?? null
    },
    lifestyle: {
      smokingHabit: labelled('smokingHabit', h?.smokingHabit),
      alcoholConsumption: labelled('alcoholConsumption', h?.alcoholConsumption),
      activityLevel: labelled('activityLevel', h?.activityLevel),
      occupation: h?.occupation ?? null
    },
    settings: { notificationsEnabled: user.notificationsEnabled },
    profileCompletion: completion(user),
    createdAt: user.createdAt
  };
};

export const getMe = async (req: Request, res: Response) => {
  const user = await loadProfile(currentUserId(req));
  res.status(200).json({ message: 'Profile fetched successfully.', code: 200, data: profileDto(user) });
};

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

const addressSchema = z
  .object({
    complete: optionalText(300),
    city: optionalText(100),
    state: optionalText(100),
    country: optionalText(100),
    pincode: z.coerce.number().int().min(100000).max(999999).nullable().optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional()
  })
  .refine((a) => (a.latitude === undefined) === (a.longitude === undefined), {
    message: 'latitude and longitude must be sent together.'
  });

const personalSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.email('Please enter valid email.').trim().toLowerCase().nullable().optional(),
  alternatePhone: phoneSchema.nullable().optional(),
  gender: z.enum(enumValues('gender')).nullable().optional(),
  dateOfBirth: dateOnlySchema
    .refine((d) => isPastDate(d), 'Date of birth must be in the past.')
    .nullable()
    .optional(),
  bloodGroup: z.enum(enumValues('bloodGroup')).nullable().optional(),
  maritalStatus: z.enum(enumValues('maritalStatus')).nullable().optional(),
  heightFeet: z.coerce.number().min(1).max(9).nullable().optional(),
  weightKg: z.coerce.number().min(1).max(400).nullable().optional(),
  address: addressSchema.optional()
});

/** ProfilePage1 + EditPersonalInfo. Phone changes go through PATCH /api/me/phone (OTP). */
export const updateMe = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const { address, dateOfBirth, ...fields } = parse(personalSchema, req.body);

  if (fields.email) {
    const taken = await prisma.user.findFirst({ where: { email: fields.email, id: { not: userId } }, select: { id: true } });
    if (taken) throw conflict('This email is already in use.');
  }

  const data: Record<string, unknown> = { ...fields };
  if (dateOfBirth !== undefined) data.dateOfBirth = dateOfBirth ? toDateOnly(dateOfBirth) : null;

  if (address) {
    const { latitude, longitude, ...addressFields } = address;
    const location =
      latitude !== undefined && longitude !== undefined
        ? { latitude: String(latitude), longitude: String(longitude) }
        : undefined;
    data.address = {
      upsert: {
        create: { ...addressFields, ...(location ? { location: { create: location } } : {}) },
        update: { ...addressFields, ...(location ? { location: { upsert: { create: location, update: location } } } : {}) }
      }
    };
  }

  if (Object.keys(data).length === 0) throw badRequest('Please provide at least one field to update.');

  await prisma.user.update({ where: { id: userId }, data });
  const user = await loadProfile(userId);
  res.status(200).json({ message: 'Profile updated successfully.', code: 200, data: profileDto(user) });
};

const medicalSchema = z.object({
  allergyType: z.enum(enumValues('allergyType')).nullable().optional(),
  allergyDetails: optionalText(250),
  medicationStatus: z.enum(enumValues('historyStatus')).nullable().optional(),
  medicationDetails: optionalText(250),
  diseaseStatus: z.enum(enumValues('historyStatus')).nullable().optional(),
  diseaseDetails: optionalText(250),
  surgeryStatus: z.enum(enumValues('historyStatus')).nullable().optional(),
  surgeryDetails: optionalText(250)
});

const lifestyleSchema = z.object({
  smokingHabit: z.enum(enumValues('smokingHabit')).nullable().optional(),
  alcoholConsumption: z.enum(enumValues('alcoholConsumption')).nullable().optional(),
  activityLevel: z.enum(enumValues('activityLevel')).nullable().optional(),
  occupation: optionalText(100)
});

const upsertHealth = async (req: Request, res: Response, schema: z.ZodObject, message: string) => {
  const userId = currentUserId(req);
  const data = parse(schema, req.body) as Record<string, unknown>;
  if (Object.keys(data).length === 0) throw badRequest('Please provide at least one field to update.');
  await prisma.userHealthProfile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  const user = await loadProfile(userId);
  res.status(200).json({ message, code: 200, data: profileDto(user) });
};

/** ProfilePage2 + EditMedicalInfo */
export const updateMedical = (req: Request, res: Response) =>
  upsertHealth(req, res, medicalSchema, 'Medical information updated successfully.');

/** ProfilePage3 + EditLifeStyleInfo */
export const updateLifestyle = (req: Request, res: Response) =>
  upsertHealth(req, res, lifestyleSchema, 'Lifestyle information updated successfully.');

/** Profile / ProfilePage1 camera button (multipart field "avatar"). */
export const uploadAvatar = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  if (!req.file) throw badRequest('Please attach an image in the "avatar" field.');
  const [file] = await persistFiles([req.file], { ownerId: userId, purpose: 'AVATAR', visibility: 'PUBLIC' });
  const avatarUrl = fileUrl(file);
  await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
  res.status(200).json({ message: 'Profile picture updated.', code: 200, data: { avatarUrl } });
};

const changePhoneSchema = z.object({ phone: phoneSchema, verificationToken: z.string().min(1) });

/** EditMobileVerify -> OtpConform (OTP purpose CHANGE_PHONE). */
export const changePhone = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const { phone, verificationToken } = parse(changePhoneSchema, req.body);

  let claims;
  try {
    claims = verifyVerificationToken(verificationToken);
  } catch {
    throw badRequest('Phone verification expired. Please verify the OTP again.');
  }
  if (claims.phone !== phone || claims.purpose !== 'CHANGE_PHONE') {
    throw badRequest('Phone verification does not match this number.');
  }

  const taken = await prisma.user.findFirst({ where: { phone, id: { not: userId } }, select: { id: true } });
  if (taken) throw conflict('This phone number is already registered.');

  await prisma.user.update({ where: { id: userId }, data: { phone, phoneVerifiedAt: new Date() } });
  const user = await loadProfile(userId);
  res.status(200).json({ message: 'Mobile number updated successfully.', code: 200, data: profileDto(user) });
};

const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, 'Old password is required.'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters.').max(64),
    confirmPassword: z.string().optional()
  })
  .refine((v) => v.confirmPassword === undefined || v.confirmPassword === v.newPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword']
  });

/** AccountSetting -> ChangePassword. The current session stays signed in. */
export const changePassword = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const { oldPassword, newPassword } = parse(changePasswordSchema, req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { password: true } });
  if (!(await bcrypt.compare(oldPassword, user.password))) throw badRequest('Old password is incorrect.');
  await prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(newPassword, 10) } });
  res.status(200).json({ message: 'Password changed successfully.', code: 200 });
};

const settingsSchema = z.object({ notificationsEnabled: z.boolean() });

/** AccountSetting notification switch. */
export const getSettings = async (req: Request, res: Response) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: currentUserId(req) },
    select: { notificationsEnabled: true }
  });
  res.status(200).json({ message: 'Settings fetched successfully.', code: 200, data: user });
};

export const updateSettings = async (req: Request, res: Response) => {
  const data = parse(settingsSchema, req.body);
  const user = await prisma.user.update({
    where: { id: currentUserId(req) },
    data,
    select: { notificationsEnabled: true }
  });
  res.status(200).json({ message: 'Settings updated successfully.', code: 200, data: user });
};

/** Drawer "My Doctor" (favourite doctors). */
export const listFavouriteDoctors = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const { page, limit, skip, take } = getPagination(req);
  const [total, rows] = await Promise.all([
    prisma.favouriteDoctor.count({ where: { userId } }),
    prisma.favouriteDoctor.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { doctor: { select: doctorCardSelect } }
    })
  ]);
  res.status(200).json({
    message: 'Favourite doctors fetched successfully.',
    code: 200,
    data: rows.map((row) => doctorCard(row.doctor, { isFavourite: true })),
    pagination: pageMeta(page, limit, total)
  });
};

