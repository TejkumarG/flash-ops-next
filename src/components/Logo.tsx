'use client';

import { motion } from 'framer-motion';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  animated?: boolean;
  variant?: 'default' | 'light';
}

/**
 * Premium gradient logo for Flash Ops
 * Represents database intelligence with modern abstract design
 */
export function Logo({ size = 'md', showText = true, animated = false, variant = 'default' }: LogoProps) {
  const sizes = {
    sm: { icon: 32, text: 'text-lg' },
    md: { icon: 48, text: 'text-2xl' },
    lg: { icon: 64, text: 'text-3xl' },
    xl: { icon: 80, text: 'text-4xl' },
  };

  const { icon, text } = sizes[size];

  const LogoIcon = (
    <svg
      width={icon}
      height={icon}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Main gradient - blue to purple */}
        <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>

        {/* Secondary gradient - cyan to blue */}
        <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>

        {/* Tertiary gradient - purple to pink */}
        <linearGradient id="gradient3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>

        {/* Glow effect */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Abstract database/AI representation */}
      {/* Main circle - represents data/intelligence hub */}
      <circle cx="50" cy="50" r="18" fill="url(#gradient1)" filter="url(#glow)" />

      {/* Orbiting elements - represents connections/databases */}
      <circle cx="50" cy="22" r="8" fill="url(#gradient2)" opacity="0.9" />
      <circle cx="72" cy="40" r="7" fill="url(#gradient3)" opacity="0.8" />
      <circle cx="68" cy="68" r="6" fill="url(#gradient2)" opacity="0.85" />
      <circle cx="32" cy="72" r="7" fill="url(#gradient3)" opacity="0.9" />
      <circle cx="24" cy="42" r="6" fill="url(#gradient2)" opacity="0.8" />

      {/* Connection lines - subtle */}
      <path
        d="M 50 32 L 50 22"
        stroke="url(#gradient1)"
        strokeWidth="2"
        opacity="0.3"
      />
      <path
        d="M 62 42 L 72 40"
        stroke="url(#gradient1)"
        strokeWidth="2"
        opacity="0.3"
      />
      <path
        d="M 60 62 L 68 68"
        stroke="url(#gradient1)"
        strokeWidth="2"
        opacity="0.3"
      />
      <path
        d="M 40 62 L 32 72"
        stroke="url(#gradient1)"
        strokeWidth="2"
        opacity="0.3"
      />
      <path
        d="M 38 44 L 24 42"
        stroke="url(#gradient1)"
        strokeWidth="2"
        opacity="0.3"
      />

      {/* Inner accent */}
      <circle cx="50" cy="50" r="8" fill="white" opacity="0.3" />
      <circle cx="50" cy="50" r="4" fill="white" opacity="0.6" />
    </svg>
  );

  const content = (
    <div className="flex items-center gap-3">
      {animated ? (
        <motion.div
          animate={{
            rotate: [0, 360],
            scale: [1, 1.05, 1],
          }}
          transition={{
            rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
            scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          {LogoIcon}
        </motion.div>
      ) : (
        LogoIcon
      )}

      {showText && (
        <div className="flex flex-col">
          <h1
            className={`${text} font-bold leading-none ${
              variant === 'light'
                ? 'text-white'
                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent'
            }`}
          >
            Flash Ops
          </h1>
          <p className={`text-xs font-medium tracking-wide ${
            variant === 'light'
              ? 'text-white/80'
              : 'text-slate-500 dark:text-slate-400'
          }`}>
            Database Intelligence
          </p>
        </div>
      )}
    </div>
  );

  return animated ? (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {content}
    </motion.div>
  ) : (
    content
  );
}
