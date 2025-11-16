'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as XLSX from 'xlsx';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Database,
  Send,
  Loader2,
  User,
  Bot,
  Sparkles,
  Table,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  FileSpreadsheet,
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

interface QueryResult {
  status: string;
  query: string;
  tables_used?: string[];
  tier?: number;
  row_count?: number;
  result?: any[] | null;
  csv_path?: string | null;
  sql_generated?: string;
  joins?: any[];
  execution_time_ms?: number;
  confidence?: number;
  error_message?: string | null;
  suggestions?: string | null;
  formatted_result?: string;
  file_path?: string | null;
}

interface Message {
  _id?: string;
  chatId?: string;
  userMessage: string;
  assistantMessage: string;
  sqlQuery?: string;
  queryResults?: QueryResult[];
  createdAt?: Date;
}

/**
 * Component to display query results in a modal
 * Handles both inline results and file-based results from MinIO
 */
function QueryResultDisplay({ result }: { result: QueryResult }) {
  const [data, setData] = useState<any[] | null>(result.result || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchDataFromMinio = async () => {
    if (hasFetched || !result.file_path) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/query-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s3Path: result.file_path }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch data from storage');
      }

      const responseData = await response.json();
      const fetchedData = responseData.data?.data || [];
      setData(fetchedData);
      setHasFetched(true);
    } catch (err: any) {
      console.error('Error fetching data from MinIO:', err);
      setError(err.message);
      toast.error('Failed to load query results from storage');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle modal open
  const handleOpenModal = () => {
    setIsModalOpen(true);
    // If data needs to be fetched from MinIO
    if (result.file_path && !data && !hasFetched) {
      fetchDataFromMinio();
    }
  };

  // Export to Excel
  const handleExportToExcel = () => {
    if (!data || data.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `query_results_${timestamp}.xlsx`;

      XLSX.writeFile(workbook, filename);
      toast.success('Excel file downloaded successfully');
    } catch (err: any) {
      console.error('Error exporting to Excel:', err);
      toast.error('Failed to export to Excel');
    }
  };

  // Get table columns from first row
  const columns = data && data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div className="mt-4 space-y-3">
      {/* Query Metadata */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {result.status === 'success' && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
            <CheckCircle className="w-3 h-3" />
            Success
          </span>
        )}
        {result.row_count !== undefined && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
            <Table className="w-3 h-3" />
            {result.row_count.toLocaleString()} rows
          </span>
        )}
        {result.execution_time_ms && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
            <Clock className="w-3 h-3" />
            {result.execution_time_ms}ms
          </span>
        )}
        {result.file_path && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded">
            <Download className="w-3 h-3" />
            Stored in MinIO
          </span>
        )}
      </div>

      {/* SQL Query */}
      {result.sql_generated && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Generated SQL
            </span>
          </div>
          <pre className="text-xs bg-slate-900 dark:bg-slate-950 text-green-400 rounded-lg p-3 overflow-x-auto">
            {result.sql_generated}
          </pre>
        </div>
      )}

      {/* View Results Button */}
      {(data || result.file_path) && (
        <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
          <Dialog.Trigger asChild>
            <button
              onClick={handleOpenModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Table className="w-4 h-4" />
              View Results
            </button>
          </Dialog.Trigger>

          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-50 w-[90vw] max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
                <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-white">
                  Query Results ({result.row_count?.toLocaleString() || 0} rows)
                </Dialog.Title>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportToExcel}
                    disabled={!data || data.length === 0 || isLoading}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Export to Excel
                  </button>
                  <Dialog.Close asChild>
                    <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <X className="w-5 h-5 text-slate-500" />
                    </button>
                  </Dialog.Close>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-auto p-6">
                {isLoading && (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                  </div>
                )}

                {data && data.length > 0 && !isLoading && (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                          <tr>
                            {columns.map((col) => (
                              <th
                                key={col}
                                className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.map((row, idx) => (
                            <tr
                              key={idx}
                              className="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 last:border-0"
                            >
                              {columns.map((col) => {
                                const value = row[col];
                                let displayValue = '-';

                                if (value !== null && value !== undefined) {
                                  if (typeof value === 'object') {
                                    displayValue = JSON.stringify(value);
                                  } else {
                                    displayValue = String(value);
                                  }
                                }

                                return (
                                  <td
                                    key={col}
                                    className="px-4 py-3 text-slate-600 dark:text-slate-400"
                                    style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                    title={displayValue}
                                  >
                                    {displayValue}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {data && data.length === 0 && !isLoading && (
                  <div className="text-center py-16 text-sm text-slate-500">
                    No data to display
                  </div>
                )}
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
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
                  const queryResults = data.queryResults || [];

                  console.log('Stream completed:', {
                    messageId: data.messageId,
                    sqlQuery,
                    queryResults,
                  });

                  // Update with final message including SQL and queryResults
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      _id: data.messageId,
                      userMessage: updated[updated.length - 1].userMessage,
                      assistantMessage: fullResponse,
                      sqlQuery: sqlQuery,
                      queryResults: queryResults,
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

      // Refresh chat title and trigger sidebar refresh
      await fetchChat();
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
      <div className="relative p-6 border-b border-slate-200/50 dark:border-slate-800/50 bg-gradient-to-r from-white/80 to-slate-50/80 dark:from-slate-900/80 dark:to-slate-800/80">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            {chat.title}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {chat.databaseIds.map((db) => (
            <div
              key={db._id}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200/60 dark:border-blue-700/60 rounded-lg text-xs shadow-sm"
            >
              <Database className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="font-semibold text-blue-800 dark:text-blue-200">
                {db.displayName || db.databaseName}
              </span>
              <span className="text-blue-400 dark:text-blue-500">·</span>
              <span className="text-blue-700 dark:text-blue-300">
                {db.connectionId.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 relative overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-4 h-full">
          {isLoadingMessages ? (
            <div className="h-full flex items-center justify-center min-h-[400px]">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center min-h-[400px]">
              <div className="text-center max-w-2xl">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 mb-6 shadow-2xl shadow-blue-500/30"
                >
                  <Sparkles className="w-12 h-12 text-white" />
                </motion.div>
                <h3 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent mb-3">
                  Ask Anything About Your Data
                </h3>
                <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
                  Transform natural language into powerful SQL queries instantly
                </p>
                <div className="grid grid-cols-1 gap-3 text-sm text-left max-w-lg mx-auto">
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-200/50 dark:border-blue-800/50 rounded-xl hover:shadow-md transition-shadow">
                    <p className="text-slate-700 dark:text-slate-300 font-medium">
                      "Show me customers who placed orders in the last 30 days"
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 border border-purple-200/50 dark:border-purple-800/50 rounded-xl hover:shadow-md transition-shadow">
                    <p className="text-slate-700 dark:text-slate-300 font-medium">
                      "What are the top selling products by revenue?"
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 border border-emerald-200/50 dark:border-emerald-800/50 rounded-xl hover:shadow-md transition-shadow">
                    <p className="text-slate-700 dark:text-slate-300 font-medium">
                      "Find all pending orders with amount greater than 1000"
                    </p>
                  </div>
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
                    className="bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-6 space-y-4 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 hover:shadow-xl hover:shadow-slate-200/60 dark:hover:shadow-slate-900/60 transition-shadow"
                  >
                    {/* User Question */}
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30">
                        <User className="w-4.5 h-4.5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1.5">
                          Your Question
                        </p>
                        <p className="text-base text-slate-900 dark:text-white leading-relaxed font-medium">
                          {msg.userMessage}
                        </p>
                      </div>
                    </div>

                    {/* Divider */}
                    {msg.assistantMessage && (
                      <div className="border-t border-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-slate-600" />
                    )}

                    {/* Assistant Response */}
                    {msg.assistantMessage && (
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-purple-600 shadow-lg shadow-purple-500/30">
                          <Bot className="w-4.5 h-4.5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1.5">
                            AI Analysis
                          </p>
                          <div className="text-base text-slate-900 dark:text-white leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.assistantMessage}
                            </ReactMarkdown>
                          </div>

                          {/* Query Results */}
                          {msg.queryResults && msg.queryResults.length > 0 && (
                            <div className="mt-4 space-y-4">
                              {msg.queryResults.map((result, idx) => (
                                <QueryResultDisplay key={idx} result={result} />
                              ))}
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
