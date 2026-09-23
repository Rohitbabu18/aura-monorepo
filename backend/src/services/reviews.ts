import { prisma } from '../lib/prisma.ts';

type Target = { doctorId: string } | { hospitalId: string };

/** Upserts the user's review for a doctor/hospital and refreshes the denormalised rating. */
export const saveReview = async (userId: string, target: Target, rating: number, comment?: string | null) =>
  prisma.$transaction(async (tx) => {
    const where =
      'doctorId' in target
        ? { userId_doctorId: { userId, doctorId: target.doctorId } }
        : { userId_hospitalId: { userId, hospitalId: target.hospitalId } };

    const review = await tx.review.upsert({
      where,
      create: { userId, rating, comment, ...target },
      update: { rating, comment },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } }
    });

    const stats = await tx.review.aggregate({ where: target, _avg: { rating: true }, _count: { _all: true } });
    const ratingData = { ratingAvg: stats._avg.rating ?? 0, ratingCount: stats._count._all };

    if ('doctorId' in target) {
      await tx.doctor.update({ where: { id: target.doctorId }, data: ratingData });
    } else {
      await tx.hospital.update({ where: { id: target.hospitalId }, data: ratingData });
    }
    return review;
  });
