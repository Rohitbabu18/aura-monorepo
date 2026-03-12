import { prisma } from '../lib/prisma.ts';
import { normalizeOperatingHours } from '../lib/operatingHours.ts';
import { sendError } from '../lib/errorHandler.ts';

import type { Request, Response } from 'express'

export const registerHospital = async (req: Request, res: Response) => {
  try {
    const { email, role, name, phone, alternatePhone } = req.body;

    const exists = await prisma.hospital.findUnique({
      where: { email }
    })

    // User exists → try login
    if (exists) {
      return res.status(403).json({
        message: 'Email already in use, Please provide valid password',
        code: 403
      });
    }

    const hospital = await prisma.hospital.create({
      data: {
        email,
        role,
        name,
        phone,
        alternatePhone
      }
    })

    return res.status(201).json({
      message: `${role} registered successfully.`,
      data: hospital
    });

  } catch (error) {
    return sendError(res, error, 'Something went wrong');
  }
};

export const updateHospital = async (req: Request, res: Response) => {
  try {
    const {
      hospital_id,
      hospitalId,
      id: bodyId,
      operatingHours,
      address: addressPayload,
      ...updateData
    } = req.body ?? {};
    const paramId = req.params?.hospitalId;
    const hospitalIdToUpdate = paramId || hospital_id || hospitalId || bodyId;

    if (!hospitalIdToUpdate) {
      return res.status(400).json({
        message: 'Please provide hospital id.'
      });
    }

    const operatingData = normalizeOperatingHours(operatingHours);
    if (operatingData) {
      updateData.operatingData = {
        upsert: {
          create: operatingData,
          update: operatingData
        }
      };
    }

    delete (updateData as Record<string, unknown>).address;
    delete (updateData as Record<string, unknown>).city;
    delete (updateData as Record<string, unknown>).state;
    delete (updateData as Record<string, unknown>).pinCode;
    delete (updateData as Record<string, unknown>).pincode;
    delete (updateData as Record<string, unknown>).latitude;
    delete (updateData as Record<string, unknown>).longitude;

    const addressBody = addressPayload ?? req.body?.address ?? {};
    const address = typeof addressBody === 'object' ? addressBody?.complete : req.body?.address;
    const city = addressBody?.city ?? req.body?.city;
    const state = addressBody?.state ?? req.body?.state;
    const resolvedPinCode =
      addressBody?.pincode ?? req.body?.pinCode ?? req.body?.pincode;
    const locationBody = addressBody?.location ?? req.body?.location ?? {};
    const resolvedLatitude =
      locationBody?.latitude ?? locationBody?.lat ?? req.body?.latitude ?? req.body?.lat;
    const resolvedLongitude =
      locationBody?.longitude ?? locationBody?.lng ?? req.body?.longitude ?? req.body?.lng;
    const hasLocation = resolvedLatitude != null && resolvedLongitude != null;

    if (address || city || state || resolvedPinCode || hasLocation) {
      updateData.address = {
        upsert: {
          create: {
            complete: address,
            city,
            state,
            pincode: resolvedPinCode ? Number(resolvedPinCode) : undefined,
            location: hasLocation ? {
              create: {
                latitude: String(resolvedLatitude),
                longitude: String(resolvedLongitude)
              }
            } : undefined
          },
          update: {
            complete: address,
            city,
            state,
            pincode: resolvedPinCode ? Number(resolvedPinCode) : undefined,
            location: hasLocation ? {
              upsert: {
                create: {
                  latitude: String(resolvedLatitude),
                  longitude: String(resolvedLongitude)
                },
                update: {
                  latitude: String(resolvedLatitude),
                  longitude: String(resolvedLongitude)
                }
              }
            } : undefined
          }
        }
      };
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: 'Please provide at least one field to update.'
      });
    }

    const exists = await prisma.hospital.findUnique({
      where: { id: hospitalIdToUpdate }
    });

    if (!exists) {
      return res.status(404).json({
        message: 'Invalid hospital id.'
      });
    }

    const hospitalUpdate = await prisma.hospital.update({
      where: { id: hospitalIdToUpdate },
      data: updateData
    });

    return res.status(200).json({
      message: 'Hospital updated successfully.',
      code: 200,
      data: hospitalUpdate
    });

  } catch (error) {
    return sendError(res, error, 'Something went wrong.');
  }
};

export const deleteHospital = async (req: Request, res: Response) => {
  try {
    const  hospital_id  = req?.params?.id as string;

    const exists = await prisma.hospital.findUnique({
      where: { id: hospital_id }
    });

    if (!exists) {
      return res.status(403).json({
        message: 'Invalid hospital id.'
      });
    }

    const userDelete = await prisma.hospital.delete({
      where: { id: hospital_id }
    });

    return res.status(200).json({
      message: 'User deleted successfully.',
      code: 200,
      data: userDelete
    });

  } catch (error) {
    return res.status(403).json({
      message: 'Invalid hospital id.',
      error
    });
  }
};

export const getAllHospitals = async (req: Request, res: Response) => {
  const hospitals = await prisma.hospital.findMany({
    include: {
      operatingData: true
    }
  });

  return res.status(200).json({
    message: 'Hospitals fetched successfully.',
    data: hospitals,
    total: hospitals.length
  });
};

export const getHospitalById = async (req: Request, res: Response) => {
  try {
    const  hospital_id  = req?.params?.id as string;

    if (!hospital_id) {
      return res.status(404).json({
        message: 'Please provide hospital id.'
      });
    }

    const hospital = await prisma.hospital.findUnique({
      where: { id: hospital_id },
      include: {
        operatingData: {
          omit:{
            id:true,
            hospitalId:true
          }
        },
        address:{
          omit:{
            id:true,
            hospitalId:true,
            userId:true,
          },
          include:{
            location:{
              omit:{
                id:true,
                 addressId:true
              }
            }
          }
        }
      }
    });

    if (!hospital) {
      return res.status(404).json({
        message: 'User not found.'
      });
    }

    return res.status(200).json({
      message: 'User fetched successfully.',
      data: hospital
    });

  } catch (error) {
    return res.status(404).json({
      message: 'User not found.',
      error
    });
  }
};
