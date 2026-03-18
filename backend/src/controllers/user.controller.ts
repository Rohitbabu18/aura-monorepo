
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.ts";
import bcrypt from "bcryptjs";
import { sendError } from "../lib/errorHandler.ts";

export const signin = async (req: Request, res: Response) => {
  try {
    const { email = "", phone = "", password } = req.body;
    const isPhone = phone !== ""
    if ((!phone && !email)) {
      return res.status(400).json({
        message: `${isPhone ? "Phone" : "Email"} is required.`,
        code: 400
      });
    }
    const exists = await prisma.user.findUnique({
      where: isPhone ? { phone } : { email }
    });

    if (exists) {
      const isMatch = await bcrypt.compare(password, exists.password);
      if (isMatch) {
        const {password,...safeUser}=exists
        return res.status(200).json({
          message: 'Sign In successfully.',
          data: safeUser,
          code: 200
        });
      }

      return res.status(403).json({
        message: 'Please provide valid password',
        code: 403
      });
    }
  } catch (error) {
    return sendError(res, error, 'Something went wrong');
  }
}
export const register = async (req: Request, res: Response) => {
    try {
        const { name, email, phone, password } = req.body;
        if ((!phone && !email) || !password) {
            return res.status(400).json({
                message: `phone and password are required.`,
                code: 400
            });
        }
        const existsPhone = await prisma.user.findUnique({
            where: { phone }
        });
        if (existsPhone) {
            return res.status(409).json({
                message: 'User already exists.'
            });
        }
        const existsEmail = await prisma.user.findUnique({
            where: { email }
        });

        if ( existsEmail) {
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
                password: hashedPassword
            }
        });

        const { password: _password, ...safeUser } = user;

        return res.status(201).json({
            message: 'User registered successfully.',
            data: safeUser
        });

    } catch (error) {
        return sendError(res, error, 'Something went wrong');
    }
}
export const updateUserById = async (req: Request, res: Response) => {
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

    const { password: _password, ...safeUser } = userUpdate;

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
        password:true
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
      where: { id: user_id }
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