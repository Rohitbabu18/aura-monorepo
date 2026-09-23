
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.ts";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { sendError } from "../lib/errorHandler.ts";
import {
  signUserAccessToken,
  signUserRefreshToken,
  verifyUserRefreshToken,
  verifyVerificationToken
} from "../lib/jwt.ts";
import { hashToken } from "../lib/tokenHash.ts";
import { z } from "zod";
import { HttpError, badRequest, forbidden, parse, phoneSchema } from "../lib/http.ts";

/** Starts a new single-device session and returns the auth block sent to the app. */
const issueSession = async (user: { id: string; email: string | null; phone: string | null }) => {
  const sessionId = randomUUID();
  const accessToken = signUserAccessToken({
    sub: user.id,
    role: "user",
    sid: sessionId,
    email: user.email,
    phone: user.phone
  });
  const refreshToken = signUserRefreshToken({ sub: user.id, sid: sessionId });

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      activeSessionId: sessionId,
      refreshTokenHash: hashToken(refreshToken.token),
      refreshTokenExpiresAt: refreshToken.expiresAt
    }
  });
  const { password: _password, refreshTokenHash: _hash, ...safeUser } = updatedUser;

  return {
    user: safeUser,
    auth: {
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
      tokenType: accessToken.tokenType,
      accessExpiresIn: accessToken.expiresIn,
      refreshExpiresIn: refreshToken.expiresIn
    }
  };
};

/** Verifies that `phone` passed OTP verification for `purpose`. */
const assertPhoneVerified = (verificationToken: unknown, phone: string, purpose: string) => {
  if (typeof verificationToken !== "string" || !verificationToken) {
    throw badRequest("verificationToken is required. Verify the phone number with OTP first.");
  }
  let claims;
  try {
    claims = verifyVerificationToken(verificationToken);
  } catch {
    throw badRequest("Phone verification expired. Please verify the OTP again.");
  }
  if (claims.phone !== phone || claims.purpose !== purpose) {
    throw badRequest("Phone verification does not match this number.");
  }
};

/** /api/user/:id routes are only usable by the signed-in owner of that account. */
const assertSelf = (req: Request) => {
  if (!req.auth || req.auth.userId !== req.params.id) throw forbidden();
};

export const signin = async (req: Request, res: Response) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const isPhoneSignin = Boolean(phone);

    if (!email && !phone) {
      return res.status(400).json({
        message: "Email or phone is required.",
        code: 400
      });
    }

    if (!password) {
      return res.status(400).json({
        message: "Password is required.",
        code: 400
      });
    }

    const exists = await prisma.user.findFirst({
      where: isPhoneSignin ? { phone } : { email }
    });

    if (!exists) {
      return res.status(401).json({
        message: "Invalid credentials.",
        code: 401
      });
    }

    const isMatch = await bcrypt.compare(password, exists.password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials.",
        code: 401
      });
    }

    const session = await issueSession(exists);

    return res.status(200).json({
      message: "Sign in successful.",
      code: 200,
      data: session.user,
      auth: session.auth
    });
  } catch (error) {
    return sendError(res, error, 'Something went wrong');
  }
}

export const refreshUserSession = async (req: Request, res: Response) => {
  try {
    const refreshToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";

    if (!refreshToken) {
      return res.status(400).json({
        message: "Refresh token is required.",
        code: 400
      });
    }

    const payload = verifyUserRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub }
    });

    if (!user || !user.refreshTokenHash || !user.activeSessionId) {
      return res.status(401).json({
        message: "Invalid or expired session.",
        code: 401
      });
    }

    if (user.activeSessionId !== payload.sid) {
      return res.status(401).json({
        message: "Session invalidated by another device login.",
        code: 401
      });
    }

    if (user.refreshTokenHash !== hashToken(refreshToken)) {
      return res.status(401).json({
        message: "Invalid or expired session.",
        code: 401
      });
    }

    if (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt < new Date()) {
      return res.status(401).json({
        message: "Refresh token expired.",
        code: 401
      });
    }

    const accessToken = signUserAccessToken({
      sub: user.id,
      role: "user",
      sid: user.activeSessionId,
      email: user.email,
      phone: user.phone
    });
    const newRefreshToken = signUserRefreshToken({
      sub: user.id,
      sid: user.activeSessionId
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash: hashToken(newRefreshToken.token),
        refreshTokenExpiresAt: newRefreshToken.expiresAt
      }
    });

    return res.status(200).json({
      message: "Token refreshed successfully.",
      code: 200,
      auth: {
        accessToken: accessToken.token,
        refreshToken: newRefreshToken.token,
        tokenType: accessToken.tokenType,
        accessExpiresIn: accessToken.expiresIn,
        refreshExpiresIn: newRefreshToken.expiresIn
      }
    });
  } catch {
    return res.status(401).json({
      message: "Invalid or expired refresh token.",
      code: 401
    });
  }
};

export const logoutUser = async (req: Request, res: Response) => {
  try {
    const refreshToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";
    if (!refreshToken) {
      return res.status(400).json({
        message: "Refresh token is required.",
        code: 400
      });
    }

    const payload = verifyUserRefreshToken(refreshToken);
    await prisma.user.updateMany({
      where: {
        id: payload.sub,
        activeSessionId: payload.sid
      },
      data: {
        activeSessionId: null,
        refreshTokenHash: null,
        refreshTokenExpiresAt: null
      }
    });

    return res.status(200).json({
      message: "Logout successful.",
      code: 200
    });
  } catch {
    return res.status(401).json({
      message: "Invalid refresh token.",
      code: 401
    });
  }
};
const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(100),
    email: z.email("Please enter valid email.").trim().toLowerCase().optional(),
    phone: phoneSchema,
    password: z.string().min(6, "Password must be at least 6 characters.").max(64),
    verificationToken: z.string().optional()
  });

export const register = async (req: Request, res: Response) => {
    try {
        const { name, email, phone, password, verificationToken } = parse(registerSchema, req.body);

        if (process.env.ALLOW_UNVERIFIED_REGISTRATION !== "true") {
            assertPhoneVerified(verificationToken, phone, "REGISTER");
        }

        const exists = await prisma.user.findFirst({
            where: { OR: [{ phone }, ...(email ? [{ email }] : [])] },
            select: { id: true }
        });
        if (exists) {
            return res.status(409).json({
                message: 'User already exists.'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                name,
                phone,
                email,
                password: hashedPassword,
                phoneVerifiedAt: verificationToken ? new Date() : null
            }
        });

        // Registration continues straight into ProfilePage1..3, so sign the user in immediately.
        const session = await issueSession(user);

        return res.status(201).json({
            message: 'User registered successfully.',
            data: session.user,
            auth: session.auth
        });

    } catch (error) {
        if (error instanceof HttpError) throw error;
        return sendError(res, error, 'Something went wrong');
    }
}

const resetPasswordSchema = z.object({
  phone: phoneSchema,
  verificationToken: z.string().min(1),
  newPassword: z.string().min(6, "Password must be at least 6 characters.").max(64)
});

/** Forgot password: OTP (purpose RESET_PASSWORD) -> CreatePassword screen. Signs out all devices. */
export const resetPassword = async (req: Request, res: Response) => {
  const { phone, verificationToken, newPassword } = parse(resetPasswordSchema, req.body);
  assertPhoneVerified(verificationToken, phone, "RESET_PASSWORD");

  const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if (!user) {
    return res.status(404).json({ message: "No account found for this phone number.", code: 404 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(newPassword, 10),
      activeSessionId: null,
      refreshTokenHash: null,
      refreshTokenExpiresAt: null
    }
  });

  return res.status(200).json({ message: "Password reset successfully. Please sign in.", code: 200 });
};

export const updateUserById = async (req: Request, res: Response) => {
  assertSelf(req);
  try {
    const user_id = req.params.id as string;

    if (!user_id) {
      return res.status(400).json({
        message: 'Please provide user id.'
      });
    }
 const exists = await prisma.user.findUnique({
      where: { id: user_id }
    });

    if (!exists) {
      return res.status(404).json({
        message: 'Invalid user id.'
      });
    }
    const body = req.body ?? {};

    const addressBody = body?.address ?? {};
    const address = typeof addressBody === 'object' ? addressBody?.complete : body?.address;
    const city = addressBody?.city ?? body?.city;
    const state = addressBody?.state ?? body?.state;
    const pinCode = addressBody?.pincode ?? body?.pinCode ?? body?.pincode;
    const locationBody = addressBody?.location ?? body?.location ?? {};
    const latitude =
      locationBody?.latitude ?? locationBody?.lat ?? body?.latitude ?? body?.lat;
    const longitude =
      locationBody?.longitude ?? locationBody?.lng ?? body?.longitude ?? body?.lng;

    const updateData: Record<string, unknown> = {
      name: body?.name,
      phone: body?.phone,
      email: body?.email, 
      alternatePhone: body?.alternatePhone
    };

    if (address || city || state || pinCode || latitude != null || longitude != null) {
      const hasLocation = latitude != null && longitude != null;
      updateData.address = {
        upsert: {
          create: {
            complete: address,
            city,
            state,
            pincode: pinCode ? Number(pinCode) : undefined,
            location: hasLocation ? {
              create: {
                latitude: String(latitude),
                longitude: String(longitude)
              }
            } : undefined
          },
          update: {
            complete: address,
            city,
            state,
            pincode: pinCode ? Number(pinCode) : undefined,
            location: hasLocation ? {
              upsert: {
                create: {
                  latitude: String(latitude),
                  longitude: String(longitude)
                },
                update: {
                  latitude: String(latitude),
                  longitude: String(longitude)
                }
              }
            } : undefined
          }
        }
      };
    }

    const hasUpdates = Object.values(updateData).some((v) => v !== undefined);
    if (!hasUpdates) {
      return res.status(400).json({
        message: 'Please provide at least one field to update.'
      });
    }

    const userUpdate = await prisma.user.update({
      where: { id: user_id },
      data: updateData
    });

    const { password: _password, refreshTokenHash: _hash, ...safeUser } = userUpdate;

    return res.status(200).json({
      message: 'User updated successfully.',
      code: 200,
      data: safeUser
    });
  } catch (error) {
    return sendError(res, error, 'Something went wrong');
  }
};

export const getUserById = async (req: Request, res: Response) => {
  assertSelf(req);
  try {
    const  user_id  = req.params.id as string;

    if (!user_id) {
      return res.status(404).json({
        message: 'Please provide user id.'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: user_id },
      omit:{
        password:true,
        refreshTokenHash:true
      }
    });

    if (!user) {
      return res.status(404).json({
        message: 'User not found.'
      });
    }

    return res.status(200).json({
      message: 'User fetched successfully.',
      data: user
    });

  } catch (error) {
    return res.status(404).json({
      message: 'User not found.',
      error
    });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  assertSelf(req);
  try {
    const  user_id  = req.params.id as string;

     if (!user_id) {
      return res.status(404).json({
        message: 'Please provide user id.'
      });
    }

    const exists = await prisma.user.findUnique({
      where: { id: user_id }
    });

    if (!exists) {
      return res.status(403).json({
        message: 'Invalid user id.'
      });
    }

    const userDelete = await prisma.user.delete({
      where: { id: user_id },
      omit: { password: true, refreshTokenHash: true }
    });

    return res.status(200).json({
      message: 'User deleted successfully.',
      code: 200,
      data: userDelete
    });

  } catch (error) {
    return res.status(403).json({
      message: 'Invalid user id.',
      error
    });
  }
};
