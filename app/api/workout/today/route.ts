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
  WEEKLY_WORKOUT_SCHEDULE,
  CORE_ROUTINE_A,
  CORE_ROUTINE_B,
  getCoreRoutineForDayOfWeek,
  getScheduledRoutineForDayOfWeek,
  getExerciseMuscleInfo,
  getProgressiveOverloadSuggestion,
  isDeloadWeek,
} from '@/lib/workoutMuscleTargets';
import { detectMissedActivities } from '@/lib/accountabilityRecheck';
import { getDashboardCountdowns } from '@/lib/countdowns';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUserFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session revoked or invalid.' }, { status: 401 });
    }

    const addisNow = getAddisNow();
    const countdowns = await getDashboardCountdowns(addisNow).catch((err) => {
      console.error('Countdowns error in workout today:', err);
      return [];
    });
    const windowInfo = workoutWindowForAddisDate(addisNow);
    const day300 = getDayOfJourney300(addisNow);

    const yesterdayAddis = new Date(windowInfo.startAddis);
    yesterdayAddis.setDate(yesterdayAddis.getDate() - 1);
    const yesterdayWindow = workoutWindowForAddisDate(yesterdayAddis);
    const yesterdayReport = await detectMissedActivities(yesterdayWindow).catch((err) => {
      console.error('Missed activities detection error:', err);
      return { missedAll: [], completedAll: [], workoutMissed: false, habits: { completed: 0, total: 0, missedNames: [] } };
    });

    // Normalized date key for daily core
    const normalizedCoreDate = new Date(
      Date.UTC(windowInfo.startAddis.getFullYear(), windowInfo.startAddis.getMonth(), windowInfo.startAddis.getDate())
    );

    const [program, todayLog, morningCoreLog, nightCoreLog] = await Promise.all([
      prisma.workoutProgram.findUnique({ where: { id: 'singleton' } }).catch(() => null),
      prisma.workoutLog.findFirst({
        where: { completedAt: { gte: windowInfo.startUtc, lte: windowInfo.endUtc } },
        include: { workoutDay: true, exerciseLogs: { include: { exercise: true } } },
      }).catch(() => null),
      prisma.dailyCoreLog.findUnique({
        where: { date_slot: { date: normalizedCoreDate, slot: 'MORNING' } },
      }).catch(() => null),
      prisma.dailyCoreLog.findUnique({
        where: { date_slot: { date: normalizedCoreDate, slot: 'NIGHT' } },
      }).catch(() => null),
    ]);

    const week = program ? getCurrentWeek(program.startDate) : 1;
    const phase = getPhase(week);
    const isDeload = isDeloadWeek(week);

    // Exact 7-day schedule lookup by day of week (0..6)
    const todayDayOfWeek = windowInfo.startAddis.getDay();
    const todayRoutine = getScheduledRoutineForDayOfWeek(todayDayOfWeek);

    const nextDayOfWeek = (todayDayOfWeek + 1) % 7;
    const nextRoutine = getScheduledRoutineForDayOfWeek(nextDayOfWeek);

    // Core routine scheduled for today (Core A or Core B)
    const todayCoreRoutine = getCoreRoutineForDayOfWeek(todayDayOfWeek);

    // Fetch previous logs for all exercises in today's routine & home substitute to provide per-set reference
    const allCandidateNames = [
      ...todayRoutine.exercises.map((e) => e.name),
      ...(todayRoutine.homeSubstitute?.exercises.map((e) => e.name) || []),
    ];

    const previousLogs = await prisma.exerciseLog.findMany({
      where: {
        exercise: {
          name: { in: allCandidateNames },
        },
      },
      orderBy: { workoutLog: { completedAt: 'desc' } },
      include: {
        workoutLog: { select: { completedAt: true, submittedAt: true } },
        exercise: true,
      },
      take: 60,
    }).catch(() => []);

    const lastByExerciseName = new Map<string, (typeof previousLogs)[number]>();
    for (const log of previousLogs) {
      if (!lastByExerciseName.has(log.exercise.name)) {
        lastByExerciseName.set(log.exercise.name, log);
      }
    }

    const nextUnlockFormatted = windowInfo.nextUnlockAddis.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const currentDayName = windowInfo.startAddis.toLocaleDateString('en-US', { weekday: 'long' });
    const currentDateFormatted = windowInfo.startAddis.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const isClosed = windowInfo.isClosed;

    // Build active exercise list with per-set history & progressive overload suggestions
    const activeExerciseList = todayRoutine.exercises.map((def, idx) => {
      const lastLog = lastByExerciseName.get(def.name) || null;
      const todayExerciseLog = todayLog?.exerciseLogs.find(
        (el) => el.exerciseId === def.id || el.exercise?.name === def.name
      ) ?? null;

      let parsedLastSets: any[] = [];
      if (lastLog?.setDetails) {
        try {
          parsedLastSets = JSON.parse(lastLog.setDetails);
        } catch {}
      }

      const overloadSuggestion = getProgressiveOverloadSuggestion(def.name, parsedLastSets, def.targetReps);
      // If deload week, reduce target sets by 1 (or by ~40%)
      const effectiveTargetSets = isDeload ? Math.max(2, Math.round(def.targetSets * 0.6)) : def.targetSets;

      return {
        id: def.id,
        name: def.name,
        order: idx + 1,
        targetMuscle: def.muscle,
        masterCue: def.cue,
        equipment: def.equipment,
        targetSets: effectiveTargetSets,
        targetReps: def.targetReps,
        targetDurationSeconds: def.targetDurationSeconds,
        startingWeightKg: def.startingWeightKg,
        startingWeightGuide: def.startingWeightGuide,
        variants: def.variants,
        defaultVariant: def.defaultVariant,
        safetyWarning: def.safetyWarning,
        isTimed: def.isTimed,
        isOptional: def.isOptional,
        isPrimaryCompound: def.isPrimaryCompound,
        overloadSuggestion: overloadSuggestion ? overloadSuggestion.suggestion : null,
        lastLog: lastLog
          ? {
              setsCompleted: lastLog.setsCompleted,
              repsCompleted: lastLog.repsCompleted,
              weightKg: lastLog.weightKg,
              setDetails: lastLog.setDetails,
            }
          : null,
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
    });

    // Home Substitute exercise list if available
    const homeSubstituteList = todayRoutine.homeSubstitute
      ? todayRoutine.homeSubstitute.exercises.map((def, idx) => {
          const lastLog = lastByExerciseName.get(def.name) || null;
          const todayExerciseLog = todayLog?.exerciseLogs.find(
            (el) => el.exerciseId === def.id || el.exercise?.name === def.name
          ) ?? null;

          const effectiveTargetSets = isDeload ? Math.max(2, Math.round(def.targetSets * 0.6)) : def.targetSets;

          return {
            id: def.id,
            name: def.name,
            order: idx + 1,
            targetMuscle: def.muscle,
            masterCue: def.cue,
            equipment: def.equipment,
            targetSets: effectiveTargetSets,
            targetReps: def.targetReps,
            targetDurationSeconds: def.targetDurationSeconds,
            startingWeightKg: def.startingWeightKg,
            startingWeightGuide: def.startingWeightGuide,
            variants: def.variants,
            defaultVariant: def.defaultVariant,
            safetyWarning: def.safetyWarning,
            isTimed: def.isTimed,
            isOptional: def.isOptional,
            isPrimaryCompound: def.isPrimaryCompound,
            lastLog: lastLog
              ? {
                  setsCompleted: lastLog.setsCompleted,
                  repsCompleted: lastLog.repsCompleted,
                  weightKg: lastLog.weightKg,
                  setDetails: lastLog.setDetails,
                }
              : null,
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
        })
      : null;

    const allExercisesChecked =
      Boolean(todayLog) &&
      activeExerciseList.length > 0 &&
      activeExerciseList.every((exercise) =>
        Boolean(todayLog?.exerciseLogs.find((el) => (el.exerciseId === exercise.id || el.exercise?.name === exercise.name) && el.checked))
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

    // Daily Core Routine State
    const morningCoreCompleted = Boolean(morningCoreLog?.completed);
    const nightCoreCompleted = Boolean(nightCoreLog?.completed);

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
      targetBodyParts: todayRoutine.targetBodyParts,
      focusBadges: todayRoutine.focusBadges,
      targetDescription: todayRoutine.description,
      isRecovery: Boolean(todayRoutine.isRecovery),
      recoveryNotice: todayRoutine.recoveryNotice,
      equipmentSummary: todayRoutine.equipmentSummary,
      isDeloadWeek: isDeload,
      deloadNotice: isDeload
        ? `DELOAD WEEK (Week ${week}) · Total volume reduced by ~40% to allow systemic, tendon, and joint recovery.`
        : null,
      todayLog: todayLog
        ? {
            id: todayLog.id,
            completedAt: todayLog.completedAt,
            type: todayRoutine.targetBodyParts,
            notes: todayLog.notes,
          }
        : null,
      day: {
        id: `day-${todayRoutine.dayOfWeek}`,
        dayOfWeek: todayRoutine.dayOfWeek,
        type: todayRoutine.dayName,
        location: todayRoutine.location,
        targetBodyParts: todayRoutine.targetBodyParts,
        focusBadges: todayRoutine.focusBadges,
        description: todayRoutine.description,
        isRecovery: Boolean(todayRoutine.isRecovery),
        recoveryNotice: todayRoutine.recoveryNotice,
        equipmentSummary: todayRoutine.equipmentSummary,
        shortSessionExerciseIds: todayRoutine.shortSessionExerciseIds,
        exercises: activeExerciseList,
        homeSubstitute: todayRoutine.homeSubstitute
          ? {
              ...todayRoutine.homeSubstitute,
              exercises: homeSubstituteList || [],
            }
          : null,
      },
      dailyCore: todayCoreRoutine
        ? {
            routine: todayCoreRoutine.exercises,
            routineType: todayCoreRoutine.type,
            routineTitle: todayCoreRoutine.title,
            routineDescription: todayCoreRoutine.description,
            morning: {
              completed: morningCoreCompleted,
              completedAt: morningCoreLog?.completedAt || null,
              xpEarned: morningCoreLog?.xpEarned || 0,
              exercisesJson: morningCoreLog?.exercisesJson || null,
            },
            night: {
              completed: nightCoreCompleted,
              completedAt: nightCoreLog?.completedAt || null,
              xpEarned: nightCoreLog?.xpEarned || 0,
              exercisesJson: nightCoreLog?.exercisesJson || null,
            },
          }
        : {
            routine: [],
            routineType: "REST" as any,
            routineTitle: "Core Rest / Active Recovery Day",
            routineDescription: "Hard core training is scheduled for 5 focused sessions per week (Sun, Mon, Wed, Fri, Sat) alternating Core A and Core B. No hard duplicate training today.",
            morning: {
              completed: morningCoreCompleted,
              completedAt: morningCoreLog?.completedAt || null,
              xpEarned: morningCoreLog?.xpEarned || 0,
              exercisesJson: morningCoreLog?.exercisesJson || null,
            },
            night: {
              completed: nightCoreCompleted,
              completedAt: nightCoreLog?.completedAt || null,
              xpEarned: nightCoreLog?.xpEarned || 0,
              exercisesJson: nightCoreLog?.exercisesJson || null,
            },
          },
      weeklySchedule: Object.values(WEEKLY_WORKOUT_SCHEDULE).map((d) => ({
        dayOfWeek: d.dayOfWeek,
        dayName: d.dayName,
        location: d.location,
        targetBodyParts: d.targetBodyParts,
        focusBadges: d.focusBadges,
        isRecovery: Boolean(d.isRecovery),
        recoveryNotice: d.recoveryNotice,
        exercisesCount: d.exercises.length,
        exercises: d.exercises.map((e) => ({
          name: e.name,
          targetSets: e.targetSets,
          targetReps: e.targetReps,
          equipment: e.equipment,
          isOptional: e.isOptional,
        })),
        coreRoutine: getCoreRoutineForDayOfWeek(d.dayOfWeek)?.type || "REST",
      })),
      nextWorkout: {
        dateFormatted: nextUnlockFormatted,
        unlockTimestamp: windowInfo.nextUnlockUtc.getTime(),
        dayOfWeek: nextRoutine.dayOfWeek,
        type: nextRoutine.dayName,
        location: nextRoutine.location,
        targetBodyParts: nextRoutine.targetBodyParts,
        focusBadges: nextRoutine.focusBadges,
        description: nextRoutine.description,
        isRecovery: Boolean(nextRoutine.isRecovery),
        recoveryNotice: nextRoutine.recoveryNotice,
        equipmentSummary: nextRoutine.equipmentSummary,
        phase,
        exercises: nextRoutine.exercises.map((e, idx) => ({
          id: e.id,
          name: e.name,
          order: idx + 1,
          targetMuscle: e.muscle,
          masterCue: e.cue,
          equipment: e.equipment,
          targetSets: isDeloadWeek(week) ? Math.max(2, Math.round(e.targetSets * 0.6)) : e.targetSets,
          targetReps: e.targetReps,
          targetDurationSeconds: e.targetDurationSeconds,
          startingWeightGuide: e.startingWeightGuide,
          safetyWarning: e.safetyWarning,
          isTimed: e.isTimed,
        })),
      },
      weekNumber: week,
      phase,
      isNewPhase: week > 1 && phase.weeks[0] === week,
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
  } catch (error: any) {
    console.error('Safe server-side catch in /api/workout/today:', error);
    return NextResponse.json(
      { error: 'Workout data could not be loaded.' },
      { status: 500 }
    );
  }
}