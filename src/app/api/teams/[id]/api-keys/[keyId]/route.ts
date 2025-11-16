import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import ApiKey from '@/models/ApiKey';
import Team from '@/models/Team';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * DELETE /api/teams/[id]/api-keys/[keyId]
 * Revoke an API key
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; keyId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id: teamId, keyId } = params;

    await connectDB();

    // Check if user has access to this team
    const team = await Team.findById(teamId);
    if (!team) {
      return errorResponse('Team not found', 404);
    }

    // Admin or team member can revoke keys
    if (
      session.user.role !== 'admin' &&
      !team.members.includes(session.user.id as any)
    ) {
      return errorResponse('Forbidden: Not a member of this team', 403);
    }

    // Find and revoke the API key
    const apiKey = await ApiKey.findById(keyId);
    if (!apiKey) {
      return errorResponse('API key not found', 404);
    }

    if (apiKey.teamId.toString() !== teamId) {
      return errorResponse('API key does not belong to this team', 403);
    }

    // Soft delete by marking as inactive
    apiKey.isActive = false;
    await apiKey.save();

    return successResponse(
      { apiKey },
      'API key revoked successfully'
    );
  } catch (error: any) {
    console.error('Error revoking API key:', error);
    return errorResponse(error.message || 'Failed to revoke API key', 500);
  }
}

/**
 * GET /api/teams/[id]/api-keys/[keyId]
 * Get details of a specific API key
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; keyId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id: teamId, keyId } = params;

    await connectDB();

    // Check if user has access to this team
    const team = await Team.findById(teamId);
    if (!team) {
      return errorResponse('Team not found', 404);
    }

    if (
      session.user.role !== 'admin' &&
      !team.members.includes(session.user.id as any)
    ) {
      return errorResponse('Forbidden: Not a member of this team', 403);
    }

    const apiKey = await ApiKey.findById(keyId)
      .populate('createdBy', 'name email')
      .populate('teamId', 'name');

    if (!apiKey) {
      return errorResponse('API key not found', 404);
    }

    if (apiKey.teamId._id.toString() !== teamId) {
      return errorResponse('API key does not belong to this team', 403);
    }

    return successResponse(
      { apiKey },
      'API key retrieved successfully'
    );
  } catch (error: any) {
    console.error('Error fetching API key:', error);
    return errorResponse(error.message || 'Failed to fetch API key', 500);
  }
}
