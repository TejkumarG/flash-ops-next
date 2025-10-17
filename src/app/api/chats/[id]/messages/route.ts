import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Chat from '@/models/Chat';
import Message from '@/models/Message';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { FASTAPI_ENDPOINTS, getApiUrl } from '@/lib/constants/api';

/**
 * GET /api/chats/[id]/messages
 * Get all messages for a specific chat
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('=== GET /api/chats/[id]/messages called ===');
  console.log('Chat ID:', params.id);

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    await connectDB();

    // Verify chat exists and user owns it
    const chat = await Chat.findById(params.id);
    console.log('Chat found:', chat ? 'yes' : 'no');

    if (!chat) {
      return errorResponse('Chat not found', 404);
    }

    if (chat.userId.toString() !== session.user.id) {
      return errorResponse('Unauthorized', 403);
    }

    // Fetch messages for this chat
    const messages = await Message.find({ chatId: params.id })
      .sort({ createdAt: 1 })
      .limit(100); // Limit to last 100 messages

    console.log('Messages found:', messages.length);
    console.log('Messages:', JSON.stringify(messages, null, 2));

    return successResponse({ messages });
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    return errorResponse(error.message || 'Failed to fetch messages', 500);
  }
}

/**
 * POST /api/chats/[id]/messages
 * Send a new message and get AI response from FastAPI (with streaming support)
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

    const body = await request.json();
    const { message } = body;

    if (!message) {
      return errorResponse('Message is required', 400);
    }

    await connectDB();

    // Verify chat exists and user owns it
    const chat = await Chat.findById(params.id).populate('databaseIds');
    if (!chat) {
      return errorResponse('Chat not found', 404);
    }

    if (chat.userId.toString() !== session.user.id) {
      return errorResponse('Unauthorized', 403);
    }

    // Create message document with user message (assistant message will be added later)
    const messageDoc = await Message.create({
      chatId: params.id,
      userMessage: message.trim(),
      assistantMessage: '', // Will be updated after FastAPI responds
    });

    // Prepare parameters for FastAPI
    const fastApiPayload = {
      chatId: params.id,
      databaseIds: chat.databaseIds.map((db: any) => db._id.toString()),
      message: message.trim(),
      stream: true,
    };

    console.log('Calling FastAPI with payload:', fastApiPayload);

    try {
      // Call FastAPI
      const fastApiUrl = getApiUrl(FASTAPI_ENDPOINTS.CHAT_COMPLETION);
      console.log('FastAPI URL:', fastApiUrl);

      const fastApiResponse = await fetch(fastApiUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fastApiPayload),
      });

      if (!fastApiResponse.ok) {
        const errorText = await fastApiResponse.text();
        console.error('FastAPI Error:', errorText);
        throw new Error(`FastAPI returned ${fastApiResponse.status}: ${errorText}`);
      }

      // Handle streaming response
      if (fastApiPayload.stream && fastApiResponse.body) {
        // Return streaming response to client
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              const reader = fastApiResponse.body!.getReader();
              const decoder = new TextDecoder();
              let fullResponse = '';
              let sqlQuery = '';
              let filePath = '';

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                // Parse SSE data from FastAPI
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const data = JSON.parse(line.slice(6));

                      // Extract chunk text and accumulate with space between chunks
                      if (data.chunk && data.chunk.trim()) {
                        fullResponse += (fullResponse ? ' ' : '') + data.chunk;
                        console.log('Sending chunk to client:', data.chunk);

                        // Send only the chunk to client
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                          chunk: data.chunk
                        })}\n\n`));
                      }

                      // Check for completion
                      if (data.is_complete) {
                        sqlQuery = data.sql_query || data.sqlQuery || '';
                        filePath = data.file_path || '';
                        console.log('Stream complete. Full response:', fullResponse);
                        console.log('SQL Query:', sqlQuery);
                      }
                    } catch (e) {
                      console.error('Failed to parse SSE line:', e, line);
                    }
                  }
                }
              }

              // Update message with accumulated response
              messageDoc.assistantMessage = fullResponse;
              messageDoc.sqlQuery = sqlQuery;
              await messageDoc.save();

              // Send completion signal
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  is_complete: true,
                  messageId: messageDoc._id,
                  sqlQuery: sqlQuery
                })}\n\n`)
              );

              // Update chat
              const chatDoc = await Chat.findById(params.id);
              if (chatDoc) {
                chatDoc.lastMessageAt = new Date();
                if (chatDoc.title === 'New Chat') {
                  // Use first sentence of assistant response as title
                  const firstSentence = fullResponse.split('.')[0];
                  chatDoc.title = firstSentence.slice(0, 50) + (firstSentence.length > 50 ? '...' : '');
                }
                await chatDoc.save();
              }

              controller.close();
            } catch (error) {
              console.error('Streaming error:', error);
              controller.error(error);
            }
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      }

      // Non-streaming fallback
      const fastApiData = await fastApiResponse.json();
      console.log('FastAPI Response:', fastApiData);

      // Update message with assistant response
      messageDoc.assistantMessage = fastApiData.response || fastApiData.message || 'No response from AI';
      messageDoc.sqlQuery = fastApiData.sqlQuery || fastApiData.sql_query;
      messageDoc.queryResults = fastApiData.queryResults || fastApiData.results;
      await messageDoc.save();

      // Update chat's lastMessageAt and title
      chat.lastMessageAt = new Date();
      if (chat.title === 'New Chat') {
        chat.title = generateChatTitle(message);
      }
      await chat.save();

      return successResponse({
        message: messageDoc,
      });
    } catch (fastApiError: any) {
      console.error('FastAPI call failed:', fastApiError);

      // If FastAPI fails, update message with error
      messageDoc.assistantMessage = `Sorry, I encountered an error while processing your request: ${fastApiError.message}\n\nPlease make sure the FastAPI server is running at the configured URL.`;
      await messageDoc.save();

      // Update chat's lastMessageAt and title
      chat.lastMessageAt = new Date();
      if (chat.title === 'New Chat') {
        chat.title = generateChatTitle(message);
      }
      await chat.save();

      return successResponse({
        message: messageDoc,
        error: fastApiError.message,
      });
    }
  } catch (error: any) {
    console.error('Error sending message:', error);
    return errorResponse(error.message || 'Failed to send message', 500);
  }
}

/**
 * Generate a chat title from the first message
 */
function generateChatTitle(message: string): string {
  // Take first 50 characters and add ellipsis if longer
  const title = message.trim().slice(0, 50);
  return message.length > 50 ? `${title}...` : title;
}
