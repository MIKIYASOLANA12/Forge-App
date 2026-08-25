import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getAddisNow,
  workoutWindowForAddisDate,
  toUtcFromAddis,
  getWorkoutLocationForAddisDate,
} from '@/lib/workoutTime';

export async function GET() {
  try {
    const addisNow = getAddisNow();
    const tomorrowAddis = new Date(addisNow);
    tomorrowAddis.setDate(tomorrowAddis.getDate() + 1);

    const { startUtc, endUtc, startAddis } = workoutWindowForAddisDate(tomorrowAddis);

    const plan = await prisma.dailyPlan.findFirst({
      where: { date: { gte: startUtc, lte: endUtc } },
      include: { tasks: true },
    });

    const domains = await prisma.domain.findMany();
    const domainMap = Object.fromEntries(domains.map((d) => [d.id, d]));

    const tomorrowLocation = getWorkoutLocationForAddisDate(startAddis);
    const tomorrowDateFormatted = startAddis.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    return NextResponse.json({
      tomorrowDateFormatted,
      tomorrowLocation,
      plan: plan
        ? {
            ...plan,
            tasks: plan.tasks.map((t) => ({
              ...t,
              domain: domainMap[t.domainId] || null,
            })),
          }
        : null,
      domains,
    });
  } catch (error: any) {
    console.error('Plan tomorrow GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch tomorrow plan' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tasks } = body; // Array of task objects: { description, domainName, minutesTarget, priority, plannedStartTime, plannedEndTime, isStudy, subject, topic }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ error: 'Tasks array is required' }, { status: 400 });
    }

    const addisNow = getAddisNow();
    const tomorrowAddis = new Date(addisNow);
    tomorrowAddis.setDate(tomorrowAddis.getDate() + 1);

    const { startUtc, endUtc } = workoutWindowForAddisDate(tomorrowAddis);

    // Find or create DailyPlan for tomorrow
    let plan = await prisma.dailyPlan.findFirst({
      where: { date: { gte: startUtc, lte: endUtc } },
    });

    if (!plan) {
      plan = await prisma.dailyPlan.create({
        data: {
          date: startUtc,
          generatedByAI: false,
        },
      });
    }

    // Resolve domains
    const domains = await prisma.domain.findMany();
    const domainByName = new Map(domains.map((d) => [d.name.toLowerCase(), d.id]));
    const defaultDomainId = domains[0]?.id || 'singleton';

    // Insert tasks
    const createdTasks = [];
    for (const t of tasks) {
      if (!t.description) continue;
      const targetDomainId = (t.domainName && domainByName.get(t.domainName.toLowerCase())) || defaultDomainId;

      const created = await prisma.planTask.create({
        data: {
          dailyPlanId: plan.id,
          domainId: targetDomainId,
          description: t.description,
          minutesTarget: Number(t.minutesTarget) || 45,
          priority: t.priority || 'MEDIUM',
          plannedStartTime: t.plannedStartTime || null,
          plannedEndTime: t.plannedEndTime || null,
          isStudy: Boolean(t.isStudy),
          subject: t.subject || null,
          topic: t.topic || null,
          xpTarget: Math.round((Number(t.minutesTarget) || 45) * 1.2),
        },
      });
      createdTasks.push(created);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully planned ${createdTasks.length} tasks for tomorrow!`,
      planId: plan.id,
      tasks: createdTasks,
    });
  } catch (error: any) {
    console.error('Plan tomorrow POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to save tomorrow plan' }, { status: 500 });
  }
}
