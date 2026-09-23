import jwt from 'jsonwebtoken';

type AccessJwtPayload = {
  sub: string;
  role: 'user';
  sid: string;
  email?: string | null;
  phone?: string | null;
};

type RefreshJwtPayload = {
  sub: string;
  sid: string;
  type: 'refresh';
};

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured in environment variables.');
  }
  return secret;
};

const getRefreshSecret = () => process.env.JWT_REFRESH_SECRET || getJwtSecret();

const parseDurationToMs = (input: string) => {
  const value = input.trim();
  const match = value.match(/^(\d+)([smhd])$/i);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return amount * multipliers[unit];
};

export const signUserAccessToken = (payload: AccessJwtPayload) => {
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
  const token = jwt.sign(payload, getJwtSecret(), { expiresIn });
  return {
    token,
    tokenType: 'Bearer',
    expiresIn
  };
};

export const signUserRefreshToken = (payload: Omit<RefreshJwtPayload, 'type'>) => {
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  const token = jwt.sign(
    {
      ...payload,
      type: 'refresh'
    },
    getRefreshSecret(),
    { expiresIn }
  );

  return {
    token,
    tokenType: 'Bearer',
    expiresIn,
    expiresAt: new Date(Date.now() + parseDurationToMs(expiresIn))
  };
};

export const verifyUserRefreshToken = (token: string): RefreshJwtPayload => {
  const payload = jwt.verify(token, getRefreshSecret());
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid refresh token payload.');
  }

  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type.');
  }

  return payload as RefreshJwtPayload;
};

export type AccessTokenClaims = AccessJwtPayload;

export const verifyUserAccessToken = (token: string): AccessJwtPayload => {
  const payload = jwt.verify(token, getJwtSecret());
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid access token payload.');
  }

  // Refresh / verification tokens may share the same secret: never accept them as access tokens.
  if (payload.type !== undefined || payload.role !== 'user') {
    throw new Error('Invalid token type.');
  }

  return payload as AccessJwtPayload;
};

type VerificationJwtPayload = {
  phone: string;
  purpose: string;
  type: 'verification';
};

// Short-lived proof that a phone number passed OTP verification for a given purpose.
export const signVerificationToken = (phone: string, purpose: string) => {
  const expiresIn = process.env.OTP_VERIFICATION_EXPIRES_IN || '15m';
  return jwt.sign({ phone, purpose, type: 'verification' }, getJwtSecret(), { expiresIn }) as string;
};

export const verifyVerificationToken = (token: string): VerificationJwtPayload => {
  const payload = jwt.verify(token, getJwtSecret());
  if (!payload || typeof payload !== 'object' || payload.type !== 'verification') {
    throw new Error('Invalid verification token.');
  }
  return payload as VerificationJwtPayload;
};
