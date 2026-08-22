import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentWeek, getPhase } from '@/lib/workout';

const ORDER = ['Push', 'Pull', 'LegsCore'];

export async function GET() {
  const now = new Date();
  const currentDayOfWeek = now.getDay(); // 0 is Sunday, 6 is Saturday
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

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

  // Fetch previous weights
  const previousLogs = await prisma.exerciseLog.findMany({
    where: { exercise: { workoutDayId: day.id } },
    orderBy: { workoutLog: { completedAt: 'desc' } },
    include: { workoutLog: { select: { completedAt: true } } },
  });

  const lastByExercise = new Map<string, (typeof previousLogs)[number]>();
  for (const log of previousLogs) {
    if (!lastByExercise.has(log.exerciseId)) lastByExercise.set(log.exerciseId, log);
  }

  // Calculate Next Monday Launch Date
  // If today is Sunday (0), next Monday is +1 day. If Saturday (6), +2 days.
  const daysUntilMonday = currentDayOfWeek === 0 ? 1 : currentDayOfWeek === 6 ? 2 : (8 - currentDayOfWeek) % 7;
  const nextMonday = new Date(now);
  nextMonday.setDate(nextMonday.getDate() + (daysUntilMonday === 0 ? 7 : daysUntilMonday));
  nextMonday.setHours(6, 0, 0, 0); // 6:00 AM unlock

  const nextMondayFormatted = nextMonday.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Next workout unlock for completed sessions
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(6, 0, 0, 0);

  const nextType = todayLog ? ORDER[(ORDER.indexOf(todayLog.workoutDay.type) + 1) % ORDER.length] : ORDER[(ORDER.indexOf(type) + 1) % ORDER.length];
  const nextDay = days.find((item) => item.type === nextType) ?? days[0];
  const nextLocation = nextDay.type === 'LegsCore' ? 'HOME / GYM' : 'GYM';

  const isWeekendPreLaunch = (currentDayOfWeek === 0 || currentDayOfWeek === 6) && !lastLog;

  const targetUnlockTime = isWeekendPreLaunch ? nextMonday.getTime() : tomorrow.getTime();
  const targetDateFormatted = isWeekendPreLaunch ? nextMondayFormatted : tomorrow.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const currentDayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const currentDateFormatted = now.toLocaleDateString('en-US', {
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
      exercises: day.exercises.map((exercise) => ({
        ...exercise,
        lastLog: lastByExercise.get(exercise.id) ?? null,
      })),
    },
    nextWorkout: {
      dateFormatted: targetDateFormatted,
      unlockTimestamp: targetUnlockTime,
      type: isWeekendPreLaunch ? 'Push' : nextDay.type,
      location: isWeekendPreLaunch ? 'GYM' : nextLocation,
      phase,
      exercises: isWeekendPreLaunch ? (days.find(d => d.type === 'Push')?.exercises ?? day.exercises) : nextDay.exercises,
    },
    weekNumber: week,
    phase,
    isNewPhase: week > 1 && phase.weeks[0] === week,
  });
}