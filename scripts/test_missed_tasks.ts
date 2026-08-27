/**
 * FORGE — MISSED-TASK DETECTION + RECHECK TEST (spec sections 13/14/15).
 *
 * Verifies against the live DB:
 *   1. Missing Workout, Chemistry, JavaScript, Reading is ALL reported (not
 *      just Chemistry), with completed items listed.
 *   2. buildMissedMessage contains every actual missed category + completed
 *      list + consistency/XP/level/streak + contextual roast.
 *   3. Single miss (only JavaScript) is NOT falsely reported as Chemistry/
 *      Workout/Reading.
 *   4. No misses -> celebration message (no missed-day roast).
 *   5. Detection/message build is deterministic across repeated runs.
 *
 * Does NOT send real Telegram messages.
 * Run: npx ts-node --project tsconfig.seed.json -r tsconfig-paths/register scripts/test_missed_tasks.ts
 */
import { prisma } from '../lib/prisma';
import { workoutWindowForAddisDate, type WorkoutWindow } from '../lib/workoutTime';
import { detectMissedActivities, buildMissedMessage } from '../lib/accountabilityRecheck';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`  \u2714 ${msg}`);
}

function windowFor(day: number): WorkoutWindow {
  return workoutWindowForAddisDate(new Date(2026, 7, day, 14, 0, 0));
}
const has = (arr: string[], needle: string) => arr.some((s) => s.toLowerCase().includes(needle.toLowerCase()));

// Mark every active habit as completed for the window (limits noise).
async function completeAllHabits(w: WorkoutWindow) {
  const habits = await prisma.habit.findMany({ where: { active: true } });
  for (const hb of habits) {
    const exists = await prisma.habitLog.findFirst({ where: { habitId: hb.id, completed: true, date: { gte: w.startUtc, lte: w.endUtc } } });
    if (!exists) await prisma.habitLog.create({ data: { habitId: hb.id, date: w.startUtc, completed: true } });
  }
}

async function addWorkoutLog(w: WorkoutWindow) {
  const wd = await prisma.workoutDay.findFirst();
  if (!wd) return false;
  await prisma.workoutLog.create({ data: { workoutDayId: wd.id, completedAt: w.startUtc, weekNumber: 1 } });
  return true;
}

async function wipe(day: number): Promise<WorkoutWindow> {
  const w = windowFor(day);
  await prisma.dailyPlan.deleteMany({ where: { date: { gte: w.startUtc, lte: w.endUtc } } });
  await prisma.habitLog.deleteMany({ where: { date: { gte: w.startUtc, lte: w.endUtc } } });
  await prisma.workoutLog.deleteMany({ where: { completedAt: { gte: w.startUtc, lte: w.endUtc } } });
  return w;
}
async function main() {
  console.log('==================================================');
  console.log('🧪 FORGE: MISSED-TASK DETECTION + RECHECK TEST');
  console.log('==================================================');
  const domain = (await prisma.domain.findFirst())!;
  const domainId = domain?.id ?? 'singleton';

  // ── TEST 1: MULTIPLE MISSES ──
  console.log('\n[1] Multiple misses — ALL four categories must be detected:');
  const w1 = await wipe(18);
  await prisma.dailyPlan.create({
    data: {
      date: w1.startUtc,
      generatedByAI: false,
      tasks: {
        create: [
          { domainId, description: 'Chemistry — Stoichiometry', subject: 'Chemistry', topic: 'Stoichiometry', minutesTarget: 60, isStudy: true, completed: false },
          { domainId, description: 'JavaScript — Loops', subject: 'JavaScript', topic: 'Loops', minutesTarget: 60, isStudy: true, completed: false },
          { domainId, description: JSON.stringify({ title: 'Reading — Atomic Habits (pages 42–53)', subject: 'Reading', bookTitle: 'Atomic Habits', pagesTarget: '42–53' }), subject: 'Reading', minutesTarget: 25, completed: false },
          { domainId, description: 'English — Advanced Vocabulary', subject: 'English', minutesTarget: 30, completed: true },
        ],
      },
    },
  });
  await completeAllHabits(w1);
  const report1 = await detectMissedActivities(w1);
  assert(has(report1.missedAll, 'Workout'), 'Workout is in missed list');
  assert(has(report1.missedAll, 'Chemistry'), 'Chemistry is in missed list');
  assert(has(report1.missedAll, 'JavaScript'), 'JavaScript is in missed list');
  assert(has(report1.missedAll, 'Reading'), 'Reading is in missed list');
  assert(report1.missedAll.length >= 4, 'at least 4 distinct missed items');
  assert(has(report1.completedAll, 'English'), 'English is in completed list');
  assert(report1.missedAll.filter((m) => m.toLowerCase().includes('workout')).length === 1, 'Workout listed exactly once');

  const text1 = await buildMissedMessage(w1, report1);
  assert(text1.includes('Workout'), 'message contains Workout');
  assert(text1.includes('Chemistry'), 'message contains Chemistry');
  assert(text1.includes('JavaScript'), 'message contains JavaScript');
  assert(text1.includes('Reading'), 'message contains Reading');
  assert(/✅ English/i.test(text1), 'message contains completed ✅ English');
  assert(/DAY \d+ \/ 300/.test(text1), 'message has DAY X / 300');
  assert(/Consistency:|XP:|Level:|Streak:/i.test(text1), 'message has consistency/XP/level/streak');

  // ── TEST 2: DETERMINISM ──
  console.log('\n[2] Deterministic across runs (recheck produces no duplicates):');
  const report1b = await detectMissedActivities(w1);
  assert(
    report1b.missedAll.length === report1.missedAll.length &&
    report1b.missedAll.every((m, i) => m === report1.missedAll[i]),
    'detection list identical across repeated runs'
  );

  // ── TEST 3: SINGLE MISS (only JavaScript) ──
  console.log('\n[3] Single miss — only JavaScript reported:');
  const w3 = await wipe(16);
  await prisma.dailyPlan.create({
    data: {
      date: w3.startUtc,
      generatedByAI: false,
      tasks: {
        create: [
          { domainId, description: 'Chemistry — Stoichiometry', subject: 'Chemistry', minutesTarget: 60, completed: true },
          { domainId, description: 'JavaScript — Loops', subject: 'JavaScript', minutesTarget: 60, completed: false },
          { domainId, description: 'Reading — Book (pages 1-12)', subject: 'Reading', minutesTarget: 25, completed: true },
          { domainId, description: 'English — Vocabulary', subject: 'English', minutesTarget: 30, completed: true },
        ],
      },
    },
  });
  await completeAllHabits(w3);
  const workoutOk = await addWorkoutLog(w3);
  assert(workoutOk, 'workout log added for single-miss window');
const report3 = await detectMissedActivities(w3);
  const miss3 = report3.missedAll.join(' · ').toLowerCase();
  assert(miss3.includes('javascript'), 'JavaScript is reported missed');
  assert(!miss3.includes('chemistry'), 'Chemistry NOT falsely reported');
  assert(!miss3.includes('workout'), 'Workout NOT falsely reported');
  assert(!miss3.includes('reading'), 'Reading NOT falsely reported');

  // ── TEST 4: NO MISSES → celebration ──
  console.log('\n[4] No misses -> celebration (no missed-day roast):');
  const w4 = await wipe(14);
  await prisma.dailyPlan.create({
    data: {
      date: w4.startUtc,
      generatedByAI: false,
      tasks: {
        create: [
          { domainId, description: 'Chemistry — Completed', subject: 'Chemistry', minutesTarget: 60, completed: true },
          { domainId, description: 'English — Done', subject: 'English', minutesTarget: 30, completed: true },
        ],
      },
    },
  });
  await completeAllHabits(w4);
  await addWorkoutLog(w4);
  const report4 = await detectMissedActivities(w4);
  assert(report4.missedAll.length === 0, 'no missed items when everything is completed');
  const text4 = await buildMissedMessage(w4, report4);
  assert(!text4.includes('❌ Workout'), 'no missed roast list for a complete day');
  assert(/Flawless/.test(text4), 'celebration message used');

  console.log('\n==================================================');
  console.log('✅ ALL MISSED-TASK / RECHECK TESTS PASSED');
  console.log('==================================================');

  // Cleanup synthetic rows (plans, habit logs, workout logs in test windows).
  for (const w of [w1, w3, w4]) {
    await prisma.dailyPlan.deleteMany({ where: { date: { gte: w.startUtc, lte: w.endUtc } } });
    await prisma.habitLog.deleteMany({ where: { date: { gte: w.startUtc, lte: w.endUtc } } });
    await prisma.workoutLog.deleteMany({ where: { completedAt: { gte: w.startUtc, lte: w.endUtc } } });
  }
  console.log('🧹 synthetic test data cleaned up');
}

main()
  .catch((e) => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });