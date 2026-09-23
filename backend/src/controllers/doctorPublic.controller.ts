import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.ts';
import { currentUserId, dateOnlySchema, getPagination, idParam, notFound, pageMeta, parse } from '../lib/http.ts';
import {
  addressDto,
  addressInclude,
  distanceFrom,
  doctorCard,
  doctorCardSelect,
  hospitalCard,
  hospitalCardSelect,
  reviewDto,
  reviewInclude
} from '../lib/serializers.ts';
import { dayOfWeek, isPastDate, nowInAppTz } from '../lib/time.ts';
import { getAvailableDates, getDoctorSlots, groupSlots } from '../services/slots.ts';
import { inOrder, pageByDistance } from '../services/geo.ts';
import { saveReview } from '../services/reviews.ts';

const listSchema = z
  .object({
    search: z.string().trim().max(50).optional(),
    specialization: z.string().trim().max(100).optional(),
    type: z.enum(['top', 'aura']).optional(),
    hospitalId: z.string().optional(),
    role: z.string().trim().max(30).default('doctor'),
    sort: z.enum(['distance', 'availability', 'rating', 'recommended']).default('recommended'),
    date: dateOnlySchema.optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional()
  })
  .refine((q) => q.sort !== 'distance' || (q.lat !== undefined && q.lng !== undefined), {
    message: 'lat and lng are required to sort by distance.'
  });

const favouriteIds = async (userId: string | undefined, doctorIds: string[]) => {
  if (!userId || doctorIds.length === 0) return new Set<string>();
  const rows = await prisma.favouriteDoctor.findMany({
    where: { userId, doctorId: { in: doctorIds } },
    select: { doctorId: true }
  });
  return new Set(rows.map((r) => r.doctorId));
};

/**
 * ShowDoctorList / SelectDoctor / Hospital "Our Specialists".
 * sort=availability keeps doctors who consult today, ordered by rating.
 * date=YYYY-MM-DD keeps doctors who consult on that day (MakeAppointment: date first, then doctor).
 */
export const listDoctors = async (req: Request, res: Response) => {
  const q = parse(listSchema, req.query);
  const { page, limit, skip, take } = getPagination(req);
  const origin = q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : null;

  const where = {
    isActive: true,
    ...(q.role === 'all'
      ? {}
      : { OR: [{ role: { equals: q.role, mode: 'insensitive' as const } }, ...(q.role === 'doctor' ? [{ role: null }] : [])] }),
    ...(q.search
      ? {
          AND: [
            {
              OR: ['name', 'specialization', 'degree', 'clinicName'].map((field) => ({
                [field]: { contains: q.search, mode: 'insensitive' as const }
              }))
            }
          ]
        }
      : {}),
    ...(q.specialization ? { specialization: { equals: q.specialization, mode: 'insensitive' as const } } : {}),
    ...(q.type === 'top' ? { isFeatured: true } : {}),
    ...(q.type === 'aura' ? { isAuraSpecialist: true } : {}),
    ...(q.hospitalId ? { hospitals: { some: { id: q.hospitalId } } } : {}),
    ...(q.sort === 'availability' || q.date
      ? { availability: { some: { dayOfWeek: dayOfWeek(q.date ?? nowInAppTz().date) } } }
      : {})
  };

  let doctors;
  let distances = new Map<string, number | null>();
  const total = await prisma.doctor.count({ where });

  if (q.sort === 'distance' && origin) {
    const candidates = await prisma.doctor.findMany({ where, select: { id: true, address: addressInclude } });
    const ranked = pageByDistance(candidates, origin, skip, take);
    distances = ranked.distances;
    doctors = inOrder(
      await prisma.doctor.findMany({ where: { id: { in: ranked.ids } }, select: doctorCardSelect }),
      ranked.ids
    );
  } else {
    const orderBy =
      q.sort === 'recommended'
        ? [{ isFeatured: 'desc' as const }, { ratingAvg: 'desc' as const }, { ratingCount: 'desc' as const }]
        : [{ ratingAvg: 'desc' as const }, { ratingCount: 'desc' as const }];
    doctors = await prisma.doctor.findMany({ where, orderBy, skip, take, select: doctorCardSelect });
  }

  const favs = await favouriteIds(req.auth?.userId, doctors.map((d) => d.id));
  res.status(200).json({
    message: 'Doctors fetched successfully.',
    code: 200,
    data: doctors.map((d) =>
      doctorCard(d, {
        isFavourite: favs.has(d.id),
        distanceKm: distances.get(d.id) ?? distanceFrom(origin, d.address)
      })
    ),
    pagination: pageMeta(page, limit, total)
  });
};

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** DoctorHome / Doctor screen (+ AboutDoctor / Education / Awards tabs). */
export const getDoctorProfile = async (req: Request, res: Response) => {
  const id = idParam(req);
  const doctor = await prisma.doctor.findFirst({
    where: { id, isActive: true },
    // Public profile: never expose credentials, contact details or registration data.
    omit: {
      password: true,
      email: true,
      alternatePhone: true,
      registrationNumber: true,
      registrationAuthority: true,
      isActive: true
    },
    include: {
      address: addressInclude,
      availability: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
      hospitals: { where: { isActive: true }, select: hospitalCardSelect },
      reviews: { orderBy: { createdAt: 'desc' }, take: 3, include: reviewInclude }
    }
  });
  if (!doctor) throw notFound('Doctor not found.');

  const isFavourite = req.auth
    ? Boolean(await prisma.favouriteDoctor.findUnique({ where: { userId_doctorId: { userId: req.auth.userId, doctorId: id } } }))
    : false;

  const today = dayOfWeek(nowInAppTz().date);
  const { availability, hospitals, reviews, address, ...profile } = doctor;

  res.status(200).json({
    message: 'Doctor fetched successfully.',
    code: 200,
    data: {
      ...profile,
      rating: Math.round(doctor.ratingAvg * 10) / 10,
      isFavourite,
      address: addressDto(address),
      timings: availability.map((w) => ({
        dayOfWeek: w.dayOfWeek,
        day: DAY_NAMES[w.dayOfWeek],
        startTime: w.startTime,
        endTime: w.endTime,
        slotMinutes: w.slotMinutes
      })),
      todayTimings: availability
        .filter((w) => w.dayOfWeek === today)
        .map((w) => ({ startTime: w.startTime, endTime: w.endTime })),
      hospitals: hospitals.map((h) => hospitalCard(h)),
      reviews: reviews.map(reviewDto)
    }
  });
};

const ensureDoctor = async (id: string) => {
  const doctor = await prisma.doctor.findFirst({ where: { id, isActive: true }, select: { id: true } });
  if (!doctor) throw notFound('Doctor not found.');
};

/** TimeSloat date strip: next N days (default 8) with whether the doctor consults that day. */
export const listAvailableDates = async (req: Request, res: Response) => {
  const id = idParam(req);
  const { days, from } = parse(
    z.object({ days: z.coerce.number().int().min(1).max(60).default(8), from: dateOnlySchema.optional() }),
    req.query
  );
  await ensureDoctor(id);
  const data = await getAvailableDates(id, days, from);
  res.status(200).json({ message: 'Dates fetched successfully.', code: 200, data });
};

/** TimeSloat / TimeSloatHome / RescheduleTimeSloat: slots grouped Morning/Afternoon/Evening/Night. */
export const listSlots = async (req: Request, res: Response) => {
  const id = idParam(req);
  const { date } = parse(
    z.object({ date: dateOnlySchema.refine((d) => !isPastDate(d), 'Date cannot be in the past.') }),
    req.query
  );
  await ensureDoctor(id);
  const slots = await getDoctorSlots(id, date);
  res.status(200).json({ message: 'Slots fetched successfully.', code: 200, data: { date, groups: groupSlots(slots) } });
};

export const listDoctorReviews = async (req: Request, res: Response) => {
  const id = idParam(req);
  const { page, limit, skip, take } = getPagination(req);
  const [total, reviews] = await Promise.all([
    prisma.review.count({ where: { doctorId: id } }),
    prisma.review.findMany({ where: { doctorId: id }, orderBy: { createdAt: 'desc' }, skip, take, include: reviewInclude })
  ]);
  res.status(200).json({
    message: 'Reviews fetched successfully.',
    code: 200,
    data: reviews.map(reviewDto),
    pagination: pageMeta(page, limit, total)
  });
};

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional()
});

export const createDoctorReview = async (req: Request, res: Response) => {
  const id = idParam(req);
  const { rating, comment } = parse(reviewSchema, req.body);
  await ensureDoctor(id);
  const review = await saveReview(currentUserId(req), { doctorId: id }, rating, comment);
  res.status(201).json({ message: 'Review saved successfully.', code: 201, data: reviewDto(review) });
};

/** DoctorHome star button. */
export const addFavourite = async (req: Request, res: Response) => {
  const id = idParam(req);
  const userId = currentUserId(req);
  await ensureDoctor(id);
  await prisma.favouriteDoctor.upsert({
    where: { userId_doctorId: { userId, doctorId: id } },
    create: { userId, doctorId: id },
    update: {}
  });
  res.status(200).json({ message: 'Doctor added to favourites.', code: 200, data: { isFavourite: true } });
};

export const removeFavourite = async (req: Request, res: Response) => {
  const id = idParam(req);
  await prisma.favouriteDoctor.deleteMany({ where: { userId: currentUserId(req), doctorId: id } });
  res.status(200).json({ message: 'Doctor removed from favourites.', code: 200, data: { isFavourite: false } });
};

