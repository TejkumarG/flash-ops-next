import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Team from '@/models/Team';
import Access from '@/models/Access';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/teams/[id]
 * Get a single team
 * Admin only
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

    if (session.user.role !== 'admin') {
      return errorResponse('Forbidden: Admin access required', 403);
    }

    await connectDB();

    const team = await Team.findById(params.id)
      .populate('members', 'name email')
      .populate('createdBy', 'name email');

    if (!team) {
      return errorResponse('Team not found', 404);
    }

    return successResponse({
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
    });
  } catch (error: any) {
    console.error('Error fetching team:', error);
    return errorResponse(error.message || 'Failed to fetch team', 500);
  }
}

/**
 * PUT /api/teams/[id]
 * Update a team
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
    const { name, description, members } = body;

    // Validate inputs
    if (name && name.trim().length < 2) {
      return errorResponse('Team name must be at least 2 characters', 400);
    }

    await connectDB();

    const team = await Team.findById(params.id);
    if (!team) {
      return errorResponse('Team not found', 404);
    }

    // Update fields
    if (name) team.name = name.trim();
    if (description !== undefined) team.description = description.trim();
    if (members) team.members = members;

    await team.save();

    // Populate the team with member details
    await team.populate('members', 'name email');
    await team.populate('createdBy', 'name email');

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
      'Team updated successfully'
    );
  } catch (error: any) {
    console.error('Error updating team:', error);
    return errorResponse(error.message || 'Failed to update team', 500);
  }
}

/**
 * DELETE /api/teams/[id]
 * Delete a team
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

    const team = await Team.findById(params.id);
    if (!team) {
      return errorResponse('Team not found', 404);
    }

    // Delete all access records associated with this team
    await Access.deleteMany({ teamId: params.id });

    // Delete the team
    await Team.findByIdAndDelete(params.id);

    return successResponse(
      { id: params.id },
      'Team deleted successfully'
    );
  } catch (error: any) {
    console.error('Error deleting team:', error);
    return errorResponse(error.message || 'Failed to delete team', 500);
  }
}
