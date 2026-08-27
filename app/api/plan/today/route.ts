import { NextResponse } from 'next/server';
import { getAddisNow, workoutWindowForAddisDate, getDayOfJourney300 } from '@/lib/workoutTime';
import { ensureTodayDailyPlan } from '@/lib/dailyPlanGenerator';
import { prisma } from '@/lib/prisma';
import { get2027DeadlineMetrics } from '@/lib/readingEngine';
import { getAccountabilityStatus, detectMissedActivities } from '@/lib/accountabilityRecheck';

export async function GET() {
  try {
    const addisNow = getAddisNow();
    const windowInfo = workoutWindowForAddisDate(addisNow);
    const day300 = getDayOfJourney300(addisNow);
    const deadline2027 = get2027DeadlineMetrics(addisNow);

    const todayPlan = await ensureTodayDailyPlan();
    const accountability = await getAccountabilityStatus();

    const dateFormatted = windowInfo.startAddis.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const openTimeFormatted = '05:00 AM';
    const closeTimeFormatted = '09:28 PM';

    // Fetch yesterday's history for the Missed History section
    const yesterdayAddis = new Date(windowInfo.startAddis);
    yesterdayAddis.setDate(yesterdayAddis.getDate() - 1);
    const yesterdayWindow = workoutWindowForAddisDate(yesterdayAddis);

    const [yesterdayPlan, yesterdayWorkoutLog] = await Promise.all([
      prisma.dailyPlan.findFirst({
        where: { date: { gte: yesterdayWindow.startUtc, lte: yesterdayWindow.endUtc } },
        include: { tasks: true },
      }),
      prisma.workoutLog.findFirst({
        where: { completedAt: { gte: yesterdayWindow.startUtc, lte: yesterdayWindow.closeUtc } },
        include: { workoutDay: true },
      }),
    ]);

    const yesterdayDateFormatted = yesterdayWindow.startAddis.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });

    const yesterdayTasks = (yesterdayPlan?.tasks || []).map((t) => {
      let title = t.description;
      try {
        const parsed = JSON.parse(t.description);
        title = parsed.title || t.description;
      } catch {}

      return {
        id: t.id,
        description: title,
        completed: t.completed,
        status: t.completed ? 'COMPLETED' : 'MISSED',
        minutesTarget: t.minutesTarget,
      };
    });

    const yesterdayWorkoutStatus = yesterdayWorkoutLog
      ? { status: 'COMPLETED', type: yesterdayWorkoutLog.workoutDay.type }
      : { status: 'MISSED', type: 'Workout Session' };

    // Full missed/completed report for yesterday (workout + every scheduled
    // task + habits) so /todo and /workout show ALL actually-missed items.
    const yesterdayReport = await detectMissedActivities(yesterdayWindow);

    return NextResponse.json({
      planId: todayPlan.planId,
      dateFormatted,
      day300,
      deadline2027,
      openTimeFormatted,
      closeTimeFormatted,
      closeTimestamp: windowInfo.closeUtc.getTime(),
      nextUnlockTimestamp: windowInfo.nextUnlockUtc.getTime(),
      isOpen: windowInfo.isOpen,
      isClosed: windowInfo.isClosed,
      tasks: todayPlan.tasks,
      studyProgress: todayPlan.studyProgress,
      readingStatus: todayPlan.readingStatus,
      demoSubjects: todayPlan.demoSubjects,
      accountability,
      yesterday: {
        dateFormatted: yesterdayDateFormatted,
        workout: yesterdayWorkoutStatus,
        tasks: yesterdayTasks,
        completedCount: yesterdayTasks.filter((t) => t.completed).length + (yesterdayWorkoutLog ? 1 : 0),
        totalCount: yesterdayTasks.length + 1,
        habits: yesterdayReport.habits,
        missedItems: yesterdayReport.missedAll,
        completedItems: yesterdayReport.completedAll,
        workoutMissed: yesterdayReport.workoutMissed,
      },
    });
  } catch (error: any) {
    console.error('Plan today error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
