import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

/**
 * Middleware for route protection
 * Protects routes and handles role-based access control
 */
export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Admin-only routes
    const adminRoutes = [
      '/settings/connections',
      '/settings/databases',
      '/settings/users',
      '/teams',
    ];

    const isAdminRoute = adminRoutes.some((route) => path.startsWith(route));

    // If user is trying to access admin route but is not admin
    if (isAdminRoute && token?.role !== 'admin') {
      // Redirect to chat page with error
      const url = new URL('/chat', req.url);
      url.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Return true if user is authorized to access the route
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  }
);

/**
 * Configure which routes to protect
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /login (login page)
     * - /api/auth/* (auth endpoints)
     * - /_next/* (Next.js internals)
     * - /favicon.ico, /robots.txt (static files)
     */
    '/((?!api/auth|_next|favicon.ico|robots.txt|login).*)',
  ],
};
