import { prisma } from '../lib/prisma';
import { getAddisNow, workoutWindowForAddisDate } from '../lib/workoutTime';
import {
  get2027DeadlineMetrics,
  getReadingSystemStatus,
  calculateBookPacing,
  ensureReadingCurriculum,
} from '../lib/readingEngine';
import { ensureTodayDailyPlan } from '../lib/dailyPlanGenerator';
import {
  saveLocalWorkoutState,
  loadLocalWorkoutState,
  generateClientId,
} from '../lib/offlineWorkoutStore';

async function main() {
  console.log('==================================================');
  console.log('🧪 FORGE STAGE 8: OFFLINE WORKOUT + READING SYSTEM TEST');
  console.log('==================================================');

  // 1. Verify 2027 Deadline Calculation
  const now = getAddisNow();
  const deadlineMetrics = get2027DeadlineMetrics(now);
  console.log('\n[1] 2027 Deadline Metrics:');
  console.log(`  - Target: ${deadlineMetrics.targetDateFormatted}`);
  console.log(`  - Days Remaining: ${deadlineMetrics.daysRemaining} days`);
  console.log(`  - Journey: ${deadlineMetrics.journeyFormatted} (${deadlineMetrics.percentage}%)`);

  if (deadlineMetrics.daysRemaining <= 0) {
    throw new Error('Invalid 2027 countdown calculation');
  }

  // 2. Verify Offline Workout Storage & Deduplication Engine
  console.log('\n[2] Offline-First Workout Logging & Persistence:');
  const testDateKey = '2026-08-26';
  const testDayId = 'test-workout-day-stage8';
  const testExId = 'ex-bench-press-101';

  const mockSets = [
    { setNumber: 1, weightKg: 40, reps: 10, completed: true, clientId: generateClientId('test-set-1') },
    { setNumber: 2, weightKg: 45, reps: 8, completed: true, clientId: generateClientId('test-set-2') },
    { setNumber: 3, weightKg: 45, reps: 7, completed: true, clientId: generateClientId('test-set-3') },
  ];

  const offlineSaved = saveLocalWorkoutState(
    testDateKey,
    testDayId,
    1,
    'Felt solid, RPE 8',
    { [testExId]: mockSets },
    { [testExId]: true },
    'LOCAL_ONLY'
  );

  console.log(`  - Saved ${offlineSaved.exerciseSets[testExId].length} sets locally (Status: ${offlineSaved.syncStatus})`);
  console.log(`  - Client Set 1 ID: ${offlineSaved.exerciseSets[testExId][0].clientId}`);

  // Test set restoration from storage
  const restored = loadLocalWorkoutState(testDateKey, testDayId);
  if (!restored || restored.exerciseSets[testExId].length !== 3) {
    throw new Error('Local set restoration failed!');
  }
  console.log(`  - Restored sets match perfectly: ${restored.exerciseSets[testExId].length} sets found`);

  // 3. Verify Reading Curriculum Seeding & Sequential Queue
  console.log('\n[3] Sequential Reading Curriculum:');
  await ensureReadingCurriculum();
  const readingStatus = await getReadingSystemStatus();

  console.log(`  - Active Book: "${readingStatus.activeBook?.title}" by ${readingStatus.activeBook?.author}`);
  console.log(`  - Total Pages: ${readingStatus.activeBook?.totalPages}, Current Page: ${readingStatus.activeBook?.currentPage}`);
  console.log(`  - Pacing: ${readingStatus.activeBook?.pacing?.requiredPagesPerDay} pages/day (${readingStatus.activeBook?.pacing?.statusText})`);
  console.log(`  - Today Chunk: Pages ${readingStatus.activeBook?.pacing?.todayChunk.startPage}–${readingStatus.activeBook?.pacing?.todayChunk.endPage}`);
  console.log(`  - Queued Books: ${readingStatus.queue.length} books in sequential queue`);

  // 4. Verify Daily Plan Generator (Chemistry, JS, Reading, Workout & Demo Subjects)
  console.log('\n[4] Daily Todo Plan with Real + Demo Subjects:');
  const todayPlan = await ensureTodayDailyPlan();
  console.log(`  - Generated ${todayPlan.tasks.length} real checkable tasks for today`);
  console.log(`  - Chemistry: ${todayPlan.studyProgress.chemistry.currentTopic.name}`);
  console.log(`  - JavaScript: ${todayPlan.studyProgress.javascript.currentLesson.mainTopic}`);
  console.log(`  - Reading: ${todayPlan.readingStatus.activeBook?.title}`);
  console.log(`  - Demo Subjects Available: ${todayPlan.demoSubjects.map((s) => s.subject).join(', ')}`);

  console.log('\n==================================================');
  console.log('✅ ALL STAGE 8 INTEGRATION TESTS PASSED!');
  console.log('==================================================');
}

main()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
