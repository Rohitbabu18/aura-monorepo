export const WEEK_DAYS = [
  { key: 'monday', label: 'Mon', full: 'Monday' },
  { key: 'tuesday', label: 'Tue', full: 'Tuesday' },
  { key: 'wednesday', label: 'Wed', full: 'Wednesday' },
  { key: 'thursday', label: 'Thu', full: 'Thursday' },
  { key: 'friday', label: 'Fri', full: 'Friday' },
  { key: 'saturday', label: 'Sat', full: 'Saturday' },
  { key: 'sunday', label: 'Sun', full: 'Sunday' },
] as const;

export type WeekDayKey = (typeof WEEK_DAYS)[number]['key'];

export type DayHours = {
  enabled: boolean;
  start: string;
  end: string;
};

export type OperatingHoursData = {
  allDays: boolean;
  startTime: string;
  endTime: string;
  days: Record<WeekDayKey, DayHours>;
};

export const createDefaultOperatingHours = (): OperatingHoursData => {
  const days = WEEK_DAYS.reduce((acc, day) => {
    acc[day.key] = { enabled: false, start: '', end: '' };
    return acc;
  }, {} as Record<WeekDayKey, DayHours>);

  return {
    allDays: false,
    startTime: '',
    endTime: '',
    days
  };
};
