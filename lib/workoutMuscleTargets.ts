export interface MuscleTargetInfo {
  primaryBodyParts: string;
  focusBadges: string[];
  description: string;
  isRecovery?: boolean;
  recoveryNotice?: string;
}

export interface DayRoutineDefinition {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  dayName: string;   // "Sunday", "Monday", etc.
  location: "HOME" | "GYM";
  targetBodyParts: string;
  focusBadges: string[];
  description: string;
  isRecovery?: boolean;
  recoveryNotice?: string;
  equipmentSummary?: string;
  exercises: WorkoutExerciseDefinition[];
}

export interface WorkoutExerciseDefinition {
  id: string;
  name: string;
  muscle: string;
  cue: string;
  equipment: string;
  targetSets: number;
  targetReps: string; // e.g. "12", "8–10", "max", "30s"
  targetDurationSeconds?: number;
  startingWeightKg?: number;
  startingWeightGuide?: string; // e.g. "approximately 30–40 kg"
  variants?: string[]; // e.g. ["Pull-ups", "Lat Pulldown"]
  defaultVariant?: string;
  safetyWarning?: string;
  isTimed?: boolean;
}

export interface CoreExerciseItem {
  id: string;
  name: string;
  target: string;
  targetDurationSeconds?: number;
  isTimed?: boolean;
  cue: string;
}

// ── FIXED DAILY CORE ROUTINE (Tracked twice daily: Morning & Night) ───────────
export const DAILY_CORE_ROUTINE: CoreExerciseItem[] = [
  {
    id: "core_crunches",
    name: "Crunches",
    target: "20 reps",
    cue: "Curl ribcage toward pelvis, exhale deeply at contraction, keep neck relaxed.",
  },
  {
    id: "core_leg_raises",
    name: "Leg Raises",
    target: "15 reps",
    cue: "Keep lower back firmly pressed into the floor throughout the entire movement.",
  },
  {
    id: "core_plank",
    name: "Plank",
    target: "45 seconds",
    targetDurationSeconds: 45,
    isTimed: true,
    cue: "Brace abs 360 degrees, glutes tight, neutral spine from neck to ankles.",
  },
  {
    id: "core_bicycle_crunches",
    name: "Bicycle Crunches",
    target: "20 each side",
    cue: "Rotate shoulder across to opposite knee in a controlled burn; avoid pulling the head.",
  },
];

// ── EXACT 7-DAY WORKOUT ROTATION (Sunday to Saturday) ─────────────────────────
export const WEEKLY_WORKOUT_SCHEDULE: Record<number, DayRoutineDefinition> = {
  // SUNDAY — HOME: Shoulders + Back
  0: {
    dayOfWeek: 0,
    dayName: "Sunday",
    location: "HOME",
    targetBodyParts: "Shoulders + Back",
    focusBadges: ["Shoulder Press", "Lateral Delts", "Upper Back Rows", "Erector Spinae"],
    description: "Home upper session using a 5-liter jar as dumbbell and bodyweight holds.",
    equipmentSummary: "5-liter jar used as dumbbell",
    exercises: [
      {
        id: "sun_jar_shoulder_press",
        name: "Jar Shoulder Press",
        muscle: "Shoulders (Anterior & Lateral Delts)",
        cue: "Hold 5L jar securely with both hands or per arm, press overhead with full lockout.",
        equipment: "5L Jar",
        targetSets: 3,
        targetReps: "12",
      },
      {
        id: "sun_jar_lateral_raise",
        name: "Jar Lateral Raise",
        muscle: "Shoulders (Lateral Side Delts)",
        cue: "Lead with the elbow, raise to shoulder height without swinging the torso.",
        equipment: "5L Jar",
        targetSets: 3,
        targetReps: "12",
      },
      {
        id: "sun_jar_bent_over_row",
        name: "Jar Bent-Over Row",
        muscle: "Back (Lats & Rhomboids)",
        cue: "Hinge at hips with flat spine, row the 5L jar toward lower ribs squeezing shoulder blades.",
        equipment: "5L Jar",
        targetSets: 3,
        targetReps: "12",
      },
      {
        id: "sun_superman_hold",
        name: "Superman Hold",
        muscle: "Lower & Upper Back (Erector Spinae & Glutes)",
        cue: "Lie face down, simultaneously raise chest, arms, and legs off floor. Hold tight.",
        equipment: "Bodyweight",
        targetSets: 3,
        targetReps: "30s",
        targetDurationSeconds: 30,
        isTimed: true,
      },
    ],
  },

  // MONDAY — HOME: Chest + Triceps
  1: {
    dayOfWeek: 1,
    dayName: "Monday",
    location: "HOME",
    targetBodyParts: "Chest + Triceps",
    focusBadges: ["Push-ups Max", "Diamond Push-ups", "Pike Overhead"],
    description: "High-intensity bodyweight pressing targeting chest thickness and triceps lockout power.",
    equipmentSummary: "Bodyweight",
    exercises: [
      {
        id: "mon_pushups",
        name: "Push-ups",
        muscle: "Chest (Pectoralis Major & Triceps)",
        cue: "Tuck elbows 45 degrees, chest to floor on every rep, explosive ascent.",
        equipment: "Bodyweight",
        targetSets: 3,
        targetReps: "max",
      },
      {
        id: "mon_diamond_pushups",
        name: "Diamond Push-ups",
        muscle: "Triceps (Horseshoe & Inner Chest)",
        cue: "Place thumbs and index fingers together under sternum; elbows track close to ribs.",
        equipment: "Bodyweight",
        targetSets: 3,
        targetReps: "12",
      },
      {
        id: "mon_pike_pushups",
        name: "Pike Push-ups",
        muscle: "Shoulders & Upper Chest (Front Delts)",
        cue: "Hips elevated in high A-frame; lower crown of head toward floor between hands.",
        equipment: "Bodyweight",
        targetSets: 3,
        targetReps: "10",
      },
    ],
  },

  // TUESDAY — HOME: Biceps + Back
  2: {
    dayOfWeek: 2,
    dayName: "Tuesday",
    location: "HOME",
    targetBodyParts: "Biceps + Back",
    focusBadges: ["Jar Bicep Curls", "Hammer Curls", "Superman Rows", "Towel Inverted Rows"],
    description: "Home pulling session combining loaded jar curls, floor rows, and door towel rows.",
    equipmentSummary: "5-liter jar + bodyweight",
    exercises: [
      {
        id: "tue_jar_curls",
        name: "Jar Curls",
        muscle: "Biceps (Biceps Brachii)",
        cue: "Keep elbows pinned to ribs, supinate wrist and squeeze biceps at peak contraction.",
        equipment: "5L Jar",
        targetSets: 3,
        targetReps: "15",
      },
      {
        id: "tue_jar_hammer_curls",
        name: "Jar Hammer Curls",
        muscle: "Biceps & Forearms (Brachialis & Brachioradialis)",
        cue: "Neutral grip with thumbs facing upward; controlled 2-second negative descent.",
        equipment: "5L Jar",
        targetSets: 3,
        targetReps: "15",
      },
      {
        id: "tue_superman_rows",
        name: "Superman Rows",
        muscle: "Back (Lats, Traps & Rear Delts)",
        cue: "Lie prone, lift chest and pull elbows back forcefully toward hips squeezing lats.",
        equipment: "Bodyweight",
        targetSets: 3,
        targetReps: "15",
      },
      {
        id: "tue_towel_rows",
        name: "Towel Rows",
        muscle: "Back (Lats Wings & Upper Back)",
        cue: "Anchor towel around door/frame, lean back at 45 degrees, pull chest smoothly to anchor.",
        equipment: "Towel + Door Anchor",
        targetSets: 3,
        targetReps: "12",
        safetyWarning: "⚠️ SAFETY INSTRUCTION: Ensure towel is securely knotted behind a locked/solid door before leaning. Verify door latch holds your full weight.",
      },
    ],
  },

  // WEDNESDAY — GYM: Chest + Shoulders
  3: {
    dayOfWeek: 3,
    dayName: "Wednesday",
    location: "GYM",
    targetBodyParts: "Chest + Shoulders",
    focusBadges: ["Barbell Bench", "Incline Dumbbell", "Lateral Raises", "Overhead Press"],
    description: "Heavy compound gym pushing for pectoral thickness and 3D shoulder deltoids.",
    equipmentSummary: "Barbell, Dumbbells, Bench",
    exercises: [
      {
        id: "wed_bench_press",
        name: "Bench Press",
        muscle: "Chest (Mid/Lower Pectoralis Major & Triceps)",
        cue: "Arch lower back lightly, tuck elbows 45 degrees, explode upward off chest.",
        equipment: "Barbell & Bench",
        targetSets: 4,
        targetReps: "8–10",
        startingWeightKg: 35,
        startingWeightGuide: "approximately 30–40 kg",
      },
      {
        id: "wed_incline_db_press",
        name: "Incline Dumbbell Press",
        muscle: "Chest (Upper Clavicular Pectoralis)",
        cue: "Set bench to 30 degrees incline, press dumbbells up with smooth arc, no elbow hyper-extension.",
        equipment: "Dumbbells & Incline Bench",
        targetSets: 3,
        targetReps: "10",
        startingWeightKg: 10,
        startingWeightGuide: "approximately 10–12 kg each",
      },
      {
        id: "wed_lateral_raises",
        name: "Lateral Raises",
        muscle: "Shoulders (Lateral Side Delts for Width)",
        cue: "Lead with elbows, pause for 0.5s at shoulder height without swinging.",
        equipment: "Dumbbells or Cable",
        targetSets: 3,
        targetReps: "12",
        startingWeightKg: 6,
        startingWeightGuide: "approximately 5–8 kg",
      },
      {
        id: "wed_overhead_press",
        name: "Overhead Press",
        muscle: "Shoulders (Anterior Deltoids & Triceps)",
        cue: "Stand tall, brace glutes and core, press barbell vertically past forehead to full extension.",
        equipment: "Barbell",
        targetSets: 3,
        targetReps: "8",
        startingWeightKg: 17.5,
        startingWeightGuide: "approximately 15–20 kg",
      },
    ],
  },

  // THURSDAY — HOME: ACTIVE RECOVERY / LIGHT FULL UPPER BODY
  4: {
    dayOfWeek: 4,
    dayName: "Thursday",
    location: "HOME",
    targetBodyParts: "Active Recovery / Light Upper",
    focusBadges: ["Active Recovery", "Light Intensity", "Mobility & Blood Flow"],
    description: "Intentionally light session to stimulate recovery and blood flow without causing fatigue.",
    equipmentSummary: "Bodyweight + 5L jar",
    isRecovery: true,
    recoveryNotice: "ACTIVE RECOVERY · LIGHT INTENSITY · DO NOT TREAT THIS AS A HARD WORKOUT DAY",
    exercises: [
      {
        id: "thu_pushups",
        name: "Push-ups",
        muscle: "Chest & Shoulders (Light Flush)",
        cue: "Moderate pace, smooth tempo, focus on range of motion and joint lubrication.",
        equipment: "Bodyweight",
        targetSets: 2,
        targetReps: "15",
      },
      {
        id: "thu_jar_curls",
        name: "Jar Curls",
        muscle: "Biceps (Blood Flow)",
        cue: "Light controlled contractions without reaching muscular failure.",
        equipment: "5L Jar",
        targetSets: 2,
        targetReps: "15",
      },
      {
        id: "thu_plank",
        name: "Plank",
        muscle: "Core (Isometric Stability)",
        cue: "Hold steady isometric brace, deep diaphragmatic breathing.",
        equipment: "Bodyweight",
        targetSets: 2,
        targetReps: "45s",
        targetDurationSeconds: 45,
        isTimed: true,
      },
    ],
  },

  // FRIDAY — GYM: Back + Biceps
  5: {
    dayOfWeek: 5,
    dayName: "Friday",
    location: "GYM",
    targetBodyParts: "Back + Biceps",
    focusBadges: ["Pull-ups / Lat Pulldown", "Barbell Rows", "Seated Cable Row", "Bicep Curls"],
    description: "Gym pulling session for V-taper lat width, mid-back density, and bicep peaks.",
    equipmentSummary: "Barbell, Cable Machines, Pull-up Bar",
    exercises: [
      {
        id: "fri_pullups_or_lat_pulldown",
        name: "Pull-ups OR Lat Pulldown",
        muscle: "Back (Lats Width / 'Wings')",
        cue: "Drive elbows down to hips while keeping chest high and arched toward bar/cable.",
        equipment: "Pull-up Bar or Lat Pulldown Machine",
        targetSets: 4,
        targetReps: "8–10",
        startingWeightKg: 45,
        startingWeightGuide: "Lat pulldown starting guide: approximately 40–50 kg",
        variants: ["Pull-ups", "Lat Pulldown"],
        defaultVariant: "Lat Pulldown",
      },
      {
        id: "fri_barbell_rows",
        name: "Barbell Rows",
        muscle: "Back (Mid-Back Thickness & Lower Lats)",
        cue: "Hinge at 45 degrees, pull barbell to lower navel, squeeze shoulder blades together.",
        equipment: "Barbell",
        targetSets: 4,
        targetReps: "10",
        startingWeightKg: 35,
        startingWeightGuide: "approximately 30–40 kg",
      },
      {
        id: "fri_seated_cable_row",
        name: "Seated Cable Row",
        muscle: "Back (Rhomboids, Middle Traps & Lats)",
        cue: "Sit tall, pull attachment to lower ribcage, 1-second squeeze with zero torso swing.",
        equipment: "Cable Row Machine",
        targetSets: 3,
        targetReps: "12",
        startingWeightKg: 30,
        startingWeightGuide: "approximately 30 kg",
      },
      {
        id: "fri_bicep_curls",
        name: "Bicep Curls",
        muscle: "Biceps (Inner/Outer Head Peaks)",
        cue: "Stationary elbows, supinate wrists at top, controlled 2-second negative.",
        equipment: "Dumbbells or Barbell",
        targetSets: 3,
        targetReps: "10",
        startingWeightKg: 10,
        startingWeightGuide: "approximately 10–12 kg",
      },
    ],
  },

  // SATURDAY — GYM: Triceps + Arms + Forearms
  6: {
    dayOfWeek: 6,
    dayName: "Saturday",
    location: "GYM",
    targetBodyParts: "Triceps + Arms + Forearms",
    focusBadges: ["Tricep Dips", "Rope Pushdowns", "Overhead Tricep Extension", "Wrist Curls"],
    description: "Dedicated arm hypertrophy focusing on tricep long/lateral heads and forearm density.",
    equipmentSummary: "Dip Bar, Cable Crossover, Dumbbells",
    exercises: [
      {
        id: "sat_tricep_dips",
        name: "Tricep Dips",
        muscle: "Triceps (Long & Lateral Heads) & Lower Chest",
        cue: "Stay upright to emphasize triceps, lower to 90 degrees elbow bend and lockout at top.",
        equipment: "Dip Bar / Parallel Bars",
        targetSets: 3,
        targetReps: "10",
      },
      {
        id: "sat_rope_pushdowns",
        name: "Rope Pushdowns",
        muscle: "Triceps (Lateral Horseshoe Head)",
        cue: "Lock elbows to sides, spread rope apart forcefully at bottom contraction.",
        equipment: "Cable & Rope",
        targetSets: 3,
        targetReps: "12",
        startingWeightKg: 17.5,
        startingWeightGuide: "approximately 15–20 kg",
      },
      {
        id: "sat_overhead_tricep_ext",
        name: "Overhead Tricep Extension",
        muscle: "Triceps (Long Head / Overall Thickness)",
        cue: "Full deep stretch behind head, keep elbows tucked, extend straight upward.",
        equipment: "Dumbbell or Cable",
        targetSets: 3,
        targetReps: "10",
        startingWeightKg: 10,
        startingWeightGuide: "approximately 10 kg",
      },
      {
        id: "sat_wrist_curls",
        name: "Wrist Curls",
        muscle: "Forearms (Flexors & Grip Power)",
        cue: "Rest forearms on bench/thighs, curl weight up using wrists only, pause at top.",
        equipment: "Barbell or Dumbbell",
        targetSets: 3,
        targetReps: "15",
        startingWeightKg: 5,
        startingWeightGuide: "approximately 5 kg",
      },
    ],
  },
};

/**
 * Returns the exact scheduled routine for a given Addis Ababa day of week (0..6).
 */
export function getScheduledRoutineForDayOfWeek(dayOfWeek: number): DayRoutineDefinition {
  const norm = ((dayOfWeek % 7) + 7) % 7;
  return WEEKLY_WORKOUT_SCHEDULE[norm] || WEEKLY_WORKOUT_SCHEDULE[0];
}

/**
 * Returns muscle info and form cue for any exercise name.
 */
export function getExerciseMuscleInfo(name: string): { muscle: string; cue: string; safetyWarning?: string } {
  const lower = name.toLowerCase();
  for (const day of Object.values(WEEKLY_WORKOUT_SCHEDULE)) {
    for (const ex of day.exercises) {
      if (
        ex.name.toLowerCase() === lower ||
        ex.id.toLowerCase() === lower ||
        lower.includes(ex.name.toLowerCase()) ||
        ex.name.toLowerCase().includes(lower)
      ) {
        return {
          muscle: ex.muscle,
          cue: ex.cue,
          safetyWarning: ex.safetyWarning,
        };
      }
    }
  }

  // Check daily core
  for (const core of DAILY_CORE_ROUTINE) {
    if (core.name.toLowerCase() === lower || core.id.toLowerCase() === lower) {
      return {
        muscle: "Abdominals & Core Stability",
        cue: core.cue,
      };
    }
  }

  return {
    muscle: "Target Muscle Group",
    cue: "Maintain controlled form and progressive tension throughout the range of motion.",
  };
}

/**
 * Progressive Overload Evaluator (Part F):
 * Generates a helpful suggestion when previous loads were completed consistently.
 * NEVER automatically modifies weights in the database.
 */
export function getProgressiveOverloadSuggestion(
  exerciseName: string,
  lastSets?: Array<{ weightKg?: number | string | null; reps?: number | string | null; completed?: boolean }>,
  targetReps?: string
): string | null {
  if (!lastSets || lastSets.length === 0) return null;

  const allCompleted = lastSets.every((s) => s.completed);
  if (!allCompleted) return null;

  const weights = lastSets
    .map((s) => Number(s.weightKg))
    .filter((w) => Number.isFinite(w) && w > 0);

  if (weights.length === 0) return null;

  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const repNumbers = lastSets.map((s) => Number(s.reps)).filter((r) => Number.isFinite(r) && r > 0);
  const avgReps = repNumbers.length > 0 ? repNumbers.reduce((a, b) => a + b, 0) / repNumbers.length : 0;

  if (avgReps >= 10 || (targetReps && avgReps >= Number(targetReps.split("–")[0]))) {
    return "💡 Current load was completed consistently. Consider testing a small increase next session.";
  }

  return null;
}
