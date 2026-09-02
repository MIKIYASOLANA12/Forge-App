import assert from 'node:assert';
import { parsePlanMetadata, formatPlanTaskTitle } from '../lib/planParser';

console.log('🧪 RUNNING PLAN PARSER AND FORMATTER TESTS...\n');

// 1. Test CODING CARD
console.log('1. Testing CODING card...');
const codingJson = JSON.stringify({
  title: '5 Million Coders / JavaScript — Module 4 — Loops: While Loops & Counter Fundamentals',
  subject: 'JavaScript',
  module: 'Module 4 — Loops',
  mainTopic: 'While Loops & Counter Fundamentals',
  itemRange: 'Items 1–11',
  subtopics: [
    'intro to loops',
    'while Loops',
    'Parts of a while Loop',
    'Quiz: JuliaJames',
    'Quiz: 99 Bottles of Juice',
    'Quiz: Countdown, Liftoff!',
    'for Loops',
    'parts of a for Loop',
    'Nested Loops',
    'Operators',
    'Quiz: Changing the Loop',
  ],
  quizzes: [
    'Quiz: JuliaJames',
    'Quiz: 99 Bottles of Juice',
    'Quiz: Countdown, Liftoff!',
    'Quiz: Changing the Loop',
  ],
  learningTarget: 'Master loop initialization, conditional checks, loop increments, and nested loop patterns.',
  minutesTarget: 100,
});

const codingParsed = parsePlanMetadata(codingJson);
assert.strictEqual(codingParsed.category, 'CODING');
assert.strictEqual(codingParsed.headerTitle, '💻 5 MILLION CODERS — JAVASCRIPT');
assert.strictEqual(codingParsed.module, 'Module 4 — Loops');
assert.strictEqual(codingParsed.mainTopic, 'While Loops & Counter Fundamentals');
assert.strictEqual(codingParsed.subtopics.length, 11);
assert.strictEqual(codingParsed.learningTarget, 'Master loop initialization, conditional checks, loop increments, and nested loop patterns.');
assert.strictEqual(codingParsed.targetMinutes, 100);
assert(!codingParsed.displayTitle.startsWith('{'), 'displayTitle must NOT be raw JSON');
console.log('✅ Coding card parsed successfully:', codingParsed.displayTitle);

// 2. Test CHEMISTRY CARD
console.log('\n2. Testing CHEMISTRY card...');
const chemJson = JSON.stringify({
  title: 'Chemistry — Chemistry Basics & Classification of Matter',
  subject: 'Chemistry',
  topic: 'Chemistry Basics & Classification of Matter',
  subtopics: [
    'Chemistry and Its Importance',
    'States of Matter',
    'Physical vs Chemical Properties',
    'Pure Substances vs Mixtures',
    'Separation Techniques',
  ],
  practiceTarget: '15 Classification & Separation Problems',
  reviewTarget: 'Phase diagram definitions & homogeneous vs heterogeneous mixtures',
  isEntrancePriority: false,
  sessionBreakdown: {
    learnMins: 35,
    activeRecallMins: 10,
    flashcardsMins: 10,
    practiceMins: 15,
    oldTopicRecallMins: 5,
  },
  minutesTarget: 75,
});

const chemParsed = parsePlanMetadata(chemJson);
assert.strictEqual(chemParsed.category, 'CHEMISTRY');
assert.strictEqual(chemParsed.headerTitle, '🧪 CHEMISTRY');
assert.strictEqual(chemParsed.topic, 'Chemistry Basics & Classification of Matter');
assert.strictEqual(chemParsed.subtopics.length, 5);
assert.strictEqual(chemParsed.practiceTarget, '15 Classification & Separation Problems');
assert.strictEqual(chemParsed.reviewTarget, 'Phase diagram definitions & homogeneous vs heterogeneous mixtures');
assert.deepStrictEqual(chemParsed.sessionBreakdown, {
  learnMins: 35,
  activeRecallMins: 10,
  flashcardsMins: 10,
  practiceMins: 15,
  oldTopicRecallMins: 5,
});
assert.strictEqual(chemParsed.targetMinutes, 75);
assert(!chemParsed.displayTitle.startsWith('{'), 'displayTitle must NOT be raw JSON');
console.log('✅ Chemistry card parsed successfully:', chemParsed.displayTitle);

// 3. Test WORKOUT CARD
console.log('\n3. Testing WORKOUT card...');
const workoutStr = 'Daily Workout Protocol: Pull (GYM)';
const workoutParsed = parsePlanMetadata(workoutStr, { minutesTarget: 45 });
assert.strictEqual(workoutParsed.category, 'WORKOUT');
assert.strictEqual(workoutParsed.headerTitle, '🏋️ WORKOUT');
assert.strictEqual(workoutParsed.workoutType, 'Pull');
assert.strictEqual(workoutParsed.workoutLocation, 'GYM');
assert.strictEqual(workoutParsed.targetMinutes, 45);
assert(workoutParsed.workoutExercises && workoutParsed.workoutExercises.length > 0);
assert(!workoutParsed.displayTitle.startsWith('{'), 'displayTitle must NOT be raw JSON');
console.log('✅ Workout card parsed successfully:', workoutParsed.displayTitle);

// 4. Test READING CARD
console.log('\n4. Testing READING card...');
const readingJson = JSON.stringify({
  title: '📚 Reading — How to Win Friends and Influence People (Pages 1–11)',
  subject: 'Reading',
  bookTitle: 'How to Win Friends and Influence People',
  pagesTarget: '1–11',
  pagesCount: 11,
  minutesTarget: 25,
});

const readingParsed = parsePlanMetadata(readingJson);
assert.strictEqual(readingParsed.category, 'READING');
assert.strictEqual(readingParsed.headerTitle, '📚 READING');
assert.strictEqual(readingParsed.bookTitle, 'How to Win Friends and Influence People');
assert.strictEqual(readingParsed.pagesTarget, '1–11');
assert.strictEqual(readingParsed.pagesCount, 11);
assert(!readingParsed.displayTitle.startsWith('{'), 'displayTitle must NOT be raw JSON');
console.log('✅ Reading card parsed successfully:', readingParsed.displayTitle);

// 5. Test Invalid JSON fallback
console.log('\n5. Testing INVALID JSON fallback...');
const invalidJson = '{"title":"Broken JSON without closing bracket';
const invalidParsed = parsePlanMetadata(invalidJson, { domain: { name: 'Study' } });
assert(!invalidParsed.displayTitle.startsWith('{'), 'Must not start with {');
assert(invalidParsed.displayTitle.includes('Broken JSON without closing bracket'), 'Clean text preserved');
console.log('✅ Invalid JSON gracefully handled without raw JSON:', invalidParsed.displayTitle);

// 6. Test Null & Undefined & Empty string
console.log('\n6. Testing NULL, UNDEFINED, and EMPTY string...');
const nullParsed = parsePlanMetadata(null, { title: 'Fallback Task', minutesTarget: 30 });
assert.strictEqual(nullParsed.displayTitle, 'Fallback Task');
assert.strictEqual(nullParsed.targetMinutes, 30);

const undefinedParsed = parsePlanMetadata(undefined, { description: 'Simple Note', minutesTarget: 20 });
assert.strictEqual(undefinedParsed.displayTitle, 'Simple Note');
assert.strictEqual(undefinedParsed.targetMinutes, 20);

const emptyParsed = parsePlanMetadata('', { domain: { name: 'Personal' } });
assert(emptyParsed.displayTitle.length > 0);
console.log('✅ Null, undefined, and empty string handled gracefully!');

// 7. Test formatPlanTaskTitle / formatTaskForDisplay
console.log('\n7. Testing formatPlanTaskTitle utility...');
assert.strictEqual(formatPlanTaskTitle(codingJson), 'JavaScript — Module 4: Loops');
assert.strictEqual(formatPlanTaskTitle(chemJson), 'Chemistry — Chemistry Basics & Classification of Matter');
assert.strictEqual(formatPlanTaskTitle(workoutStr), 'Daily Workout Protocol: Pull (GYM)');
assert.strictEqual(formatPlanTaskTitle(readingJson), 'Reading — How to Win Friends and Influence People, pages 1–11');
console.log('✅ formatPlanTaskTitle returned clean readable titles for all items!');

console.log('\n🎉 ALL PLAN PARSER TESTS PASSED PERFECTLY!\n');
