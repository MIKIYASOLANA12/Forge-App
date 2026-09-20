import {
  WEEKLY_WORKOUT_SCHEDULE,
  CORE_ROUTINE_A,
  CORE_ROUTINE_B,
  getCoreRoutineForDayOfWeek,
  isDeloadWeek,
  getProgressiveOverloadSuggestion,
} from "../lib/workoutMuscleTargets";
import { calculateDaysRemaining } from "../lib/countdowns";

function runTests() {
  console.log("=== RUNNING PHYSIQUE WORKOUT SYSTEM TESTS ===");

  // Test 1: Deadline calculation for March 10, 2027
  const march10Target = new Date("2027-03-10T00:00:00+03:00");
  const deadline = calculateDaysRemaining(march10Target);
  console.log(`Physique Deadline (2027-03-10): Days Remaining: ${deadline.days}`);
  if (deadline.days <= 0) {
    throw new Error("Deadline calculation returned invalid days remaining");
  }

  // Test 2: All 7 days defined in schedule (0 = Sunday ... 6 = Saturday)
  const expectedDays = [0, 1, 2, 3, 4, 5, 6];
  for (const dayNum of expectedDays) {
    const routine = WEEKLY_WORKOUT_SCHEDULE[dayNum];
    if (!routine) {
      throw new Error(`Missing routine for day number ${dayNum}`);
    }
    console.log(`Day ${dayNum} (${routine.dayName}): Location=${routine.location}, Target=${routine.targetBodyParts}, Exercises=${routine.exercises.length}`);
    if (routine.exercises.length === 0) {
      throw new Error(`Routine for day ${dayNum} has 0 exercises`);
    }
  }

  // Test 3: Gym days have Home Substitutes (Wed=3, Fri=5, Sat=6)
  const gymDays = [3, 5, 6];
  for (const dayNum of gymDays) {
    const routine = WEEKLY_WORKOUT_SCHEDULE[dayNum];
    if (!routine.homeSubstitute) {
      throw new Error(`Gym day ${routine.dayName} is missing a homeSubstitute!`);
    }
    console.log(`Gym Day ${routine.dayName} has Home Sub: ${routine.homeSubstitute.targetBodyParts} (${routine.homeSubstitute.exercises.length} exercises)`);
    if (routine.homeSubstitute.exercises.length === 0) {
      throw new Error(`Home substitute for ${routine.dayName} has 0 exercises`);
    }
  }

  // Test 4: Core A/B Rotation
  console.log("Core A Routine exercises:", CORE_ROUTINE_A.exercises.length);
  console.log("Core B Routine exercises:", CORE_ROUTINE_B.exercises.length);
  if (CORE_ROUTINE_A.exercises.length < 3 || CORE_ROUTINE_B.exercises.length < 3) {
    throw new Error("Core routines must have at least 3 exercises each");
  }

  // Verify daily alternation
  const sunCore = getCoreRoutineForDayOfWeek(0); // Sunday: Core A
  const monCore = getCoreRoutineForDayOfWeek(1); // Monday: Core B
  const wedCore = getCoreRoutineForDayOfWeek(3); // Wednesday: Core B
  const friCore = getCoreRoutineForDayOfWeek(5); // Friday: Core A
  const satCore = getCoreRoutineForDayOfWeek(6); // Saturday: Core B
  console.log(`Core Rotations -> Sun: ${sunCore.type}, Mon: ${monCore.type}, Wed: ${wedCore.type}, Fri: ${friCore.type}, Sat: ${satCore.type}`);

  // Test 5: Deload Week
  console.log("Week 1 deload?", isDeloadWeek(1)); // false
  console.log("Week 6 deload?", isDeloadWeek(6)); // true
  console.log("Week 12 deload?", isDeloadWeek(12)); // true
  console.log("Week 13 deload?", isDeloadWeek(13)); // false
  if (isDeloadWeek(1) !== false || isDeloadWeek(6) !== true || isDeloadWeek(12) !== true) {
    throw new Error("Deload week formula failed (should be every 6th week)");
  }

  // Test 6: Progressive Overload Suggestions (Bench Press: target "8–10")
  const highLogs = [
    { weightKg: 30, reps: 10, completed: true },
    { weightKg: 30, reps: 10, completed: true },
    { weightKg: 30, reps: 10, completed: true },
    { weightKg: 30, reps: 10, completed: true },
  ];

  const suggestion = getProgressiveOverloadSuggestion("Bench Press", highLogs, "8–10");
  console.log("Bench Suggestion with 4x 10 reps @ 30kg:", suggestion);
  if (!suggestion || !suggestion.isReady || !suggestion.suggestion.includes("PROGRESSION READY")) {
    throw new Error("Progressive overload did not identify PROGRESSION READY when top reps hit");
  }

  const lowLogs = [
    { weightKg: 30, reps: 8, completed: true },
    { weightKg: 30, reps: 8, completed: true },
  ];
  const suggestionLow = getProgressiveOverloadSuggestion("Bench Press", lowLogs, "8–10");
  console.log("Bench Suggestion with 8 reps @ 30kg:", suggestionLow);
  if (suggestionLow !== null) {
    throw new Error("Progressive overload suggested increase when top reps were not hit");
  }

  console.log("=== ALL PHYSIQUE WORKOUT SYSTEM TESTS PASSED ===");
}

runTests();
