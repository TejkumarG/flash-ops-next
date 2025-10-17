import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Chat from '@/models/Chat';
import Message from '@/models/Message';
import Database from '@/models/Database';
import Access from '@/models/Access';
import Team from '@/models/Team';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/chats
 * Get all chats for the current user with message previews
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    await connectDB();

    console.log('=== GET /api/chats called ===');
    console.log('Current user ID:', session.user.id);
    console.log('Current user ID type:', typeof session.user.id);
    console.log('Current user email:', session.user.email);

    // First, check all chats in the database
    const allChats = await Chat.find({}).lean();
    console.log('Total chats in DB:', allChats.length);
    console.log('All chat user IDs:', allChats.map(c => ({
      id: c._id.toString(),
      userId: c.userId.toString(),
      userIdType: typeof c.userId
    })));

    // Try to match by converting ObjectId to string
    const mongoose = require('mongoose');
    const userIdQuery = mongoose.Types.ObjectId.isValid(session.user.id)
      ? new mongoose.Types.ObjectId(session.user.id)
      : session.user.id;

    console.log('User ID query:', userIdQuery);
    console.log('User ID query type:', typeof userIdQuery);

    // Fetch all chats for this user
    const chats = await Chat.find({ userId: userIdQuery })
      .populate('databaseIds', 'databaseName displayName connectionId')
      .populate({
        path: 'databaseIds',
        populate: {
          path: 'connectionId',
          select: 'name connectionType',
        },
      })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .lean();

    console.log('Chats found for user:', chats.length);

    // Enrich chats with message count and last message preview
    const enrichedChats = await Promise.all(
      chats.map(async (chat) => {
        // Get message count
        const messageCount = await Message.countDocuments({ chatId: chat._id });

        // Get last message
        const lastMessage = await Message.findOne({ chatId: chat._id })
          .sort({ createdAt: -1 })
          .select('userMessage assistantMessage createdAt')
          .lean();

        return {
          ...chat,
          messageCount,
          lastMessage: lastMessage
            ? {
                message: lastMessage.assistantMessage || lastMessage.userMessage,
                role: lastMessage.assistantMessage ? 'assistant' : 'user',
                createdAt: lastMessage.createdAt,
              }
            : null,
        };
      })
    );

    return successResponse({ chats: enrichedChats });
  } catch (error: any) {
    console.error('Error fetching chats:', error);
    return errorResponse(error.message || 'Failed to fetch chats', 500);
  }
}

/**
 * POST /api/chats
 * Create a new chat conversation with multiple databases
 */
export async function POST(request: NextRequest) {
  console.log('=== POST /api/chats called ===');
  let session: any = null;
  let databaseIds: any = null;

  try {
    console.log('Getting session...');
    session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const bodyData = body;
    databaseIds = bodyData.databaseIds;
    const { title } = bodyData;

    console.log('Request body:', body);
    console.log('Database IDs received:', databaseIds);
    console.log('Database IDs type:', typeof databaseIds, Array.isArray(databaseIds));

    if (!databaseIds || !Array.isArray(databaseIds) || databaseIds.length === 0) {
      return errorResponse('At least one database ID is required', 400);
    }

    await connectDB();

    // Verify all databases exist
    const databases = await Database.find({ _id: { $in: databaseIds } });
    if (databases.length !== databaseIds.length) {
      return errorResponse('One or more databases not found', 404);
    }

    // Verify user has access to all databases (skip for admins)
    if (session.user.role !== 'admin') {
      for (const dbId of databaseIds) {
        const hasAccess = await checkUserAccess(session.user.id, dbId);
        if (!hasAccess) {
          return errorResponse('You do not have access to all selected databases', 403);
        }
      }
    }

    // Create new chat
    const chat = await Chat.create({
      userId: session.user.id,
      databaseIds,
      title: title || 'New Chat',
      lastMessageAt: new Date(),
    });

    // Populate database info before returning
    await chat.populate('databaseIds', 'databaseName displayName connectionId');
    await chat.populate({
      path: 'databaseIds',
      populate: {
        path: 'connectionId',
        select: 'name connectionType',
      },
    });

    // Return enriched chat
    const enrichedChat = {
      ...chat.toObject(),
      messageCount: 0,
      lastMessage: null,
    };

    return successResponse({ chat: enrichedChat }, 'Chat created successfully', 201);
  } catch (error: any) {
    console.error('Error creating chat:', error);
    console.error('Error stack:', error.stack);
    console.error('Database IDs:', databaseIds);
    console.error('User ID:', session?.user?.id);
    console.error('User role:', session?.user?.role);
    return errorResponse(error.message || 'Failed to create chat', 500);
  }
}

/**
 * Check if user has access to a database
 * Checks both individual and team-based access
 */
async function checkUserAccess(
  userId: string,
  databaseId: string
): Promise<boolean> {
  // Check individual access
  const individualAccess = await Access.findOne({
    userId,
    databaseId,
    accessType: 'individual',
  });

  if (individualAccess) return true;

  // Check team-based access
  const userTeams = await Team.find({ members: userId });
  const teamIds = userTeams.map((team) => team._id);

  const teamAccess = await Access.findOne({
    databaseId,
    accessType: 'team',
    teamId: { $in: teamIds },
  });

  return !!teamAccess;
}
