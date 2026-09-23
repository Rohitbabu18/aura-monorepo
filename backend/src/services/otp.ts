import { randomInt } from 'node:crypto';
import { prisma } from '../lib/prisma.ts';
import { hashToken } from '../lib/tokenHash.ts';
import { HttpError, badRequest, conflict, notFound } from '../lib/http.ts';
import { signVerificationToken } from '../lib/jwt.ts';

export type OtpPurpose = 'REGISTER' | 'LOGIN' | 'CHANGE_PHONE' | 'RESET_PASSWORD';

const OTP_LENGTH = 4; // OTPVerify / OtpConform / MobileVerify screens use a 4-digit input
const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

const isProduction = () => process.env.NODE_ENV === 'production';

const hashOtp = (phone: string, purpose: OtpPurpose, code: string) =>
  hashToken(`${phone}:${purpose}:${code}:${process.env.JWT_SECRET ?? ''}`);

/**
 * SMS delivery. No provider is wired yet: outside production the code is logged and returned
 * to the caller so the app can be tested end to end.
 */
const deliverOtp = async (phone: string, code: string) => {
  if (process.env.SMS_PROVIDER) {
    throw new HttpError(501, `SMS provider "${process.env.SMS_PROVIDER}" is not implemented yet.`);
  }
  if (isProduction()) {
    throw new HttpError(503, 'OTP delivery is not configured.');
  }
  console.log(`[otp] ${phone}: ${code}`);
};

const assertPhoneEligible = async (phone: string, purpose: OtpPurpose) => {
  const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if ((purpose === 'REGISTER' || purpose === 'CHANGE_PHONE') && user) {
    throw conflict('This phone number is already registered.');
  }
  if ((purpose === 'LOGIN' || purpose === 'RESET_PASSWORD') && !user) {
    throw notFound('No account found for this phone number.');
  }
};

export const sendOtp = async (phone: string, purpose: OtpPurpose) => {
  await assertPhoneEligible(phone, purpose);

  const recent = await prisma.otpCode.findMany({
    where: { phone, purpose, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true }
  });
  if (recent[0] && Date.now() - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new HttpError(429, 'Please wait before requesting another OTP.');
  }
  if (recent.length >= MAX_PER_HOUR) {
    throw new HttpError(429, 'Too many OTP requests. Please try again later.');
  }

  const code = String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
  await prisma.otpCode.create({
    data: {
      phone,
      purpose,
      codeHash: hashOtp(phone, purpose, code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS)
    }
  });
  await deliverOtp(phone, code);

  return {
    expiresInSeconds: OTP_TTL_MS / 1000,
    ...(isProduction() ? {} : { devCode: code })
  };
};

export const verifyOtp = async (phone: string, purpose: OtpPurpose, code: string) => {
  const otp = await prisma.otpCode.findFirst({
    where: { phone, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' }
  });

  if (!otp) throw badRequest('OTP expired. Please request a new one.');
  if (otp.attempts >= MAX_ATTEMPTS) throw new HttpError(429, 'Too many attempts. Please request a new OTP.');

  if (otp.codeHash !== hashOtp(phone, purpose, code)) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw badRequest('Invalid OTP.');
  }

  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  return { verificationToken: signVerificationToken(phone, purpose) };
};
