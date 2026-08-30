import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSessionUserFromRequest(req);
  if (!session) {
    const res = NextResponse.json({ authenticated: false, reason: 'REVOKED' }, { status: 401 });
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  // Update session lastActiveAt timestamp for activity detection
  if (session.sessionId) {
    await prisma.userSession.updateMany({
      where: { sessionToken: session.sessionId },
      data: { lastActiveAt: new Date() },
    }).catch(() => {});
  }

  return NextResponse.json({
    authenticated: true,
    userId: session.userId,
    sessionId: session.sessionId,
  });
}
