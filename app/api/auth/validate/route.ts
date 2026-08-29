import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/auth/validate
// Verifies that the session token is structurally valid, email-verified,
// and NOT revoked in PostgreSQL.
export async function GET(req: NextRequest) {
  const session = await getSessionUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  return NextResponse.json({
    valid: true,
    userId: session.userId,
    sessionId: session.sessionId,
  });
}
