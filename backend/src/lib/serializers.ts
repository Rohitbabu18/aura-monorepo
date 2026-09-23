import { labelOf } from './meta.ts';

type LocationLike = { latitude: string; longitude: string } | null | undefined;
type AddressLike =
  | {
      complete?: string | null;
      city?: string | null;
      state?: string | null;
      country?: string | null;
      pincode?: number | null;
      location?: LocationLike;
    }
  | null
  | undefined;

export const addressDto = (address: AddressLike) => {
  if (!address) return null;
  const lat = address.location ? Number(address.location.latitude) : NaN;
  const lng = address.location ? Number(address.location.longitude) : NaN;
  return {
    complete: address.complete ?? null,
    city: address.city ?? null,
    state: address.state ?? null,
    country: address.country ?? null,
    pincode: address.pincode ?? null,
    location: Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null
  };
};

/** Prisma include for an address with its location, without internal ids. */
export const addressInclude = {
  select: {
    complete: true,
    city: true,
    state: true,
    country: true,
    pincode: true,
    location: { select: { latitude: true, longitude: true } }
  }
} as const;

export const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const distanceFrom = (origin: { lat: number; lng: number } | null, address: AddressLike) => {
  const dto = addressDto(address);
  if (!origin || !dto?.location) return null;
  return Math.round(haversineKm(origin.lat, origin.lng, dto.location.latitude, dto.location.longitude) * 10) / 10;
};

const round1 = (value: number) => Math.round(value * 10) / 10;

export const doctorCardSelect = {
  id: true,
  name: true,
  avatarUrl: true,
  degree: true,
  specialization: true,
  experience: true,
  clinicName: true,
  consultationFee: true,
  ratingAvg: true,
  ratingCount: true,
  isFeatured: true,
  isAuraSpecialist: true,
  address: addressInclude
} as const;

type DoctorCardLike = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  degree: string | null;
  specialization: string | null;
  experience: string | null;
  clinicName: string | null;
  consultationFee: number | null;
  ratingAvg: number;
  ratingCount: number;
  isFeatured: boolean;
  isAuraSpecialist: boolean;
  address?: AddressLike;
};

export const doctorCard = (
  doctor: DoctorCardLike,
  extra: { isFavourite?: boolean; distanceKm?: number | null } = {}
) => ({
  id: doctor.id,
  name: doctor.name,
  avatarUrl: doctor.avatarUrl,
  degree: doctor.degree,
  specialization: doctor.specialization,
  experience: doctor.experience,
  clinicName: doctor.clinicName,
  consultationFee: doctor.consultationFee,
  rating: round1(doctor.ratingAvg),
  ratingCount: doctor.ratingCount,
  isFeatured: doctor.isFeatured,
  isAuraSpecialist: doctor.isAuraSpecialist,
  address: addressDto(doctor.address),
  ...extra
});

export const hospitalCardSelect = {
  id: true,
  name: true,
  role: true,
  coverImageUrl: true,
  phone: true,
  ratingAvg: true,
  ratingCount: true,
  emergencyAvailable: true,
  ambulanceAvailable: true,
  address: addressInclude
} as const;

type HospitalCardLike = {
  id: string;
  name: string;
  role: string;
  coverImageUrl: string | null;
  phone: string | null;
  ratingAvg: number;
  ratingCount: number;
  emergencyAvailable: boolean | null;
  ambulanceAvailable: boolean | null;
  address?: AddressLike;
};

export const hospitalCard = (hospital: HospitalCardLike, extra: { distanceKm?: number | null } = {}) => ({
  id: hospital.id,
  name: hospital.name,
  role: hospital.role,
  coverImageUrl: hospital.coverImageUrl,
  phone: hospital.phone,
  rating: round1(hospital.ratingAvg),
  ratingCount: hospital.ratingCount,
  emergencyAvailable: hospital.emergencyAvailable,
  ambulanceAvailable: hospital.ambulanceAvailable,
  address: addressDto(hospital.address),
  ...extra
});

const WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

/** OperatingData columns -> [{ day, open, start, end }] */
export const operatingHoursDto = (data: Record<string, unknown> | null | undefined) =>
  data
    ? WEEK.map((day) => ({
        day,
        open: Boolean(data[`${day}Enabled`]),
        start: (data[`${day}Start`] as string | null) ?? null,
        end: (data[`${day}End`] as string | null) ?? null
      }))
    : [];

export const reviewDto = (review: {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  user: { id: string; name: string | null; avatarUrl: string | null };
}) => ({
  id: review.id,
  rating: review.rating,
  comment: review.comment,
  createdAt: review.createdAt,
  user: { id: review.user.id, name: review.user.name, avatarUrl: review.user.avatarUrl }
});

export const reviewInclude = { user: { select: { id: true, name: true, avatarUrl: true } } } as const;

export const labelled = (group: Parameters<typeof labelOf>[0], value: string | null | undefined) =>
  value ? { value, label: labelOf(group, value) } : null;
