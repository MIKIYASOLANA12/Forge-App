import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentWeek, getPhase } from '@/lib/workout';
import { getAddisNow, workoutWindowForAddisDate, toUtcFromAddis } from '@/lib/workoutTime';
import { WORKOUT_DAY_TARGETS, getExerciseMuscleInfo } from '@/lib/workoutMuscleTargets';

const ORDER = ['Push', 'Pull', 'LegsCore'];

export async function GET() {
  // Use shared workout-time helpers for Addis/Addis_Ababa 05:00 day boundary
  const addisNow = getAddisNow();

  // Today's window (UTC) derived from Addis-local workout day that starts at 05:00
  const { startUtc: todayStart, endUtc: todayEnd, startAddis: todayStartAddis } = workoutWindowForAddisDate(addisNow);

  const [program, lastLog, days, todayLog] = await Promise.all([
    prisma.workoutProgram.findUnique({ where: { id: 'singleton' } }),
    prisma.workoutLog.findFirst({ orderBy: { completedAt: 'desc' }, include: { workoutDay: true } }),
    prisma.workoutDay.findMany({ include: { exercises: { orderBy: { order: 'asc' } } } }),
    prisma.workoutLog.findFirst({
      where: { completedAt: { gte: todayStart, lte: todayEnd } },
      include: { workoutDay: true, exerciseLogs: { include: { exercise: true } } },
    }),
  ]);

  if (!program || !days.length) {
    return NextResponse.json({ error: 'Workout program is not seeded' }, { status: 404 });
  }

  const week = getCurrentWeek(program.startDate);
  const phase = getPhase(week);

  // Determine scheduled workout
  // If todayLog exists, today's workout was the one logged in todayLog
  // Otherwise, scheduled workout is next in order after lastLog (prior to today)
  let activeDay = days[0];
  if (todayLog) {
    activeDay = days.find((d) => d.id === todayLog.workoutDayId) || days.find((d) => d.type === todayLog.workoutDay.type) || days[0];
  } else if (lastLog) {
    const lastIndex = ORDER.indexOf(lastLog.workoutDay.type);
    const nextType = ORDER[(lastIndex + 1) % ORDER.length];
    activeDay = days.find((item) => item.type === nextType) ?? days[0];
  } else {
    activeDay = days.find((item) => item.type === 'Push') ?? days[0];
  }

  const location = activeDay.type === 'LegsCore' ? 'HOME / GYM' : 'GYM';
  const targetInfo = WORKOUT_DAY_TARGETS[activeDay.type] || {
    primaryBodyParts: 'Full Body Hypertrophy',
    focusBadges: ['Compound Movements', 'Core Stability'],
    description: 'Targeted muscular overload session.',
  };

  // Fetch previous weights with setDetails for active day's exercises
  const previousLogs = await prisma.exerciseLog.findMany({
    where: { exercise: { workoutDayId: activeDay.id } },
    orderBy: { workoutLog: { completedAt: 'desc' } },
    include: { workoutLog: { select: { completedAt: true } } },
  });

  const lastByExercise = new Map<string, (typeof previousLogs)[number]>();
  for (const log of previousLogs) {
    if (!lastByExercise.has(log.exerciseId)) lastByExercise.set(log.exerciseId, log);
  }

  // Next workout unlock timestamp: Tomorrow morning at exactly 05:00 AM Addis Ababa time
  // Derived from the start of current Addis workout day + 24 hours (next 05:00 AM boundary)
  const nextUnlockAddis = new Date(todayStartAddis);
  nextUnlockAddis.setDate(nextUnlockAddis.getDate() + 1);
  nextUnlockAddis.setHours(5, 0, 0, 0); // 05:00 AM Addis
  const nextUnlockUtc = toUtcFromAddis(nextUnlockAddis);

  const nextUnlockFormatted = nextUnlockAddis.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Next workout day details
  const activeTypeIndex = ORDER.indexOf(activeDay.type);
  const nextDayType = ORDER[(activeTypeIndex + 1) % ORDER.length];
  const nextDay = days.find((item) => item.type === nextDayType) ?? days[0];
  const nextLocation = nextDay.type === 'LegsCore' ? 'HOME / GYM' : 'GYM';
  const nextTargetInfo = WORKOUT_DAY_TARGETS[nextDay.type] || targetInfo;

  const currentDayName = addisNow.toLocaleDateString('en-US', { weekday: 'long' });
  const currentDateFormatted = addisNow.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return NextResponse.json({
    currentDayName,
    currentDateFormatted,
    completedToday: Boolean(todayLog),
    targetBodyParts: targetInfo.primaryBodyParts,
    focusBadges: targetInfo.focusBadges,
    targetDescription: targetInfo.description,
    todayLog: todayLog ? {
      id: todayLog.id,
      completedAt: todayLog.completedAt,
      type: todayLog.workoutDay.type,
      notes: todayLog.notes,
    } : null,
    day: {
      id: activeDay.id,
      type: activeDay.type,
      location,
      targetBodyParts: targetInfo.primaryBodyParts,
      focusBadges: targetInfo.focusBadges,
      exercises: activeDay.exercises.map((exercise) => {
        const muscleInfo = getExerciseMuscleInfo(exercise.name);
        return {
          ...exercise,
          targetMuscle: muscleInfo.muscle,
          masterCue: muscleInfo.cue,
          lastLog: lastByExercise.get(exercise.id) ?? null,
        };
      }),
    },
    nextWorkout: {
      dateFormatted: nextUnlockFormatted,
      unlockTimestamp: nextUnlockUtc.getTime(),
      type: nextDay.type,
      location: nextLocation,
      targetBodyParts: nextTargetInfo.primaryBodyParts,
      focusBadges: nextTargetInfo.focusBadges,
      phase,
      exercises: nextDay.exercises.map((exercise) => {
        const muscleInfo = getExerciseMuscleInfo(exercise.name);
        return {
          ...exercise,
          targetMuscle: muscleInfo.muscle,
          masterCue: muscleInfo.cue,
        };
      }),
    },
    weekNumber: week,
    phase,
    isNewPhase: week > 1 && phase.weeks[0] === week,
  });
}