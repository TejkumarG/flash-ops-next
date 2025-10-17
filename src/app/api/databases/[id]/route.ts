import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Database from '@/models/Database';
import { updateDatabaseSchema } from '@/lib/validation';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/databases/[id]
 * Get a specific database by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    await connectDB();

    const database = await Database.findById(params.id)
      .populate('connectionId', 'name connectionType host port')
      .populate('createdBy', 'name email');

    if (!database) {
      return errorResponse('Database not found', 404);
    }

    // Check access: admin can see all, users only their own
    if (
      session.user.role !== 'admin' &&
      database.createdBy._id.toString() !== session.user.id
    ) {
      return errorResponse('Forbidden', 403);
    }

    return successResponse(database);
  } catch (error: any) {
    console.error('Error fetching database:', error);
    return errorResponse('Failed to fetch database', 500);
  }
}

/**
 * PUT /api/databases/[id]
 * Update a database
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

    // Validate request body
    const validation = updateDatabaseSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(
        validation.error.errors[0].message,
        400
      );
    }

    await connectDB();

    const database = await Database.findById(params.id);
    if (!database) {
      return errorResponse('Database not found', 404);
    }

    const {
      databaseName,
      displayName,
      connectionStatus,
      syncStatus,
      syncErrorMessage,
    } = validation.data;

    // Update fields
    if (databaseName !== undefined) database.databaseName = databaseName;
    if (displayName !== undefined) database.displayName = displayName;
    if (connectionStatus !== undefined)
      database.connectionStatus = connectionStatus;
    if (syncStatus !== undefined) database.syncStatus = syncStatus;
    if (syncErrorMessage !== undefined)
      database.syncErrorMessage = syncErrorMessage;

    await database.save();
    await database.populate('connectionId', 'name connectionType host port');

    return successResponse(database, 'Database updated successfully');
  } catch (error: any) {
    console.error('Error updating database:', error);
    return errorResponse(error.message || 'Failed to update database', 500);
  }
}

/**
 * DELETE /api/databases/[id]
 * Delete a database
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

    const database = await Database.findById(params.id);
    if (!database) {
      return errorResponse('Database not found', 404);
    }

    await Database.findByIdAndDelete(params.id);

    return successResponse(
      { id: params.id },
      'Database deleted successfully'
    );
  } catch (error: any) {
    console.error('Error deleting database:', error);
    return errorResponse(error.message || 'Failed to delete database', 500);
  }
}
