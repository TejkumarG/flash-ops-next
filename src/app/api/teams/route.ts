import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Team from '@/models/Team';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/teams
 * Get all teams
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

    const teams = await Team.find()
      .populate('members', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    return successResponse({
      teams: teams.map((team) => ({
        id: team._id,
        name: team.name,
        description: team.description,
        members: team.members,
        memberCount: team.members.length,
        createdBy: team.createdBy,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching teams:', error);
    return errorResponse(error.message || 'Failed to fetch teams', 500);
  }
}

/**
 * POST /api/teams
 * Create a new team
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
    console.log('[TEAMS] Creating team with data:', JSON.stringify(body, null, 2));
    const { name, description, members } = body;

    // Validate inputs
    if (!name || name.trim().length < 2) {
      console.error('[TEAMS] Validation error: Team name too short');
      return errorResponse('Team name must be at least 2 characters', 400);
    }

    await connectDB();

    console.log('[TEAMS] Creating team object...');
    // Create team
    const team = await Team.create({
      name: name.trim(),
      description: description?.trim() || '',
      members: members || [],
      createdBy: session.user.id,
    });

    console.log('[TEAMS] Team created, populating members...');
    // Populate the team with member details
    await team.populate('members', 'name email');
    await team.populate('createdBy', 'name email');

    console.log('[TEAMS] Team created successfully:', team._id);
    return successResponse(
      {
        team: {
          id: team._id,
          name: team.name,
          description: team.description,
          members: team.members,
          memberCount: team.members.length,
          createdBy: team.createdBy,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
        },
      },
      'Team created successfully',
      201
    );
  } catch (error: any) {
    console.error('[TEAMS] Error creating team:', error);
    console.error('[TEAMS] Error stack:', error.stack);
    return errorResponse(error.message || 'Failed to create team', 500);
  }
}
