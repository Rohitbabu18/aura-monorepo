import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.ts';
import { badRequest, currentUserId, getPagination, idParam, idListSchema, notFound, pageMeta, parse } from '../lib/http.ts';
import { enumValues, labelOf } from '../lib/meta.ts';
import {
  addressDto,
  addressInclude,
  distanceFrom,
  doctorCard,
  doctorCardSelect,
  hospitalCard,
  hospitalCardSelect,
  operatingHoursDto,
  reviewDto,
  reviewInclude
} from '../lib/serializers.ts';
import { dayOfWeek, nowInAppTz } from '../lib/time.ts';
import { inOrder, pageByDistance } from '../services/geo.ts';
import { saveReview } from '../services/reviews.ts';
import { reviewSchema } from './doctorPublic.controller.ts';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const listSchema = z
  .object({
    search: z.string().trim().max(50).optional(),
    role: z.enum(['HOSPITAL', 'CLINIC']).optional(),
    city: z.string().trim().max(100).optional(),
    sort: z.enum(['distance', 'availability', 'rating', 'recommended']).default('recommended'),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional()
  })
  .refine((q) => q.sort !== 'distance' || (q.lat !== undefined && q.lng !== undefined), {
    message: 'lat and lng are required to sort by distance.'
  });

/** HospitalList screen. sort=availability keeps hospitals open today. */
export const listHospitals = async (req: Request, res: Response) => {
  const q = parse(listSchema, req.query);
  const { page, limit, skip, take } = getPagination(req);
  const origin = q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : null;
  const todayKey = DAY_KEYS[dayOfWeek(nowInAppTz().date)];

  const where = {
    isActive: true,
    ...(q.role ? { role: q.role } : {}),
    ...(q.search
      ? {
          OR: [
            { name: { contains: q.search, mode: 'insensitive' as const } },
            { specialtiesOffered: { has: q.search } },
            { address: { city: { contains: q.search, mode: 'insensitive' as const } } }
          ]
        }
      : {}),
    ...(q.city ? { address: { city: { equals: q.city, mode: 'insensitive' as const } } } : {}),
    ...(q.sort === 'availability' ? { operatingData: { [`${todayKey}Enabled`]: true } } : {})
  };

  const total = await prisma.hospital.count({ where });
  let hospitals;
  let distances = new Map<string, number | null>();

  if (q.sort === 'distance' && origin) {
    const candidates = await prisma.hospital.findMany({ where, select: { id: true, address: addressInclude } });
    const ranked = pageByDistance(candidates, origin, skip, take);
    distances = ranked.distances;
    hospitals = inOrder(
      await prisma.hospital.findMany({ where: { id: { in: ranked.ids } }, select: hospitalCardSelect }),
      ranked.ids
    );
  } else {
    hospitals = await prisma.hospital.findMany({
      where,
      // "recommended" favours well-reviewed hospitals; "rating" favours the highest average.
      orderBy:
        q.sort === 'recommended'
          ? [{ ratingCount: 'desc' }, { ratingAvg: 'desc' }, { name: 'asc' }]
          : [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }, { name: 'asc' }],
      skip,
      take,
      select: hospitalCardSelect
    });
  }

  res.status(200).json({
    message: 'Hospitals fetched successfully.',
    code: 200,
    data: hospitals.map((h) => hospitalCard(h, { distanceKm: distances.get(h.id) ?? distanceFrom(origin, h.address) })),
    pagination: pageMeta(page, limit, total)
  });
};

const roomDto = (room: {
  id: string;
  roomType: string;
  name: string;
  feePerDay: number;
  patientsPerRoom: number;
  serviceChargePercent: number | null;
  doctorVisitCharge: number | null;
  minBookingAmount: number | null;
  photoUrls: string[];
  isAvailable: boolean;
}) => ({ ...room, roomTypeLabel: labelOf('roomType', room.roomType) });

/** Hospital screen + AboutHospital / ChargeRoom / Photos tabs. */
export const getHospitalProfile = async (req: Request, res: Response) => {
  const id = idParam(req);
  const hospital = await prisma.hospital.findFirst({
    where: { id, isActive: true },
    omit: { email: true, alternatePhone: true, licenseNumber: true, isActive: true },
    include: {
      address: addressInclude,
      operatingData: true,
      rooms: { orderBy: { feePerDay: 'asc' } },
      packages: { orderBy: { price: 'asc' } },
      doctors: { where: { isActive: true }, take: 10, select: doctorCardSelect },
      reviews: { orderBy: { createdAt: 'desc' }, take: 3, include: reviewInclude }
    }
  });
  if (!hospital) throw notFound('Hospital not found.');

  const { address, operatingData, rooms, packages, doctors, reviews, ...profile } = hospital;
  const hours = operatingHoursDto(operatingData as Record<string, unknown> | null);

  res.status(200).json({
    message: 'Hospital fetched successfully.',
    code: 200,
    data: {
      ...profile,
      rating: Math.round(hospital.ratingAvg * 10) / 10,
      address: addressDto(address),
      operatingHours: hours,
      closedDays: hours.filter((h) => !h.open).map((h) => h.day),
      rooms: rooms.map(roomDto),
      roomTypes: [...new Set(rooms.map((r) => r.roomType))].map((value) => ({ value, label: labelOf('roomType', value) })),
      packages,
      doctors: doctors.map((d) => doctorCard(d)),
      reviews: reviews.map(reviewDto)
    }
  });
};

const ensureHospital = async (id: string) => {
  const hospital = await prisma.hospital.findFirst({ where: { id, isActive: true }, select: { id: true } });
  if (!hospital) throw notFound('Hospital not found.');
};

/** ChargeRoom tab / ChooseRoom: rooms, optionally filtered by room-type chip. */
export const listHospitalRooms = async (req: Request, res: Response) => {
  const id = idParam(req);
  const { roomType } = parse(z.object({ roomType: z.enum(enumValues('roomType')).optional() }), req.query);
  await ensureHospital(id);
  const rooms = await prisma.hospitalRoom.findMany({
    where: { hospitalId: id, ...(roomType ? { roomType } : {}) },
    orderBy: { feePerDay: 'asc' }
  });
  res.status(200).json({ message: 'Rooms fetched successfully.', code: 200, data: rooms.map(roomDto) });
};

/** ChooseDoctor ("Hire me") in the hospital booking flow. */
export const listHospitalDoctors = async (req: Request, res: Response) => {
  const id = idParam(req);
  const { page, limit, skip, take } = getPagination(req);
  await ensureHospital(id);
  const where = { isActive: true, hospitals: { some: { id } } };
  const [total, doctors] = await Promise.all([
    prisma.doctor.count({ where }),
    prisma.doctor.findMany({ where, orderBy: [{ ratingAvg: 'desc' }], skip, take, select: doctorCardSelect })
  ]);
  res.status(200).json({
    message: 'Doctors fetched successfully.',
    code: 200,
    data: doctors.map((d) => doctorCard(d)),
    pagination: pageMeta(page, limit, total)
  });
};

export const listHospitalReviews = async (req: Request, res: Response) => {
  const id = idParam(req);
  const { page, limit, skip, take } = getPagination(req);
  const [total, reviews] = await Promise.all([
    prisma.review.count({ where: { hospitalId: id } }),
    prisma.review.findMany({ where: { hospitalId: id }, orderBy: { createdAt: 'desc' }, skip, take, include: reviewInclude })
  ]);
  res.status(200).json({
    message: 'Reviews fetched successfully.',
    code: 200,
    data: reviews.map(reviewDto),
    pagination: pageMeta(page, limit, total)
  });
};

/** Hospital star rating. */
export const createHospitalReview = async (req: Request, res: Response) => {
  const id = idParam(req);
  const { rating, comment } = parse(reviewSchema, req.body);
  await ensureHospital(id);
  const review = await saveReview(currentUserId(req), { hospitalId: id }, rating, comment);
  res.status(201).json({ message: 'Review saved successfully.', code: 201, data: reviewDto(review) });
};

/**
 * CompareHospital -> CompareHospitalDetails: side-by-side doctors, per-day fees by room type,
 * and packages. Pass ?ids=a,b (2 or 3 hospitals) or ?names=name1,name2 (the typed names).
 */
export const compareHospitals = async (req: Request, res: Response) => {
  const { ids, names } = parse(
    z.object({ ids: idListSchema, names: idListSchema }),
    { ids: req.query.ids, names: req.query.names }
  );

  let hospitalIds = ids;
  if (hospitalIds.length === 0 && names.length > 0) {
    const matches = await Promise.all(
      names.map((name) =>
        prisma.hospital.findFirst({
          where: { isActive: true, name: { contains: name, mode: 'insensitive' } },
          orderBy: { ratingAvg: 'desc' },
          select: { id: true }
        })
      )
    );
    hospitalIds = matches.filter((m): m is { id: string } => Boolean(m)).map((m) => m.id);
  }

  hospitalIds = [...new Set(hospitalIds)];
  if (hospitalIds.length < 2 || hospitalIds.length > 3) {
    throw badRequest('Please provide 2 or 3 hospitals to compare.');
  }

  const hospitals = await prisma.hospital.findMany({
    where: { id: { in: hospitalIds }, isActive: true },
    select: {
      ...hospitalCardSelect,
      rooms: { select: { roomType: true, feePerDay: true } },
      packages: { orderBy: { price: 'asc' }, select: { id: true, name: true, description: true, price: true } },
      doctors: { where: { isActive: true }, take: 10, select: doctorCardSelect }
    }
  });
  if (hospitals.length !== hospitalIds.length) throw notFound('One or more hospitals were not found.');

  const ordered = inOrder(hospitals, hospitalIds);
  const roomTypes = enumValues('roomType').filter((type) => ordered.some((h) => h.rooms.some((r) => r.roomType === type)));

  res.status(200).json({
    message: 'Hospitals compared successfully.',
    code: 200,
    data: {
      roomTypes: roomTypes.map((value) => ({ value, label: labelOf('roomType', value) })),
      hospitals: ordered.map(({ rooms, packages, doctors, ...h }) => ({
        ...hospitalCard(h),
        doctors: doctors.map((d) => doctorCard(d)),
        // Lowest per-day fee for each room type; null when the hospital has no such room.
        feesPerDay: Object.fromEntries(
          roomTypes.map((type) => {
            const fees = rooms.filter((r) => r.roomType === type).map((r) => r.feePerDay);
            return [type, fees.length ? Math.min(...fees) : null];
          })
        ),
        packages
      }))
    }
  });
};
