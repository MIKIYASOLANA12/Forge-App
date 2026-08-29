import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSessionUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ authenticated: false, reason: 'REVOKED' }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    userId: session.userId,
    sessionId: session.sessionId,
  });
}
