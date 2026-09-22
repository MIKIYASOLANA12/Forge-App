import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = await getSessionUserFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.$executeRawUnsafe(
    'ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "wakeTime" TEXT NOT NULL DEFAULT \'02:24\';'
  );
  await prisma.$executeRawUnsafe(
    'UPDATE "NotificationPreference" SET "wakeTime" = \'02:24\' WHERE "id" = \'singleton\';'
  );
  const rows = await prisma.$queryRawUnsafe<Array<{ wakeTime: string }>>(
    'SELECT "wakeTime" FROM "NotificationPreference" WHERE "id" = \'singleton\';'
  );

  return NextResponse.json({ success: true, wakeTime: rows[0]?.wakeTime || '02:24' });
}
