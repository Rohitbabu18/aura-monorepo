import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.ts';
import { verifyUserAccessToken } from '../lib/jwt.ts';
import { unauthorized } from '../lib/http.ts';

const readBearer = (req: Request) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
};

const authenticate = async (token: string) => {
  let claims;
  try {
    claims = verifyUserAccessToken(token);
  } catch {
    throw unauthorized('Invalid or expired access token.');
  }

  // Single active session per user: a login on another device invalidates older tokens.
  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, activeSessionId: true }
  });

  if (!user || user.activeSessionId !== claims.sid) {
    throw unauthorized('Session expired. Please sign in again.');
  }

  return { userId: user.id, sessionId: claims.sid };
};

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const token = readBearer(req);
  if (!token) throw unauthorized();
  req.auth = await authenticate(token);
  next();
};

/** Attaches req.auth when a valid token is present; anonymous requests pass through. */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const token = readBearer(req);
  if (token) {
    try {
      req.auth = await authenticate(token);
    } catch {
      req.auth = undefined;
    }
  }
  next();
};
