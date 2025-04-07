import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/express.js';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { admins } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export const adminAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      res.status(401).json({
        error: {
          code: 'AUTH_ERROR',
          message: 'No token provided',
        },
      });
      return;
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { id: string };
    const admin = await db.select().from(admins).where(eq(admins.id, decoded.id)).limit(1);

    if (!admin[0]) {
      res.status(401).json({
        error: {
          code: 'AUTH_ERROR',
          message: 'Not authorized as admin',
        },
      });
      return;
    }

    // Add admin to request
    req.user = {
      id: admin[0].id,
      email: admin[0].email,
      name: admin[0].name,
      isAdmin: true,
      username: admin[0].name,
    };

    next();
  } catch (error) {
    res.status(401).json({
      error: {
        code: 'AUTH_ERROR',
        message: 'Please authenticate',
      },
    });
    return;
  }
};
