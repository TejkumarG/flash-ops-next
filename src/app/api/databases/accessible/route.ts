import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Database from '@/models/Database';
import Team from '@/models/Team';
import Access from '@/models/Access';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/databases/accessible
 * Get all databases accessible to the current user
 * Available to all authenticated users
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    await connectDB();

    const userId = session.user.id;

    // Find all teams the user is a member of
    const userTeams = await Team.find({ members: userId }).select('_id');
    const teamIds = userTeams.map((team) => team._id);

    // Find all access records for this user (both team and individual)
    const accessRecords = await Access.find({
      $or: [
        { accessType: 'team', teamId: { $in: teamIds } },
        { accessType: 'individual', userId: userId },
      ],
    }).select('databaseId');

    // Get unique database IDs
    const databaseIds = [...new Set(accessRecords.map((record) => record.databaseId.toString()))];

    // Fetch all accessible databases with connection info
    const databases = await Database.find({ _id: { $in: databaseIds } })
      .populate('connectionId', 'name connectionType host port')
      .sort({ databaseName: 1 });

    return successResponse({
      databases: databases.map((db) => ({
        id: db._id,
        databaseName: db.databaseName,
        displayName: db.displayName,
        connectionStatus: db.connectionStatus,
        syncStatus: db.syncStatus,
        syncLastAt: db.syncLastAt,
        lastConnectionTest: db.lastConnectionTest,
        connection: db.connectionId,
        createdAt: db.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching accessible databases:', error);
    return errorResponse(error.message || 'Failed to fetch accessible databases', 500);
  }
}
