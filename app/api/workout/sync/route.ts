import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAddisNow, workoutWindowForAddisDate } from '@/lib/workoutTime';
import { recordProgressActivity } from '@/lib/progressEngine';

type IncomingSet = {
  setNumber?: number;
  set?: number;
  weightKg?: number | string;
  reps?: number | string;
  notes?: string;
  completed?: boolean;
  clientId?: string;
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

    let workoutLog = await prisma.workoutLog.findFirst({
      where: {
        workoutDayId,
        completedAt: { gte: windowInfo.startUtc, lte: windowInfo.endUtc },
      },
      include: { exerciseLogs: true },
    });

    // After cutoff: still persist sets that were recorded on-device so history is not lost.
    // Do not treat a late sync as a new submission (no XP, no submittedAt).
    const lateHistoricalSync = windowInfo.isClosed && !workoutLog;

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

    let totalXpEarned = 0;
    const canAwardXp = !windowInfo.isClosed;

    for (const item of exerciseLogs) {
      if (!item.exerciseId) continue;

      const existingExerciseLog = workoutLog.exerciseLogs.find((el) => el.exerciseId === item.exerciseId);
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
        if (canAwardXp && newlyChecked) {
          totalXpEarned += Math.max(1, setsCompleted) * Math.max(1, repsCompleted) * 2;
        }
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

        if (canAwardXp && checked) {
          totalXpEarned += Math.max(1, setsCompleted) * Math.max(1, repsCompleted) * 2;
        }
      }
    }

    if (sessionSubmitted && !windowInfo.isClosed && !workoutLog.submittedAt) {
      await prisma.workoutLog.update({
        where: { id: workoutLog.id },
        data: {
          submittedAt: new Date(),
          notes: notes?.trim() || workoutLog.notes,
        },
      });
    } else if (notes?.trim()) {
      await prisma.workoutLog.update({
        where: { id: workoutLog.id },
        data: { notes: notes.trim() },
      });
    }

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
      historicalOnly: Boolean(lateHistoricalSync),
      message: lateHistoricalSync
        ? 'Historical sets preserved after cutoff (not counted as a new submission)'
        : 'Offline workout synchronized successfully',
    });
  } catch (error: any) {
    console.error('Workout sync error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
