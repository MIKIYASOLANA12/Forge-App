import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAddisNow, workoutWindowForAddisDate } from '@/lib/workoutTime';
import { recordProgressActivity } from '@/lib/progressEngine';
import { getScheduledRoutineForDayOfWeek, getExerciseMuscleInfo } from '@/lib/workoutMuscleTargets';

type IncomingSet = {
  setNumber?: number;
  set?: number;
  weightKg?: number | string;
  reps?: number | string;
  notes?: string;
  completed?: boolean;
  clientId?: string;
  variant?: string;
};

function parseSetDetails(raw: unknown): IncomingSet[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mergeSetDetails(existingRaw: string | null | undefined, incomingRaw: unknown): string {
  const existing = parseSetDetails(existingRaw);
  const incoming = parseSetDetails(incomingRaw);
  const byId = new Map<string, IncomingSet>();
  const order: string[] = [];

  for (const set of [...existing, ...incoming]) {
    const key = set.clientId || `n-${set.setNumber ?? set.set ?? order.length + 1}`;
    if (!byId.has(key)) order.push(key);
    byId.set(key, { ...byId.get(key), ...set, clientId: set.clientId || key });
  }

  const merged = order.map((key, idx) => {
    const set = byId.get(key)!;
    return {
      setNumber: set.setNumber ?? set.set ?? idx + 1,
      weightKg: set.weightKg ?? '',
      reps: set.reps ?? '',
      notes: set.notes ?? '',
      completed: Boolean(set.completed),
      clientId: set.clientId || key,
      variant: set.variant,
    };
  });

  return JSON.stringify(merged);
}

export async function POST(request: NextRequest) {
  try {
    const addisNow = getAddisNow();
    const windowInfo = workoutWindowForAddisDate(addisNow);

    const body = await request.json();
    const { workoutDayId, weekNumber, notes, exerciseLogs, sessionSubmitted } = body;

    if (!workoutDayId || !Array.isArray(exerciseLogs)) {
      return NextResponse.json({ error: 'workoutDayId and exerciseLogs are required' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Serialize the execution day so retries/double-clicks cannot create a second session.
      await tx.$queryRaw`SELECT id FROM "WorkoutDay" WHERE id = ${workoutDayId} FOR UPDATE`;

      let workoutDay = await tx.workoutDay.findUnique({ where: { id: workoutDayId } });
      if (!workoutDay) {
        const dayNum = parseInt(workoutDayId.replace('day-', ''), 10);
        const routine = getScheduledRoutineForDayOfWeek(isNaN(dayNum) ? windowInfo.startAddis.getDay() : dayNum);
        workoutDay = await tx.workoutDay.create({
          data: {
            id: workoutDayId,
            type: routine.dayName,
            dayOfWeek: routine.dayOfWeek,
            location: routine.location,
            targetBodyParts: routine.targetBodyParts,
            isRecovery: Boolean(routine.isRecovery),
          },
        });
      }

      let workoutLog = await tx.workoutLog.findFirst({
        where: {
          workoutDayId: workoutDay.id,
          completedAt: { gte: windowInfo.startUtc, lte: windowInfo.endUtc },
        },
        include: { exerciseLogs: true },
      });

      if (sessionSubmitted && windowInfo.isClosed) {
        return {
          locked: true,
          alreadyCompleted: false,
          missed: true,
          message: 'Today\'s workout is missed and locked after the cutoff.',
          workoutLogId: workoutLog?.id || null,
          xpEarned: 0,
        };
      }

      if (workoutLog?.submittedAt) {
        return {
          locked: true,
          alreadyCompleted: true,
          missed: false,
          message: 'Today\'s workout has already been completed.',
          workoutLogId: workoutLog.id,
          xpEarned: 0,
        };
      }

      const lateHistoricalSync = windowInfo.isClosed && !workoutLog;

      if (!workoutLog) {
        workoutLog = await tx.workoutLog.create({
          data: {
            workoutDayId: workoutDay.id,
            weekNumber: Number(weekNumber) || 1,
            notes: notes?.trim() || null,
          },
          include: { exerciseLogs: true },
        });
      }

      let totalXpEarned = 0;
      const canAwardXp = !windowInfo.isClosed;

      for (const item of exerciseLogs) {
      if (!item.exerciseId) continue;

      // Ensure exercise exists in DB
      let exercise = await tx.workoutExercise.findUnique({ where: { id: item.exerciseId } });
      if (!exercise) {
        const muscleInfo = getExerciseMuscleInfo(item.exerciseName || item.name || item.exerciseId);
        exercise = await tx.workoutExercise.create({
          data: {
            id: item.exerciseId,
            workoutDayId: workoutDay.id,
            name: item.exerciseName || item.name || item.exerciseId,
            order: Number(item.order) || 1,
            targetMuscle: muscleInfo.muscle,
          },
        });
      }

      const existingExerciseLog = workoutLog.exerciseLogs.find((el) => el.exerciseId === exercise!.id);
      const setsCompleted = Number(item.setsCompleted) || 1;
      const repsCompleted = Number(item.repsCompleted) || 8;
      const weightKg =
        item.weightKg !== null && item.weightKg !== undefined && item.weightKg !== ''
          ? Number(item.weightKg)
          : null;
      const checked = Boolean(item.checked);
      const setDetails = mergeSetDetails(existingExerciseLog?.setDetails, item.setDetails);
      const clientId = item.clientId || existingExerciseLog?.clientId || null;

      if (existingExerciseLog) {
        const newlyChecked = checked && !existingExerciseLog.checked;
        await tx.exerciseLog.update({
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
        if (canAwardXp && newlyChecked) {
          totalXpEarned += Math.max(1, setsCompleted) * Math.max(1, repsCompleted) * 2;
        }
      } else {
        await tx.exerciseLog.create({
          data: {
            workoutLogId: workoutLog.id,
            exerciseId: exercise.id,
            setsCompleted,
            repsCompleted,
            weightKg,
            checked,
            setDetails,
            clientId,
          },
        });

        if (canAwardXp && checked) {
          totalXpEarned += Math.max(1, setsCompleted) * Math.max(1, repsCompleted) * 2;
        }
      }
    }

      if (sessionSubmitted && !windowInfo.isClosed && !workoutLog.submittedAt) {
        await tx.workoutLog.update({
        where: { id: workoutLog.id },
        data: {
          submittedAt: new Date(),
          notes: notes?.trim() || workoutLog.notes,
        },
      });
      } else if (notes?.trim()) {
        await tx.workoutLog.update({
        where: { id: workoutLog.id },
        data: { notes: notes.trim() },
      });
      }

      if (totalXpEarned > 0) {
        await tx.userProfile.update({
          where: { id: 'singleton' },
          data: { totalXp: { increment: totalXpEarned } },
        });
      }

      return {
        locked: false,
        alreadyCompleted: false,
        missed: false,
        workoutLogId: workoutLog.id,
        xpEarned: totalXpEarned,
        historicalOnly: Boolean(lateHistoricalSync),
      };
    });

    if (result.locked) {
      return NextResponse.json(result, { status: 200 });
    }

    if (result.xpEarned > 0) {
      await recordProgressActivity(result.xpEarned).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      workoutLogId: result.workoutLogId,
      xpEarned: result.xpEarned,
      syncedAt: new Date().toISOString(),
      historicalOnly: result.historicalOnly,
      message: result.historicalOnly
        ? 'Historical sets preserved after cutoff (not counted as a new submission)'
        : 'Offline workout synchronized successfully',
    });
  } catch (error: any) {
    console.error('Workout sync error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
