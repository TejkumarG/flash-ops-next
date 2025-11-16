import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Database from '@/models/Database';
import Team from '@/models/Team';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { validateApiKey, trackApiKeyUsage, getClientIp } from '@/lib/api-key-auth';

/**
 * POST /api/query
 * Execute natural language query against a database
 * Supports both session auth and API key auth
 */
export async function POST(request: NextRequest) {
  try {
    let userId: string | undefined;
    let userName: string | undefined;
    let teamId: string | undefined;
    let apiKeyId: string | undefined;
    let authMethod: 'session' | 'api-key';

    // Try session authentication first
    const session = await getServerSession(authOptions);

    if (session?.user) {
      // Session-based authentication
      userId = session.user.id;
      userName = session.user.name || session.user.email;
      authMethod = 'session';
    } else {
      // Try API key authentication
      const apiKeyValidation = await validateApiKey(request);

      if (!apiKeyValidation.isValid) {
        return errorResponse(
          apiKeyValidation.error || 'Authentication required',
          401
        );
      }

      // API key authentication
      teamId = apiKeyValidation.context!.teamId;
      apiKeyId = apiKeyValidation.context!.apiKeyId;
      authMethod = 'api-key';

      // Check if key has query permission
      const hasQueryPermission =
        apiKeyValidation.context!.permissions.includes('query:read') ||
        apiKeyValidation.context!.permissions.includes('*');

      if (!hasQueryPermission) {
        return errorResponse('API key does not have query permission', 403);
      }
    }

    // Parse request body
    const body = await request.json();
    const { databaseId, query } = body;

    if (!databaseId || !query) {
      return errorResponse('Database ID and query are required', 400);
    }

    await connectDB();

    // Get database and check access
    const database = await Database.findById(databaseId)
      .populate('teamId', 'name members')
      .populate('connectionId');

    if (!database) {
      return errorResponse('Database not found', 404);
    }

    // Access control
    if (authMethod === 'session') {
      // For session auth, check if user is admin or team member
      const isAdmin = session!.user.role === 'admin';
      const isTeamMember = database.teamId.members.includes(userId as any);

      if (!isAdmin && !isTeamMember) {
        return errorResponse('Access denied to this database', 403);
      }

      teamId = database.teamId._id.toString();
    } else {
      // For API key auth, check if key belongs to same team as database
      if (database.teamId._id.toString() !== teamId) {
        return errorResponse('API key team does not match database team', 403);
      }
    }

    // Check if database has embeddings
    if (!database.metadata?.embeddingsCreated) {
      return errorResponse(
        'Database embeddings not generated. Please sync the database first.',
        400
      );
    }

    // TODO: Call FastAPI endpoint to process natural language query
    // For now, return a placeholder response
    const result = {
      query,
      databaseId,
      generatedSql: 'SELECT * FROM users LIMIT 10', // Placeholder
      results: [], // Placeholder
      executionTime: 0,
    };

    // Track API key usage if using API key auth
    if (authMethod === 'api-key' && apiKeyId) {
      await trackApiKeyUsage(apiKeyId, {
        userId,
        userName: userName || 'API User',
        query: query.substring(0, 200),
        ipAddress: getClientIp(request),
      });
    }

    return successResponse(
      {
        result,
        authMethod,
        teamId,
      },
      'Query executed successfully'
    );
  } catch (error: any) {
    console.error('Error executing query:', error);
    return errorResponse(error.message || 'Failed to execute query', 500);
  }
}
