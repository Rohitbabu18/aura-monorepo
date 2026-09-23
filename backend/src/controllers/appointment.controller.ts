import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.ts';
import {
  badRequest,
  conflict,
  currentUserId,
  dateOnlySchema,
  getPagination,
  idListSchema,
  idParam,
  notFound,
  pageMeta,
  parse,
  phoneSchema,
  timeSchema
} from '../lib/http.ts';
import { labelOf } from '../lib/meta.ts';
import { addressDto, doctorCard, doctorCardSelect } from '../lib/serializers.ts';
import { fileDto } from '../lib/upload.ts';
import { formatDateOnly, isPastSlot, nowInAppTz, toDateOnly } from '../lib/time.ts';
import { getDoctorSlots, releaseStaleHolds, slotLockKey } from '../services/slots.ts';
import { connectOwnReports, connectSymptoms, symptomSelect } from '../services/bookingHelpers.ts';
import { chargePayment } from '../services/payments.ts';
import { notify } from '../services/notify.ts';

const ACTIVE = ['PENDING_PAYMENT', 'CONFIRMED'] as const;

const appointmentInclude = {
  doctor: { select: { ...doctorCardSelect, phone: true } },
  symptoms: symptomSelect,
  reports: true,
  payment: { select: { id: true, status: true, amount: true, currency: true, paidAt: true } }
} as const;

type AppointmentRecord = NonNullable<Awaited<ReturnType<typeof loadAppointment>>>;

const loadAppointment = (id: string, userId: string) =>
  prisma.appointment.findFirst({ where: { id, userId }, include: appointmentInclude });

const displayTime = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return `${String(((h + 11) % 12) + 1).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

const appointmentDto = (a: AppointmentRecord) => {
  const date = formatDateOnly(a.date);
  const active = (ACTIVE as readonly string[]).includes(a.status);
  const upcoming = active && !isPastSlot(date, a.startTime);
  return {
    id: a.id,
    status: a.status,
    statusLabel: labelOf('appointmentStatus', a.status),
    date,
    startTime: a.startTime,
    endTime: a.endTime,
    displayTime: displayTime(a.startTime),
    doctor: { ...doctorCard(a.doctor), phone: a.doctor.phone },
    clinicName: a.doctor.clinicName,
    clinicAddress: addressDto(a.doctor.address),
    fee: a.fee,
    symptoms: a.symptoms,
    otherSymptoms: a.otherSymptoms,
    comment: a.comment,
    forSelf: a.forSelf,
    patient: a.forSelf ? null : { name: a.patientName, phone: a.patientPhone, email: a.patientEmail },
    reports: a.reports.map(fileDto),
    payment: a.payment,
    rescheduleCount: a.rescheduleCount,
    cancelledAt: a.cancelledAt,
    cancelReason: a.cancelReason,
    canPay: a.status === 'PENDING_PAYMENT' && upcoming,
    canCancel: upcoming,
    canReschedule: upcoming,
    createdAt: a.createdAt
  };
};

/** Throws unless `time` is a real, free, future slot for the doctor on `date`. */
const assertSlotBookable = async (doctorId: string, date: string, time: string, ignoreAppointmentId?: string) => {
  const slots = await getDoctorSlots(doctorId, date, ignoreAppointmentId);
  const slot = slots.find((s) => s.time === time);
  if (!slot) throw badRequest('The doctor is not available at the selected time.');
  if (!slot.available) throw conflict('This slot is no longer available. Please choose another time.');
  return slot;
};

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';

const createSchema = z
  .object({
    doctorId: z.string().min(1),
    date: dateOnlySchema,
    startTime: timeSchema,
    symptomIds: idListSchema,
    otherSymptoms: z.string().trim().max(250).optional(),
    comment: z.string().trim().max(500).optional(),
    forSelf: z.boolean().default(true),
    patientName: z.string().trim().min(1).max(100).optional(),
    patientPhone: phoneSchema.optional(),
    patientEmail: z.email().trim().optional(),
    reportIds: idListSchema,
    acceptTerms: z.literal(true, { message: 'Please accept terms & conditions.' })
  })
  .refine((v) => v.forSelf || (v.patientName && v.patientPhone), {
    message: 'Patient name and mobile number are required when booking for someone else.',
    path: ['patientName']
  });

/** PatientDetails / PatientDetailsHome "Confirm & Pay": creates the booking and holds the slot. */
export const createAppointment = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const input = parse(createSchema, req.body);

  const doctor = await prisma.doctor.findFirst({
    where: { id: input.doctorId, isActive: true },
    select: { id: true, name: true, consultationFee: true }
  });
  if (!doctor) throw notFound('Doctor not found.');

  const slot = await assertSlotBookable(doctor.id, input.date, input.startTime);
  const [symptoms, reports] = await Promise.all([
    connectSymptoms(input.symptomIds),
    connectOwnReports(userId, input.reportIds)
  ]);
  const fee = doctor.consultationFee ?? 0;

  let appointment;
  try {
    appointment = await prisma.appointment.create({
      data: {
        userId,
        doctorId: doctor.id,
        date: toDateOnly(input.date),
        startTime: slot.time,
        endTime: slot.endTime,
        status: fee > 0 ? 'PENDING_PAYMENT' : 'CONFIRMED',
        forSelf: input.forSelf,
        patientName: input.forSelf ? null : input.patientName,
        patientPhone: input.forSelf ? null : input.patientPhone,
        patientEmail: input.forSelf ? null : input.patientEmail,
        otherSymptoms: input.otherSymptoms,
        comment: input.comment,
        fee,
        slotLock: slotLockKey(doctor.id, input.date, slot.time),
        symptoms: { connect: symptoms },
        reports: { connect: reports },
        ...(fee > 0
          ? { payment: { create: { userId, purpose: 'APPOINTMENT', title: 'Appointment Booking Charge', amount: fee } } }
          : {})
      },
      include: appointmentInclude
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict('This slot was just booked. Please choose another time.');
    throw error;
  }

  if (appointment.status === 'CONFIRMED') {
    await notify(userId, 'APPOINTMENT', 'Appointment booked',
      `Your appointment with ${doctor.name ?? 'the doctor'} on ${input.date} at ${displayTime(slot.time)} is confirmed.`,
      { appointmentId: appointment.id });
  }

  res.status(201).json({ message: 'Appointment created successfully.', code: 201, data: appointmentDto(appointment) });
};

/** Completes payment for a PENDING_PAYMENT appointment and confirms it. */
export const payAppointment = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const id = idParam(req);
  await releaseStaleHolds();

  const appointment = await loadAppointment(id, userId);
  if (!appointment) throw notFound('Appointment not found.');
  if (appointment.status !== 'PENDING_PAYMENT' || !appointment.payment) {
    throw badRequest('This appointment is not awaiting payment.');
  }

  const result = await chargePayment(appointment.payment);
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: appointment.payment.id },
      data: { status: result.status, provider: result.provider, providerRef: result.providerRef, paidAt: new Date() }
    }),
    prisma.appointment.update({ where: { id }, data: { status: 'CONFIRMED' } })
  ]);

  const date = formatDateOnly(appointment.date);
  await notify(userId, 'APPOINTMENT', 'Appointment booked',
    `Your appointment with ${appointment.doctor.name ?? 'the doctor'} on ${date} at ${displayTime(appointment.startTime)} is confirmed.`,
    { appointmentId: id });

  const updated = await loadAppointment(id, userId);
  res.status(200).json({ message: 'Payment successful.', code: 200, data: appointmentDto(updated!) });
};

/** MyAppointments Current / Past toggle. */
export const listAppointments = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const { scope } = parse(z.object({ scope: z.enum(['current', 'past']).default('current') }), req.query);
  const { page, limit, skip, take } = getPagination(req);
  await releaseStaleHolds();

  const today = toDateOnly(nowInAppTz().date);
  const where =
    scope === 'current'
      ? { userId, status: { in: [...ACTIVE] }, date: { gte: today } }
      : { userId, OR: [{ status: { notIn: [...ACTIVE] } }, { date: { lt: today } }] };

  const [total, rows] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      orderBy: scope === 'current' ? [{ date: 'asc' }, { startTime: 'asc' }] : [{ date: 'desc' }, { startTime: 'desc' }],
      skip,
      take,
      include: appointmentInclude
    })
  ]);

  res.status(200).json({
    message: 'Appointments fetched successfully.',
    code: 200,
    data: rows.map(appointmentDto),
    pagination: pageMeta(page, limit, total)
  });
};

/** CurrentAppointInfo */
export const getAppointment = async (req: Request, res: Response) => {
  const appointment = await loadAppointment(idParam(req), currentUserId(req));
  if (!appointment) throw notFound('Appointment not found.');
  res.status(200).json({ message: 'Appointment fetched successfully.', code: 200, data: appointmentDto(appointment) });
};

const assertChangeable = (a: AppointmentRecord) => {
  if (!(ACTIVE as readonly string[]).includes(a.status)) throw badRequest('This appointment can no longer be changed.');
  if (isPastSlot(formatDateOnly(a.date), a.startTime)) throw badRequest('This appointment time has already passed.');
};

/** CurrentAppointInfo "Cancel Appointment". Refunds of paid bookings are processed separately. */
export const cancelAppointment = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const id = idParam(req);
  const { reason } = parse(z.object({ reason: z.string().trim().max(250).optional() }), req.body ?? {});

  const appointment = await loadAppointment(id, userId);
  if (!appointment) throw notFound('Appointment not found.');
  assertChangeable(appointment);

  await prisma.$transaction([
    prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED', slotLock: null, cancelledAt: new Date(), cancelReason: reason ?? 'Cancelled by patient.' }
    }),
    prisma.payment.updateMany({ where: { appointmentId: id, status: 'PENDING' }, data: { status: 'CANCELLED' } })
  ]);

  await notify(userId, 'APPOINTMENT', 'Appointment cancelled',
    `Your appointment with ${appointment.doctor.name ?? 'the doctor'} on ${formatDateOnly(appointment.date)} at ${displayTime(appointment.startTime)} has been cancelled.`,
    { appointmentId: id });

  const updated = await loadAppointment(id, userId);
  res.status(200).json({ message: 'Your booking has been cancelled.', code: 200, data: appointmentDto(updated!) });
};

const rescheduleSchema = z.object({
  date: dateOnlySchema,
  startTime: timeSchema,
  symptomIds: idListSchema.optional(),
  otherSymptoms: z.string().trim().max(250).optional()
});

/** RescheduleSymptom -> RescheduleDate -> RescheduleTimeSloat. */
export const rescheduleAppointment = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const id = idParam(req);
  const input = parse(rescheduleSchema, req.body);

  const appointment = await loadAppointment(id, userId);
  if (!appointment) throw notFound('Appointment not found.');
  assertChangeable(appointment);

  const slot = await assertSlotBookable(appointment.doctorId, input.date, input.startTime, id);
  const symptoms = input.symptomIds ? await connectSymptoms(input.symptomIds) : undefined;

  try {
    await prisma.appointment.update({
      where: { id },
      data: {
        date: toDateOnly(input.date),
        startTime: slot.time,
        endTime: slot.endTime,
        slotLock: slotLockKey(appointment.doctorId, input.date, slot.time),
        rescheduleCount: { increment: 1 },
        ...(symptoms ? { symptoms: { set: symptoms } } : {}),
        ...(input.otherSymptoms !== undefined ? { otherSymptoms: input.otherSymptoms } : {})
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict('This slot was just booked. Please choose another time.');
    throw error;
  }

  await notify(userId, 'APPOINTMENT', 'Appointment rescheduled',
    `Your appointment with ${appointment.doctor.name ?? 'the doctor'} has been rescheduled to ${input.date} at ${displayTime(slot.time)}.`,
    { appointmentId: id });

  const updated = await loadAppointment(id, userId);
  res.status(200).json({ message: 'Appointment rescheduled.', code: 200, data: appointmentDto(updated!) });
};

/** CurrentAppointInfo "Reports" (+): attach already-uploaded reports. */
export const attachAppointmentReports = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const id = idParam(req);
  const { reportIds } = parse(z.object({ reportIds: idListSchema }), req.body);
  if (reportIds.length === 0) throw badRequest('reportIds is required.');

  const appointment = await loadAppointment(id, userId);
  if (!appointment) throw notFound('Appointment not found.');

  const reports = await connectOwnReports(userId, reportIds);
  await prisma.appointment.update({ where: { id }, data: { reports: { connect: reports } } });

  const updated = await loadAppointment(id, userId);
  res.status(200).json({ message: 'Reports attached.', code: 200, data: appointmentDto(updated!) });
};

export const detachAppointmentReport = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const id = idParam(req);
  const reportId = idParam(req, 'reportId');
  const appointment = await loadAppointment(id, userId);
  if (!appointment) throw notFound('Appointment not found.');
  await prisma.appointment.update({ where: { id }, data: { reports: { disconnect: { id: reportId } } } });
  const updated = await loadAppointment(id, userId);
  res.status(200).json({ message: 'Report removed.', code: 200, data: appointmentDto(updated!) });
};
