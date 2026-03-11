type OperatingHoursInput = {
  allDays?: boolean;
  startTime?: string;
  endTime?: string;
  days?: Array<{
    day?: string;
    enabled?: boolean;
    startTime?: string;
    endTime?: string;
  }>;
};

type NormalizedOperatingData = {
  visitingHours?: string;
  mondayEnabled?: boolean;
  mondayStart?: string;
  mondayEnd?: string;
  tuesdayEnabled?: boolean;
  tuesdayStart?: string;
  tuesdayEnd?: string;
  wednesdayEnabled?: boolean;
  wednesdayStart?: string;
  wednesdayEnd?: string;
  thursdayEnabled?: boolean;
  thursdayStart?: string;
  thursdayEnd?: string;
  fridayEnabled?: boolean;
  fridayStart?: string;
  fridayEnd?: string;
  saturdayEnabled?: boolean;
  saturdayStart?: string;
  saturdayEnd?: string;
  sundayEnabled?: boolean;
  sundayStart?: string;
  sundayEnd?: string;
};

const WEEK_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
];

const DAY_FIELD_MAP = {
  monday: { enabled: 'mondayEnabled', start: 'mondayStart', end: 'mondayEnd' },
  tuesday: { enabled: 'tuesdayEnabled', start: 'tuesdayStart', end: 'tuesdayEnd' },
  wednesday: { enabled: 'wednesdayEnabled', start: 'wednesdayStart', end: 'wednesdayEnd' },
  thursday: { enabled: 'thursdayEnabled', start: 'thursdayStart', end: 'thursdayEnd' },
  friday: { enabled: 'fridayEnabled', start: 'fridayStart', end: 'fridayEnd' },
  saturday: { enabled: 'saturdayEnabled', start: 'saturdayStart', end: 'saturdayEnd' },
  sunday: { enabled: 'sundayEnabled', start: 'sundayStart', end: 'sundayEnd' },
} as const;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const normalizeOperatingHours = (
  input: unknown
): NormalizedOperatingData | null => {
  if (!input) return null;

  if (typeof input === 'string') {
    const trimmed = input.trim();
    return trimmed ? { visitingHours: trimmed } : null;
  }

  if (typeof input !== 'object') return null;

  const data = input as OperatingHoursInput;
  const allDays = Boolean(data.allDays);
  const startTime = isNonEmptyString(data.startTime) ? data.startTime : undefined;
  const endTime = isNonEmptyString(data.endTime) ? data.endTime : undefined;
  const days = Array.isArray(data.days) ? data.days : [];

  if (!allDays && days.length === 0) {
    return null;
  }

  const normalized: NormalizedOperatingData = {};
  let anyEnabled = false;

  WEEK_DAYS.forEach((dayKey) => {
    const fields = DAY_FIELD_MAP[dayKey as keyof typeof DAY_FIELD_MAP];
    normalized[fields.enabled] = false;
  });

  if (allDays && startTime && endTime) {
    WEEK_DAYS.forEach((dayKey) => {
      const fields = DAY_FIELD_MAP[dayKey as keyof typeof DAY_FIELD_MAP];
      normalized[fields.enabled] = true;
      normalized[fields.start] = startTime;
      normalized[fields.end] = endTime;
    });
    return normalized;
  }

  days.forEach((day) => {
    const dayKey = isNonEmptyString(day?.day) ? day.day.toLowerCase() : '';
    if (!WEEK_DAYS.includes(dayKey)) return;
    const fields = DAY_FIELD_MAP[dayKey as keyof typeof DAY_FIELD_MAP];
    const enabled = Boolean(day?.enabled);
    normalized[fields.enabled] = enabled;
    if (enabled) {
      if (isNonEmptyString(day?.startTime)) {
        normalized[fields.start] = day.startTime;
      }
      if (isNonEmptyString(day?.endTime)) {
        normalized[fields.end] = day.endTime;
      }
      anyEnabled = true;
    }
  });

  return anyEnabled ? normalized : null;
};
