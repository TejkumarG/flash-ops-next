import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/users
 * Get all users
 * Admin only
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    if (session.user.role !== 'admin') {
      return errorResponse('Forbidden: Admin access required', 403);
    }

    await connectDB();

    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });

    return successResponse({
      users: users.map((user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return errorResponse(error.message || 'Failed to fetch users', 500);
  }
}

/**
 * POST /api/users
 * Create a new user
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    if (session.user.role !== 'admin') {
      return errorResponse('Forbidden: Admin access required', 403);
    }

    const body = await request.json();
    const { name, email, password, role } = body;

    // Validate inputs
    if (!name || !email || !password) {
      return errorResponse('Name, email, and password are required', 400);
    }

    if (name.trim().length < 2) {
      return errorResponse('Name must be at least 2 characters', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse('Invalid email format', 400);
    }

    if (password.length < 6) {
      return errorResponse('Password must be at least 6 characters', 400);
    }

    if (role && !['admin', 'user'].includes(role)) {
      return errorResponse('Role must be either "admin" or "user"', 400);
    }

    await connectDB();

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return errorResponse('User with this email already exists', 400);
    }

    // Create user (password will be hashed automatically by pre-save hook)
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      password: password, // Will be hashed by pre-save hook
      role: role || 'user',
      isActive: true,
    });

    return successResponse(
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
      },
      'User created successfully',
      201
    );
  } catch (error: any) {
    console.error('Error creating user:', error);
    return errorResponse(error.message || 'Failed to create user', 500);
  }
}
