'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Database,
  Users,
  LogOut,
  Plug,
  UsersRound,
  Plus,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useEffect, useState } from 'react';

interface Chat {
  _id: string;
  title: string;
  lastMessageAt?: string;
  databaseIds: any[];
  messageCount: number;
  lastMessage: any;
}

/**
 * Premium dashboard layout with animated sidebar
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = session?.user?.role === 'admin';
  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [chatsExpanded, setChatsExpanded] = useState(false);
  const [showAllChats, setShowAllChats] = useState(false);

  const adminNavigation = [
    { name: 'Connections', href: '/connections', icon: Plug },
    { name: 'Databases', href: '/databases', icon: Database },
    { name: 'Teams', href: '/teams', icon: UsersRound },
    { name: 'Users', href: '/users', icon: Users },
  ];

  // Initialize chatsExpanded from localStorage and auto-expand when on a chat page
  useEffect(() => {
    const savedExpanded = localStorage.getItem('chatsExpanded');
    if (savedExpanded !== null) {
      setChatsExpanded(savedExpanded === 'true');
    } else if (pathname.startsWith('/chat/')) {
      // Auto-expand if we're on a specific chat page
      setChatsExpanded(true);
    }
  }, [pathname]);

  // Save chatsExpanded to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('chatsExpanded', String(chatsExpanded));
  }, [chatsExpanded]);

  // Fetch chats on mount and when chat is updated
  useEffect(() => {
    fetchChats();

    // Listen for chat updates from chat pages
    const handleChatUpdate = () => {
      fetchChats();
    };

    window.addEventListener('chatUpdated', handleChatUpdate);
    return () => window.removeEventListener('chatUpdated', handleChatUpdate);
  }, []);

  const fetchChats = async () => {
    try {
      setLoadingChats(true);
      const response = await fetch('/api/chats');
      if (!response.ok) throw new Error('Failed to fetch chats');
      const data = await response.json();
      setChats(data.data?.chats || data.chats || []);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoadingChats(false);
    }
  };

  const handleNewChat = () => {
    router.push('/chat');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="fixed top-0 left-0 h-screen w-64 backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-r border-slate-200/50 dark:border-slate-800/50 z-50"
      >
        <div className="flex flex-col h-full p-6">
          {/* Logo */}
          <div className="mb-8">
            <Logo size="sm" showText={true} />
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-6 overflow-y-auto">
            {/* Chat Navigation Item */}
            <div className="space-y-1">
              <motion.button
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setChatsExpanded(!chatsExpanded);
                  // If collapsing, navigate to /chat to show the database selection
                  if (!chatsExpanded) {
                    router.push('/chat');
                  }
                }}
                className={`
                  w-full relative flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200
                  ${
                    pathname.startsWith('/chat')
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                  }
                `}
              >
                <MessageSquare className="w-5 h-5" />
                <span>Chat</span>
                <div className="ml-auto">
                  {chatsExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </div>
                {pathname.startsWith('/chat') && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl -z-10"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </motion.button>
            </div>

            {/* Admin Navigation */}
            {isAdmin && (
              <div className="space-y-1">
                <h3 className="px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Admin
                </h3>
                {adminNavigation.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  const Icon = item.icon;

                  return (
                    <Link key={item.name} href={item.href}>
                      <motion.div
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        className={`
                          relative flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200
                          ${
                            isActive
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                          }
                        `}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{item.name}</span>
                        {isActive && (
                          <motion.div
                            layoutId="activeNav"
                            className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl -z-10"
                            transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                      </motion.div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Chats Section - Collapsible */}
            {chatsExpanded && (
              <div className="space-y-1">
                <div className="flex items-center justify-between px-4 mb-2">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Chats
                  </h3>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleNewChat}
                    className="p-1 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:shadow-lg hover:shadow-blue-500/25 transition-shadow"
                    title="New Chat"
                  >
                    <Plus className="w-4 h-4" />
                  </motion.button>
                </div>

                <div className="space-y-1">
                  {loadingChats ? (
                    <div className="px-4 py-2 text-sm text-slate-500">Loading...</div>
                  ) : chats.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-slate-500">No chats yet</div>
                  ) : (
                    <>
                      {(showAllChats ? chats : chats.slice(0, 5)).map((chat) => {
                        const isActive = pathname === `/chat/${chat._id}`;
                        return (
                          <Link key={chat._id} href={`/chat/${chat._id}`}>
                            <motion.div
                              whileHover={{ x: 4 }}
                              whileTap={{ scale: 0.98 }}
                              className={`
                                relative flex items-start gap-3 px-4 py-2 rounded-xl transition-all duration-200
                                ${
                                  isActive
                                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                }
                              `}
                            >
                              <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{chat.title}</p>
                                {chat.lastMessage && (
                                  <p className="text-xs opacity-75 truncate mt-0.5">
                                    {chat.lastMessage.message}
                                  </p>
                                )}
                              </div>
                              {isActive && (
                                <motion.div
                                  layoutId="activeChatNav"
                                  className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl -z-10"
                                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                                />
                              )}
                            </motion.div>
                          </Link>
                        );
                      })}

                      {/* View All / Show Less Button */}
                      {chats.length > 5 && (
                        <motion.button
                          whileHover={{ x: 4 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setShowAllChats(!showAllChats)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl transition-all duration-200"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                          <span>{showAllChats ? 'Show Less' : `View All (${chats.length})`}</span>
                        </motion.button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </nav>

          {/* User section */}
          <div className="pt-6 border-t border-slate-200/50 dark:border-slate-800/50">
            <Link href="/settings">
              <motion.div
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-3 px-4 py-3 mb-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all duration-200 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-semibold">
                  {session?.user?.name?.[0] || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {session?.user?.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {session?.user?.role}
                  </p>
                </div>
              </motion.div>
            </Link>
            <motion.button
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200 font-medium"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign out</span>
            </motion.button>
          </div>
        </div>
      </motion.aside>

      {/* Main content */}
      <main className="ml-64 min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-8"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
