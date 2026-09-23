import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.ts';
import { currentUserId, getPagination, pageMeta, parse } from '../lib/http.ts';
import { labelOf } from '../lib/meta.ts';

/** Drawer "Payment History". */
export const listPayments = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const { status } = parse(
    z.object({ status: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED']).optional() }),
    req.query
  );
  const { page, limit, skip, take } = getPagination(req);
  const where = { userId, ...(status ? { status } : {}) };

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: {
        id: true,
        title: true,
        purpose: true,
        amount: true,
        currency: true,
        status: true,
        paidAt: true,
        createdAt: true,
        appointmentId: true,
        hospitalBookingId: true
      }
    })
  ]);

  res.status(200).json({
    message: 'Payments fetched successfully.',
    code: 200,
    data: payments.map((p) => ({ ...p, statusLabel: labelOf('paymentStatus', p.status) })),
    pagination: pageMeta(page, limit, total)
  });
};
