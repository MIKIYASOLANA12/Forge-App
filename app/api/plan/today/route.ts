import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAddisNow, workoutWindowForAddisDate, getDayOfJourney300 } from '@/lib/workoutTime';

export async function GET() {
  try {
    const addisNow = getAddisNow();
    const { startUtc, endUtc, startAddis } = workoutWindowForAddisDate(addisNow);
    const day300 = getDayOfJourney300(addisNow);

    const plan = await prisma.dailyPlan.findFirst({
      where: { date: { gte: startUtc, lte: endUtc } },
      include: {
        tasks: {
          orderBy: [{ isStudy: 'desc' }, { priority: 'asc' }],
        },
      },
    });

    const domains = await prisma.domain.findMany();
    const domainMap = Object.fromEntries(domains.map((d) => [d.id, d]));

    const dateFormatted = startAddis.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    if (plan) {
      const tasksWithDomain = plan.tasks.map((t) => ({
        ...t,
        domain: domainMap[t.domainId] || { name: 'General', color: '#94a3b8', icon: 'check-circle' },
      }));

      return NextResponse.json({
        ...plan,
        dateFormatted,
        day300,
        tasks: tasksWithDomain,
      });
    }

    return NextResponse.json({
      id: null,
      dateFormatted,
      day300,
      tasks: [],
    });
  } catch (error: any) {
    console.error('Plan today error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
