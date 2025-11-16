import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import ApiKey from '@/models/ApiKey';
import Team from '@/models/Team';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import crypto from 'crypto';

/**
 * Generate a secure API key
 */
function generateApiKey(): { fullKey: string; prefix: string } {
  const randomPart = crypto.randomBytes(24).toString('hex');
  const timestamp = Date.now().toString(36);
  const fullKey = `flash_${randomPart}_${timestamp}`;
  const prefix = fullKey.substring(0, 13); // flash_xxxxx
  return { fullKey, prefix };
}

/**
 * GET /api/teams/[id]/api-keys
 * List API keys for a team
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

    const teamId = params.id;

    await connectDB();

    // Check if user has access to this team
    const team = await Team.findById(teamId);
    if (!team) {
      return errorResponse('Team not found', 404);
    }

    // Admin can see all, or must be team member
    if (
      session.user.role !== 'admin' &&
      !team.members.includes(session.user.id as any)
    ) {
      return errorResponse('Forbidden: Not a member of this team', 403);
    }

    const apiKeys = await ApiKey.find({ teamId })
      .populate('createdBy', 'name email')
      .populate('teamId', 'name')
      .sort({ createdAt: -1 });

    return successResponse(
      { apiKeys },
      'API keys retrieved successfully'
    );
  } catch (error: any) {
    console.error('Error fetching API keys:', error);
    return errorResponse(error.message || 'Failed to fetch API keys', 500);
  }
}

/**
 * POST /api/teams/[id]/api-keys
 * Generate new API key for a team
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    const teamId = params.id;
    const body = await request.json();
    const { name, expiresInDays = 90 } = body;

    if (!name) {
      return errorResponse('API key name is required', 400);
    }

    await connectDB();

    // Check if user has access to this team
    const team = await Team.findById(teamId);
    if (!team) {
      return errorResponse('Team not found', 404);
    }

    // Admin or team member can create keys
    if (
      session.user.role !== 'admin' &&
      !team.members.includes(session.user.id as any)
    ) {
      return errorResponse('Forbidden: Not a member of this team', 403);
    }

    // Generate API key
    const { fullKey, prefix } = generateApiKey();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Create API key record (key will be hashed by pre-save hook)
    const apiKey = await ApiKey.create({
      key: fullKey,
      keyPrefix: prefix,
      name,
      teamId,
      createdBy: session.user.id,
      expiresAt,
      isActive: true,
      permissions: ['query:read'],
    });

    // Populate for response
    await apiKey.populate('createdBy', 'name email');
    await apiKey.populate('teamId', 'name');

    return successResponse(
      {
        apiKey: {
          ...apiKey.toJSON(),
          fullKey, // Show full key ONLY on creation
        },
        warning: 'Save this API key securely. It will not be shown again!',
      },
      'API key created successfully',
      201
    );
  } catch (error: any) {
    console.error('Error creating API key:', error);
    return errorResponse(error.message || 'Failed to create API key', 500);
  }
}
