import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth';
import { SESSION_COOKIE_NAME } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSessionUserFromRequest(req);
  if (!session) {
    const res = NextResponse.json({ authenticated: false, reason: 'REVOKED' }, { status: 401 });
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  return NextResponse.json({
    authenticated: true,
    userId: session.userId,
    sessionId: session.sessionId,
  });
}
