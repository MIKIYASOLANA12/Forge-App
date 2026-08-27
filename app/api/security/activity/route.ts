import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/security/activity
// Lists the login notification feed (location, device, time, IP, status).
export async function GET(req: NextRequest) {
  const session = await getSessionUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const attempts = await prisma.loginActivity.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      email: true,
      ipAddress: true,
      userAgent: true,
      location: true,
      status: true,
      approvedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    attempts: attempts.map((a) => ({
      id: a.id,
      email: a.email,
      device: a.userAgent,
      location: a.location,
      ip: a.ipAddress,
      status: a.status,
      approvedAt: a.approvedAt,
      attemptedAt: a.createdAt,
    })),
  });
}