import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Chat from '@/models/Chat';
import Message from '@/models/Message';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/chats/[id]
 * Get a specific chat by ID
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

    const chat = await Chat.findById(params.id)
      .populate('databaseIds', 'databaseName displayName connectionId')
      .populate({
        path: 'databaseIds',
        populate: {
          path: 'connectionId',
          select: 'name connectionType',
        },
      });

    if (!chat) {
      return errorResponse('Chat not found', 404);
    }

    // Verify user owns this chat
    if (chat.userId.toString() !== session.user.id) {
      return errorResponse('Unauthorized', 403);
    }

    return successResponse({ chat });
  } catch (error: any) {
    console.error('Error fetching chat:', error);
    return errorResponse(error.message || 'Failed to fetch chat', 500);
  }
}

/**
 * PUT /api/chats/[id]
 * Update a chat (e.g., change title)
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

    const body = await request.json();
    const { title } = body;

    if (!title) {
      return errorResponse('Title is required', 400);
    }

    await connectDB();

    const chat = await Chat.findById(params.id);

    if (!chat) {
      return errorResponse('Chat not found', 404);
    }

    // Verify user owns this chat
    if (chat.userId.toString() !== session.user.id) {
      return errorResponse('Unauthorized', 403);
    }

    // Update title
    chat.title = title;
    await chat.save();

    await chat.populate('databaseIds', 'databaseName displayName connectionId');
    await chat.populate({
      path: 'databaseIds',
      populate: {
        path: 'connectionId',
        select: 'name connectionType',
      },
    });

    return successResponse({ chat }, 'Chat updated successfully');
  } catch (error: any) {
    console.error('Error updating chat:', error);
    return errorResponse(error.message || 'Failed to update chat', 500);
  }
}

/**
 * DELETE /api/chats/[id]
 * Delete a chat and all its messages
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

    await connectDB();

    const chat = await Chat.findById(params.id);

    if (!chat) {
      return errorResponse('Chat not found', 404);
    }

    // Verify user owns this chat
    if (chat.userId.toString() !== session.user.id) {
      return errorResponse('Unauthorized', 403);
    }

    // Delete all messages in this chat
    await Message.deleteMany({ chatId: params.id });

    // Delete the chat
    await chat.deleteOne();

    return successResponse(null, 'Chat deleted successfully');
  } catch (error: any) {
    console.error('Error deleting chat:', error);
    return errorResponse(error.message || 'Failed to delete chat', 500);
  }
}
