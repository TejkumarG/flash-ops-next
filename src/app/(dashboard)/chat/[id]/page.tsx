'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Send,
  Loader2,
  User,
  Bot,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface DatabaseType {
  _id: string;
  databaseName: string;
  displayName?: string;
  connectionId: {
    name: string;
    connectionType: string;
  };
}

interface Chat {
  _id: string;
  userId: string;
  databaseIds: DatabaseType[];
  title: string;
  lastMessageAt: Date;
  createdAt: Date;
}

interface Message {
  _id?: string;
  chatId?: string;
  userMessage: string;
  assistantMessage: string;
  sqlQuery?: string;
  createdAt?: Date;
}

export default function ChatViewPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const chatId = params.id as string;

  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch chat details
  useEffect(() => {
    if (chatId) {
      fetchChat();
      fetchMessages();
    }
  }, [chatId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChat = async () => {
    try {
      setIsLoadingChat(true);
      const response = await fetch(`/api/chats/${chatId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Chat not found');
          router.push('/chat');
          return;
        }
        throw new Error('Failed to fetch chat');
      }
      const data = await response.json();
      setChat(data.data?.chat || data.chat);
    } catch (error) {
      console.error('Error fetching chat:', error);
      toast.error('Failed to load chat');
    } finally {
      setIsLoadingChat(false);
    }
  };

  const fetchMessages = async () => {
    try {
      setIsLoadingMessages(true);
      const response = await fetch(`/api/chats/${chatId}/messages`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      setMessages(data.data?.messages || data.messages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSending || !chat) return;

    const optimisticMessage: Message = {
      userMessage: inputMessage.trim(),
      assistantMessage: '',
    };

    // Optimistic update
    setMessages((prev) => [...prev, optimisticMessage]);
    setInputMessage('');
    setIsSending(true);
    setStreamingMessage('');

    try {
      // Send message and handle streaming
      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: optimisticMessage.userMessage }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const contentType = response.headers.get('content-type');

      // Handle streaming response
      if (contentType?.includes('text/event-stream')) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error('No reader available');

        let fullResponse = '';
        let sqlQuery = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                // Handle chunk from FastAPI with space between chunks
                if (data.chunk && data.chunk.trim()) {
                  fullResponse += (fullResponse ? ' ' : '') + data.chunk;
                  setStreamingMessage(fullResponse);

                  // Update the last message with streaming content
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      ...updated[updated.length - 1],
                      assistantMessage: fullResponse,
                    };
                    return updated;
                  });
                }

                // Handle completion
                if (data.is_complete || data.done) {
                  sqlQuery = data.sqlQuery || data.sql_query || '';

                  // Update with final message including SQL
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      _id: data.messageId,
                      userMessage: updated[updated.length - 1].userMessage,
                      assistantMessage: fullResponse,
                      sqlQuery: sqlQuery,
                    };
                    return updated;
                  });
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e, line);
              }
            }
          }
        }

        setStreamingMessage('');
      } else {
        // Non-streaming fallback
        const data = await response.json();

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = data.data?.message || data.message;
          return updated;
        });
      }

      // Trigger sidebar refresh by dispatching a custom event
      window.dispatchEvent(new Event('chatUpdated'));
    } catch (error: any) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
      // Remove optimistic message on error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsSending(false);
    }
  };

  if (isLoadingChat) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500">Chat not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 rounded-3xl shadow-2xl border border-slate-200/50 dark:border-slate-800/50 overflow-hidden">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 pointer-events-none rounded-3xl" />

      {/* Chat Header */}
      <div className="relative p-6 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
          {chat.title}
        </h3>
        <div className="flex flex-wrap gap-2">
          {chat.databaseIds.map((db) => (
            <div
              key={db._id}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs"
            >
              <Database className="w-3 h-3 text-blue-500" />
              <span className="font-medium text-blue-700 dark:text-blue-300">
                {db.displayName || db.databaseName}
              </span>
              <span className="text-blue-500 dark:text-blue-400">·</span>
              <span className="text-blue-600 dark:text-blue-400">
                {db.connectionId.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Messages Area */}
      <div className="relative flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
          {isLoadingMessages ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 mb-4 shadow-lg shadow-blue-500/25"
                >
                  <Sparkles className="w-10 h-10 text-white" />
                </motion.div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                  Start Chatting
                </h3>
                <p className="text-slate-600 dark:text-slate-400 max-w-sm mb-4 mx-auto">
                  Ask questions in natural language about your data
                </p>
                <div className="space-y-2 text-sm text-left bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 max-w-md mx-auto">
                  <p className="text-slate-500 dark:text-slate-400 font-medium mb-2">
                    Try asking:
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">
                    • "Show me all users created this month"
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">
                    • "What's the total revenue by product?"
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">
                    • "List top 10 customers by orders"
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <AnimatePresence initial={false}>
                {messages.map((msg, index) => (
                  <motion.div
                    key={msg._id || index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4"
                  >
                    {/* User Question */}
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                          You asked
                        </p>
                        <p className="text-sm text-slate-900 dark:text-white leading-relaxed">
                          {msg.userMessage}
                        </p>
                      </div>
                    </div>

                    {/* Divider */}
                    {msg.assistantMessage && (
                      <div className="border-t border-slate-200 dark:border-slate-700" />
                    )}

                    {/* Assistant Response */}
                    {msg.assistantMessage && (
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            AI Response
                          </p>
                          <p className="text-sm text-slate-900 dark:text-white leading-relaxed whitespace-pre-wrap">
                            {msg.assistantMessage}
                          </p>
                          {msg.sqlQuery && (
                            <div className="mt-3">
                              <div className="flex items-center space-x-2 mb-2">
                                <Sparkles className="w-3 h-3 text-indigo-500" />
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                  Generated SQL
                                </span>
                              </div>
                              <pre className="text-xs bg-slate-900 dark:bg-slate-950 text-green-400 rounded-lg p-3 overflow-x-auto">
                                {msg.sqlQuery}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="relative p-6 border-t border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50">
        <div className="max-w-5xl mx-auto">
          <form onSubmit={handleSendMessage} className="space-y-2">
            <div className="relative flex items-center gap-2">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder="Ask a question about your data..."
                rows={1}
                className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 resize-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all"
                disabled={isSending}
              />
              <motion.button
                type="submit"
                whileHover={
                  inputMessage.trim() && !isSending
                    ? { scale: 1.05 }
                    : {}
                }
                whileTap={
                  inputMessage.trim() && !isSending
                    ? { scale: 0.95 }
                    : {}
                }
                disabled={!inputMessage.trim() || isSending}
                className={`p-3 rounded-xl font-semibold transition-all flex items-center justify-center ${
                  !inputMessage.trim() || isSending
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                }`}
              >
                {isSending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </motion.button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Press Enter to send, Shift+Enter for new line
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
