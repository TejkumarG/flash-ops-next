import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Database from '@/models/Database';
import Connection from '@/models/Connection';
import Access from '@/models/Access';
import Team from '@/models/Team';
import { createDatabaseSchema } from '@/lib/validation';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/databases
 * Get all databases user has access to (via individual access or team access)
 * Admins see all databases
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    await connectDB();

    let databases;

    // Admins see all databases
    if (session.user.role === 'admin') {
      databases = await Database.find({})
        .populate('connectionId', 'name connectionType host port')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });
    } else {
      // Regular users: get databases they have access to (individual or team-based)

      // 1. Get individual access
      const individualAccess = await Access.find({
        userId: session.user.id,
        accessType: 'individual',
      }).select('databaseId');

      // 2. Get team access - find all teams user is a member of
      const userTeams = await Team.find({
        members: session.user.id,
      }).select('_id');

      const teamIds = userTeams.map((team) => team._id);

      const teamAccess = await Access.find({
        accessType: 'team',
        teamId: { $in: teamIds },
      }).select('databaseId');

      // 3. Combine all database IDs
      const individualDbIds = individualAccess.map((a) => a.databaseId);
      const teamDbIds = teamAccess.map((a) => a.databaseId);
      const allDatabaseIds = [...new Set([...individualDbIds, ...teamDbIds])];

      // 4. Fetch databases
      databases = await Database.find({
        _id: { $in: allDatabaseIds },
      })
        .populate('connectionId', 'name connectionType host port')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });
    }

    return successResponse({ databases });
  } catch (error: any) {
    console.error('Error fetching databases:', error);
    return errorResponse('Failed to fetch databases', 500);
  }
}

/**
 * POST /api/databases
 * Create a new database entry
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

    // Validate request body
    const validation = createDatabaseSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(
        validation.error.errors[0].message,
        400
      );
    }

    const { connectionId, databaseName, displayName } = validation.data;

    await connectDB();

    // Verify connection exists
    const connection = await Connection.findById(connectionId);
    if (!connection) {
      return errorResponse('Connection not found', 404);
    }

    // Check if database already exists for this connection
    const existingDatabase = await Database.findOne({
      connectionId,
      databaseName,
    });

    if (existingDatabase) {
      return errorResponse(
        'Database already exists for this connection',
        400
      );
    }

    const database = await Database.create({
      connectionId,
      databaseName,
      displayName: displayName || databaseName,
      connectionStatus: 'disconnected',
      syncStatus: 'yet_to_sync',
      createdBy: session.user.id,
    });

    // Populate connection info before returning
    await database.populate('connectionId', 'name connectionType host port');

    return successResponse(database, 'Database created successfully', 201);
  } catch (error: any) {
    console.error('Error creating database:', error);
    return errorResponse(error.message || 'Failed to create database', 500);
  }
}
