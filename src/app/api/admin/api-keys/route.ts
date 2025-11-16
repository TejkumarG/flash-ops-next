import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import ApiKey from '@/models/ApiKey';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/admin/api-keys
 * Admin view of all API keys across all teams
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

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const isActive = searchParams.get('isActive');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build filter
    const filter: any = {};
    if (teamId) filter.teamId = teamId;
    if (isActive !== null && isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    // Get total count
    const total = await ApiKey.countDocuments(filter);

    // Get API keys with pagination
    const apiKeys = await ApiKey.find(filter)
      .populate('createdBy', 'name email')
      .populate('teamId', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Get statistics
    const stats = await ApiKey.aggregate([
      {
        $group: {
          _id: null,
          totalKeys: { $sum: 1 },
          activeKeys: {
            $sum: { $cond: ['$isActive', 1, 0] },
          },
          totalUsage: { $sum: '$usageCount' },
          expiredKeys: {
            $sum: {
              $cond: [
                { $and: ['$isActive', { $lt: ['$expiresAt', new Date()] }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    return successResponse(
      {
        apiKeys,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        statistics: stats[0] || {
          totalKeys: 0,
          activeKeys: 0,
          totalUsage: 0,
          expiredKeys: 0,
        },
      },
      'API keys retrieved successfully'
    );
  } catch (error: any) {
    console.error('Error fetching API keys:', error);
    return errorResponse(error.message || 'Failed to fetch API keys', 500);
  }
}
