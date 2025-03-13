import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { AuthRequest } from '../types/express.js';

export const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new Error('Authentication required');
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { id: string };
    const user = await db.select().from(users).where(eq(users.id, decoded.id)).limit(1);

    if (!user[0]) {
      throw new Error('User not found');
    }

    req.user = {
      id: user[0].id,
      email: user[0].email,
      username: user[0].username,
    };

    next();
  } catch (error) {
    res.status(401).json({
      error: {
        code: 'AUTH_ERROR',
        message: 'Please authenticate',
      },
    });
  }
};
