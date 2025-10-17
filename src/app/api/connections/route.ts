import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Connection from '@/models/Connection';
import { encrypt } from '@/lib/encryption';
import { createConnectionSchema } from '@/lib/validation';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/connections
 * Get all connections for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    await connectDB();

    // Admin can see all connections, users see only their own
    const query =
      session.user.role === 'admin' ? {} : { createdBy: session.user.id };

    const connections = await Connection.find(query)
      .select('-password') // Don't send encrypted passwords to frontend
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    return successResponse(connections);
  } catch (error: any) {
    console.error('Error fetching connections:', error);
    return errorResponse('Failed to fetch connections', 500);
  }
}

/**
 * POST /api/connections
 * Create a new connection
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
    const validation = createConnectionSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(
        validation.error.errors[0].message,
        400
      );
    }

    const { name, connectionType, host, port, username, password } =
      validation.data;

    await connectDB();

    // Encrypt password before storing
    const encryptedPassword = encrypt(password);

    const connection = await Connection.create({
      name,
      connectionType,
      host,
      port,
      username,
      password: encryptedPassword,
      createdBy: session.user.id,
    });

    // Remove password from response
    const connectionResponse = connection.toObject();
    delete (connectionResponse as any).password;

    return successResponse(connectionResponse, 'Connection created successfully', 201);
  } catch (error: any) {
    console.error('Error creating connection:', error);
    return errorResponse(error.message || 'Failed to create connection', 500);
  }
}
