import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAddisNow, workoutWindowForAddisDate } from '@/lib/workoutTime';
import { recordProgressActivity } from '@/lib/progressEngine';
import { computeLevel } from '@/lib/xp';

export async function POST(request: NextRequest) {
  try {
    const addisNow = getAddisNow();
    const windowInfo = workoutWindowForAddisDate(addisNow);

    const body = await request.json();
    const { workoutDayId, weekNumber, notes, exerciseLogs } = body;

    if (!workoutDayId || !Array.isArray(exerciseLogs)) {
      return NextResponse.json({ error: 'workoutDayId and exerciseLogs are required' }, { status: 400 });
    }

    // Check if within active window
    if (windowInfo.isClosed) {
      // If cutoff passed, check if a log already exists for today that we can safely sync sets into
      const existingLog = await prisma.workoutLog.findFirst({
        where: {
          workoutDayId,
          completedAt: { gte: windowInfo.startUtc, lte: windowInfo.closeUtc },
        },
      });

      if (!existingLog) {
        return NextResponse.json(
          {
            error: 'Workout window closed at 09:28 PM. Unsubmitted workouts are locked.',
            locked: true,
          },
          { status: 403 }
        );
      }
    }

    // Find or create today's WorkoutLog
    let workoutLog = await prisma.workoutLog.findFirst({
      where: {
        workoutDayId,
        completedAt: { gte: windowInfo.startUtc, lte: windowInfo.endUtc },
      },
      include: { exerciseLogs: true },
    });

    let totalXpEarned = 0;

    if (!workoutLog) {
      workoutLog = await prisma.workoutLog.create({
        data: {
          workoutDayId,
          weekNumber: Number(weekNumber) || 1,
          notes: notes?.trim() || null,
        },
        include: { exerciseLogs: true },
      });
    }

    // Upsert exercise logs
    for (const item of exerciseLogs) {
      if (!item.exerciseId) continue;

      const existingExerciseLog = workoutLog.exerciseLogs.find((el) => el.exerciseId === item.exerciseId);

      const setsCompleted = Number(item.setsCompleted) || 1;
      const repsCompleted = Number(item.repsCompleted) || 8;
      const weightKg = item.weightKg !== null && item.weightKg !== undefined && item.weightKg !== '' ? Number(item.weightKg) : null;
      const checked = Boolean(item.checked);
      const setDetails = typeof item.setDetails === 'string' ? item.setDetails : JSON.stringify(item.setDetails || []);
      const clientId = item.clientId || null;

      if (existingExerciseLog) {
        await prisma.exerciseLog.update({
          where: { id: existingExerciseLog.id },
          data: {
            setsCompleted,
            repsCompleted,
            weightKg,
            checked,
            setDetails,
            clientId: clientId || existingExerciseLog.clientId,
          },
        });
      } else {
        await prisma.exerciseLog.create({
          data: {
            workoutLogId: workoutLog.id,
            exerciseId: item.exerciseId,
            setsCompleted,
            repsCompleted,
            weightKg,
            checked,
            setDetails,
            clientId,
          },
        });

        if (checked) {
          totalXpEarned += Math.max(1, setsCompleted) * Math.max(1, repsCompleted) * 2;
        }
      }
    }

    // Award XP if new checks occurred
    if (totalXpEarned > 0) {
      await prisma.userProfile.update({
        where: { id: 'singleton' },
        data: {
          totalXp: { increment: totalXpEarned },
        },
      });

      await recordProgressActivity(totalXpEarned).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      workoutLogId: workoutLog.id,
      xpEarned: totalXpEarned,
      syncedAt: new Date().toISOString(),
      message: 'Offline workout synchronized successfully',
    });
  } catch (error: any) {
    console.error('Workout sync error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
