import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAddisNow, workoutWindowForAddisDate, toUtcFromAddis } from '@/lib/workoutTime';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      subject = 'Chemistry',
      topic,
      targetDay = 'today', // 'today' | 'tomorrow'
      minutes = 30,
      priority = 'HIGH',
    } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const addisNow = getAddisNow();
    let targetDateAddis = new Date(addisNow);

    if (targetDay === 'tomorrow') {
      targetDateAddis.setDate(targetDateAddis.getDate() + 1);
    }

    const { startUtc, endUtc, startAddis } = workoutWindowForAddisDate(targetDateAddis);

    // Find or create DailyPlan for that date
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

    // Find Study domain
    let studyDomain = await prisma.domain.findFirst({
      where: { name: 'Study' },
    });

    if (!studyDomain) {
      studyDomain = await prisma.domain.findFirst();
    }

    const domainId = studyDomain?.id || 'singleton';

    // Create the task
    const task = await prisma.planTask.create({
      data: {
        dailyPlanId: plan.id,
        domainId,
        description: title,
        minutesTarget: Number(minutes) || 30,
        subject,
        topic: topic || null,
        priority,
        isStudy: true,
        xpTarget: Math.round((Number(minutes) || 30) * 1.2),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Added '${title}' to ${targetDay}'s plan!`,
      task,
    });
  } catch (error: any) {
    console.error('Accept recommendation error:', error);
    return NextResponse.json({ error: error.message || 'Failed to accept recommendation' }, { status: 500 });
  }
}
