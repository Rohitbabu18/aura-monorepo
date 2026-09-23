// Calendar helpers. Appointment dates are stored as DATE columns and times as local "HH:mm"
// strings in APP_TIMEZONE (default Asia/Kolkata), which is what the app displays.

export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

export const nowInAppTz = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute'))
  };
};

/** "YYYY-MM-DD" -> Date at UTC midnight (the value Prisma stores for @db.Date). */
export const toDateOnly = (value: string) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
};

export const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);

export const addDays = (value: string, days: number) => {
  const date = toDateOnly(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
};

export const dayOfWeek = (value: string) => toDateOnly(value).getUTCDay();

export const timeToMinutes = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
};

export const minutesToTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export type SlotPeriod = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';

export const slotPeriod = (minutes: number): SlotPeriod => {
  if (minutes < 12 * 60) return 'MORNING';
  if (minutes < 17 * 60) return 'AFTERNOON';
  if (minutes < 20 * 60) return 'EVENING';
  return 'NIGHT';
};

/** True when date+time is not strictly in the future (in APP_TIMEZONE). */
export const isPastSlot = (date: string, time: string) => {
  const now = nowInAppTz();
  if (date < now.date) return true;
  if (date > now.date) return false;
  return timeToMinutes(time) <= now.minutes;
};

export const isPastDate = (date: string) => date < nowInAppTz().date;
