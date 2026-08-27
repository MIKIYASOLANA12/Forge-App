import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/security/sessions
// Lists the authenticated owner's active (non-revoked) sessions and
// identifies which one is the current device.
export async function GET(req: NextRequest) {
  const session = await getSessionUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const currentSessionId = session.sessionId ?? null;

  const dbSessions = await prisma.userSession.findMany({
    where: { userId: session.userId, revoked: false },
    orderBy: { lastActiveAt: 'desc' },
    select: {
      id: true,
      sessionToken: true,
      ipAddress: true,
      userAgent: true,
      location: true,
      createdAt: true,
      lastActiveAt: true,
    },
  });

  const sessions = dbSessions.map((s) => ({
    id: s.id,
    device: s.userAgent,
    location: s.location,
    ip: s.ipAddress,
    loggedInAt: s.createdAt,
    lastActiveAt: s.lastActiveAt,
    isCurrent: s.sessionToken === currentSessionId,
  }));

  return NextResponse.json({ currentSessionId, sessions });
}