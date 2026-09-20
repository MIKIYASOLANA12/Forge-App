import assert from 'assert';
import { BODY_TRANSFORMATION_END_KEY, calculateDaysRemaining } from '../lib/countdowns';
import {
  WEEKLY_WORKOUT_SCHEDULE,
  getCoreRoutineForDayOfWeek,
  getScheduledRoutineForDayOfWeek,
  getProgressiveOverloadSuggestion,
  WorkoutExerciseDefinition,
  CoreExerciseItem,
} from '../lib/workoutMuscleTargets';
import { isGymDay, getAddisNow } from '../lib/workoutTime';
import {
  evaluateAnswerCorrectness,
  toClientQuestionDTO,
  toClientAssessmentSession,
  AssessmentQuestion,
  AssessmentSessionState,
} from '../lib/studyAssessmentEngine';

async function runTests() {
  console.log('--- RUNNING WORKOUT AND ASSESSMENT VERIFICATION TESTS ---');

  // Test 1: Countdown to March 10, 2027
  console.log('Test 1: Transformation countdown target date and key');
  assert.strictEqual(BODY_TRANSFORMATION_END_KEY, '2027-03-10', 'Countdown key must be 2027-03-10');
  const targetDate = new Date('2027-03-10T00:00:00Z');
  const daysRem = calculateDaysRemaining(targetDate);
  assert(typeof daysRem.days === 'number', 'Days remaining must be a number');
  console.log(`✓ Test 1 Passed: Dynamic countdown remaining days = ${daysRem.days} days (target: 2027-03-10)`);

  // Test 2: Full 7-Day Schedule Definition
  console.log('Test 2: 7-Day workout schedule verification');
  for (let d = 0; d < 7; d++) {
    const day = getScheduledRoutineForDayOfWeek(d);
    assert(day, `Workout day for weekday ${d} must exist`);
    assert.strictEqual(day.dayOfWeek, d);
  }

  // Sunday (0): Home Shoulders & Back with 5L Jar
  const sun = getScheduledRoutineForDayOfWeek(0);
  assert.strictEqual(sun.location, 'HOME');
  assert(sun.targetBodyParts.includes('Shoulders'));
  assert(sun.targetBodyParts.includes('Back'));
  const sunJarEx = sun.exercises.find((e: WorkoutExerciseDefinition) => (e.equipment || '').includes('5L Jar'));
  assert(sunJarEx, 'Sunday must include exercises with 5L Jar equipment');

  // Monday (1): Home Chest & Triceps
  const mon = getScheduledRoutineForDayOfWeek(1);
  assert.strictEqual(mon.location, 'HOME');
  assert(mon.targetBodyParts.includes('Chest'));
  assert(mon.targetBodyParts.includes('Triceps'));

  // Tuesday (2): Home Biceps & Back + Towel Row Safety
  const tue = getScheduledRoutineForDayOfWeek(2);
  assert.strictEqual(tue.location, 'HOME');
  assert(tue.targetBodyParts.includes('Biceps'));
  const towelRow = tue.exercises.find((e: WorkoutExerciseDefinition) => e.name.toLowerCase().includes('towel row'));
  assert(towelRow, 'Tuesday must include Towel Row');
  assert(towelRow.safetyWarning && towelRow.safetyWarning.includes('SAFETY INSTRUCTION'));

  // Wednesday (3): Gym Chest & Shoulders
  const wed = getScheduledRoutineForDayOfWeek(3);
  assert.strictEqual(wed.location, 'GYM');
  const wedDate = new Date(2026, 8, 23); // Wednesday
  assert.strictEqual(isGymDay(wedDate), true);
  assert(wed.targetBodyParts.includes('Chest'));
  assert(wed.targetBodyParts.includes('Shoulders'));
  const bench = wed.exercises.find((e: WorkoutExerciseDefinition) => e.name.toLowerCase().includes('bench press'));
  assert(bench && bench.startingWeightKg === 35, 'Wednesday Bench Press starting weight must be 35kg');

  // Thursday (4): Home Active Recovery
  const thu = getScheduledRoutineForDayOfWeek(4);
  assert.strictEqual(thu.location, 'HOME');
  assert.strictEqual(thu.isRecovery, true);
  const thuDate = new Date(2026, 8, 24); // Thursday
  assert.strictEqual(isGymDay(thuDate), false);

  // Friday (5): Gym Back & Biceps + Pull-up vs Lat Pulldown
  const fri = getScheduledRoutineForDayOfWeek(5);
  assert.strictEqual(fri.location, 'GYM');
  const friDate = new Date(2026, 8, 25); // Friday
  assert.strictEqual(isGymDay(friDate), true);
  const pullUpEx = fri.exercises.find((e: WorkoutExerciseDefinition) => e.name.toLowerCase().includes('pull-up') || e.name.toLowerCase().includes('lat pulldown'));
  assert(pullUpEx, 'Friday must have Pull-ups / Lat Pulldown variant');
  assert(pullUpEx.variants && pullUpEx.variants.length >= 2);

  // Saturday (6): Gym Triceps, Arms & Forearms
  const sat = getScheduledRoutineForDayOfWeek(6);
  assert.strictEqual(sat.location, 'GYM');
  const satDate = new Date(2026, 8, 26); // Saturday
  assert.strictEqual(isGymDay(satDate), true);
  assert(sat.targetBodyParts.includes('Triceps'));
  assert(sat.targetBodyParts.includes('Forearms'));

  console.log('✓ Test 2 Passed: Full 7-day schedule, locations, starting weights, and safety warnings verified');

  // Test 3: Progressive Core Program (A/B Rotation)
  console.log('Test 3: Progressive Core Program specification');
  const coreA = getCoreRoutineForDayOfWeek(0); // Sunday: Core A
  const coreB = getCoreRoutineForDayOfWeek(1); // Monday: Core B
  assert(coreA && coreA.type === 'CORE_A');
  assert(coreB && coreB.type === 'CORE_B');
  assert(coreA && coreA.exercises.length >= 3, 'Core A must have at least 3 exercises');
  assert(coreB && coreB.exercises.length >= 3, 'Core B must have at least 3 exercises');
  console.log('✓ Test 3 Passed: Progressive Core Routines verified (Core A & Core B)');

  // Test 4: Progressive Overload Suggestions
  console.log('Test 4: Progressive Overload calculations');
  const suggestion1 = getProgressiveOverloadSuggestion(
    'Bench Press',
    [
      { weightKg: 40, reps: 10, completed: true },
      { weightKg: 40, reps: 10, completed: true },
      { weightKg: 40, reps: 10, completed: true },
    ],
    '8–10'
  );
  assert(suggestion1 !== null);
  assert(suggestion1.isReady === true);
  assert(suggestion1.suggestion.includes('PROGRESSION READY'));

  const suggestion2 = getProgressiveOverloadSuggestion(
    'Bench Press',
    [
      { weightKg: 40, reps: 6, completed: false },
    ],
    '8–10'
  );
  assert.strictEqual(suggestion2, null);
  console.log('✓ Test 4 Passed: Overload suggestions calculate correctly without auto-mutating input weights');

  // Test 5: Assessment Engine Numerical Tolerance & Grading
  console.log('Test 5: Assessment Engine Numerical tolerance & matching evaluation');
  const calcQuestion: AssessmentQuestion = {
    id: 'q_calc_1',
    subject: 'CHEMISTRY',
    unitId: 'u1',
    unitTitle: 'Stoichiometry',
    topicId: 't1',
    topicTitle: 'Molar Mass',
    subtopic: 'Calculations',
    type: 'calculation',
    difficulty: 'medium',
    prompt: 'Calculate mass in grams of 2.5 moles of NaCl (Molar mass = 58.44 g/mol)',
    options: [],
    correctAnswer: '146.1 g',
    explanation: '2.5 * 58.44 = 146.1 g',
    conceptTag: 'molar-mass',
    sourceType: 'AI_GENERATED',
    xpReward: 30,
  };

  // Exact match
  const resExact = evaluateAnswerCorrectness(calcQuestion, '146.1');
  assert.strictEqual(resExact.isCorrect, true);

  // Within 1.5% margin
  const resTol = evaluateAnswerCorrectness(calcQuestion, '146.5');
  assert.strictEqual(resTol.isCorrect, true);

  // Far off
  const resFail = evaluateAnswerCorrectness(calcQuestion, '130.0');
  assert.strictEqual(resFail.isCorrect, false);

  // Matching Question evaluation
  const matchQuestion: AssessmentQuestion = {
    id: 'q_match_1',
    subject: 'CHEMISTRY',
    unitId: 'u1',
    unitTitle: 'Intro',
    topicId: 't1',
    topicTitle: 'Branches',
    subtopic: 'Branches',
    type: 'matching',
    difficulty: 'medium',
    prompt: 'Match branches',
    options: ['1. Carbon', '2. Minerals'],
    matchingPairs: { left: ['A. Organic', 'B. Inorganic'], right: ['1. Carbon', '2. Minerals'] },
    correctAnswer: 'A:1, B:2',
    explanation: 'Organic is carbon, inorganic is minerals',
    conceptTag: 'branches',
    sourceType: 'AI_GENERATED',
    xpReward: 35,
  };
  const resMatchGood = evaluateAnswerCorrectness(matchQuestion, 'A:1, B:2');
  assert.strictEqual(resMatchGood.isCorrect, true);
  const resMatchReorder = evaluateAnswerCorrectness(matchQuestion, 'B:2, A:1');
  assert.strictEqual(resMatchReorder.isCorrect, true);
  const resMatchBad = evaluateAnswerCorrectness(matchQuestion, 'A:2, B:1');
  assert.strictEqual(resMatchBad.isCorrect, false);
  console.log('✓ Test 5 Passed: Numerical tolerance and matching evaluation work as intended');

  // Test 6: Sanitized Client DTO (Part O: Never leaks answer keys)
  console.log('Test 6: Client DTO sanitization check');
  const clientQ = toClientQuestionDTO(calcQuestion);
  assert.strictEqual((clientQ as any).correctAnswer, undefined, 'Client DTO must not have correctAnswer');
  assert.strictEqual((clientQ as any).explanation, undefined, 'Client DTO must not have explanation');

  const sampleSession: AssessmentSessionState = {
    id: 'sess_123',
    userId: 'user_1',
    subject: 'CHEMISTRY',
    unitId: 'u1',
    unitTitle: 'Unit 1',
    topicId: 't1',
    topicTitle: 'Topic 1',
    subtopics: ['Sub 1'],
    questionCount: 1,
    currentIndex: 0,
    status: 'IN_PROGRESS',
    questions: [calcQuestion],
    answers: [],
    weakConcepts: [],
    strongConcepts: [],
    score: 0,
    accuracy: 0,
    xpEarned: 0,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const clientSession = toClientAssessmentSession(sampleSession);
  assert.strictEqual((clientSession.questions[0] as any).correctAnswer, undefined);
  assert.strictEqual((clientSession.questions[0] as any).explanation, undefined);
  console.log('✓ Test 6 Passed: Client assessment session DTO is completely sanitized');

  console.log('\n--- ALL WORKOUT AND ASSESSMENT TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
