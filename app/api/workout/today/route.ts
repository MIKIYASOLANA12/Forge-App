import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentWeek, getPhase } from '@/lib/workout';
import {
  getAddisNow,
  workoutWindowForAddisDate,
  toUtcFromAddis,
  getWorkoutLocationForAddisDate,
  getDayOfJourney300,
} from '@/lib/workoutTime';
import {
  WORKOUT_DAY_TARGETS,
  getExerciseMuscleInfo,
  getProtocolExercises,
} from '@/lib/workoutMuscleTargets';
import { detectMissedActivities } from '@/lib/accountabilityRecheck';
import { getHolidayWorkoutStatus } from '@/lib/holidayWorkout';
import { getDashboardCountdowns } from '@/lib/countdowns';

const ORDER = ['Push', 'Pull', 'LegsCore'];

export async function GET(req: NextRequest) {
  const session = await getSessionUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized: Session revoked or invalid.' }, { status: 401 });
  }

  const addisNow = getAddisNow();
  const holidayStatus = getHolidayWorkoutStatus(addisNow);
  const countdowns = await getDashboardCountdowns(addisNow);
  const windowInfo = workoutWindowForAddisDate(addisNow);
  const day300 = getDayOfJourney300(addisNow);

  const yesterdayAddis = new Date(windowInfo.startAddis);
  yesterdayAddis.setDate(yesterdayAddis.getDate() - 1);
  const yesterdayWindow = workoutWindowForAddisDate(yesterdayAddis);
  const yesterdayReport = await detectMissedActivities(yesterdayWindow);

  const [program, lastLog, days, todayLog] = await Promise.all([
    prisma.workoutProgram.findUnique({ where: { id: 'singleton' } }),
    prisma.workoutLog.findFirst({ orderBy: { completedAt: 'desc' }, include: { workoutDay: true } }),
    prisma.workoutDay.findMany({ include: { exercises: { orderBy: { order: 'asc' } } } }),
    prisma.workoutLog.findFirst({
      where: { completedAt: { gte: windowInfo.startUtc, lte: windowInfo.endUtc } },
      include: { workoutDay: true, exerciseLogs: { include: { exercise: true } } },
    }),
  ]);

  if (!program || !days.length) {
    return NextResponse.json({ error: 'Workout program is not seeded' }, { status: 404 });
  }

  const week = getCurrentWeek(program.startDate);
  const phase = getPhase(week);

  // Determine scheduled workout by calendar day progression
  // Every day has its own scheduled workout in the sequence regardless of past misses
  const scheduledType = ORDER[(day300.dayNumber - 1) % ORDER.length];
  let activeDay = days.find((d) => d.type === scheduledType) || days[0];

  if (todayLog) {
    activeDay = days.find((d) => d.id === todayLog.workoutDayId) || days.find((d) => d.type === todayLog.workoutDay.type) || activeDay;
  }

  // Location based on weekly schedule: Monday, Wednesday, Saturday = GYM; other days = HOME
  const location = getWorkoutLocationForAddisDate(windowInfo.startAddis);
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

  const nextUnlockFormatted = windowInfo.nextUnlockAddis.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Next workout day details (Calendar progression to next day)
  const nextScheduledType = ORDER[day300.dayNumber % ORDER.length];
  const nextDay = days.find((item) => item.type === nextScheduledType) ?? days[0];
  const nextLocation = getWorkoutLocationForAddisDate(windowInfo.nextUnlockAddis);
  const nextTargetInfo = WORKOUT_DAY_TARGETS[nextDay.type] || targetInfo;

  const currentDayName = addisNow.toLocaleDateString('en-US', { weekday: 'long' });
  const currentDateFormatted = addisNow.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Filter exercises by location: HOME (order >= 100) vs GYM (order < 100)
  const rawActiveExercises = activeDay.exercises.filter((ex) =>
    location === 'HOME' ? ex.order >= 100 : ex.order < 100
  );

  const activeExerciseList = rawActiveExercises.length > 0
    ? rawActiveExercises
    : getProtocolExercises(activeDay.type, location).map((p, idx) => ({
        id: `${activeDay.id}-${location.toLowerCase()}-${idx + 1}`,
        workoutDayId: activeDay.id,
        name: p.name,
        order: location === 'HOME' ? 101 + idx : idx + 1,
      }));

  const rawNextExercises = nextDay.exercises.filter((ex) =>
    nextLocation === 'HOME' ? ex.order >= 100 : ex.order < 100
  );

  const nextExerciseList = rawNextExercises.length > 0
    ? rawNextExercises
    : getProtocolExercises(nextDay.type, nextLocation).map((p, idx) => ({
        id: `${nextDay.id}-${nextLocation.toLowerCase()}-${idx + 1}`,
        workoutDayId: nextDay.id,
        name: p.name,
        order: nextLocation === 'HOME' ? 101 + idx : idx + 1,
      }));

  const isClosed = windowInfo.isClosed;
  const allExercisesChecked =
    Boolean(todayLog) &&
    activeExerciseList.length > 0 &&
    activeExerciseList.every((exercise) =>
      Boolean(todayLog?.exerciseLogs.find((el) => el.exerciseId === exercise.id && el.checked))
    );
  const submittedBeforeCutoff = Boolean(
    todayLog?.submittedAt && todayLog.submittedAt.getTime() <= windowInfo.closeUtc.getTime()
  );
  const legacyFullLogBeforeCutoff = Boolean(
    todayLog &&
      !todayLog.submittedAt &&
      allExercisesChecked &&
      todayLog.completedAt.getTime() <= windowInfo.closeUtc.getTime()
  );
  const isCompleted = submittedBeforeCutoff || (!isClosed && allExercisesChecked) || legacyFullLogBeforeCutoff;
  const isMissed = isClosed && !isCompleted;

  return NextResponse.json({
    currentDayName,
    currentDateFormatted,
    openTimeFormatted: '05:00 AM',
    closeTimeFormatted: '09:28 PM',
    closeTimestamp: windowInfo.closeUtc.getTime(),
    nextUnlockTimestamp: windowInfo.nextUnlockUtc.getTime(),
    isOpen: windowInfo.isOpen,
    isClosed,
    isMissed,
    completedToday: isCompleted,
    missedToday: isMissed,
    sessionInProgress: Boolean(todayLog) && !isCompleted,
    day300,
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
      exercises: activeExerciseList.map((exercise) => {
        const muscleInfo = getExerciseMuscleInfo(exercise.name);
        const todayExerciseLog = todayLog?.exerciseLogs.find((el) => el.exerciseId === exercise.id) ?? null;
        return {
          ...exercise,
          targetMuscle: muscleInfo.muscle,
          masterCue: muscleInfo.cue,
          lastLog: lastByExercise.get(exercise.id) ?? null,
          todayLog: todayExerciseLog
            ? {
                setsCompleted: todayExerciseLog.setsCompleted,
                repsCompleted: todayExerciseLog.repsCompleted,
                weightKg: todayExerciseLog.weightKg,
                checked: todayExerciseLog.checked,
                setDetails: todayExerciseLog.setDetails,
                clientId: todayExerciseLog.clientId,
              }
            : null,
        };
      }),
    },
    nextWorkout: {
      dateFormatted: nextUnlockFormatted,
      unlockTimestamp: windowInfo.nextUnlockUtc.getTime(),
      type: nextDay.type,
      location: nextLocation,
      targetBodyParts: nextTargetInfo.primaryBodyParts,
      focusBadges: nextTargetInfo.focusBadges,
      phase,
      exercises: nextExerciseList.map((exercise) => {
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
    isHolidayWorkout: holidayStatus.isHolidayPeriod,
    holiday: holidayStatus,
    countdowns,
    yesterday: {
      dateFormatted: yesterdayWindow.startAddis.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }),
      missedItems: yesterdayReport.missedAll,
      completedItems: yesterdayReport.completedAll,
      workoutMissed: yesterdayReport.workoutMissed,
    },
  });
}