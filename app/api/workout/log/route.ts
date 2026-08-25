import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeLevel } from '@/lib/xp';
import { recordProgressActivity } from '@/lib/progressEngine';
import { getAddisNow, workoutWindowForAddisDate } from '@/lib/workoutTime';

export async function POST(request: NextRequest) {
  try {
    // Authoritative Hard 09:28 PM Cutoff Check
    const addisNow = getAddisNow();
    const { isClosed } = workoutWindowForAddisDate(addisNow);
    if (isClosed) {
      return NextResponse.json(
        {
          error: 'Daily workout execution window closed at 09:28 PM Ethiopia Time. Unsubmitted workouts are marked MISSED and cannot be submitted, edited, or backdated.',
          locked: true,
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    if (
      !body.workoutDayId ||
      !Number.isInteger(body.weekNumber) ||
      !Array.isArray(body.exerciseLogs) ||
      !body.exerciseLogs.length
    ) {
      return NextResponse.json(
        { error: 'workoutDayId, weekNumber, and exerciseLogs are required' },
        { status: 400 }
      );
    }

    const exercises = body.exerciseLogs.map((log: any) => {
      let setDetailsStr: string | null = null;
      if (log.setDetails) {
        setDetailsStr = typeof log.setDetails === 'string' ? log.setDetails : JSON.stringify(log.setDetails);
      }

      return {
        exerciseId: String(log.exerciseId ?? ''),
        setsCompleted: Number(log.setsCompleted ?? 1),
        repsCompleted: Number(log.repsCompleted ?? 8),
        weightKg: log.weightKg !== null && log.weightKg !== undefined && log.weightKg !== '' ? Number(log.weightKg) : null,
        checked: Boolean(log.checked),
        setDetails: setDetailsStr,
      };
    });

    if (
      exercises.some(
        (log: any) =>
          !log.exerciseId ||
          !Number.isInteger(log.setsCompleted) ||
          log.setsCompleted < 0 ||
          !Number.isInteger(log.repsCompleted) ||
          log.repsCompleted < 0 ||
          (log.weightKg !== null && (!Number.isFinite(log.weightKg) || log.weightKg < 0))
      )
    ) {
      return NextResponse.json({ error: 'Invalid exercise log values' }, { status: 400 });
    }

    const xpEarned = exercises
      .filter((log: any) => log.checked)
      .reduce((sum: number, log: any) => sum + Math.max(1, log.setsCompleted) * Math.max(1, log.repsCompleted) * 2, 0);

    const result = await prisma.$transaction(async (transaction) => {
      const log = await transaction.workoutLog.create({
        data: {
          workoutDayId: body.workoutDayId,
          weekNumber: body.weekNumber,
          notes: body.notes?.trim() || null,
          exerciseLogs: {
            create: exercises.map((exercise: any) => ({
              exerciseId: exercise.exerciseId,
              setsCompleted: exercise.setsCompleted,
              repsCompleted: exercise.repsCompleted,
              weightKg: exercise.weightKg,
              checked: exercise.checked,
              setDetails: exercise.setDetails,
            })),
          },
        },
        include: {
          exerciseLogs: {
            include: {
              exercise: true,
            },
          },
        },
      });

      const profile = await transaction.userProfile.update({
        where: { id: 'singleton' },
        data: {
          totalXp: { increment: xpEarned },
        },
      });

      const level = computeLevel(profile.totalXp);
      if (level !== profile.level) {
        await transaction.userProfile.update({
          where: { id: 'singleton' },
          data: { level },
        });
      }

      return { log, xpEarned };
    });

    await recordProgressActivity(0).catch(() => {});
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating workout log:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}