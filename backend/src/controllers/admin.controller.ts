import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.ts';
import { badRequest, idListSchema, idParam, notFound, parse, timeSchema } from '../lib/http.ts';
import { enumValues } from '../lib/meta.ts';
import { timeToMinutes } from '../lib/time.ts';
import { notify } from '../services/notify.ts';

const ok = (res: Response, message: string, data?: unknown, status = 200) =>
  res.status(status).json({ message, code: status, ...(data !== undefined ? { data } : {}) });

const url = z.url().max(1000);

// ---------- Doctors ----------

const doctorProfileSchema = z
  .object({
    avatarUrl: url.nullable(),
    degree: z.string().trim().max(150).nullable(),
    about: z.string().trim().max(5000).nullable(),
    education: z.string().trim().max(5000).nullable(),
    awards: z.string().trim().max(5000).nullable(),
    clinicName: z.string().trim().max(150).nullable(),
    consultationFee: z.number().int().min(0).nullable(),
    waitingTimeMins: z.number().int().min(0).max(600).nullable(),
    services: z.array(z.string().trim().min(1).max(100)).max(50),
    photoUrls: z.array(url).max(30),
    videoUrl: url.nullable(),
    isFeatured: z.boolean(),
    isAuraSpecialist: z.boolean(),
    isActive: z.boolean()
  })
  .partial();

export const updateDoctorProfile = async (req: Request, res: Response) => {
  const data = parse(doctorProfileSchema, req.body);
  const doctor = await prisma.doctor.update({ where: { id: idParam(req) }, data, omit: { password: true } });
  ok(res, 'Doctor profile updated.', doctor);
};

const availabilitySchema = z.object({
  windows: z
    .array(
      z
        .object({
          dayOfWeek: z.number().int().min(0).max(6),
          startTime: timeSchema,
          endTime: timeSchema,
          slotMinutes: z.number().int().min(5).max(240).default(15)
        })
        .refine((w) => timeToMinutes(w.endTime) > timeToMinutes(w.startTime), 'endTime must be after startTime.')
    )
    .max(50)
});

/** Replaces the doctor's weekly consultation windows. */
export const setDoctorAvailability = async (req: Request, res: Response) => {
  const doctorId = idParam(req);
  const { windows } = parse(availabilitySchema, req.body);
  await prisma.$transaction([
    prisma.doctorAvailability.deleteMany({ where: { doctorId } }),
    prisma.doctorAvailability.createMany({ data: windows.map((w) => ({ ...w, doctorId })) })
  ]);
  const saved = await prisma.doctorAvailability.findMany({ where: { doctorId }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] });
  ok(res, 'Availability updated.', saved);
};

export const setDoctorHospitals = async (req: Request, res: Response) => {
  const { hospitalIds } = parse(z.object({ hospitalIds: idListSchema }), req.body);
  const doctor = await prisma.doctor.update({
    where: { id: idParam(req) },
    data: { hospitals: { set: hospitalIds.map((id) => ({ id })) } },
    select: { id: true, hospitals: { select: { id: true, name: true } } }
  });
  ok(res, 'Doctor hospitals updated.', doctor);
};

// ---------- Hospitals ----------

const hospitalProfileSchema = z
  .object({
    about: z.string().trim().max(5000).nullable(),
    coverImageUrl: url.nullable(),
    photoUrls: z.array(url).max(50),
    ambulancePhone: z.string().trim().max(20).nullable(),
    isActive: z.boolean()
  })
  .partial();

export const updateHospitalProfile = async (req: Request, res: Response) => {
  const data = parse(hospitalProfileSchema, req.body);
  const hospital = await prisma.hospital.update({ where: { id: idParam(req) }, data });
  ok(res, 'Hospital profile updated.', hospital);
};

const roomSchema = z.object({
  roomType: z.enum(enumValues('roomType')),
  name: z.string().trim().min(1).max(100),
  feePerDay: z.number().int().min(0),
  patientsPerRoom: z.number().int().min(1).max(100).default(1),
  serviceChargePercent: z.number().int().min(0).max(100).nullable().optional(),
  doctorVisitCharge: z.number().int().min(0).nullable().optional(),
  minBookingAmount: z.number().int().min(0).nullable().optional(),
  photoUrls: z.array(url).max(20).default([]),
  isAvailable: z.boolean().default(true)
});

export const createRoom = async (req: Request, res: Response) => {
  const data = parse(roomSchema, req.body);
  const room = await prisma.hospitalRoom.create({ data: { ...data, hospitalId: idParam(req) } });
  ok(res, 'Room created.', room, 201);
};

export const updateRoom = async (req: Request, res: Response) => {
  const data = parse(roomSchema.partial(), req.body);
  const room = await prisma.hospitalRoom.update({ where: { id: idParam(req) }, data });
  ok(res, 'Room updated.', room);
};

export const deleteRoom = async (req: Request, res: Response) => {
  await prisma.hospitalRoom.delete({ where: { id: idParam(req) } });
  ok(res, 'Room deleted.');
};

const packageSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(500).nullable().optional(),
  price: z.number().int().min(0)
});

export const createPackage = async (req: Request, res: Response) => {
  const data = parse(packageSchema, req.body);
  const pkg = await prisma.hospitalPackage.create({ data: { ...data, hospitalId: idParam(req) } });
  ok(res, 'Package created.', pkg, 201);
};

export const deletePackage = async (req: Request, res: Response) => {
  await prisma.hospitalPackage.delete({ where: { id: idParam(req) } });
  ok(res, 'Package deleted.');
};

// ---------- Master data ----------

const symptomSchema = z.object({
  name: z.string().trim().min(1).max(100),
  iconUrl: url.nullable().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true)
});
const specialitySchema = symptomSchema.omit({ iconUrl: true });
const bannerSchema = z.object({
  placement: z.enum(['HOME_SLIDER', 'HOME_EXPLORE']).default('HOME_EXPLORE'),
  title: z.string().trim().max(150).nullable().optional(),
  imageUrl: url,
  target: z.enum(['NONE', 'HOSPITAL', 'DOCTOR', 'URL']).default('NONE'),
  targetId: z.string().nullable().optional(),
  url: url.nullable().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true)
});
const helpSchema = z.object({
  category: z.enum(enumValues('helpCategory')),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(10000),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true)
});

type Delegate = {
  create: (args: { data: never }) => Promise<unknown>;
  update: (args: { where: { id: string }; data: never }) => Promise<unknown>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
};

const crud = (label: string, delegate: () => Delegate, schema: z.ZodObject) => ({
  create: async (req: Request, res: Response) => {
    const data = parse(schema, req.body);
    ok(res, `${label} created.`, await delegate().create({ data: data as never }), 201);
  },
  update: async (req: Request, res: Response) => {
    const data = parse(schema.partial(), req.body);
    ok(res, `${label} updated.`, await delegate().update({ where: { id: idParam(req) }, data: data as never }));
  },
  remove: async (req: Request, res: Response) => {
    await delegate().delete({ where: { id: idParam(req) } });
    ok(res, `${label} deleted.`);
  }
});

export const symptomsAdmin = crud('Symptom', () => prisma.symptom as unknown as Delegate, symptomSchema);
export const specialitiesAdmin = crud('Speciality', () => prisma.speciality as unknown as Delegate, specialitySchema);
export const bannersAdmin = crud('Banner', () => prisma.banner as unknown as Delegate, bannerSchema);
export const helpArticlesAdmin = crud('Help article', () => prisma.helpArticle as unknown as Delegate, helpSchema);

export const setConfig = async (req: Request, res: Response) => {
  const key = idParam(req, 'key');
  if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(key)) throw badRequest('Invalid config key.');
  const { value } = parse(z.object({ value: z.string().max(2000) }), req.body);
  const row = await prisma.appConfig.upsert({ where: { key }, create: { key, value }, update: { value } });
  ok(res, 'Config saved.', row);
};

// ---------- Operations ----------

export const setAppointmentStatus = async (req: Request, res: Response) => {
  const { status } = parse(z.object({ status: z.enum(['CONFIRMED', 'COMPLETED', 'NO_SHOW']) }), req.body);
  const appointment = await prisma.appointment.findUnique({ where: { id: idParam(req) }, select: { id: true, status: true } });
  if (!appointment) throw notFound('Appointment not found.');
  if (appointment.status === 'CANCELLED') throw badRequest('Cancelled appointments cannot be changed.');
  ok(res, 'Appointment updated.', await prisma.appointment.update({ where: { id: appointment.id }, data: { status } }));
};

export const setHospitalBookingStatus = async (req: Request, res: Response) => {
  const { status, reason } = parse(
    z.object({
      status: z.enum(['CONFIRMED', 'ADMITTED', 'COMPLETED', 'REJECTED']),
      reason: z.string().trim().max(250).optional()
    }),
    req.body
  );
  const booking = await prisma.hospitalBooking.findUnique({
    where: { id: idParam(req) },
    include: { hospital: { select: { name: true } } }
  });
  if (!booking) throw notFound('Booking not found.');
  if (booking.status === 'CANCELLED') throw badRequest('Cancelled bookings cannot be changed.');

  const updated = await prisma.hospitalBooking.update({
    where: { id: booking.id },
    data: { status, ...(status === 'REJECTED' ? { cancelReason: reason ?? null } : {}) }
  });
  if (status === 'CONFIRMED' || status === 'REJECTED') {
    await notify(booking.userId, 'HOSPITAL_BOOKING',
      status === 'CONFIRMED' ? 'Booking confirmed' : 'Booking declined',
      status === 'CONFIRMED'
        ? `Your booking at ${booking.hospital.name} has been confirmed.`
        : `Your booking at ${booking.hospital.name} could not be accepted.${reason ? ` ${reason}` : ''}`,
      { hospitalBookingId: booking.id });
  }
  ok(res, 'Booking updated.', updated);
};

/** Lets staff (or a doctor, until the doctor app exists) reply in a conversation. */
export const replyToConversation = async (req: Request, res: Response) => {
  const { text, senderType } = parse(
    z.object({ text: z.string().trim().min(1).max(2000), senderType: z.enum(['DOCTOR', 'SYSTEM']).default('SYSTEM') }),
    req.body
  );
  const conversation = await prisma.conversation.findUnique({ where: { id: idParam(req) } });
  if (!conversation) throw notFound('Conversation not found.');
  if (senderType === 'DOCTOR' && conversation.type !== 'DOCTOR') throw badRequest('This is not a doctor conversation.');

  const now = new Date();
  const [message] = await prisma.$transaction([
    prisma.message.create({ data: { conversationId: conversation.id, senderType, text, createdAt: now } }),
    prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageText: text, lastMessageAt: now } })
  ]);
  ok(res, 'Message sent.', message, 201);
};
