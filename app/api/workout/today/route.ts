import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentWeek, getPhase } from '@/lib/workout';
import { getAddisNow, workoutWindowForAddisDate, toUtcFromAddis } from '@/lib/workoutTime';
import { WORKOUT_DAY_TARGETS, getExerciseMuscleInfo } from '@/lib/workoutMuscleTargets';

const ORDER = ['Push', 'Pull', 'LegsCore'];

export async function GET() {
  // Use shared workout-time helpers for Addis/Addis_Ababa 05:00 day boundary
  const addisNow = getAddisNow();
  const currentDayOfWeek = addisNow.getDay(); // 0 is Sunday, 6 is Saturday

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
  const lastIndex = lastLog ? ORDER.indexOf(lastLog.workoutDay.type) : -1;
  const type = ORDER[(lastIndex + 1) % ORDER.length];
  const day = days.find((item) => item.type === type) ?? days[0];

  const location = day.type === 'LegsCore' ? 'HOME / GYM' : 'GYM';
  const targetInfo = WORKOUT_DAY_TARGETS[day.type] || {
    primaryBodyParts: 'Full Body Hypertrophy',
    focusBadges: ['Compound Movements', 'Core Stability'],
    description: 'Targeted muscular overload session.',
  };

  // Fetch previous weights with setDetails
  const previousLogs = await prisma.exerciseLog.findMany({
    where: { exercise: { workoutDayId: day.id } },
    orderBy: { workoutLog: { completedAt: 'desc' } },
    include: { workoutLog: { select: { completedAt: true } } },
  });

  const lastByExercise = new Map<string, (typeof previousLogs)[number]>();
  for (const log of previousLogs) {
    if (!lastByExercise.has(log.exerciseId)) lastByExercise.set(log.exerciseId, log);
  }

  // Calculate Next Monday Launch Date in Addis timezone, set to 05:00
  const daysUntilMonday = currentDayOfWeek === 0 ? 1 : currentDayOfWeek === 6 ? 2 : (8 - currentDayOfWeek) % 7;
  const nextMondayAddis = new Date(addisNow);
  nextMondayAddis.setDate(nextMondayAddis.getDate() + (daysUntilMonday === 0 ? 7 : daysUntilMonday));
  nextMondayAddis.setHours(5, 0, 0, 0); // 05:00 Addis
  const nextMonday = toUtcFromAddis(nextMondayAddis); // convert to UTC

  const nextMondayFormatted = nextMondayAddis.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Next workout unlock for completed sessions (tomorrow at 05:00 Addis)
  const tomorrowAddis = new Date(addisNow);
  tomorrowAddis.setDate(tomorrowAddis.getDate() + 1);
  tomorrowAddis.setHours(5, 0, 0, 0);
  const tomorrow = toUtcFromAddis(tomorrowAddis);

  const nextType = todayLog ? ORDER[(ORDER.indexOf(todayLog.workoutDay.type) + 1) % ORDER.length] : ORDER[(ORDER.indexOf(type) + 1) % ORDER.length];
  const nextDay = days.find((item) => item.type === nextType) ?? days[0];
  const nextLocation = nextDay.type === 'LegsCore' ? 'HOME / GYM' : 'GYM';
  const nextTargetInfo = WORKOUT_DAY_TARGETS[nextDay.type] || targetInfo;

  const isWeekendPreLaunch = (currentDayOfWeek === 0 || currentDayOfWeek === 6) && !lastLog;

  const targetUnlockTime = isWeekendPreLaunch ? nextMonday.getTime() : tomorrow.getTime();
  const targetDateFormatted = isWeekendPreLaunch ? nextMondayFormatted : tomorrow.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

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
    isWeekendPreLaunch,
    launchMondayFormatted: nextMondayFormatted,
    launchUnlockTimestamp: nextMonday.getTime(),
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
      id: day.id,
      type: day.type,
      location,
      targetBodyParts: targetInfo.primaryBodyParts,
      focusBadges: targetInfo.focusBadges,
      exercises: day.exercises.map((exercise) => {
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
      dateFormatted: targetDateFormatted,
      unlockTimestamp: targetUnlockTime,
      type: isWeekendPreLaunch ? 'Push' : nextDay.type,
      location: isWeekendPreLaunch ? 'GYM' : nextLocation,
      targetBodyParts: isWeekendPreLaunch ? WORKOUT_DAY_TARGETS.Push.primaryBodyParts : nextTargetInfo.primaryBodyParts,
      focusBadges: isWeekendPreLaunch ? WORKOUT_DAY_TARGETS.Push.focusBadges : nextTargetInfo.focusBadges,
      phase,
      exercises: isWeekendPreLaunch ? (days.find(d => d.type === 'Push')?.exercises ?? day.exercises) : nextDay.exercises,
    },
    weekNumber: week,
    phase,
    isNewPhase: week > 1 && phase.weeks[0] === week,
  });
}