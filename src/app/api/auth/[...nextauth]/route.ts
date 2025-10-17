import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * NextAuth API route handler
 * Handles all authentication endpoints: /api/auth/*
 *
 * Endpoints provided by NextAuth:
 * - GET  /api/auth/signin - Sign in page
 * - POST /api/auth/signin/:provider - Sign in with provider
 * - GET/POST /api/auth/callback/:provider - OAuth callback
 * - GET  /api/auth/signout - Sign out page
 * - POST /api/auth/signout - Sign out action
 * - GET  /api/auth/session - Get session
 * - GET  /api/auth/csrf - Get CSRF token
 * - GET  /api/auth/providers - Get configured providers
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
