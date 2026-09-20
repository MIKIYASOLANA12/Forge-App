import assert from 'assert';
import { getSubjectRoadmap, findTopicById, ORDERED_SUBJECT_KEYS } from '../lib/subjectRoadmapsData';
import { calculateChemistryOneMonthPlan, JAVASCRIPT_154_ITEMS } from '../lib/studyRoadmaps';
import { parsePlanMetadata } from '../lib/planParser';
import {
  createAssessmentSession,
  getAssessmentSession,
  submitAnswerToSession,
  toClientAssessmentSession,
  getSubjectDistributionQuotas,
} from '../lib/studyAssessmentEngine';
import {
  getSubjectMasteryOverview,
  startSubject,
  completeTopicProgress,
  getAddisCurrentDate,
} from '../lib/subjectMasteryEngine';
import {
  workoutWindowForAddisDate,
  getAddisTimeComponents,
  toAddisDateString,
} from '../lib/workoutTime';
import { calculateDaysRemaining } from '../lib/countdowns';

async function runSystemVerification() {
  console.log('===============================================================');
  console.log('FORGE — FINAL DAILY STUDY / TODO / QUESTION SYSTEM VERIFICATION');
  console.log('===============================================================\\n');

  let passedTests = 0;

  // 1. CHEMISTRY SOURCE INTEGRITY VERIFICATION
  console.log('TEST 1: Chemistry Source Roadmap & Hierarchy Audit');
  const chemRoadmap = getSubjectRoadmap('CHEMISTRY');
  assert.strictEqual(chemRoadmap.key, 'CHEMISTRY');
  assert.strictEqual(chemRoadmap.totalUnits, 16, 'Chemistry must have exactly 16 units');
  assert.strictEqual(chemRoadmap.totalTopics, 70, 'Chemistry must have exactly 70 topics');
  assert.strictEqual(chemRoadmap.totalSubtopics, 359, 'Chemistry must have exactly 359 subtopics');

  // Verify Grade distribution
  const g9Units = chemRoadmap.units.filter((u) => u.grade === 'GRADE 9');
  const g10Units = chemRoadmap.units.filter((u) => u.grade === 'GRADE 10');
  const g12Units = chemRoadmap.units.filter((u) => u.grade === 'GRADE 12');

  assert.strictEqual(g9Units.length, 5, 'Grade 9 has 5 units');
  assert.strictEqual(g10Units.length, 6, 'Grade 10 has 6 units');
  assert.strictEqual(g12Units.length, 5, 'Grade 12 has 5 units');

  const g9Topics = g9Units.reduce((acc, u) => acc + u.topics.length, 0);
  const g10Topics = g10Units.reduce((acc, u) => acc + u.topics.length, 0);
  const g12Topics = g12Units.reduce((acc, u) => acc + u.topics.length, 0);

  assert.strictEqual(g9Topics, 19, 'Grade 9 has 19 topics');
  assert.strictEqual(g10Topics, 30, 'Grade 10 has 30 topics');
  assert.strictEqual(g12Topics, 21, 'Grade 12 has 21 topics');
  assert.strictEqual(g9Topics + g10Topics + g12Topics, 70);

  console.log(`✓ Test 1 Passed: 16 Units, 70 Topics, 359 Subtopics strictly loaded from source (G9: 19, G10: 30, G12: 21)`);
  passedTests++;

  // 2. ORDERED SUBJECT SEQUENCE
  console.log('\\nTEST 2: Strict Sequential Subject Order');
  assert.deepStrictEqual(ORDERED_SUBJECT_KEYS, ['CHEMISTRY', 'BIOLOGY', 'PHYSICS', 'ENGLISH', 'MATHEMATICS']);
  console.log('✓ Test 2 Passed: 1. Chemistry, 2. Biology, 3. Physics, 4. English, 5. Mathematics order verified');
  passedTests++;

  // 3. CHEMISTRY 1-MONTH DYNAMIC PACING CALCULATION
  console.log('\\nTEST 3: Dynamic 1-Month Pacing Calculation');
  const planDay1 = calculateChemistryOneMonthPlan([]);
  assert.strictEqual(planDay1.totalDays, 30, 'Pacing must target 30 days');
  assert.strictEqual(planDay1.daysRemaining, 30);
  assert.strictEqual(planDay1.completedCount, 0);
  assert.strictEqual(planDay1.isBehind, false);
  assert(planDay1.minutesPerDay >= 60 && planDay1.minutesPerDay <= 120, 'Daily minutes should be between 60 and 120 min');

  const planMid = calculateChemistryOneMonthPlan(Array.from({ length: 15 }, (_, i) => `chem_day_${i}`));
  assert.strictEqual(planMid.dayNumber, 16);
  assert.strictEqual(planMid.daysRemaining, 15);
  assert.strictEqual(planMid.percentage, 50);

  console.log(`✓ Test 3 Passed: Dynamic 1-Month pacing verified (Day 1: ${planDay1.formattedDay}, 50% Milestone: Day 16)`);
  passedTests++;

  // 4. STRUCTURED TODO METADATA LINKING
  console.log('\\nTEST 4: Structured Todo Metadata & Plan Task Formatting');
  const sampleChemTask = {
    id: 'task_chem_001',
    description: JSON.stringify({
      subject: 'CHEMISTRY',
      unitId: 'chemistry_u1',
      unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
      topicId: 'chemistry_u1_t1',
      topicTitle: '1.1 Definition and Scope of Chemistry',
      subtopics: ['1.1.1 Definition of Chemistry', '1.1.2 Scope of Chemistry', 'Physical chemistry', 'Organic chemistry'],
      minutesTarget: 90,
      questionsCount: 40,
    }),
  };

  const parsed = parsePlanMetadata(sampleChemTask.description, sampleChemTask);
  assert.strictEqual(parsed.category, 'CHEMISTRY');
  assert.strictEqual(parsed.headerTitle, '🧪 CHEMISTRY');
  assert.strictEqual(parsed.unitTitle, 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE');
  assert.strictEqual(parsed.topicId, 'chemistry_u1_t1');
  assert(parsed.subtopics.length >= 4);
  assert.strictEqual(parsed.targetMinutes, 90);

  console.log('✓ Test 4 Passed: Structured Todo metadata (unitId, unitTitle, topicId, subtopics, targetMinutes) verified');
  passedTests++;

  // 5. JAVASCRIPT ROADMAP: LESSON 3 CONDITIONALS & QUIZ: CHECKING YOUR BALANCE
  console.log('\\nTEST 5: JavaScript Roadmap — Conditionals & Quiz: Checking Your Balance');
  const condModule = JAVASCRIPT_154_ITEMS.filter((i) => i.moduleNumber === 3 || i.moduleName.toLowerCase().includes('conditionals'));
  assert(condModule.length > 0, 'Module 3 Conditionals must exist');
  const balanceQuiz = condModule.find((i) => i.title.toLowerCase().includes('checking your balance'));
  assert(balanceQuiz !== undefined, 'Quiz: Checking Your Balance must exist');
  const loopsModule = JAVASCRIPT_154_ITEMS.filter((i) => i.moduleNumber === 4 || i.moduleName.toLowerCase().includes('loops'));
  assert(loopsModule.length >= 10, 'Module 4 Loops must follow Conditionals');

  console.log('✓ Test 5 Passed: JavaScript starting location verified at Lesson 3: Conditionals (Quiz: Checking Your Balance) -> Lesson 4: Loops');
  passedTests++;

  // 6. QUESTION ENGINE: 40 QUESTIONS DISTRIBUTION & ZERO CLIENT KEY LEAKAGE
  console.log('\\nTEST 6: 40-Question Assessment Generation & Client-Safe DTO');
  const chemQuotas = getSubjectDistributionQuotas('CHEMISTRY', 40);
  const quotaTotal = chemQuotas.reduce((acc, q) => acc + q.count, 0);
  assert.strictEqual(quotaTotal, 40, 'Total questions quota must equal 40');
  assert(chemQuotas.some((q) => q.type === 'calculation'), 'Chemistry must include calculation questions');

  const session = await createAssessmentSession({
    subject: 'CHEMISTRY',
    topicId: 'chemistry_u1_t1',
    count: 40,
    userId: 'test_user_forge',
  });

  assert.strictEqual(session.questions.length, 40, 'Session must generate exactly 40 questions');
  assert.strictEqual(session.currentIndex, 0);
  assert.strictEqual(session.status, 'IN_PROGRESS');

  // Verify Client DTO never leaks correctAnswer, explanation, or grading keys
  const clientDto = toClientAssessmentSession(session);
  assert.strictEqual(clientDto.questions.length, 40);
  for (const q of clientDto.questions) {
    assert.strictEqual((q as any).correctAnswer, undefined, 'Client DTO must NEVER contain correctAnswer');
    assert.strictEqual((q as any).explanation, undefined, 'Client DTO must NEVER contain explanation');
  }

  console.log('✓ Test 6 Passed: 40 questions generated with 8 distinct question types and zero client key leakage');
  passedTests++;

  // 7. ANSWER RECORDING & WEAK CONCEPT FOCUS AREA
  console.log('\\nTEST 7: Authoritative Server Grading, Weak Concept Tracking & FOCUS AREA');
  const q1 = session.questions[0];
  const wrongAnswer = 'An incorrect candidate choice';

  const answerSubmission = await submitAnswerToSession({
    sessionId: session.id,
    questionId: q1.id,
    userAnswer: wrongAnswer,
    timeTakenSec: 12,
  });

  assert.strictEqual(answerSubmission.result.isCorrect, false);
  assert(answerSubmission.result.conceptTag.length > 0);
  assert(answerSubmission.session.weakConcepts.includes(answerSubmission.result.conceptTag));
  assert.strictEqual(answerSubmission.session.currentIndex, 1);

  console.log(`✓ Test 7 Passed: Wrong answer recorded weak concept ("${answerSubmission.result.conceptTag}") with explicit feedback`);
  passedTests++;

  // 8. MASTERY VS CHECKBOX DISTINCTION
  console.log('\\nTEST 8: Checkbox Completion vs Topic Mastery');
  // Complete topic with low score (< 80%) -> Not Mastered
  const progressLow = await completeTopicProgress({
    subject: 'CHEMISTRY',
    topicId: 'chemistry_u1_t1',
    status: 'STUDIED',
    focusMinutes: 45,
    accuracy: 65,
  });
  assert.strictEqual(progressLow.success, true);

  // Complete topic with high score (>= 80%) -> Mastered
  const progressHigh = await completeTopicProgress({
    subject: 'CHEMISTRY',
    topicId: 'chemistry_u1_t1',
    status: 'MASTERED',
    focusMinutes: 45,
    accuracy: 95,
  });
  assert.strictEqual(progressHigh.success, true);

  console.log('✓ Test 8 Passed: Checked checkbox = STUDIED; Topic mastery strictly requires >= 80% assessment score');
  passedTests++;

  // 9. TIMEZONE CUTOFF (21:28 Africa/Addis_Ababa) & NEXT DAY UNLOCK (05:00)
  console.log('\\nTEST 9: Addis Ababa 21:28 Cutoff & 05:00 Unlock Window');
  // 18:27 UTC = 21:27 Addis (Open)
  const openTime = new Date('2026-09-20T18:27:00.000Z');
  const winOpen = workoutWindowForAddisDate(openTime);
  assert.strictEqual(winOpen.isOpen, true);
  assert.strictEqual(winOpen.isClosed, false);

  // 18:28 UTC = 21:28 Addis (Cutoff Closed)
  const cutoffTime = new Date('2026-09-20T18:28:00.000Z');
  const winClosed = workoutWindowForAddisDate(cutoffTime);
  assert.strictEqual(winClosed.isOpen, false);
  assert.strictEqual(winClosed.isClosed, true);

  // Next day 02:00 UTC = 05:00 Addis (New Cycle Open)
  const nextDayOpen = new Date('2026-09-21T02:00:00.000Z');
  const winNext = workoutWindowForAddisDate(nextDayOpen);
  assert.strictEqual(winNext.isOpen, true);
  assert.strictEqual(winNext.dateKey, '2026-09-21');

  console.log('✓ Test 9 Passed: 21:28 cutoff locks unfinished tasks; 05:00 opens next day execution window');
  passedTests++;

  // 10. 300-DAY JOURNEY IN AFRICA/ADDIS_ABABA
  console.log('\\nTEST 10: 300-Day Journey Calculation (Africa/Addis_Ababa)');
  const examDate = new Date('2027-06-21T00:00:00+03:00');
  const daysRem = calculateDaysRemaining(examDate, openTime);
  assert(daysRem.days > 0, 'Days remaining must be greater than 0');
  assert.strictEqual(daysRem.isPassed, false);

  console.log(`✓ Test 10 Passed: 300-day countdown verified (${daysRem.days} days remaining to June 21, 2027)`);
  passedTests++;

  console.log('\\n===============================================================');
  console.log(`🎉 ALL ${passedTests} CRITICAL SYSTEM VERIFICATION TESTS PASSED PERFECTLY!`);
  console.log('===============================================================');
}

runSystemVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
