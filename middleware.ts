import { NextResponse, NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from './lib/session';
import { prisma } from './lib/prisma';

const PUBLIC_PATHS = [
  '/login',
  '/auth/verify',
  '/verify-email',
  '/auth/reset-password',
  '/api/auth/login',
  '/api/auth/verify',
  '/api/auth/resend-verification',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/telegram/webhook',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Skip static assets, internal next routes, pwa icons
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/manifest') ||
    pathname.includes('.') // static files like favicon.ico, images, etc.
  ) {
    return NextResponse.next();
  }

  // 2. Check for public routes
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + '/'));

  // 3. Extract and verify session cookie
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionCookie ? await verifySessionToken(sessionCookie) : null;

  if (session) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { emailVerified: true },
    });

    if (!user || !user.emailVerified) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('required', 'email-verification');
      if (pathname !== '/') {
        loginUrl.searchParams.set('callbackUrl', pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
  }

  // 4. If user is authenticated and tries to visit /login, redirect to /
  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // 5. If route is public, allow access
  if (isPublic) {
    return NextResponse.next();
  }

  // 6. Route is protected and user is NOT authenticated
  if (!session) {
    // API routes return 401 Unauthorized
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    // Web pages redirect to /login
    const loginUrl = new URL('/login', req.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('callbackUrl', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 7. Authenticated user accessing protected route
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
