import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth';
import { getSmartScheduleStatus } from '@/lib/smartSchedule';
import { getDashboardCountdowns } from '@/lib/countdowns';
import { getHolidayWorkoutStatus } from '@/lib/holidayWorkout';
import { getAddisNow } from '@/lib/workoutTime';

export const dynamic = 'force-dynamic';

// GET /api/schedule/now
// Returns the dynamic command center status for Mikiyas:
// - Greeting based on time of day
// - "What should I do right now?" schedule status
// - 3 Important Countdowns (Entrance Exam, 7-Month Transformation, 16-Day Holiday Workout)
// - 16-Day Grandmother-House Home Workout state
export async function GET(req: NextRequest) {
  const session = await getSessionUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const addisNow = getAddisNow();
    const [smartSchedule, countdowns, holidayStatus] = await Promise.all([
      getSmartScheduleStatus(addisNow),
      getDashboardCountdowns(addisNow),
      Promise.resolve(getHolidayWorkoutStatus(addisNow)),
    ]);

    return NextResponse.json({
      success: true,
      schedule: smartSchedule,
      countdowns,
      holiday: holidayStatus,
    });
  } catch (error: any) {
    console.error('Failed to resolve smart schedule status:', error);
    return NextResponse.json({ error: 'Failed to load schedule status' }, { status: 500 });
  }
}
