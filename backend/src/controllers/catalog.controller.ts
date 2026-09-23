import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.ts';
import { parse } from '../lib/http.ts';
import { metaOptions, LABELS } from '../lib/meta.ts';
import { doctorCard, doctorCardSelect, hospitalCard, hospitalCardSelect } from '../lib/serializers.ts';

/** Every dropdown / chip / radio option list the app renders, with labels. */
export const getMeta = (_req: Request, res: Response) => {
  res.status(200).json({ message: 'Meta fetched successfully.', code: 200, data: metaOptions() });
};

const bannerDto = (b: { id: string; title: string | null; imageUrl: string; target: string; targetId: string | null; url: string | null }) => ({
  id: b.id,
  title: b.title,
  imageUrl: b.imageUrl,
  target: b.target,
  targetId: b.targetId,
  url: b.url
});

const activeBanners = (placement: string) =>
  prisma.banner.findMany({ where: { placement, isActive: true }, orderBy: { sortOrder: 'asc' } });

/** Home tab: banners, platform stats, top hospitals, top + Aura specialists, unread badge. */
export const getHome = async (req: Request, res: Response) => {
  const userId = req.auth?.userId;
  const doctorWhere = { isActive: true };

  const [slider, explore, users, doctors, hospitals, topHospitals, topSpecialists, auraSpecialists, unread, user, favourites] =
    await Promise.all([
      activeBanners('HOME_SLIDER'),
      activeBanners('HOME_EXPLORE'),
      prisma.user.count(),
      prisma.doctor.count({ where: doctorWhere }),
      prisma.hospital.count({ where: { isActive: true } }),
      prisma.hospital.findMany({
        where: { isActive: true },
        orderBy: [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }],
        take: 10,
        select: hospitalCardSelect
      }),
      prisma.doctor.findMany({
        where: { ...doctorWhere, isFeatured: true },
        orderBy: [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }],
        take: 10,
        select: doctorCardSelect
      }),
      prisma.doctor.findMany({
        where: { ...doctorWhere, isAuraSpecialist: true },
        orderBy: [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }],
        take: 10,
        select: doctorCardSelect
      }),
      userId ? prisma.notification.count({ where: { userId, readAt: null } }) : Promise.resolve(0),
      userId
        ? prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, avatarUrl: true, address: { select: { complete: true, city: true } } }
          })
        : Promise.resolve(null),
      userId
        ? prisma.favouriteDoctor.findMany({ where: { userId }, select: { doctorId: true } })
        : Promise.resolve([])
    ]);

  const favSet = new Set(favourites.map((f) => f.doctorId));
  const card = (d: Parameters<typeof doctorCard>[0]) => doctorCard(d, { isFavourite: favSet.has(d.id) });

  res.status(200).json({
    message: 'Home fetched successfully.',
    code: 200,
    data: {
      user: user
        ? { name: user.name, avatarUrl: user.avatarUrl, location: user.address?.city ?? user.address?.complete ?? null }
        : null,
      unreadNotifications: unread,
      banners: slider.map(bannerDto),
      exploreBanners: explore.map(bannerDto),
      stats: { totalUsers: users, totalDoctors: doctors, totalHospitals: hospitals },
      topHospitals: topHospitals.map((h) => hospitalCard(h)),
      topSpecialists: topSpecialists.map(card),
      auraSpecialists: auraSpecialists.map(card)
    }
  });
};

export const listBanners = async (req: Request, res: Response) => {
  const { placement } = parse(z.object({ placement: z.string().default('HOME_EXPLORE') }), req.query);
  const banners = await activeBanners(placement);
  res.status(200).json({ message: 'Banners fetched successfully.', code: 200, data: banners.map(bannerDto) });
};

/** Symptom grid used by ChooseSymptom / MakeAppointment / ChooseTypeofDisease / RescheduleSymptom. */
export const listSymptoms = async (req: Request, res: Response) => {
  const { search } = parse(z.object({ search: z.string().trim().max(50).optional() }), req.query);
  const symptoms = await prisma.symptom.findMany({
    where: { isActive: true, ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}) },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, iconUrl: true }
  });
  res.status(200).json({ message: 'Symptoms fetched successfully.', code: 200, data: symptoms });
};

/** ShareCase "Select specialities" tags. */
export const listSpecialities = async (_req: Request, res: Response) => {
  const specialities = await prisma.speciality.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true }
  });
  res.status(200).json({ message: 'Specialities fetched successfully.', code: 200, data: specialities });
};

/**
 * Public runtime config: support / assistant / help-center phone numbers, doctor-app store URL, etc.
 * Everything in AppConfig is public, so never store secrets there.
 */
export const getConfig = async (_req: Request, res: Response) => {
  const rows = await prisma.appConfig.findMany();
  res.status(200).json({
    message: 'Config fetched successfully.',
    code: 200,
    data: Object.fromEntries(rows.map((r) => [r.key, r.value]))
  });
};

/** Help Center: "I have a issue with" categories and their articles. */
export const listHelpArticles = async (req: Request, res: Response) => {
  const { category } = parse(
    z.object({ category: z.enum(Object.keys(LABELS.helpCategory) as [string, ...string[]]).optional() }),
    req.query
  );
  const articles = await prisma.helpArticle.findMany({
    where: { isActive: true, ...(category ? { category } : {}) },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    select: { id: true, category: true, title: true, content: true }
  });
  res.status(200).json({ message: 'Help articles fetched successfully.', code: 200, data: articles });
};
