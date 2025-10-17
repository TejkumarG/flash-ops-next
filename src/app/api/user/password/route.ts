import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import bcrypt from 'bcryptjs';

/**
 * PUT /api/user/password
 * Change user password
 * Authenticated users only
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // Validate inputs
    if (!currentPassword || !newPassword) {
      return errorResponse('Current password and new password are required', 400);
    }

    if (newPassword.length < 6) {
      return errorResponse('New password must be at least 6 characters', 400);
    }

    if (currentPassword === newPassword) {
      return errorResponse('New password must be different from current password', 400);
    }

    await connectDB();

    // Get user with password field
    const user = await User.findById(session.user.id).select('+password');
    if (!user) {
      return errorResponse('User not found', 404);
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return errorResponse('Current password is incorrect', 400);
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    return successResponse(
      {
        success: true,
      },
      'Password updated successfully'
    );
  } catch (error: any) {
    console.error('Error updating password:', error);
    return errorResponse(
      error.message || 'Failed to update password',
      500
    );
  }
}
