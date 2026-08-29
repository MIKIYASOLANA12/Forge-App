import { NextResponse, NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from './lib/session';
// Note: Do not import Prisma in middleware — the Edge/middleware runtime on Vercel
// does not support Node-native modules. Email verification status is read from
// the signed session token instead of querying the database here.

const PUBLIC_PATHS = [
  '/login',
  '/auth/verify',
  '/verify-email',
  '/auth/reset-password',
  '/api/auth/login',
  '/api/auth/verify',
  '/api/auth/validate',
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

  // 2. Extract and verify session cookie early so we can special-case /login
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionCookie ? await verifySessionToken(sessionCookie) : null;

  // 3. Check for public routes
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + '/'));

  // 4. If route is public, allow access — except for /login where a verified
  //    authenticated user should be redirected to the app root.
  if (isPublic) {
    if (pathname === '/login' && session && session.emailVerified) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  // 5. If we have a session but it's not email-verified, redirect to /login
  //    (unless they're already on /login which we allowed above). This avoids
  //    the infinite redirect loop for old sessions that do not include the
  //    emailVerified claim.
  if (session && !session.emailVerified) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('required', 'email-verification');
    if (pathname !== '/') {
      loginUrl.searchParams.set('callbackUrl', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 6. If route is protected and user is NOT authenticated, block or redirect
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

  // 7. Enforce real server-side session revocation check on protected requests.
  if (session.sessionId) {
    try {
      const validateUrl = new URL('/api/auth/validate', req.url);
      const validateRes = await fetch(validateUrl, {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${sessionCookie}`,
        },
        cache: 'no-store',
      });

      if (!validateRes.ok) {
        if (pathname.startsWith('/api/')) {
          const res = NextResponse.json(
            { error: 'Unauthorized: Session terminated.' },
            { status: 401 }
          );
          res.cookies.delete(SESSION_COOKIE_NAME);
          return res;
        }

        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('reason', 'terminated');
        const res = NextResponse.redirect(loginUrl);
        res.cookies.delete(SESSION_COOKIE_NAME);
        return res;
      }
    } catch {
      // If validation endpoint subrequest fails unexpectedly, allow proceed
    }
  }

  // 8. Authenticated & verified user accessing protected route
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
