'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Send,
  ChevronDown,
  Loader2,
  User,
  Bot,
  MessageSquare,
  Sparkles,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  Check,
  X,
  CheckSquare,
  Square,
  Search,
  ArrowLeft,
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
  messageCount?: number;
  lastMessage?: {
    message: string;
    role: 'user' | 'assistant';
    createdAt: Date;
  } | null;
}

interface Message {
  _id?: string;
  chatId?: string;
  userMessage: string;
  assistantMessage: string;
  sqlQuery?: string;
  createdAt?: Date;
}

export default function ChatPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [databases, setDatabases] = useState<DatabaseType[]>([]);
  const [selectedDatabaseIds, setSelectedDatabaseIds] = useState<string[]>([]);
  const [showDatabaseSelector, setShowDatabaseSelector] = useState(false);
  const [databaseSearchQuery, setDatabaseSearchQuery] = useState('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [streamingMessage, setStreamingMessage] = useState('');
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch accessible databases
  useEffect(() => {
    fetchDatabases();
  }, []);

  // Fetch chats
  useEffect(() => {
    fetchChats();
  }, []);

  // Fetch messages when chat changes
  useEffect(() => {
    if (selectedChat) {
      fetchMessages();
      // Update selected databases when switching chats
      setSelectedDatabaseIds(selectedChat.databaseIds.map((db) => db._id));
    } else {
      setMessages([]);
    }
  }, [selectedChat]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchDatabases = async () => {
    try {
      setIsLoadingDatabases(true);
      const response = await fetch('/api/databases');
      if (!response.ok) throw new Error('Failed to fetch databases');
      const result = await response.json();
      setDatabases(result.data?.databases || []);
    } catch (error) {
      toast.error('Failed to load databases');
    } finally {
      setIsLoadingDatabases(false);
    }
  };

  const fetchChats = async () => {
    setIsLoadingChats(true);
    try {
      const response = await fetch('/api/chats');
      if (!response.ok) throw new Error('Failed to fetch chats');
      const data = await response.json();
      setChats(data.chats || []);
    } catch (error) {
      toast.error('Failed to load chats');
    } finally {
      setIsLoadingChats(false);
    }
  };

  const fetchMessages = async () => {
    if (!selectedChat) return;

    setIsLoadingMessages(true);
    try {
      const response = await fetch(`/api/chats/${selectedChat._id}/messages`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      toast.error('Failed to load messages');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleNewChat = () => {
    // Reset to new chat mode
    setSelectedChat(null);
    setMessages([]);
    setSelectedDatabaseIds([]);
    setShowDatabaseSelector(true);
    toast.info('Select databases to start a new chat');
  };

  const toggleDatabaseSelection = (dbId: string) => {
    setSelectedDatabaseIds((prev) =>
      prev.includes(dbId)
        ? prev.filter((id) => id !== dbId)
        : [...prev, dbId]
    );
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete chat');

      setChats((prev) => prev.filter((c) => c._id !== chatId));

      if (selectedChat?._id === chatId) {
        setSelectedChat(null);
        setMessages([]);
        setSelectedDatabaseIds([]);
      }

      toast.success('Chat deleted');
    } catch (error) {
      toast.error('Failed to delete chat');
    }
  };

  const handleEditChatTitle = async (chatId: string, newTitle: string) => {
    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });

      if (!response.ok) throw new Error('Failed to update chat');

      const data = await response.json();
      const updatedChat = data.chat;

      setChats((prev) =>
        prev.map((c) => (c._id === chatId ? updatedChat : c))
      );

      if (selectedChat?._id === chatId) {
        setSelectedChat(updatedChat);
      }

      setEditingChatId(null);
      setEditingTitle('');
      toast.success('Chat renamed');
    } catch (error) {
      toast.error('Failed to rename chat');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSending) return;

    // Validate database selection
    if (selectedDatabaseIds.length === 0) {
      toast.error('Please select at least one database');
      setShowDatabaseSelector(true);
      return;
    }

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
      let chatId = selectedChat?._id;
      const isNewChat = !selectedChat; // Track if this is a new chat

      // If no chat selected, create a new one first
      if (!chatId) {
        // Use first message as chat title (first 50 chars)
        const chatTitle = optimisticMessage.userMessage.length > 50
          ? optimisticMessage.userMessage.substring(0, 50) + '...'
          : optimisticMessage.userMessage;

        const createChatResponse = await fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            databaseIds: selectedDatabaseIds,
            title: chatTitle,
          }),
        });

        if (!createChatResponse.ok) throw new Error('Failed to create chat');

        const chatData = await createChatResponse.json();
        const newChat = chatData.data?.chat || chatData.chat;

        chatId = newChat._id;

        // Update chats list (don't set selectedChat yet - wait until after response)
        setChats((prev) => [newChat, ...prev]);

        // Trigger sidebar refresh
        window.dispatchEvent(new Event('chatUpdated'));
      }

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
                    if (updated.length > 0) {
                      updated[updated.length - 1] = {
                        ...updated[updated.length - 1],
                        assistantMessage: fullResponse,
                      };
                    }
                    return updated;
                  });
                }

                // Handle completion (is_complete from FastAPI or done from Next.js)
                if (data.is_complete || data.done) {
                  sqlQuery = data.sqlQuery || data.sql_query || '';

                  // Update with final message including SQL
                  setMessages((prev) => {
                    const updated = [...prev];
                    if (updated.length > 0) {
                      const lastMessage = updated[updated.length - 1];
                      updated[updated.length - 1] = {
                        _id: data.messageId,
                        userMessage: lastMessage.userMessage,
                        assistantMessage: fullResponse,
                        sqlQuery: sqlQuery,
                      };
                    }
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
        // Refresh chat list to update lastMessageAt and title
        await fetchChats();

        // Navigate to chat page after response completes
        if (isNewChat && chatId) {
          router.push(`/chat/${chatId}`);
        }
      } else {
        // Non-streaming fallback
        const data = await response.json();

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = data.message;
          return updated;
        });

        await fetchChats();

        // Navigate to chat page after response completes
        if (isNewChat && chatId) {
          router.push(`/chat/${chatId}`);
        }
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
      // Remove optimistic message on error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsSending(false);
    }
  };

  const getSelectedDatabasesLabel = () => {
    if (selectedDatabaseIds.length === 0) return 'Select Databases';
    if (selectedDatabaseIds.length === 1) {
      const db = databases.find((d) => d._id === selectedDatabaseIds[0]);
      return db?.displayName || db?.databaseName || 'Database';
    }
    return `${selectedDatabaseIds.length} databases selected`;
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(date).toLocaleDateString();
  };

  // Filter databases based on search query
  const filteredDatabases = databases.filter((db) => {
    const searchLower = databaseSearchQuery.toLowerCase();
    return (
      db.databaseName.toLowerCase().includes(searchLower) ||
      db.displayName?.toLowerCase().includes(searchLower) ||
      db.connectionId.name.toLowerCase().includes(searchLower)
    );
  });

  // Show loading screen while databases are being fetched
  if (isLoadingDatabases) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)]">
      {!selectedChat ? (
        // New Chat - Database Selection (Full Screen)
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="h-full backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 rounded-3xl shadow-2xl border border-slate-200/50 dark:border-slate-800/50 overflow-hidden flex flex-col"
        >
          {/* Loading overlay when sending message */}
          {isSending && (
            <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center rounded-3xl">
              <div className="text-center">
                <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
                <p className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Sending message...</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">AI is analyzing your query</p>
              </div>
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 pointer-events-none rounded-3xl" />

          {/* Header */}
          <div className="relative p-6 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                  New Chat
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Select databases to start chatting
                </p>
              </div>
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25"
              >
                <Sparkles className="w-8 h-8 text-white" />
              </motion.div>
            </div>
          </div>

          {/* Database Selection */}
          <div className="relative flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
              {/* Search Bar */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={databaseSearchQuery}
                  onChange={(e) => setDatabaseSearchQuery(e.target.value)}
                  placeholder="Search databases..."
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all"
                />
              </div>

              {/* Selected Count */}
              {selectedDatabaseIds.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl"
                >
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    {selectedDatabaseIds.length} database{selectedDatabaseIds.length !== 1 ? 's' : ''} selected
                  </p>
                </motion.div>
              )}

              {/* Database List */}
              <div className="space-y-3">
                {filteredDatabases.length === 0 ? (
                  <div className="text-center py-12">
                    <Database className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No databases found
                    </p>
                  </div>
                ) : (
                  filteredDatabases.map((db) => {
                    const isSelected = selectedDatabaseIds.includes(db._id);
                    return (
                      <motion.button
                        key={db._id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => toggleDatabaseSelection(db._id)}
                        className={`w-full p-4 rounded-xl text-left transition-all border-2 ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-lg shadow-blue-500/10'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                              isSelected
                                ? 'bg-gradient-to-br from-blue-500 to-indigo-500'
                                : 'bg-slate-100 dark:bg-slate-700'
                            }`}>
                              <Database className={`w-5 h-5 ${
                                isSelected ? 'text-white' : 'text-slate-500 dark:text-slate-400'
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium text-sm truncate ${
                                isSelected
                                  ? 'text-blue-700 dark:text-blue-300'
                                  : 'text-slate-900 dark:text-white'
                              }`}>
                                {db.displayName || db.databaseName}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {db.connectionId.name} · {db.connectionId.connectionType}
                              </p>
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-3">
                            {isSelected ? (
                              <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center">
                                <CheckSquare className="w-4 h-4 text-white" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-lg border-2 border-slate-300 dark:border-slate-600" />
                            )}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Input Area */}
          <div className="relative p-6 border-t border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50">
            <div className="max-w-4xl mx-auto">
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
                    placeholder={
                      selectedDatabaseIds.length === 0
                        ? 'Select databases above to start chatting...'
                        : 'Ask a question about your data...'
                    }
                    rows={1}
                    className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 resize-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all"
                    disabled={isSending || selectedDatabaseIds.length === 0}
                  />
                  <motion.button
                    type="submit"
                    whileHover={
                      inputMessage.trim() && !isSending && selectedDatabaseIds.length > 0
                        ? { scale: 1.05 }
                        : {}
                    }
                    whileTap={
                      inputMessage.trim() && !isSending && selectedDatabaseIds.length > 0
                        ? { scale: 0.95 }
                        : {}
                    }
                    disabled={!inputMessage.trim() || isSending || selectedDatabaseIds.length === 0}
                    className={`p-3 rounded-xl font-semibold transition-all flex items-center justify-center ${
                      !inputMessage.trim() || isSending || selectedDatabaseIds.length === 0
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
                  {selectedDatabaseIds.length === 0
                    ? 'Select at least one database to continue'
                    : 'Press Enter to send, Shift+Enter for new line'}
                </p>
              </form>
            </div>
          </div>
        </motion.div>
      ) : (
        // Full-screen Chat View
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="h-full relative backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 rounded-3xl shadow-2xl border border-slate-200/50 dark:border-slate-800/50 overflow-hidden flex flex-col"
        >
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 pointer-events-none" />

          {/* Chat Header with Back Button */}
          <div className="relative p-4 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3 mb-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedChat(null)}
                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
              </motion.button>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {selectedChat.title}
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedChat.databaseIds.map((db) => (
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
        <div className="relative flex-1 overflow-y-auto p-6 space-y-4">
          {isLoadingMessages ? (
            // Loading state
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            // Empty state - No messages
            <div className="h-full flex items-center justify-center">
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
                <p className="text-slate-600 dark:text-slate-400 max-w-sm mb-4">
                  Select databases and ask questions in natural language
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
            // Messages
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

                    {/* Divider - only show if there's an assistant response */}
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

        {/* Input Area */}
        <div className="relative p-6 border-t border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50">
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
      </motion.div>
      )}
    </div>
  );
}
