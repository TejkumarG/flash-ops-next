import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Connection from '@/models/Connection';
import Database from '@/models/Database';
import { encrypt } from '@/lib/encryption';
import { updateConnectionSchema } from '@/lib/validation';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/connections/[id]
 * Get a specific connection by ID
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

    const connection = await Connection.findById(params.id)
      .select('-password')
      .populate('createdBy', 'name email');

    if (!connection) {
      return errorResponse('Connection not found', 404);
    }

    // Check access: admin can see all, users only their own
    if (
      session.user.role !== 'admin' &&
      connection.createdBy._id.toString() !== session.user.id
    ) {
      return errorResponse('Forbidden', 403);
    }

    return successResponse(connection);
  } catch (error: any) {
    console.error('Error fetching connection:', error);
    return errorResponse('Failed to fetch connection', 500);
  }
}

/**
 * PUT /api/connections/[id]
 * Update a connection
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
    const validation = updateConnectionSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(
        validation.error.errors[0].message,
        400
      );
    }

    await connectDB();

    const connection = await Connection.findById(params.id);
    if (!connection) {
      return errorResponse('Connection not found', 404);
    }

    const { name, connectionType, host, port, username, password } =
      validation.data;

    // Update fields
    if (name !== undefined) connection.name = name;
    if (connectionType !== undefined) connection.connectionType = connectionType;
    if (host !== undefined) connection.host = host;
    if (port !== undefined) connection.port = port;
    if (username !== undefined) connection.username = username;

    // Encrypt password if provided
    if (password !== undefined && password.trim() !== '') {
      connection.password = encrypt(password);
    }

    await connection.save();

    // Remove password from response
    const connectionResponse = connection.toObject();
    delete (connectionResponse as any).password;

    return successResponse(connectionResponse, 'Connection updated successfully');
  } catch (error: any) {
    console.error('Error updating connection:', error);
    return errorResponse(error.message || 'Failed to update connection', 500);
  }
}

/**
 * DELETE /api/connections/[id]
 * Delete a connection and all associated databases
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

    const connection = await Connection.findById(params.id);
    if (!connection) {
      return errorResponse('Connection not found', 404);
    }

    // Delete all databases associated with this connection
    await Database.deleteMany({ connectionId: params.id });

    // Delete the connection
    await Connection.findByIdAndDelete(params.id);

    return successResponse(
      { id: params.id },
      'Connection and associated databases deleted successfully'
    );
  } catch (error: any) {
    console.error('Error deleting connection:', error);
    return errorResponse(error.message || 'Failed to delete connection', 500);
  }
}
