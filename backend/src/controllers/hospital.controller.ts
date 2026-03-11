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
  const hospitals = await prisma.hospital.findMany();

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
      where: { id: hospital_id }
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
