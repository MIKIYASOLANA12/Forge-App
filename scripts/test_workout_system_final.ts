import assert from 'assert';
import {
  WEEKLY_WORKOUT_SCHEDULE,
  CORE_ROUTINE_A,
  CORE_ROUTINE_B,
  getCoreRoutineForDayOfWeek,
  getScheduledRoutineForDayOfWeek,
  getProgressiveOverloadSuggestion,
  isDeloadWeek,
  getExerciseMuscleInfo,
} from '../lib/workoutMuscleTargets';

async function runWorkoutTests() {
  console.log('====================================================');
  console.log('RUNNING FORGE WORKOUT SYSTEM VERIFICATION SUITE');
  console.log('====================================================');

  // 1. EXACT 7-DAY WORKOUT SPLIT VERIFICATION
  console.log('\n--- 1. Testing Exact 7-Day Workout Split ---');

  // Sunday: HOME - Shoulders + Back
  const sun = getScheduledRoutineForDayOfWeek(0);
  assert.strictEqual(sun.dayName, 'Sunday');
  assert.strictEqual(sun.location, 'HOME');
  assert.strictEqual(sun.targetBodyParts, 'Shoulders + Back');
  const sunExNames = sun.exercises.map(e => e.name);
  assert(sunExNames.includes('Jar Lateral Raise'), 'Sunday must include Jar Lateral Raise');
  assert(sunExNames.includes('Jar Shoulder Press'), 'Sunday must include Jar Shoulder Press');
  assert(sunExNames.includes('Jar Bent-Over Row'), 'Sunday must include Jar Bent-Over Row');
  assert(sunExNames.includes('Rear-Delt Fly'), 'Sunday must include Rear-Delt Fly');
  assert(sunExNames.includes('Superman Hold'), 'Sunday must include Superman Hold');
  console.log('✓ Sunday (HOME: Shoulders + Back) matches exact prescription');

  // Monday: HOME - Chest + Triceps
  const mon = getScheduledRoutineForDayOfWeek(1);
  assert.strictEqual(mon.dayName, 'Monday');
  assert.strictEqual(mon.location, 'HOME');
  assert.strictEqual(mon.targetBodyParts, 'Chest + Triceps');
  const monExNames = mon.exercises.map(e => e.name);
  assert(monExNames.includes('Push-ups'), 'Monday must include Push-ups');
  assert(monExNames.includes('Diamond Push-ups'), 'Monday must include Diamond Push-ups');
  assert(monExNames.includes('Feet-Elevated Push-ups'), 'Monday must include Feet-Elevated Push-ups');
  assert(monExNames.includes('Pike Push-ups'), 'Monday must include Pike Push-ups');
  assert(monExNames.includes('Jar Overhead Triceps Extension'), 'Monday must include Jar Overhead Triceps Extension');
  console.log('✓ Monday (HOME: Chest + Triceps) matches exact prescription');

  // Tuesday: HOME - Biceps + Back
  const tue = getScheduledRoutineForDayOfWeek(2);
  assert.strictEqual(tue.dayName, 'Tuesday');
  assert.strictEqual(tue.location, 'HOME');
  assert.strictEqual(tue.targetBodyParts, 'Biceps + Back');
  const tueExNames = tue.exercises.map(e => e.name);
  assert(tueExNames.includes('Jar Curls'), 'Tuesday must include Jar Curls');
  assert(tueExNames.includes('Hammer Curls'), 'Tuesday must include Hammer Curls');
  assert(tueExNames.includes('Jar Rows'), 'Tuesday must include Jar Rows');
  assert(tueExNames.includes('Towel Rows'), 'Tuesday must include Towel Rows');
  assert(tueExNames.includes('Superman Rows'), 'Tuesday must include Superman Rows');
  assert(tueExNames.includes('Pull-Ups'), 'Tuesday must include optional Pull-Ups');
  console.log('✓ Tuesday (HOME: Biceps + Back + Optional Pull-ups) matches exact prescription');

  // Wednesday: GYM - Chest + Shoulders
  const wed = getScheduledRoutineForDayOfWeek(3);
  assert.strictEqual(wed.dayName, 'Wednesday');
  assert.strictEqual(wed.location, 'GYM');
  assert.strictEqual(wed.targetBodyParts, 'Chest + Shoulders');
  const wedExNames = wed.exercises.map(e => e.name);
  assert(wedExNames.includes('Bench Press'), 'Wednesday must include Bench Press');
  assert(wedExNames.includes('Incline Dumbbell Press'), 'Wednesday must include Incline DB Press');
  assert(wedExNames.includes('Lateral Raise'), 'Wednesday must include Lateral Raise');
  assert(wedExNames.includes('Overhead Press'), 'Wednesday must include Overhead Press');
  assert(wedExNames.includes('Rear-Delt Exercise'), 'Wednesday must include Rear-Delt Exercise');
  console.log('✓ Wednesday (GYM: Chest + Shoulders) matches exact prescription');

  // Thursday: HOME - Active Recovery
  const thu = getScheduledRoutineForDayOfWeek(4);
  assert.strictEqual(thu.dayName, 'Thursday');
  assert.strictEqual(thu.location, 'HOME');
  assert.strictEqual(thu.isRecovery, true);
  const thuExNames = thu.exercises.map(e => e.name);
  assert(thuExNames.includes('Push-ups'), 'Thursday must include Push-ups');
  assert(thuExNames.includes('Jar Curls'), 'Thursday must include Jar Curls');
  assert(thuExNames.includes('Plank'), 'Thursday must include Plank');
  console.log('✓ Thursday (HOME: Active Recovery) matches exact prescription');

  // Friday: GYM - Back + Biceps
  const fri = getScheduledRoutineForDayOfWeek(5);
  assert.strictEqual(fri.dayName, 'Friday');
  assert.strictEqual(fri.location, 'GYM');
  assert.strictEqual(fri.targetBodyParts, 'Back + Biceps');
  const friExNames = fri.exercises.map(e => e.name);
  assert(friExNames.includes('Pull-ups OR Lat Pulldown'), 'Friday must include Pull-ups OR Lat Pulldown');
  assert(friExNames.includes('Barbell Row'), 'Friday must include Barbell Row');
  assert(friExNames.includes('Seated Cable Row'), 'Friday must include Seated Cable Row');
  assert(friExNames.includes('Biceps Curl'), 'Friday must include Biceps Curl');
  assert(friExNames.includes('Hammer Curl'), 'Friday must include Hammer Curl');
  console.log('✓ Friday (GYM: Back + Biceps) matches exact prescription');

  // Saturday: GYM - Triceps + Arms + Forearms
  const sat = getScheduledRoutineForDayOfWeek(6);
  assert.strictEqual(sat.dayName, 'Saturday');
  assert.strictEqual(sat.location, 'GYM');
  assert.strictEqual(sat.targetBodyParts, 'Triceps + Arms + Forearms');
  const satExNames = sat.exercises.map(e => e.name);
  assert(satExNames.includes('Dips'), 'Saturday must include Dips');
  assert(satExNames.includes('Rope Pushdown'), 'Saturday must include Rope Pushdown');
  assert(satExNames.includes('Overhead Triceps Extension'), 'Saturday must include Overhead Triceps Extension');
  assert(satExNames.includes('Wrist Curls'), 'Saturday must include Wrist Curls');
  assert(satExNames.includes('Hammer Curls'), 'Saturday must include Hammer Curls');
  console.log('✓ Saturday (GYM: Triceps + Arms + Forearms) matches exact prescription');

  // 2. CORE A / CORE B ALTERNATING SCHEDULE VERIFICATION
  console.log('\n--- 2. Testing Core A / Core B Rotation ---');
  assert.strictEqual(CORE_ROUTINE_A.exercises.length, 3);
  assert.strictEqual(CORE_ROUTINE_B.exercises.length, 3);

  // Sunday (0) -> Core A
  assert.strictEqual(getCoreRoutineForDayOfWeek(0)?.type, 'CORE_A');
  // Monday (1) -> Core B
  assert.strictEqual(getCoreRoutineForDayOfWeek(1)?.type, 'CORE_B');
  // Tuesday (2) -> null (Rest / no hard core)
  assert.strictEqual(getCoreRoutineForDayOfWeek(2), null);
  // Wednesday (3) -> Core A
  assert.strictEqual(getCoreRoutineForDayOfWeek(3)?.type, 'CORE_A');
  // Thursday (4) -> null (Active Recovery / light plank only)
  assert.strictEqual(getCoreRoutineForDayOfWeek(4), null);
  // Friday (5) -> Core B
  assert.strictEqual(getCoreRoutineForDayOfWeek(5)?.type, 'CORE_B');
  // Saturday (6) -> Core A
  assert.strictEqual(getCoreRoutineForDayOfWeek(6)?.type, 'CORE_A');
  console.log('✓ Core Routine correctly alternates: Sun(A), Mon(B), Tue(Rest), Wed(A), Thu(Rest), Fri(B), Sat(A)');

  // 3. PROGRESSIVE OVERLOAD CRITERIA
  console.log('\n--- 3. Testing Progressive Overload Suggestion ---');
  // Under top reps:
  const noProg = getProgressiveOverloadSuggestion(
    'Bench Press',
    [
      { weightKg: 35, reps: 8, completed: true },
      { weightKg: 35, reps: 8, completed: true },
    ],
    '8–10'
  );
  assert.strictEqual(noProg, null, 'Should not suggest progression if top reps are not met');

  // Hitting top reps:
  const progReady = getProgressiveOverloadSuggestion(
    'Bench Press',
    [
      { weightKg: 35, reps: 10, completed: true },
      { weightKg: 35, reps: 10, completed: true },
      { weightKg: 35, reps: 10, completed: true },
      { weightKg: 35, reps: 10, completed: true },
    ],
    '8–10'
  );
  assert(progReady && progReady.isReady, 'Should suggest progression when hitting top reps');
  assert(progReady.suggestion.includes('PROGRESSION READY'));
  console.log('✓ Progressive overload trigger correctly identifies readiness at top of rep range');

  // 4. DELOAD EVALUATOR
  console.log('\n--- 4. Testing Deload Week Evaluator ---');
  assert.strictEqual(isDeloadWeek(1), false);
  assert.strictEqual(isDeloadWeek(5), false);
  assert.strictEqual(isDeloadWeek(6), true, 'Week 6 must be a deload week');
  assert.strictEqual(isDeloadWeek(12), true, 'Week 12 must be a deload week');
  console.log('✓ Deload week evaluator correctly flags every 6th week');

  // 5. MUSCLE INFO & CUES
  console.log('\n--- 5. Testing Exercise Muscle Info & Cues ---');
  const benchInfo = getExerciseMuscleInfo('Bench Press');
  assert(benchInfo.muscle.includes('Chest'), 'Bench press target must be Chest');
  assert(benchInfo.cue.length > 0, 'Bench press must have cue');
  const towelInfo = getExerciseMuscleInfo('Towel Rows');
  assert(towelInfo.safetyWarning && towelInfo.safetyWarning.includes('SAFETY INSTRUCTION'));
  console.log('✓ Exercise cues, muscle mappings, and safety warnings verified');

  console.log('\n====================================================');
  console.log('ALL WORKOUT SYSTEM TESTS PASSED SUCCESSFULLY (100%)');
  console.log('====================================================');
}

runWorkoutTests().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
