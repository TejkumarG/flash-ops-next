import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { connectDB } from './mongodb';
import User from '@/models/User';

/**
 * NextAuth configuration options
 * Centralized configuration for authentication
 */
export const authOptions: NextAuthOptions = {
  // Configure authentication providers
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        try {
          // Connect to database
          await connectDB();

          // Find user by email (include password field)
          const user = await User.findOne({ email: credentials.email.toLowerCase() }).select('+password');

          if (!user) {
            throw new Error('Invalid email or password');
          }

          // Check if user is active
          if (!user.isActive) {
            throw new Error('Your account has been deactivated. Please contact an administrator.');
          }

          // Verify password
          const isPasswordValid = await user.comparePassword(credentials.password);

          if (!isPasswordValid) {
            throw new Error('Invalid email or password');
          }

          // Return user object (without password)
          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch (error: any) {
          console.error('Authentication error:', error);
          throw new Error(error.message || 'Authentication failed');
        }
      },
    }),
  ],

  // Custom pages
  pages: {
    signIn: '/login',
    error: '/login',
  },

  // Session configuration
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // JWT configuration
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Callbacks to customize behavior
  callbacks: {
    /**
     * JWT callback - called when JWT is created or updated
     * Add custom fields to the token
     */
    async jwt({ token, user }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.email = user.email;
        token.name = user.name;
      }

      return token;
    },

    /**
     * Session callback - called whenever session is checked
     * Add custom fields to the session object
     */
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.email = token.email;
        session.user.name = token.name;
      }

      return session;
    },
  },

  // Enable debug messages in development
  debug: process.env.NODE_ENV === 'development',

  // Secret for JWT encryption
  secret: process.env.NEXTAUTH_SECRET,
};
