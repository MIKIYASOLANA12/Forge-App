import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getAddisNow,
  workoutWindowForAddisDate,
  getDayOfJourney300,
  JOURNEY_START_YEAR,
  JOURNEY_START_MONTH,
  JOURNEY_START_DAY,
  WORKOUT_DAY_START_HOUR,
  TOTAL_JOURNEY_DAYS,
  toUtcFromAddis,
} from '@/lib/workoutTime';
import { getProgressHistory, getDailyBreakdown } from '@/lib/progressEngine';

export async function GET(req: NextRequest) {
  try {
    const addisNow = getAddisNow();
    const day300Info = getDayOfJourney300(addisNow);

    // Fetch all recorded ProgressDaily entries from DB
    const dailyRecords = await prisma.progressDaily.findMany({
      orderBy: { date: 'asc' },
    });

    const dailyByDateStr = new Map(
      dailyRecords.map((r) => [r.date.toISOString().split('T')[0], r])
    );

    // Build the 300-day journey calendar array
    const journeyDays = [];
    const anchorDate = new Date(
      JOURNEY_START_YEAR,
      JOURNEY_START_MONTH,
      JOURNEY_START_DAY,
      WORKOUT_DAY_START_HOUR,
      0,
      0,
      0
    );

    for (let dayIdx = 1; dayIdx <= TOTAL_JOURNEY_DAYS; dayIdx++) {
      const dayDateAddis = new Date(anchorDate);
      dayDateAddis.setDate(dayDateAddis.getDate() + (dayIdx - 1));

      const { startUtc } = workoutWindowForAddisDate(dayDateAddis);
      const dateKey = startUtc.toISOString().split('T')[0];
      const isPastOrToday = dayIdx <= day300Info.dayNumber;
      const isToday = dayIdx === day300Info.dayNumber;

      const record = dailyByDateStr.get(dateKey);

      let color = 'GRAY';
      let score = 0;
      let workoutDone = false;
      let tasksCompleted = 0;
      let tasksTotal = 0;

      if (record) {
        score = record.consistencyScore;
        color = record.color;
        workoutDone = record.workoutDone;
        tasksCompleted = record.tasksCompleted;
        tasksTotal = record.tasksTotal;
      } else if (isPastOrToday && !isToday) {
        color = 'RED'; // Missed past day with no logs
      }

      journeyDays.push({
        dayNumber: dayIdx,
        dateFormatted: dayDateAddis.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        isToday,
        isFuture: !isPastOrToday,
        color,
        consistencyScore: score,
        workoutDone,
        tasksCompleted,
        tasksTotal,
      });
    }

    // Fetch multi-metric time series for large live graph
    const chartHistory = await getProgressHistory(300);

    return NextResponse.json({
      day300: day300Info,
      calendar: journeyDays,
      chartHistory,
    });
  } catch (error: any) {
    console.error('300-day progress error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch 300-day progress' }, { status: 500 });
  }
}
