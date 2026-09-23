import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { HttpError, unauthorized } from '../lib/http.ts';

/**
 * Guards back-office endpoints with a shared key (header "x-admin-key").
 * Disabled unless ADMIN_API_KEY is set. Replace with real staff accounts before opening an admin panel.
 */
export const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) throw new HttpError(503, 'Admin API is disabled.');
  const given = req.header('x-admin-key') ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw unauthorized('Invalid admin key.');
  next();
};
