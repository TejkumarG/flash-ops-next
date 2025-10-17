'use client';

import { motion } from 'framer-motion';
import { Logo } from '@/components/Logo';
import { Database, Shield, Zap, MessageSquare, Users, Activity } from 'lucide-react';

/**
 * Premium split-screen auth layout
 * Left: Login form | Right: App features
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const features = [
    {
      icon: MessageSquare,
      title: 'Natural Language Queries',
      description: 'Chat with your databases using plain English. No SQL knowledge required.',
    },
    {
      icon: Database,
      title: 'Multi-Database Support',
      description: 'Connect MySQL, PostgreSQL, MongoDB, and more. All in one platform.',
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'Encrypted credentials, role-based access, and secure connections.',
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Create teams, assign access, and collaborate seamlessly.',
    },
    {
      icon: Zap,
      title: 'Real-time Insights',
      description: 'Get instant answers to your data questions with AI-powered intelligence.',
    },
    {
      icon: Activity,
      title: 'Connection Monitoring',
      description: 'Track database health, sync status, and connection performance.',
    },
  ];

  return (
    <div className="min-h-screen flex overflow-hidden">
      {/* Left Side - Login Form */}
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full lg:w-1/2 relative flex items-center justify-center bg-white dark:bg-slate-950 p-8"
      >
        {/* Subtle background pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMS41IiBmaWxsPSJjdXJyZW50Q29sb3IiIG9wYWNpdHk9IjAuMDUiLz48L3N2Zz4=')] opacity-50" />

        <div className="relative z-10 w-full max-w-md">
          {children}
        </div>
      </motion.div>

      {/* Right Side - App Details */}
      <motion.div
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-12 flex-col justify-center overflow-hidden"
      >
        {/* Animated orbs */}
        <motion.div
          className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl"
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
          animate={{
            x: [0, -50, 0],
            y: [0, -30, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        <div className="relative z-10 text-white">
          {/* Logo & Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-12"
          >
            <div className="mb-6">
              <Logo size="lg" showText={true} variant="light" />
            </div>
            <h2 className="text-3xl font-bold mb-3">
              Database Intelligence Platform
            </h2>
            <p className="text-blue-100 text-lg">
              Transform how you interact with your data using natural language and AI.
            </p>
          </motion.div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1, duration: 0.5 }}
                  className="flex items-start gap-4 p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/15 transition-all duration-200"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-blue-100">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Bottom Accent */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="mt-12 pt-8 border-t border-white/20"
          >
            <p className="text-blue-100 text-sm">
              Trusted by data teams worldwide • Enterprise-ready • Free to start
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
