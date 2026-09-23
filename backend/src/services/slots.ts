import { prisma } from '../lib/prisma.ts';
import {
  addDays,
  dayOfWeek,
  isPastSlot,
  minutesToTime,
  nowInAppTz,
  slotPeriod,
  timeToMinutes,
  toDateOnly
} from '../lib/time.ts';

// Unpaid bookings hold their slot for this long before being released.
export const PAYMENT_HOLD_MINUTES = Number(process.env.PAYMENT_HOLD_MINUTES || 15);

export const slotLockKey = (doctorId: string, date: string, time: string) => `${doctorId}|${date}|${time}`;

/** Cancels PENDING_PAYMENT appointments whose hold expired so their slots become bookable again. */
export const releaseStaleHolds = async (doctorId?: string) => {
  const cutoff = new Date(Date.now() - PAYMENT_HOLD_MINUTES * 60 * 1000);
  const stale = await prisma.appointment.findMany({
    where: { status: 'PENDING_PAYMENT', createdAt: { lt: cutoff }, ...(doctorId ? { doctorId } : {}) },
    select: { id: true }
  });
  if (stale.length === 0) return;
  const ids = stale.map((a) => a.id);
  await prisma.$transaction([
    prisma.appointment.updateMany({
      where: { id: { in: ids }, status: 'PENDING_PAYMENT' },
      data: { status: 'CANCELLED', slotLock: null, cancelledAt: new Date(), cancelReason: 'Payment not completed in time.' }
    }),
    prisma.payment.updateMany({
      where: { appointmentId: { in: ids }, status: 'PENDING' },
      data: { status: 'CANCELLED' }
    })
  ]);
};

export type Slot = {
  time: string;
  endTime: string;
  period: ReturnType<typeof slotPeriod>;
  available: boolean;
};

/** Generates the day's slots from DoctorAvailability windows, marking booked or past ones unavailable. */
export const getDoctorSlots = async (doctorId: string, date: string, ignoreAppointmentId?: string) => {
  await releaseStaleHolds(doctorId);

  const [windows, booked] = await Promise.all([
    prisma.doctorAvailability.findMany({
      where: { doctorId, dayOfWeek: dayOfWeek(date) },
      orderBy: { startTime: 'asc' }
    }),
    prisma.appointment.findMany({
      where: {
        doctorId,
        date: toDateOnly(date),
        slotLock: { not: null },
        ...(ignoreAppointmentId ? { id: { not: ignoreAppointmentId } } : {})
      },
      select: { startTime: true }
    })
  ]);

  const bookedTimes = new Set(booked.map((a) => a.startTime));
  const slots = new Map<string, Slot>();

  for (const window of windows) {
    const end = timeToMinutes(window.endTime);
    const step = Math.max(5, window.slotMinutes);
    for (let start = timeToMinutes(window.startTime); start + step <= end; start += step) {
      const time = minutesToTime(start);
      if (slots.has(time)) continue;
      slots.set(time, {
        time,
        endTime: minutesToTime(start + step),
        period: slotPeriod(start),
        available: !bookedTimes.has(time) && !isPastSlot(date, time)
      });
    }
  }

  return [...slots.values()].sort((a, b) => a.time.localeCompare(b.time));
};

export const groupSlots = (slots: Slot[]) => {
  const periods = ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'] as const;
  return periods
    .map((period) => {
      const items = slots.filter((s) => s.period === period);
      return { period, total: items.length, available: items.filter((s) => s.available).length, slots: items };
    })
    .filter((group) => group.total > 0);
};

/** The date strip on TimeSloat screens: next N days with whether the doctor works that day. */
export const getAvailableDates = async (doctorId: string, days: number, from?: string) => {
  const start = from && from > nowInAppTz().date ? from : nowInAppTz().date;
  const windows = await prisma.doctorAvailability.findMany({ where: { doctorId }, select: { dayOfWeek: true } });
  const workingDays = new Set(windows.map((w) => w.dayOfWeek));
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(start, index);
    return { date, dayOfWeek: dayOfWeek(date), hasAvailability: workingDays.has(dayOfWeek(date)) };
  });
};
