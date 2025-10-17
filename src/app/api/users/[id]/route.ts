import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * PUT /api/users/[id]
 * Update a user
 * Admin only
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    if (session.user.role !== 'admin') {
      return errorResponse('Forbidden: Admin access required', 403);
    }

    const body = await request.json();
    const { name, email, role, isActive, password } = body;

    // Validate inputs
    if (name && name.trim().length < 2) {
      return errorResponse('Name must be at least 2 characters', 400);
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return errorResponse('Invalid email format', 400);
      }
    }

    if (role && !['admin', 'user'].includes(role)) {
      return errorResponse('Role must be either "admin" or "user"', 400);
    }

    if (password && password.length < 6) {
      return errorResponse('Password must be at least 6 characters', 400);
    }

    await connectDB();

    // Don't select password field to avoid issues with pre-save hook
    const user = await User.findById(params.id);
    if (!user) {
      return errorResponse('User not found', 404);
    }

    // Prevent admin from deactivating themselves
    if (session.user.id === params.id && isActive === false) {
      return errorResponse('You cannot deactivate your own account', 400);
    }

    // Prevent admin from changing their own role
    if (session.user.id === params.id && role && role !== user.role) {
      return errorResponse('You cannot change your own role', 400);
    }

    // Check if email is already taken by another user
    if (email && email.toLowerCase() !== user.email) {
      const existingUser = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: params.id },
      });

      if (existingUser) {
        return errorResponse('Email is already taken', 400);
      }
    }

    // Update fields
    if (name) user.name = name.trim();
    if (email) user.email = email.toLowerCase();
    if (role) user.role = role;
    if (typeof isActive === 'boolean') user.isActive = isActive;

    // Update password if provided
    if (password) {
      user.password = password; // Pre-save hook will hash it
    }

    await user.save();

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
      'User updated successfully'
    );
  } catch (error: any) {
    console.error('Error updating user:', error);
    return errorResponse(error.message || 'Failed to update user', 500);
  }
}

/**
 * DELETE /api/users/[id]
 * Delete a user
 * Admin only
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    if (session.user.role !== 'admin') {
      return errorResponse('Forbidden: Admin access required', 403);
    }

    await connectDB();

    // Prevent admin from deleting themselves
    if (session.user.id === params.id) {
      return errorResponse('You cannot delete your own account', 400);
    }

    const user = await User.findById(params.id);
    if (!user) {
      return errorResponse('User not found', 404);
    }

    await User.findByIdAndDelete(params.id);

    return successResponse(
      { id: params.id },
      'User deleted successfully'
    );
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return errorResponse(error.message || 'Failed to delete user', 500);
  }
}
