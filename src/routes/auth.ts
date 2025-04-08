import { Router, Response, RequestHandler } from 'express';
import { AuthRequest } from '../types/express.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { auth } from '../middleware/auth.js';

const router = Router();

// Login
router.post('/login', (async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required',
        },
      });
    }

    // Find user
    const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user[0]) {
      return res.status(401).json({
        error: {
          code: 'AUTH_ERROR',
          message: 'Invalid credentials',
        },
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user[0].password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: {
          code: 'AUTH_ERROR',
          message: 'Invalid credentials',
        },
      });
    }

    // Generate JWT
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET not configured');
    }

    const token = jwt.sign({ id: user[0].id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({
      data: {
        user: {
          id: user[0].id,
          email: user[0].email,
          username: user[0].username,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Error logging in',
      },
    });
  }
}) as RequestHandler);

// Get current user
router.get('/me', auth, (async (req: AuthRequest, res: Response) => {
  res.json({
    data: {
      user: req.user,
    },
  });
}) as RequestHandler);

// Logout (just for API completeness - actual logout happens on frontend)
router.post('/logout', auth, (async (req: AuthRequest, res: Response) => {
  res.status(200).json({
    data: {
      message: 'Logged out successfully',
    },
  });
}) as RequestHandler);

export default router;
