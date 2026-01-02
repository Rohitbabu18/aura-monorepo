import { prisma } from '../lib/prisma.ts';

export const registerHospital = async (req: any, res: any) => {
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
    return res.status(500).json({
      message: 'Something went wrong',
      error
    });
  }
};

export const updateHospital = async (req: any, res: any) => {
  try {
    const { hospital_id, ...updateData } = req.body;

    const exists = await prisma.hospital.findUnique({
      where: { id: hospital_id }
    });

    if (!exists) {
      return res.status(403).json({
        message: 'Invalid hospital id.'
      });
    }

    const hospitalUpdate = await prisma.hospital.update({
      where: { id: hospital_id },
      data: updateData
    });

    return res.status(200).json({
      message: 'Hospital updated successfully.',
      code: 200,
      data: hospitalUpdate
    });

  } catch (error) {
    return res.status(403).json({
      message: 'Invalid hospital id.',
      error
    });
  }
};

export const deleteHospital = async (req: any, res: any) => {
  try {
    const { hospital_id } = req.body;

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

export const getAllHospitals = async (req: any, res: any) => {
  const hospitals = await prisma.hospital.findMany();

  return res.status(200).json({
    message: 'Hospitals fetched successfully.',
    data: hospitals,
    total: hospitals.length
  });
};

export const getHospitalById = async (req: any, res: any) => {
  try {
    const { hospital_id } = req.body;

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
