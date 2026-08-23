import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isGoogleCalendarConnected } from '@/lib/googleCalendar';

export async function GET() {
  const [plans, connected] = await Promise.all([
    prisma.dailyPlan.findMany({
      orderBy: { date: 'asc' },
      include: { tasks: true },
    }),
    isGoogleCalendarConnected(),
  ]);

  const events = plans.flatMap((plan) =>
    plan.tasks.map((task) => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(task.description || '{}') as Record<string, unknown>;
      } catch {
        parsed = { title: task.description || 'Plan item', description: '' };
      }

      return {
        id: task.id,
        title: String(parsed.title ?? task.description ?? 'Plan item'),
        description: String(parsed.description ?? ''),
        category: String(parsed.category ?? 'Personal'),
        date: plan.date.toISOString(),
        startTime: parsed.startTime ?? null,
        endTime: parsed.endTime ?? null,
        completed: task.completed,
        minutesTarget: task.minutesTarget,
        googleEventId: task.googleEventId,
        isSyncedToGoogle: Boolean(task.googleEventId && connected),
      };
    })
  );

  return NextResponse.json({
    connected,
    events,
  });
}
