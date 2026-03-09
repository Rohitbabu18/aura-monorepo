

import bcrypt from 'bcryptjs';
import type { Request, Response } from "express";
import { prisma } from '../lib/prisma.ts';
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

    const exists = await prisma.user.findUnique({
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

    // New user → register
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data:{
        phone,
        password: hashedPassword
      }
    });

    return res.status(201).json({
      message: 'User Sign Up successfully.',
      data: user
    });

  } catch (error) {
    return res.status(500).json({
      message: 'Something went wrong',
      error
    });
  }
};

/**
 * DELETE USER
 */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const  user_id  = req.params.id;

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

/**
 * GET ALL USERS
 */
export const getAllUsers = async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
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
    const  user_id  = req.params.id;

    if (!user_id) {
      return res.status(404).json({
        message: 'Please provide user id.'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: user_id },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true
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
