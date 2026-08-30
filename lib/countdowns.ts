/**
 * FORGE — COUNTDOWNS & CHALLENGE ENGINE (Africa/Addis_Ababa Timezone Aware)
 * 1. Grade 12 Entrance Exam Countdown
 * 2. 7-Month Body Transformation Challenge (August 31, 2026 -> March 10, 2027)
 * 3. 16-Day Grandmother-House Home Workout Countdown
 */
import { getAddisNow, toAddisDateString } from './workoutTime';
import { getHolidayWorkoutStatus } from './holidayWorkout';
import { prisma } from './prisma';

export interface CountdownCard {
  id: 'entrance_exam' | 'body_transformation' | 'holiday_workout';
  title: string;
  badge: string;
  badgeColor: string;
  daysRemaining: number;
  totalDays?: number;
  progressPercent: number;
  targetDateFormatted: string;
  statusText: string;
  subText: string;
  isCompleted: boolean;
  isVisible: boolean;
  icon: string;
}

export const BODY_TRANSFORMATION_START_KEY = '2026-08-31';
export const BODY_TRANSFORMATION_END_KEY = '2027-03-10'; // Wednesday, March 10, 2027

/**
 * Calculates remaining days between current Addis date and a target date.
 */
export function calculateDaysRemaining(targetDate: Date, customNow?: Date): { days: number; isPassed: boolean } {
  const now = customNow || getAddisNow();
  const curDateKey = toAddisDateString(now);
  const targetDateKey = toAddisDateString(targetDate);

  const [tY, tM, tD] = targetDateKey.split('-').map(Number);
  const [cY, cM, cD] = curDateKey.split('-').map(Number);

  const tUtc = Date.UTC(tY, tM - 1, tD);
  const cUtc = Date.UTC(cY, cM - 1, cD);

  const diffDays = Math.round((tUtc - cUtc) / (1000 * 60 * 60 * 24));

  return {
    days: Math.max(0, diffDays),
    isPassed: diffDays <= 0,
  };
}

/**
 * Fetch and construct all 3 distinct countdown cards.
 */
export async function getDashboardCountdowns(customNow?: Date): Promise<CountdownCard[]> {
  const now = customNow || getAddisNow();
  const dateKey = toAddisDateString(now);

  // 1. Fetch User Settings for Exam Date
  const profile = await prisma.userProfile.findUnique({
    where: { id: 'singleton' },
  });

  const defaultExamDate = new Date('2027-06-15T00:00:00Z');
  const examDate = profile?.examDate || defaultExamDate;

  // ── A. ENTRANCE EXAM COUNTDOWN ───────────────────────────────────────────────
  const examDiff = calculateDaysRemaining(examDate, now);
  const examDateFormatted = examDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const entranceExamCard: CountdownCard = {
    id: 'entrance_exam',
    title: 'Grade 12 Entrance Exam',
    badge: examDiff.isPassed ? 'COMPLETED' : 'NATIONAL EXAM',
    badgeColor: 'blue',
    daysRemaining: examDiff.days,
    progressPercent: Math.min(100, Math.max(0, Math.round(((300 - examDiff.days) / 300) * 100))),
    targetDateFormatted: examDateFormatted,
    statusText: examDiff.isPassed ? 'Exam Period Reached' : `${examDiff.days} days left`,
    subText: examDiff.isPassed ? 'Exam passed or completed' : `Target Exam Date: ${examDateFormatted}`,
    isCompleted: examDiff.isPassed,
    isVisible: true,
    icon: 'GraduationCap',
  };

  // ── B. 7-MONTH BODY TRANSFORMATION CHALLENGE (Aug 31, 2026 -> Mar 10, 2027) ──
  const [btStartY, btStartM, btStartD] = BODY_TRANSFORMATION_START_KEY.split('-').map(Number);
  const [btEndY, btEndM, btEndD] = BODY_TRANSFORMATION_END_KEY.split('-').map(Number);
  const [curY, curM, curD] = dateKey.split('-').map(Number);

  const btStartDate = new Date(Date.UTC(btStartY, btStartM - 1, btStartD));
  const btEndDate = new Date(Date.UTC(btEndY, btEndM - 1, btEndD));
  const curDate = new Date(Date.UTC(curY, curM - 1, curD));

  const totalChallengeDays = Math.round((btEndDate.getTime() - btStartDate.getTime()) / (1000 * 60 * 60 * 24)); // 191 days
  const daysFromStart = Math.round((curDate.getTime() - btStartDate.getTime()) / (1000 * 60 * 60 * 24));
  const btRemainingDays = Math.max(0, Math.round((btEndDate.getTime() - curDate.getTime()) / (1000 * 60 * 60 * 24)));
  const btPassed = curDate.getTime() >= btEndDate.getTime();

  // Count verified completed workouts in database
  const completedWorkoutsCount = await prisma.workoutLog.count({
    where: {
      submittedAt: { not: null },
      completedAt: { gte: btStartDate },
    },
  });

  const btProgressPercent = Math.min(100, Math.max(0, Math.round((daysFromStart / totalChallengeDays) * 100)));

  const bodyTransformationCard: CountdownCard = {
    id: 'body_transformation',
    title: '7-Month Body Transformation',
    badge: btPassed ? 'COMPLETED' : '7-MONTH CHALLENGE',
    badgeColor: 'amber',
    daysRemaining: btRemainingDays,
    totalDays: totalChallengeDays,
    progressPercent: btPassed ? 100 : btProgressPercent,
    targetDateFormatted: 'March 10, 2027',
    statusText: btPassed ? 'Challenge Completed 🎉' : `${btRemainingDays} days remaining`,
    subText: btPassed
      ? `Completed on March 10, 2027 · ${completedWorkoutsCount} workouts logged`
      : `Ends Wednesday, March 10, 2027 · ${completedWorkoutsCount} workouts logged`,
    isCompleted: btPassed,
    isVisible: true,
    icon: 'Flame',
  };

  // ── C. 16-DAY GRANDMOTHER-HOUSE HOLIDAY HOME WORKOUT ─────────────────────────
  const holidayStatus = getHolidayWorkoutStatus(now);

  const holidayCard: CountdownCard = {
    id: 'holiday_workout',
    title: '16-Day Grandmother-House Workout',
    badge: holidayStatus.isHolidayPeriod
      ? `DAY ${holidayStatus.currentDayNumber} OF 16`
      : holidayStatus.isBeforeHoliday
      ? 'STARTS SOON'
      : 'COMPLETED',
    badgeColor: holidayStatus.isHolidayPeriod ? 'rose' : 'purple',
    daysRemaining: holidayStatus.isBeforeHoliday ? holidayStatus.daysUntilStart : holidayStatus.remainingDays,
    totalDays: 16,
    progressPercent: holidayStatus.isHolidayPeriod
      ? Math.round(((holidayStatus.currentDayNumber - 1) / 16) * 100)
      : holidayStatus.isAfterHoliday
      ? 100
      : 0,
    targetDateFormatted: holidayStatus.endDateFormatted,
    statusText: holidayStatus.isHolidayPeriod
      ? `Day ${holidayStatus.currentDayNumber} of 16 (${holidayStatus.remainingDays} days remaining)`
      : holidayStatus.isBeforeHoliday
      ? `Starts in ${holidayStatus.daysUntilStart} day${holidayStatus.daysUntilStart === 1 ? '' : 's'}`
      : 'Holiday Protocol Completed',
    subText: holidayStatus.isHolidayPeriod
      ? `Active: ${holidayStatus.todayRoutine?.title || 'Home Session'}`
      : holidayStatus.isBeforeHoliday
      ? 'Starts August 31, 2026 · Temporary Bodyweight Program'
      : 'Completed · Normal Gym Program Active',
    isCompleted: holidayStatus.isAfterHoliday,
    // Only visible before and during the 16 days. Auto-hidden after completion!
    isVisible: !holidayStatus.isAfterHoliday,
    icon: 'Home',
  };

  return [entranceExamCard, bodyTransformationCard, holidayCard].filter((c) => c.isVisible);
}
