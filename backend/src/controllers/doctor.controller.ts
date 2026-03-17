

import bcrypt from 'bcryptjs';
import type { Request, Response } from "express";
import { prisma } from '../lib/prisma.ts';
import { normalizeOperatingHours } from '../lib/operatingHours.ts';
import { sendError } from '../lib/errorHandler.ts';
/**
 * REGISTER / SIGN IN
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        message: 'phone and password are required.',
        code: 400
      });
    }

    const exists = await prisma.doctor.findUnique({
      where:{ phone }
    });

    // User exists → try login
    if (exists) {
      const isMatch = await bcrypt.compare(password, exists.password);

      if (isMatch) {
        return res.status(200).json({
          message: 'Sign In successfully.',
          data: exists,
          code: 200
        });
      }

      return res.status(403).json({
        message: 'Please provide valid password',
        code: 403
      });
    }

    // New doctor → register
    const hashedPassword = await bcrypt.hash(password, 10);

    const doctor = await prisma.doctor.create({
      data:{
        phone,
        password: hashedPassword
      }
    });

    return res.status(201).json({
      message: 'User Sign Up successfully.',
      data: doctor
    });

  } catch (error) {
    return sendError(res, error, 'Something went wrong');
  }
};

/**
 * REGISTER FROM BASIC INFO FORM
 * - hospital/clinic -> Hospital model
 * - doctor/nurse/staff -> User model
 */
export const registerFromBasicInfo = async (req: Request, res: Response) => {
  try {
    const userTypeRaw = req.body?.userType ?? req.body?.user_type ?? req.body?.type;
    const userType = typeof userTypeRaw === 'string' ? userTypeRaw.toLowerCase() : '';

    const name = req.body?.name ?? req.body?.fullName ?? req.body?.full_name;
    const phone = req.body?.phone ?? req.body?.contactNumber ?? req.body?.contact_number;
    const email = req.body?.email ?? req.body?.emailAddress ?? req.body?.email_address;
    const alternatePhone =
      req.body?.alternatePhone ??
      req.body?.alternateContactNumber ??
      req.body?.alternateContact ??
      req.body?.alternate_contact_number;

    const addressBody = req.body?.address ?? {};
    const address = typeof addressBody === 'object' ? addressBody?.complete : req.body?.address;
    const city = addressBody?.city ?? req.body?.city;
    const state = addressBody?.state ?? req.body?.state;
    const pinCode = addressBody?.pincode ?? req.body?.pinCode ?? req.body?.pincode;
    const locationBody = addressBody?.location ?? req.body?.location ?? {};
    const latitude =
      locationBody?.latitude ?? locationBody?.lat ?? req.body?.latitude ?? req.body?.lat;
    const longitude =
      locationBody?.longitude ?? locationBody?.lng ?? req.body?.longitude ?? req.body?.lng;

    const specialization = req.body?.specialization;
    const experience = req.body?.experience;
    const registrationNumber = req.body?.registrationNumber;
    const registrationAuthority = req.body?.registrationAuthority;

    const facilityType = req.body?.facilityType;
    const establishedYear = req.body?.establishedYear;
    const ownershipType = req.body?.ownershipType;
    const registrationNo = req.body?.registrationNo;
    const licenseNumber = req.body?.licenseNumber;
    const totalBeds = req.body?.totalBeds;
    const totalStaff = req.body?.totalStaff;
    const services = req.body?.services;
    const operatingHours = req.body?.operatingHours;
    const emergencyAvailable = req.body?.emergencyAvailable;
    const ambulanceAvailable = req.body?.ambulanceAvailable;
    const websiteUrl = req.body?.websiteUrl;

    if (!userType) {
      return res.status(400).json({
        message: 'userType is required.'
      });
    }

    if (!name || !phone) {
      return res.status(400).json({
        message: 'name and phone are required.'
      });
    }

    const isHospital = userType === 'hospital' || userType === 'clinic';

    if (isHospital) {
      if (!email) {
        return res.status(400).json({
          message: 'email is required for hospital/clinic.'
        });
      }

      const hospitalOrConditions = [{ email }, ...(phone ? [{ phone }] : [])];
      const exists = await prisma.hospital.findFirst({
        where: {
          OR: hospitalOrConditions
        }
      });

      if (exists) {
        return res.status(409).json({
          message: 'Hospital or clinic already exists.'
        });
      }

      const servicesArray = Array.isArray(services)
        ? services
        : typeof services === 'string'
          ? services.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [];

      const operatingData = normalizeOperatingHours(operatingHours);

      const hospital = await prisma.hospital.create({
        data: {
          name,
          phone,
          email,
          alternatePhone,
          role: userType === 'clinic' ? 'CLINIC' : 'HOSPITAL',
          facilityType,
          ownershipType,
          yearEstablished: establishedYear ? Number(establishedYear) : undefined,
          registrationNumber: registrationNo ?? registrationNumber,
          licenseNumber,
          numberOfBeds: totalBeds ? Number(totalBeds) : undefined,
          totalStaff: totalStaff ? Number(totalStaff) : undefined,
          servicesOffered: servicesArray,
          emergencyAvailable,
          ambulanceAvailable,
          websiteUrl,
          address: address || city || state || pinCode ? {
            create: {
              complete: address,
              city,
              state,
              pincode: pinCode ? Number(pinCode) : undefined,
              location: latitude != null && longitude != null ? {
                create: {
                  latitude: String(latitude),
                  longitude: String(longitude)
                }
              } : undefined
            }
          } : undefined,
          operatingData: operatingData
            ? {
              create: operatingData
            }
            : undefined
        }
      });

      return res.status(201).json({
        message: 'Hospital/Clinic registered successfully.',
        data: hospital
      });
    }

    const userOrConditions = [{ phone }, ...(email ? [{ email }] : [])];
    const userExists = await prisma.doctor.findFirst({
      where: {
        OR: userOrConditions
      }
    });

    if (userExists) {
      return res.status(409).json({
        message: 'User already exists.'
      });
    }

    const hashedPassword = await bcrypt.hash('12345678', 10);

    const doctor = await prisma.doctor.create({
      data: {
        name,
        phone,
        email,
        alternatePhone,
        specialization,
        experience: experience != null ? String(experience) : undefined,
        registrationNumber,
        registrationAuthority,
        role: userType,
        password: hashedPassword,
        address: address || city || state || pinCode ? {
          create: {
            complete: address,
            city,
            state,
            pincode: pinCode ? Number(pinCode) : undefined,
            location: latitude != null && longitude != null ? {
              create: {
                latitude: String(latitude),
                longitude: String(longitude)
              }
            } : undefined
          }
        } : undefined
      }
    });

    const { password: _password, ...safeUser } = doctor;

    return res.status(201).json({
      message: 'User registered successfully.',
      data: safeUser
    });
  } catch (error) {
    return sendError(res, error, 'Something went wrong');
  }
};

/**
 * DELETE USER
 */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const  user_id  = req.params.id as string;

    const exists = await prisma.doctor.findUnique({
      where: { id: user_id }
    });

    if (!exists) {
      return res.status(403).json({
        message: 'Invalid doctor id.'
      });
    }

    const userDelete = await prisma.doctor.delete({
      where: { id: user_id }
    });

    return res.status(200).json({
      message: 'User deleted successfully.',
      code: 200,
      data: userDelete
    });

  } catch (error) {
    return res.status(403).json({
      message: 'Invalid doctor id.',
      error
    });
  }
};

/**
 * GET ALL USERS
 */
export const getAllUsers = async (req: Request, res: Response) => {
  const users = await prisma.doctor.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true
    }
  });

  return res.status(200).json({
    message: 'Users fetched successfully.',
    data: users,
    total: users.length
  });
};

/**
 * GET USER BY ID
 */
export const getUserById = async (req: Request, res: Response) => {
  try {
    const  user_id  = req.params.id as string;

    if (!user_id) {
      return res.status(404).json({
        message: 'Please provide doctor id.'
      });
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: user_id },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true
      }
    });

    if (!doctor) {
      return res.status(404).json({
        message: 'User not found.'
      });
    }

    return res.status(200).json({
      message: 'User fetched successfully.',
      data: doctor
    });

  } catch (error) {
    return res.status(404).json({
      message: 'User not found.',
      error
    });
  }
};

/**
 * UPDATE USER BY ID
 */
export const updateUserById = async (req: Request, res: Response) => {
  try {
    const user_id = req.params.id as string;

    if (!user_id) {
      return res.status(400).json({
        message: 'Please provide doctor id.'
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
      role: body?.role,
      alternatePhone: body?.alternatePhone,
      specialization: body?.specialization,
      experience: body?.experience != null ? String(body.experience) : undefined,
      registrationNumber: body?.registrationNumber,
      registrationAuthority: body?.registrationAuthority
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

    const exists = await prisma.doctor.findUnique({
      where: { id: user_id }
    });

    if (!exists) {
      return res.status(404).json({
        message: 'Invalid doctor id.'
      });
    }

    const userUpdate = await prisma.doctor.update({
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
