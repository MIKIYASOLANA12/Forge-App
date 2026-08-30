/**
 * FORGE — MASTER COMMAND CENTER & HOLIDAY WORKOUT TEST SUITE
 * Comprehensive verification of:
 * 1. 16-Day Grandmother-House Home Workout protocols & automatic switching
 * 2. 7-Month Body Transformation challenge (Ends March 10, 2027)
 * 3. Grade 12 Entrance Exam countdown
 * 4. Smart Schedule & "What Should I Do Now?" dynamic states
 * 5. Fixed 11:00 AM daily wake-up target
 */
if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile('.env.local'); } catch {}
}
import { getHolidayWorkoutStatus, HOLIDAY_ROUTINES } from '../lib/holidayWorkout';
import { getDashboardCountdowns, calculateDaysRemaining } from '../lib/countdowns';
import { getPersonalizedGreeting, getSmartScheduleStatus } from '../lib/smartSchedule';
import { prisma } from '../lib/prisma';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✔ ${message}`);
}

async function main() {
  console.log('==================================================');
  console.log('🧪 FORGE: MASTER COMMAND CENTER & WORKOUT TEST');
  console.log('==================================================\n');

  // ── [1] 16-DAY GRANDMOTHER-HOUSE HOLIDAY WORKOUT PROTOCOLS ──
  console.log('[1] Testing 16-Day Grandmother-House Home Workout Protocols:');
  assert(Object.keys(HOLIDAY_ROUTINES).length === 16, 'All 16 day routines defined');
  assert(HOLIDAY_ROUTINES[1].title.includes('Day 1 — Chest + Abs'), 'Day 1 is Chest + Abs');
  assert(HOLIDAY_ROUTINES[2].title.includes('Day 2 — Core + Obliques'), 'Day 2 is Core + Obliques');
  assert(HOLIDAY_ROUTINES[3].title.includes('Day 3 — Chest'), 'Day 3 is Chest');
  assert(HOLIDAY_ROUTINES[4].title.includes('Day 4 — Abs + Lower Abs'), 'Day 4 is Abs + Lower Abs');
  assert(HOLIDAY_ROUTINES[8].isRest === true, 'Day 8 is Rest / Recovery');
  assert(HOLIDAY_ROUTINES[15].title.includes('Day 15 — Final Hard Chest'), 'Day 15 is Final Hard Chest + Abs');
  assert(HOLIDAY_ROUTINES[16].title.includes('Day 16 — Final Full Core'), 'Day 16 is Final Full Core + Chest');

  // Test Pre-Holiday date (August 30, 2026)
  const preDate = new Date(Date.UTC(2026, 7, 30, 9, 0, 0)); // Aug 30, 2026 12:00 Addis
  const preStatus = getHolidayWorkoutStatus(preDate);
  assert(preStatus.isBeforeHoliday === true, 'Pre-holiday status detected on Aug 30');
  assert(preStatus.daysUntilStart === 1, 'Calculates 1 day until start on Aug 30');
  assert(preStatus.isHolidayPeriod === false, 'Holiday is not active on Aug 30');

  // Test Day 1 (August 31, 2026)
  const day1Date = new Date(Date.UTC(2026, 7, 31, 9, 0, 0)); // Aug 31, 2026 12:00 Addis
  const day1Status = getHolidayWorkoutStatus(day1Date);
  assert(day1Status.isHolidayPeriod === true, 'Holiday becomes active on Aug 31');
  assert(day1Status.currentDayNumber === 1, 'Current day is Day 1 on Aug 31');
  assert(day1Status.remainingDays === 16, '16 days remaining on Day 1');
  assert(day1Status.todayRoutine?.dayNumber === 1, 'Day 1 routine is returned');

  // Test Day 16 (September 15, 2026)
  const day16Date = new Date(Date.UTC(2026, 8, 15, 9, 0, 0)); // Sep 15, 2026 12:00 Addis
  const day16Status = getHolidayWorkoutStatus(day16Date);
  assert(day16Status.isHolidayPeriod === true, 'Holiday is active on final Day 16 (Sep 15)');
  assert(day16Status.currentDayNumber === 16, 'Current day is Day 16 on Sep 15');
  assert(day16Status.remainingDays === 1, '1 day remaining on final Day 16');

  // Test Post-Holiday (September 16, 2026)
  const postDate = new Date(Date.UTC(2026, 8, 16, 9, 0, 0)); // Sep 16, 2026
  const postStatus = getHolidayWorkoutStatus(postDate);
  assert(postStatus.isHolidayPeriod === false, 'Holiday period is completed on Sep 16');
  assert(postStatus.isAfterHoliday === true, 'isAfterHoliday is true on Sep 16');

  // ── [2] 7-MONTH BODY TRANSFORMATION COUNTDOWN (Ends March 10, 2027) ──
  console.log('\n[2] Testing 7-Month Body Transformation Challenge:');
  const countdowns = await getDashboardCountdowns(day1Date);
  const btCard = countdowns.find((c) => c.id === 'body_transformation');
  assert(btCard !== undefined, 'Body Transformation card exists');
  assert(btCard?.targetDateFormatted === 'March 10, 2027', 'Exact end date is March 10, 2027');
  assert(btCard?.daysRemaining === 191, 'Aug 31 to March 10 is exactly 191 days');

  // Test challenge completion after March 10, 2027
  const postChallengeDate = new Date(Date.UTC(2027, 2, 11, 9, 0, 0)); // March 11, 2027
  const postChallengeCountdowns = await getDashboardCountdowns(postChallengeDate);
  const postBtCard = postChallengeCountdowns.find((c) => c.id === 'body_transformation');
  assert(postBtCard?.isCompleted === true, 'Challenge marked completed after March 10, 2027');
  assert(postBtCard?.daysRemaining === 0, 'Zero days remaining when passed (no negative numbers)');
  assert(Boolean(postBtCard?.statusText.includes('Completed')), 'Shows completed status text gracefully');

  // ── [3] GRADE 12 ENTRANCE EXAM COUNTDOWN ──
  console.log('\n[3] Testing Grade 12 Entrance Exam Countdown:');
  const examCard = countdowns.find((c) => c.id === 'entrance_exam');
  assert(examCard !== undefined, 'Entrance Exam card exists');
  assert(Boolean(examCard && examCard.daysRemaining > 0), 'Entrance exam days remaining is positive');

  // ── [4] DYNAMIC GREETINGS & FIXED 11:00 AM WAKE-UP SCHEDULE ──
  console.log('\n[4] Testing Dynamic Time-Based Greetings & Schedule:');
  const morningDate = new Date(Date.UTC(2026, 7, 31, 5, 0, 0)); // 08:00 AM Addis
  const afternoonDate = new Date(Date.UTC(2026, 7, 31, 11, 0, 0)); // 02:00 PM Addis
  const eveningDate = new Date(Date.UTC(2026, 7, 31, 16, 0, 0)); // 07:00 PM Addis
  const lateNightDate = new Date(Date.UTC(2026, 7, 31, 20, 0, 0)); // 11:00 PM Addis

  assert(getPersonalizedGreeting(morningDate).greeting.includes('Good morning'), 'Morning greeting at 08:00 AM');
  assert(getPersonalizedGreeting(afternoonDate).greeting.includes('Good afternoon'), 'Afternoon greeting at 02:00 PM');
  assert(getPersonalizedGreeting(eveningDate).greeting.includes('Good evening'), 'Evening greeting at 07:00 PM');
  assert(getPersonalizedGreeting(lateNightDate).greeting.includes('Night owl'), 'Night owl greeting at 11:00 PM');

  // Test Smart Schedule states
  const wakeSchedule = await getSmartScheduleStatus(new Date(Date.UTC(2026, 7, 31, 8, 15, 0))); // 11:15 AM Addis
  assert(wakeSchedule.targetWakeTime === '11:00 AM', 'Target wake-up time is fixed at 11:00 AM');
  assert(wakeSchedule.currentActivityCategory === 'WAKE', 'Wake-up block active at 11:15 AM');

  const studySchedule = await getSmartScheduleStatus(new Date(Date.UTC(2026, 7, 31, 10, 0, 0))); // 01:00 PM Addis
  assert(studySchedule.currentActivityCategory === 'STUDY', 'Study block active at 01:00 PM');

  const codeSchedule = await getSmartScheduleStatus(new Date(Date.UTC(2026, 7, 31, 12, 0, 0))); // 03:00 PM Addis
  assert(codeSchedule.currentActivityCategory === 'CODING', 'Coding block active at 03:00 PM');

  const workoutSchedule = await getSmartScheduleStatus(new Date(Date.UTC(2026, 7, 31, 14, 0, 0))); // 05:00 PM Addis
  assert(workoutSchedule.currentActivityCategory === 'WORKOUT', 'Workout block active at 05:00 PM');

  console.log('\n==================================================');
  console.log('✅ ALL MASTER COMMAND CENTER TESTS PASSED');
  console.log('==================================================');
}

main().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
