import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Access from '@/models/Access';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/access
 * Get all access records or filter by database/team/user
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

    const { searchParams } = new URL(request.url);
    const databaseId = searchParams.get('databaseId');
    const teamId = searchParams.get('teamId');
    const userId = searchParams.get('userId');

    await connectDB();

    const query: any = {};
    if (databaseId) query.databaseId = databaseId;
    if (teamId) query.teamId = teamId;
    if (userId) query.userId = userId;

    const accessRecords = await Access.find(query)
      .populate('databaseId', 'databaseName displayName')
      .populate('teamId', 'name')
      .populate('userId', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    return successResponse({
      access: accessRecords.map((record) => ({
        id: record._id,
        databaseId: record.databaseId,
        accessType: record.accessType,
        teamId: record.teamId,
        userId: record.userId,
        createdBy: record.createdBy,
        createdAt: record.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching access records:', error);
    return errorResponse(error.message || 'Failed to fetch access records', 500);
  }
}

/**
 * POST /api/access
 * Create new access record(s)
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
    const { databaseIds, accessType, teamId, userId } = body;

    // Validate inputs
    if (!databaseIds || !Array.isArray(databaseIds) || databaseIds.length === 0) {
      return errorResponse('At least one database must be selected', 400);
    }

    if (!accessType || !['team', 'individual'].includes(accessType)) {
      return errorResponse('Invalid access type', 400);
    }

    if (accessType === 'team' && !teamId) {
      return errorResponse('Team ID is required for team access', 400);
    }

    if (accessType === 'individual' && !userId) {
      return errorResponse('User ID is required for individual access', 400);
    }

    await connectDB();

    // Create access records for each database
    const accessRecords = [];
    const errors = [];

    for (const databaseId of databaseIds) {
      try {
        // Check if access already exists
        const existingAccess = await Access.findOne({
          databaseId,
          ...(accessType === 'team' ? { teamId } : { userId }),
        });

        if (existingAccess) {
          errors.push(`Access already exists for database ${databaseId}`);
          continue;
        }

        const accessRecord = await Access.create({
          databaseId,
          accessType,
          ...(accessType === 'team' ? { teamId } : { userId }),
          createdBy: session.user.id,
        });

        accessRecords.push(accessRecord);
      } catch (error: any) {
        errors.push(`Failed to create access for database ${databaseId}: ${error.message}`);
      }
    }

    if (accessRecords.length === 0) {
      return errorResponse(
        errors.length > 0 ? errors.join(', ') : 'Failed to create any access records',
        400
      );
    }

    return successResponse(
      {
        created: accessRecords.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      `Successfully created ${accessRecords.length} access record(s)`,
      201
    );
  } catch (error: any) {
    console.error('Error creating access:', error);
    return errorResponse(error.message || 'Failed to create access', 500);
  }
}
