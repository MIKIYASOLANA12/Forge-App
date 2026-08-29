import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth';
import { SESSION_COOKIE_NAME } from '@/lib/session';

export const dynamic = 'force-dynamic';

// GET /api/auth/validate
// Verifies that the session token is structurally valid, email-verified,
// and NOT revoked in PostgreSQL.
export async function GET(req: NextRequest) {
  const session = await getSessionUserFromRequest(req);
  if (!session) {
    const res = NextResponse.json({ valid: false }, { status: 401 });
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  return NextResponse.json({
    valid: true,
    userId: session.userId,
    sessionId: session.sessionId,
  });
}
