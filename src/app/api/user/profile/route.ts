import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * PUT /api/user/profile
 * Update user profile (name and email)
 * Authenticated users only
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const { name, email } = body;

    // Validate inputs
    if (!name || !email) {
      return errorResponse('Name and email are required', 400);
    }

    if (name.trim().length < 2) {
      return errorResponse('Name must be at least 2 characters', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse('Invalid email format', 400);
    }

    await connectDB();

    // Check if email is already taken by another user
    if (email !== session.user.email) {
      const existingUser = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: session.user.id }
      });

      if (existingUser) {
        return errorResponse('Email is already taken', 400);
      }
    }

    // Update user
    const user = await User.findById(session.user.id);
    if (!user) {
      return errorResponse('User not found', 404);
    }

    user.name = name.trim();
    user.email = email.toLowerCase();
    await user.save();

    return successResponse(
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      'Profile updated successfully'
    );
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    return errorResponse(
      error.message || 'Failed to update profile',
      500
    );
  }
}
