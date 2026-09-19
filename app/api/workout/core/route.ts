import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserFromRequest } from '@/lib/auth';
import { getAddisNow, workoutWindowForAddisDate } from '@/lib/workoutTime';
import { recordProgressActivity } from '@/lib/progressEngine';
import { DAILY_CORE_ROUTINE } from '@/lib/workoutMuscleTargets';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUserFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { slot, completed = true, exercises } = body;

    if (slot !== 'MORNING' && slot !== 'NIGHT') {
      return NextResponse.json({ error: 'slot must be MORNING or NIGHT' }, { status: 400 });
    }

    const addisNow = getAddisNow();
    const windowInfo = workoutWindowForAddisDate(addisNow);
    const normalizedDate = new Date(
      Date.UTC(windowInfo.startAddis.getFullYear(), windowInfo.startAddis.getMonth(), windowInfo.startAddis.getDate())
    );

    const existing = await prisma.dailyCoreLog.findUnique({
      where: {
        date_slot: {
          date: normalizedDate,
          slot,
        },
      },
    });

    const isNewlyCompleted = Boolean(completed) && !existing?.completed;
    const xpReward = 25;
    const xpToAward = isNewlyCompleted ? xpReward : 0;

    const exercisesJsonStr = exercises ? JSON.stringify(exercises) : JSON.stringify(DAILY_CORE_ROUTINE.map(c => ({ id: c.id, name: c.name, target: c.target, completed: Boolean(completed) })));

    const log = await prisma.dailyCoreLog.upsert({
      where: {
        date_slot: {
          date: normalizedDate,
          slot,
        },
      },
      create: {
        date: normalizedDate,
        slot,
        completed: Boolean(completed),
        exercisesJson: exercisesJsonStr,
        completedAt: completed ? new Date() : null,
        xpEarned: xpToAward,
      },
      update: {
        completed: Boolean(completed),
        exercisesJson: exercisesJsonStr,
        completedAt: completed ? (existing?.completedAt || new Date()) : null,
        xpEarned: existing?.completed ? existing.xpEarned : (completed ? xpReward : 0),
      },
    });

    if (xpToAward > 0) {
      await prisma.userProfile.update({
        where: { id: 'singleton' },
        data: { totalXp: { increment: xpToAward } },
      }).catch(() => {});
      await recordProgressActivity(xpToAward).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      log,
      xpEarned: xpToAward,
      message: `Daily Core ${slot === 'MORNING' ? 'Morning' : 'Night'} check-in recorded!`,
    });
  } catch (error: any) {
    console.error('Error logging daily core:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
