import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth';
import { getSmartScheduleStatus } from '@/lib/smartSchedule';
import { getDashboardCountdowns } from '@/lib/countdowns';
import { getHolidayWorkoutStatus } from '@/lib/holidayWorkout';
import { getGoalYearStatus } from '@/lib/ethiopianCalendar';
import { getAddisNow } from '@/lib/workoutTime';
import { sendSmartCoachScheduleReminder } from '@/lib/telegramScheduler';

export const dynamic = 'force-dynamic';

// GET /api/schedule/now
// Returns the dynamic command center status for Mikiyas:
// - Greeting based on time of day
// - "What should I do right now?" schedule status
// - Fixed Ethiopian Goal Year (2019 E.C.) + Exam Countdown (June 21, 2027 / Sene 14, 2019 E.C.)
// - 3 Important Countdowns (Entrance Exam, 7-Month Transformation, 16-Day Holiday Workout)
// - 16-Day Grandmother-House Home Workout state
export async function GET(req: NextRequest) {
  const session = await getSessionUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const addisNow = getAddisNow();
    const [smartSchedule, countdowns, holidayStatus, goalYear] = await Promise.all([
      getSmartScheduleStatus(addisNow).catch((err) => {
        console.error('getSmartScheduleStatus error:', err);
        return null;
      }),
      getDashboardCountdowns(addisNow).catch((err) => {
        console.error('getDashboardCountdowns error:', err);
        return [];
      }),
      Promise.resolve(getHolidayWorkoutStatus(addisNow)),
      Promise.resolve(getGoalYearStatus(addisNow)),
    ]);

    // Asynchronously evaluate persistent schedule/sleep coach checks
    void sendSmartCoachScheduleReminder(addisNow).catch(() => {});

    return NextResponse.json({
      success: true,
      schedule: smartSchedule,
      countdowns,
      holiday: holidayStatus,
      goalYear,
    });
  } catch (error: any) {
    console.error('Failed to resolve smart schedule status:', error);
    return NextResponse.json({ error: 'Failed to load schedule status' }, { status: 500 });
  }
}
