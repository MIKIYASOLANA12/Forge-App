import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentWeek, getPhase } from '@/lib/workout';

const ORDER = ['Push', 'Pull', 'LegsCore'];

export async function GET() {
  const now = new Date();
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

  // Determine current scheduled workout
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

  // Next workout details (for countdown & blurred preview)
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(6, 0, 0, 0); // 6:00 AM unlock

  const nextType = todayLog ? type : ORDER[(ORDER.indexOf(type) + 1) % ORDER.length];
  const nextDay = days.find((item) => item.type === nextType) ?? days[0];
  const nextLocation = nextDay.type === 'LegsCore' ? 'HOME / GYM' : 'GYM';

  const nextDateFormatted = tomorrow.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return NextResponse.json({
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
      dateFormatted: nextDateFormatted,
      unlockTimestamp: tomorrow.getTime(),
      type: nextDay.type,
      location: nextLocation,
      phase,
      exercises: nextDay.exercises,
    },
    weekNumber: week,
    phase,
    isNewPhase: week > 1 && phase.weeks[0] === week,
  });
}