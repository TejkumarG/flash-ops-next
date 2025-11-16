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
      database_ids: chat.databaseIds.map((db: any) => db._id.toString()),
      query: message.trim(),
    };

    console.log('Calling FastAPI with payload:', fastApiPayload);

    try {
      // Call FastAPI
      const fastApiUrl = getApiUrl(FASTAPI_ENDPOINTS.CHAT_COMPLETION);
      console.log('FastAPI URL:', fastApiUrl);

      // Create AbortController for timeout
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 100000); // 100 seconds

      const fastApiResponse = await fetch(fastApiUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fastApiPayload),
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!fastApiResponse.ok) {
        const errorText = await fastApiResponse.text();
        console.error('FastAPI Error:', errorText);
        throw new Error(`FastAPI returned ${fastApiResponse.status}: ${errorText}`);
      }

      // Handle streaming response
      const contentType = fastApiResponse.headers.get('content-type');
      const isStreaming = contentType?.includes('text/event-stream') || contentType?.includes('application/x-ndjson');

      if (isStreaming && fastApiResponse.body) {
        // Return streaming response to client
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              const reader = fastApiResponse.body!.getReader();
              const decoder = new TextDecoder();
              let fullResponse = '';
              let sqlQuery = '';
              let queryResults: any[] = [];

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
                      console.log('Received SSE data from FastAPI:', data);

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
                        queryResults = data.queryResults || data.results || data.query_results || [];
                        console.log('=== Stream complete ===');
                        console.log('Full response:', fullResponse);
                        console.log('SQL Query:', sqlQuery);
                        console.log('Query Results length:', queryResults.length);
                        console.log('Query Results:', JSON.stringify(queryResults, null, 2));
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
              messageDoc.queryResults = queryResults;
              await messageDoc.save();

              // Send completion signal with queryResults
              console.log('Sending completion signal with queryResults:', queryResults);
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  is_complete: true,
                  messageId: messageDoc._id,
                  sqlQuery: sqlQuery,
                  queryResults: queryResults
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

      // Handle array response (FastAPI returns array of query results)
      let queryResults = [];
      let assistantMessage = '';
      let sqlQuery = '';

      if (Array.isArray(fastApiData)) {
        // FastAPI returns array directly
        queryResults = fastApiData;

        // Extract formatted_result from first result for assistant message
        if (queryResults.length > 0 && queryResults[0].formatted_result) {
          assistantMessage = queryResults[0].formatted_result;
          sqlQuery = queryResults[0].sql_generated || '';
        }
      } else {
        // Handle object response
        assistantMessage = fastApiData.response || fastApiData.message || fastApiData.formatted_result || '';
        sqlQuery = fastApiData.sqlQuery || fastApiData.sql_query || '';
        queryResults = fastApiData.queryResults || fastApiData.results || [];
      }

      // Update message with assistant response
      messageDoc.assistantMessage = assistantMessage || 'Query executed successfully';
      messageDoc.sqlQuery = sqlQuery;
      messageDoc.queryResults = queryResults;
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
