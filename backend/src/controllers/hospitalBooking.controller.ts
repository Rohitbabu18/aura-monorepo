import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.ts';
import {
  badRequest,
  currentUserId,
  dateOnlySchema,
  getPagination,
  idListSchema,
  idParam,
  notFound,
  pageMeta,
  parse
} from '../lib/http.ts';
import { labelOf } from '../lib/meta.ts';
import { doctorCard, doctorCardSelect, hospitalCard, hospitalCardSelect } from '../lib/serializers.ts';
import { fileDto } from '../lib/upload.ts';
import { formatDateOnly, isPastDate, nowInAppTz, toDateOnly } from '../lib/time.ts';
import { connectOwnReports, connectSymptoms, symptomSelect } from '../services/bookingHelpers.ts';
import { notify } from '../services/notify.ts';

const ACTIVE = ['REQUESTED', 'CONFIRMED'] as const;

const bookingInclude = {
  hospital: { select: hospitalCardSelect },
  doctor: { select: doctorCardSelect },
  room: true,
  symptoms: symptomSelect,
  reports: true
} as const;

const loadBooking = (id: string, userId: string) =>
  prisma.hospitalBooking.findFirst({ where: { id, userId }, include: bookingInclude });

type BookingRecord = NonNullable<Awaited<ReturnType<typeof loadBooking>>>;

const bookingDto = (b: BookingRecord) => {
  const admissionDate = formatDateOnly(b.admissionDate);
  const changeable = (ACTIVE as readonly string[]).includes(b.status) && !isPastDate(admissionDate);
  return {
    id: b.id,
    status: b.status,
    statusLabel: labelOf('hospitalBookingStatus', b.status),
    admissionDate,
    hospital: hospitalCard(b.hospital),
    doctor: b.doctor ? doctorCard(b.doctor) : null,
    room: b.room ? { ...b.room, roomTypeLabel: labelOf('roomType', b.room.roomType) } : null,
    symptoms: b.symptoms,
    otherSymptoms: b.otherSymptoms,
    reports: b.reports.map(fileDto),
    cancelledAt: b.cancelledAt,
    cancelReason: b.cancelReason,
    canCancel: changeable,
    canReschedule: changeable,
    createdAt: b.createdAt
  };
};

const futureDate = dateOnlySchema.refine((d) => !isPastDate(d), 'Date cannot be in the past.');

const createSchema = z.object({
  hospitalId: z.string().min(1),
  admissionDate: futureDate,
  symptomIds: idListSchema,
  otherSymptoms: z.string().trim().max(250).optional(),
  doctorId: z.string().min(1).optional(),
  roomId: z.string().min(1).optional(),
  reportIds: idListSchema
});

/** Hospital flow submit (UploadYourReports "Next"): ChooseDate + disease + doctor + room + reports. */
export const createHospitalBooking = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const input = parse(createSchema, req.body);

  const hospital = await prisma.hospital.findFirst({
    where: { id: input.hospitalId, isActive: true },
    select: { id: true, name: true }
  });
  if (!hospital) throw notFound('Hospital not found.');

  if (input.doctorId) {
    const doctor = await prisma.doctor.findFirst({
      where: { id: input.doctorId, isActive: true, hospitals: { some: { id: hospital.id } } },
      select: { id: true }
    });
    if (!doctor) throw badRequest('The selected doctor does not practice at this hospital.');
  }
  if (input.roomId) {
    const room = await prisma.hospitalRoom.findFirst({
      where: { id: input.roomId, hospitalId: hospital.id, isAvailable: true },
      select: { id: true }
    });
    if (!room) throw badRequest('The selected room is not available at this hospital.');
  }

  const [symptoms, reports] = await Promise.all([
    connectSymptoms(input.symptomIds),
    connectOwnReports(userId, input.reportIds)
  ]);

  const booking = await prisma.hospitalBooking.create({
    data: {
      userId,
      hospitalId: hospital.id,
      doctorId: input.doctorId,
      roomId: input.roomId,
      admissionDate: toDateOnly(input.admissionDate),
      otherSymptoms: input.otherSymptoms,
      symptoms: { connect: symptoms },
      reports: { connect: reports }
    },
    include: bookingInclude
  });

  await notify(userId, 'HOSPITAL_BOOKING', 'Request received',
    `We have received your request for ${hospital.name} on ${input.admissionDate}. We will inform you shortly.`,
    { hospitalBookingId: booking.id });

  res.status(201).json({ message: 'We have received your request, we will inform you shortly.', code: 201, data: bookingDto(booking) });
};

/** MyAppointments hospital cards (Current / Past). */
export const listHospitalBookings = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const { scope } = parse(z.object({ scope: z.enum(['current', 'past']).default('current') }), req.query);
  const { page, limit, skip, take } = getPagination(req);
  const today = toDateOnly(nowInAppTz().date);

  const where =
    scope === 'current'
      ? { userId, status: { in: [...ACTIVE, 'ADMITTED' as const] }, admissionDate: { gte: today } }
      : {
          userId,
          OR: [{ status: { in: ['COMPLETED', 'CANCELLED', 'REJECTED'] as ('COMPLETED' | 'CANCELLED' | 'REJECTED')[] } }, { admissionDate: { lt: today } }]
        };

  const [total, rows] = await Promise.all([
    prisma.hospitalBooking.count({ where }),
    prisma.hospitalBooking.findMany({
      where,
      orderBy: { admissionDate: scope === 'current' ? 'asc' : 'desc' },
      skip,
      take,
      include: bookingInclude
    })
  ]);

  res.status(200).json({
    message: 'Hospital bookings fetched successfully.',
    code: 200,
    data: rows.map(bookingDto),
    pagination: pageMeta(page, limit, total)
  });
};

export const getHospitalBooking = async (req: Request, res: Response) => {
  const booking = await loadBooking(idParam(req), currentUserId(req));
  if (!booking) throw notFound('Booking not found.');
  res.status(200).json({ message: 'Booking fetched successfully.', code: 200, data: bookingDto(booking) });
};

const assertChangeable = (b: BookingRecord) => {
  if (!(ACTIVE as readonly string[]).includes(b.status)) throw badRequest('This booking can no longer be changed.');
  if (isPastDate(formatDateOnly(b.admissionDate))) throw badRequest('This booking date has already passed.');
};

export const cancelHospitalBooking = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const id = idParam(req);
  const { reason } = parse(z.object({ reason: z.string().trim().max(250).optional() }), req.body ?? {});
  const booking = await loadBooking(id, userId);
  if (!booking) throw notFound('Booking not found.');
  assertChangeable(booking);

  await prisma.hospitalBooking.update({
    where: { id },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason ?? 'Cancelled by patient.' }
  });
  await notify(userId, 'HOSPITAL_BOOKING', 'Booking cancelled',
    `Your booking at ${booking.hospital.name} on ${formatDateOnly(booking.admissionDate)} has been cancelled.`,
    { hospitalBookingId: id });

  const updated = await loadBooking(id, userId);
  res.status(200).json({ message: 'Your booking has been cancelled.', code: 200, data: bookingDto(updated!) });
};

const rescheduleSchema = z.object({
  admissionDate: futureDate,
  symptomIds: idListSchema.optional(),
  otherSymptoms: z.string().trim().max(250).optional()
});

/** Hospital card "Reschedule" -> RescheduleSymptom -> RescheduleDate. */
export const rescheduleHospitalBooking = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const id = idParam(req);
  const input = parse(rescheduleSchema, req.body);
  const booking = await loadBooking(id, userId);
  if (!booking) throw notFound('Booking not found.');
  assertChangeable(booking);

  const symptoms = input.symptomIds ? await connectSymptoms(input.symptomIds) : undefined;
  await prisma.hospitalBooking.update({
    where: { id },
    data: {
      admissionDate: toDateOnly(input.admissionDate),
      // A new date needs the hospital to confirm again.
      status: 'REQUESTED',
      ...(symptoms ? { symptoms: { set: symptoms } } : {}),
      ...(input.otherSymptoms !== undefined ? { otherSymptoms: input.otherSymptoms } : {})
    }
  });
  await notify(userId, 'HOSPITAL_BOOKING', 'Booking rescheduled',
    `Your booking at ${booking.hospital.name} has been moved to ${input.admissionDate}.`,
    { hospitalBookingId: id });

  const updated = await loadBooking(id, userId);
  res.status(200).json({ message: 'Booking rescheduled.', code: 200, data: bookingDto(updated!) });
};
