import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Access from '@/models/Access';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * DELETE /api/access/[id]
 * Delete an access record
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

    const accessRecord = await Access.findById(params.id);
    if (!accessRecord) {
      return errorResponse('Access record not found', 404);
    }

    await Access.findByIdAndDelete(params.id);

    return successResponse(
      { id: params.id },
      'Access revoked successfully'
    );
  } catch (error: any) {
    console.error('Error deleting access:', error);
    return errorResponse(error.message || 'Failed to revoke access', 500);
  }
}
