import type { Request, Response } from 'express';
import { z } from 'zod';
import { parse, phoneSchema } from '../lib/http.ts';
import { sendOtp, verifyOtp } from '../services/otp.ts';

const purposeSchema = z.enum(['REGISTER', 'LOGIN', 'CHANGE_PHONE', 'RESET_PASSWORD']);

const sendSchema = z.object({ phone: phoneSchema, purpose: purposeSchema });
const verifySchema = sendSchema.extend({
  code: z.string().trim().regex(/^\d{4}$/, 'Please enter the 4 digit OTP.')
});

/** Verification / EditMobileVerify / "Try Other Way?" screens; also "Resend OTP". */
export const requestOtp = async (req: Request, res: Response) => {
  const { phone, purpose } = parse(sendSchema, req.body);
  const data = await sendOtp(phone, purpose);
  res.status(200).json({ message: 'OTP sent successfully.', code: 200, data });
};

/** OTPVerify / OtpConform / MobileVerify screens. Returns a verificationToken for the next step. */
export const confirmOtp = async (req: Request, res: Response) => {
  const { phone, purpose, code } = parse(verifySchema, req.body);
  const data = await verifyOtp(phone, purpose, code);
  res.status(200).json({ message: 'OTP verified successfully.', code: 200, data });
};
