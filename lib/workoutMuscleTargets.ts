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
  homeSubstitute?: {
    location: "HOME";
    targetBodyParts: string;
    focusBadges: string[];
    description: string;
    equipmentSummary: string;
    exercises: WorkoutExerciseDefinition[];
  };
  shortSessionExerciseIds?: string[]; // IDs of high-priority exercises for 25-35m school-time mode
}

export interface WorkoutExerciseDefinition {
  id: string;
  name: string;
  muscle: string;
  cue: string;
  equipment: string;
  targetSets: number;
  targetReps: string; // e.g. "12–15", "8–10", "Near failure", "30 seconds"
  targetDurationSeconds?: number;
  startingWeightKg?: number;
  startingWeightGuide?: string; // e.g. "approximately 30–40 kg"
  variants?: string[]; // e.g. ["Pull-ups", "Lat Pulldown"]
  defaultVariant?: string;
  safetyWarning?: string;
  isTimed?: boolean;
  isOptional?: boolean;
  isPrimaryCompound?: boolean;
}

export interface CoreExerciseItem {
  id: string;
  name: string;
  target: string;
  targetDurationSeconds?: number;
  isTimed?: boolean;
  cue: string;
  progressionTip?: string;
}

export interface CoreRoutineDefinition {
  type: "CORE_A" | "CORE_B";
  title: string;
  description: string;
  exercises: CoreExerciseItem[];
}

// ── PROGRESSIVE CORE PROGRAM (4–5 Sessions / Week, Alternating A & B) ─────────
export const CORE_ROUTINE_A: CoreRoutineDefinition = {
  type: "CORE_A",
  title: "Core A — Lower Abs & Anti-Extension Stability",
  description: "Targeting lower abdominal wall, anterior core compression, and deep transverse stability.",
  exercises: [
    {
      id: "core_a_leg_raises",
      name: "Leg Raises",
      target: "3 × 10–15 reps",
      cue: "Keep lower back pressed firmly into floor; lower legs with strict 3-second control without arching.",
      progressionTip: "Progress by slowing negative to 4 seconds, adding 2-second pause 6 inches off floor, or holding light ankle resistance.",
    },
    {
      id: "core_a_crunches",
      name: "Slow / Weighted Crunches",
      target: "3 × 10–15 reps",
      cue: "Curl ribcage toward pelvis, exhale forcefully at peak contraction, pause for 1 full second.",
      progressionTip: "Progress by placing hands overhead, pausing 2s at peak contraction, or holding a 5L jar on chest.",
    },
    {
      id: "core_a_plank",
      name: "Plank Hold",
      target: "3 × 30–60 seconds",
      targetDurationSeconds: 45,
      isTimed: true,
      cue: "360-degree abdominal brace, squeeze glutes and quads tight, neutral neck.",
      progressionTip: "Progress by squeezing glutes harder (RKC plank style), extending lever arm forward, or elevating feet.",
    },
  ],
};

export const CORE_ROUTINE_B: CoreRoutineDefinition = {
  type: "CORE_B",
  title: "Core B — Obliques, Pelvic Control & Lateral Stability",
  description: "Targeting rotational core strength, side obliques for V-taper aesthetics, and pelvic curl control.",
  exercises: [
    {
      id: "core_b_reverse_crunch",
      name: "Reverse Crunch",
      target: "3 × 10–15 reps",
      cue: "Curl pelvis toward chest using lower abs without momentum or swinging legs.",
      progressionTip: "Progress with slower descent and pausing at top of pelvic lift.",
    },
    {
      id: "core_b_bicycle_crunch",
      name: "Bicycle Crunch",
      target: "3 × 15–20 / side",
      cue: "Slow rotational burn; drive shoulder (not elbow) toward opposite knee, pause 1s each side.",
      progressionTip: "Progress with slower cadence (2s per rotation) and full leg extension.",
    },
    {
      id: "core_b_side_plank",
      name: "Side Plank",
      target: "3 × 30–45s / side",
      targetDurationSeconds: 45,
      isTimed: true,
      cue: "Elevate hips high in straight alignment from ankles to shoulders, deep diaphragmatic breathing.",
      progressionTip: "Progress by elevating top leg or extending duration to 60s per side.",
    },
  ],
};

/**
 * Returns scheduled Core Routine (A or B) for day of week.
 * 4–5 planned sessions per week:
 * Sunday: Core A, Monday: Core B, Tuesday: Core A, Wednesday: Core B, Friday: Core A, Saturday: Core B, Thursday: Rest/Light
 */
export function getCoreRoutineForDayOfWeek(dayOfWeek: number): CoreRoutineDefinition {
  const norm = ((dayOfWeek % 7) + 7) % 7;
  // Sunday (0): Core A, Monday (1): Core B, Tuesday (2): Core A, Wednesday (3): Core B, Friday (5): Core A, Saturday (6): Core B, Thursday (4): Core A
  return (norm === 1 || norm === 3 || norm === 6) ? CORE_ROUTINE_B : CORE_ROUTINE_A;
}

// ── AUTHORITATIVE 7-DAY WORKOUT SCHEDULE (Sunday to Saturday) ─────────────────
export const WEEKLY_WORKOUT_SCHEDULE: Record<number, DayRoutineDefinition> = {
  // SUNDAY — HOME: Shoulders + Back
  0: {
    dayOfWeek: 0,
    dayName: "Sunday",
    location: "HOME",
    targetBodyParts: "Shoulders + Back",
    focusBadges: ["Lateral Delts", "Shoulder Press", "Upper Back Rows", "Rear Delts", "Erector Spinae"],
    description: "Home upper session prioritizing side delt width, shoulder pressing, and upper back/rear delt development.",
    equipmentSummary: "5-liter jar + bodyweight",
    shortSessionExerciseIds: ["sun_jar_lateral_raise", "sun_jar_shoulder_press", "sun_jar_bent_over_row"],
    exercises: [
      {
        id: "sun_jar_lateral_raise",
        name: "Jar Lateral Raise",
        muscle: "Shoulders (Lateral Side Delts)",
        cue: "Lead with the elbow, raise to shoulder height without swinging torso. Controlled 2s descent.",
        equipment: "5L Jar",
        targetSets: 3,
        targetReps: "12–15",
        isPrimaryCompound: true,
      },
      {
        id: "sun_jar_shoulder_press",
        name: "Jar Shoulder Press",
        muscle: "Shoulders (Anterior & Lateral Delts)",
        cue: "Hold 5L jar securely with both hands or per arm, press overhead with full lockout.",
        equipment: "5L Jar",
        targetSets: 3,
        targetReps: "10–15",
        isPrimaryCompound: true,
      },
      {
        id: "sun_jar_bent_over_row",
        name: "Jar Bent-Over Row",
        muscle: "Back (Lats & Rhomboids)",
        cue: "Hinge at hips with flat spine, row 5L jar toward lower ribs squeezing shoulder blades.",
        equipment: "5L Jar",
        targetSets: 3,
        targetReps: "12–15",
        isPrimaryCompound: true,
      },
      {
        id: "sun_jar_rear_delt_fly",
        name: "Jar/Bent-Over Rear-Delt Fly",
        muscle: "Shoulders (Posterior Rear Delts & Upper Back)",
        cue: "Hinge at hips, raise arms outward with elbows slightly bent, squeezing rear deltoids.",
        equipment: "5L Jar / Bodyweight",
        targetSets: 3,
        targetReps: "12–15",
      },
      {
        id: "sun_superman_hold",
        name: "Superman Hold",
        muscle: "Lower & Upper Back (Erector Spinae & Glutes)",
        cue: "Lie face down, simultaneously raise chest, arms, and legs off floor. Hold tight.",
        equipment: "Bodyweight",
        targetSets: 3,
        targetReps: "30 seconds",
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
    focusBadges: ["Push-ups (Near Failure)", "Diamond Lockout", "Incline Upper Chest", "Pike Overhead"],
    description: "High-intensity bodyweight pressing for pectoral thickness, upper chest, and triceps horseshoe development.",
    equipmentSummary: "Bodyweight + optional 5L jar",
    shortSessionExerciseIds: ["mon_pushups", "mon_feet_elevated_pushups", "mon_diamond_pushups"],
    exercises: [
      {
        id: "mon_pushups",
        name: "Push-ups",
        muscle: "Chest (Mid Pectoralis Major & Triceps)",
        cue: "Tuck elbows 45 degrees, chest to floor on every rep, near failure with clean form.",
        equipment: "Bodyweight",
        targetSets: 3,
        targetReps: "Near failure (clean form)",
        isPrimaryCompound: true,
      },
      {
        id: "mon_diamond_pushups",
        name: "Diamond Push-ups",
        muscle: "Triceps (Horseshoe & Inner Chest)",
        cue: "Place thumbs and index fingers together under sternum; elbows track close to ribs.",
        equipment: "Bodyweight",
        targetSets: 3,
        targetReps: "10–15",
        isPrimaryCompound: true,
      },
      {
        id: "mon_feet_elevated_pushups",
        name: "Feet-Elevated Push-ups",
        muscle: "Chest (Upper Clavicular Pectoralis)",
        cue: "Elevate feet on chair/step; lower chest with controlled tempo, drive through palms.",
        equipment: "Bodyweight / Chair",
        targetSets: 3,
        targetReps: "8–15",
        isPrimaryCompound: true,
      },
      {
        id: "mon_pike_pushups",
        name: "Pike Push-ups",
        muscle: "Shoulders & Upper Chest (Front Delts)",
        cue: "Hips elevated in high A-frame; lower crown of head toward floor between hands.",
        equipment: "Bodyweight",
        targetSets: 3,
        targetReps: "8–12",
      },
      {
        id: "mon_jar_triceps_ext",
        name: "Jar Overhead Triceps Extension",
        muscle: "Triceps (Long Head Thickness)",
        cue: "Hold 5L jar overhead with both hands, lower behind head with elbows tucked, extend upward.",
        equipment: "5L Jar",
        targetSets: 2,
        targetReps: "12–15",
        isOptional: true,
      },
    ],
  },

  // TUESDAY — HOME: Biceps + Back
  2: {
    dayOfWeek: 2,
    dayName: "Tuesday",
    location: "HOME",
    targetBodyParts: "Biceps + Back",
    focusBadges: ["Jar Bicep Curls", "Hammer Curls", "Jar Rows", "Towel Door Rows", "Superman Rows"],
    description: "Home pulling session for bicep peaks, brachialis forearm thickness, and back lat development.",
    equipmentSummary: "5-liter jar + towel / door anchor",
    shortSessionExerciseIds: ["tue_jar_curls", "tue_jar_rows", "tue_jar_hammer_curls"],
    exercises: [
      {
        id: "tue_jar_curls",
        name: "Jar Curls",
        muscle: "Biceps (Biceps Brachii)",
        cue: "Keep elbows pinned to ribs, supinate wrist and squeeze biceps hard at peak contraction.",
        equipment: "5L Jar",
        targetSets: 3,
        targetReps: "12–20",
        isPrimaryCompound: true,
      },
      {
        id: "tue_jar_hammer_curls",
        name: "Jar Hammer Curls",
        muscle: "Biceps & Forearms (Brachialis & Brachioradialis)",
        cue: "Neutral grip with thumbs upward; controlled 2-second negative descent for arm thickness.",
        equipment: "5L Jar",
        targetSets: 3,
        targetReps: "12–20",
        isPrimaryCompound: true,
      },
      {
        id: "tue_jar_rows",
        name: "Jar Rows",
        muscle: "Back (Lats & Mid-Back Thickness)",
        cue: "Hinge at hips with flat spine, row 5L jar toward lower ribs squeezing shoulder blades.",
        equipment: "5L Jar",
        targetSets: 3,
        targetReps: "12–20",
        isPrimaryCompound: true,
      },
      {
        id: "tue_towel_rows",
        name: "Towel Rows",
        muscle: "Back (Lats Wings & Upper Back)",
        cue: "Anchor towel around solid door/frame, lean back at 45 degrees, pull chest smoothly to anchor.",
        equipment: "Towel + Door Anchor",
        targetSets: 3,
        targetReps: "8–15",
        safetyWarning: "⚠️ SAFETY INSTRUCTION: Ensure towel is securely knotted behind a locked/solid door before leaning. Verify door latch holds your full weight.",
        variants: ["Towel Rows", "Pull-ups (if safe bar available)"],
        defaultVariant: "Towel Rows",
      },
      {
        id: "tue_superman_rows",
        name: "Superman Rows",
        muscle: "Back (Lats, Traps & Rear Delts)",
        cue: "Lie prone, lift chest and pull elbows back forcefully toward hips squeezing lats.",
        equipment: "Bodyweight",
        targetSets: 3,
        targetReps: "12–15",
      },
    ],
  },

  // WEDNESDAY — GYM (with Complete Home Substitute): Chest + Shoulders
  3: {
    dayOfWeek: 3,
    dayName: "Wednesday",
    location: "GYM",
    targetBodyParts: "Chest + Shoulders",
    focusBadges: ["Barbell Bench", "Incline Dumbbell", "Lateral Raises", "Overhead Press"],
    description: "Heavy compound gym pushing for pectoral thickness, upper chest fullness, and 3D shoulder deltoids.",
    equipmentSummary: "Barbell, Dumbbells, Bench",
    shortSessionExerciseIds: ["wed_bench_press", "wed_incline_db_press", "wed_lateral_raises"],
    exercises: [
      {
        id: "wed_bench_press",
        name: "Bench Press",
        muscle: "Chest (Mid/Lower Pectoralis Major & Triceps)",
        cue: "Arch lower back lightly, tuck elbows 45 degrees, explode upward off chest with full control.",
        equipment: "Barbell & Bench",
        targetSets: 4,
        targetReps: "8–10",
        startingWeightKg: 35,
        startingWeightGuide: "approximately 30–40 kg",
        isPrimaryCompound: true,
      },
      {
        id: "wed_incline_db_press",
        name: "Incline Dumbbell Press",
        muscle: "Chest (Upper Clavicular Pectoralis)",
        cue: "Set bench to 30 degrees incline, press dumbbells up with smooth arc, no elbow hyper-extension.",
        equipment: "Dumbbells & Incline Bench",
        targetSets: 3,
        targetReps: "8–12",
        startingWeightKg: 10,
        startingWeightGuide: "approximately 10–12 kg each",
        isPrimaryCompound: true,
      },
      {
        id: "wed_lateral_raises",
        name: "Lateral Raise",
        muscle: "Shoulders (Lateral Side Delts for Width)",
        cue: "Lead with elbows, pause for 0.5s at shoulder height without swinging torso.",
        equipment: "Dumbbells or Cable",
        targetSets: 4,
        targetReps: "12–15",
        startingWeightKg: 6,
        startingWeightGuide: "approximately 5–8 kg",
        isPrimaryCompound: true,
      },
      {
        id: "wed_overhead_press",
        name: "Overhead Press",
        muscle: "Shoulders (Anterior Deltoids & Triceps)",
        cue: "Stand tall, brace glutes and core, press barbell vertically past forehead to full extension.",
        equipment: "Barbell",
        targetSets: 3,
        targetReps: "8–10",
        startingWeightKg: 17.5,
        startingWeightGuide: "approximately 15–20 kg",
        isPrimaryCompound: true,
      },
      {
        id: "wed_rear_delt_work",
        name: "Rear-Delt Fly",
        muscle: "Shoulders (Posterior Delts)",
        cue: "Hinge at hips, pull dumbbells out and back with soft elbows, squeezing rear delts.",
        equipment: "Dumbbells or Cable",
        targetSets: 2,
        targetReps: "12–15",
        startingWeightKg: 5,
        startingWeightGuide: "approximately 4–6 kg",
        isOptional: true,
      },
    ],
    homeSubstitute: {
      location: "HOME",
      targetBodyParts: "Chest + Shoulders (Home Substitute)",
      focusBadges: ["Feet-Elevated Push-ups", "Push-up Progression", "Jar Lateral Raise", "Pike Push-ups"],
      description: "Complete home replacement for Wednesday targeting chest thickness and shoulder deltoid width.",
      equipmentSummary: "Bodyweight + 5L jar",
      exercises: [
        {
          id: "wed_sub_feet_elevated_pushups",
          name: "Feet-Elevated Push-ups",
          muscle: "Chest (Upper Clavicular Pectoralis)",
          cue: "Feet on chair/step; lower chest with controlled tempo, explosive press upward.",
          equipment: "Bodyweight / Chair",
          targetSets: 4,
          targetReps: "8–15",
          isPrimaryCompound: true,
        },
        {
          id: "wed_sub_pushup_progression",
          name: "Push-up Progression",
          muscle: "Chest (Mid Pectoralis Major)",
          cue: "Clean full depth push-ups, 2-second negative on every repetition.",
          equipment: "Bodyweight",
          targetSets: 3,
          targetReps: "12–15",
          isPrimaryCompound: true,
        },
        {
          id: "wed_sub_jar_lateral_raise",
          name: "Jar Lateral Raise",
          muscle: "Shoulders (Lateral Side Delts)",
          cue: "Lead with elbows, pause for 0.5s at shoulder height without swinging torso.",
          equipment: "5L Jar",
          targetSets: 4,
          targetReps: "12–15",
          isPrimaryCompound: true,
        },
        {
          id: "wed_sub_pike_pushups",
          name: "Pike Push-ups",
          muscle: "Shoulders (Anterior Deltoids Overhead)",
          cue: "Elevate hips high in A-frame; lower head toward hands under strict control.",
          equipment: "Bodyweight",
          targetSets: 3,
          targetReps: "8–12",
          isPrimaryCompound: true,
        },
      ],
    },
  },

  // THURSDAY — HOME: ACTIVE RECOVERY / LIGHT UPPER BODY
  4: {
    dayOfWeek: 4,
    dayName: "Thursday",
    location: "HOME",
    targetBodyParts: "Active Recovery / Light Upper Body",
    focusBadges: ["Active Recovery", "Light Intensity", "Blood Flow & Joint Mobility"],
    description: "Genuinely light recovery session to stimulate blood flow and recovery without creating systemic fatigue.",
    equipmentSummary: "Bodyweight + 5L jar",
    isRecovery: true,
    recoveryNotice: "ACTIVE RECOVERY · LIGHT INTENSITY · DO NOT TREAT THIS AS A HARD WORKOUT DAY",
    shortSessionExerciseIds: ["thu_pushups", "thu_jar_curls", "thu_plank"],
    exercises: [
      {
        id: "thu_pushups",
        name: "Push-ups",
        muscle: "Chest & Shoulders (Light Flush)",
        cue: "Moderate pace, smooth tempo, focus on joint lubrication and blood flow.",
        equipment: "Bodyweight",
        targetSets: 2,
        targetReps: "15",
      },
      {
        id: "thu_jar_curls",
        name: "Jar Curls",
        muscle: "Biceps (Blood Flow)",
        cue: "Light controlled contractions without approaching muscular failure.",
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
        targetReps: "45 seconds",
        targetDurationSeconds: 45,
        isTimed: true,
      },
    ],
  },

  // FRIDAY — GYM (with Complete Home Substitute): Back + Biceps
  5: {
    dayOfWeek: 5,
    dayName: "Friday",
    location: "GYM",
    targetBodyParts: "Back + Biceps",
    focusBadges: ["Pull-ups / Lat Pulldown", "Barbell Row", "Seated Cable Row", "Biceps Curl", "Hammer Curl"],
    description: "Gym pulling session for V-taper lat width, mid-back density, and bicep peaks.",
    equipmentSummary: "Barbell, Cable Machines, Pull-up Bar",
    shortSessionExerciseIds: ["fri_pullups_or_lat_pulldown", "fri_barbell_rows", "fri_bicep_curls"],
    exercises: [
      {
        id: "fri_pullups_or_lat_pulldown",
        name: "Pull-ups OR Lat Pulldown",
        muscle: "Back (Lats Width / 'Wings')",
        cue: "Drive elbows down to hips while keeping chest arched toward bar/cable. User selects executed variation.",
        equipment: "Pull-up Bar or Lat Pulldown Machine",
        targetSets: 4,
        targetReps: "8–10",
        startingWeightKg: 45,
        startingWeightGuide: "Lat pulldown starting guide: approximately 40–50 kg",
        variants: ["Pull-ups", "Lat Pulldown"],
        defaultVariant: "Lat Pulldown",
        isPrimaryCompound: true,
      },
      {
        id: "fri_barbell_rows",
        name: "Barbell Row",
        muscle: "Back (Mid-Back Thickness & Lower Lats)",
        cue: "Hinge at 45 degrees, pull barbell to lower navel, squeeze shoulder blades together.",
        equipment: "Barbell",
        targetSets: 4,
        targetReps: "8–10",
        startingWeightKg: 35,
        startingWeightGuide: "approximately 30–40 kg",
        isPrimaryCompound: true,
      },
      {
        id: "fri_seated_cable_row",
        name: "Seated Cable Row",
        muscle: "Back (Rhomboids, Middle Traps & Lats)",
        cue: "Sit tall, pull attachment to lower ribcage, 1-second squeeze with zero torso swing.",
        equipment: "Cable Row Machine",
        targetSets: 3,
        targetReps: "10–12",
        startingWeightKg: 30,
        startingWeightGuide: "approximately 30 kg",
      },
      {
        id: "fri_bicep_curls",
        name: "Biceps Curl",
        muscle: "Biceps (Inner/Outer Head Peaks)",
        cue: "Stationary elbows, supinate wrists at top, controlled 2-second negative.",
        equipment: "Dumbbells or Barbell",
        targetSets: 3,
        targetReps: "10–12",
        startingWeightKg: 10,
        startingWeightGuide: "approximately 10–12 kg",
        isPrimaryCompound: true,
      },
      {
        id: "fri_hammer_curls",
        name: "Hammer Curl",
        muscle: "Biceps & Forearms (Brachialis & Width)",
        cue: "Neutral grip with thumbs up; controlled descent for upper arm fullness.",
        equipment: "Dumbbells",
        targetSets: 3,
        targetReps: "10–12",
        startingWeightKg: 10,
        startingWeightGuide: "approximately 10 kg",
      },
    ],
    homeSubstitute: {
      location: "HOME",
      targetBodyParts: "Back + Biceps (Home Substitute)",
      focusBadges: ["Towel Rows", "Jar Rows", "Jar Curls", "Jar Hammer Curls"],
      description: "Complete home replacement for Friday targeting lat width, back thickness, and bicep hypertrophy.",
      equipmentSummary: "5L jar + towel / door anchor",
      exercises: [
        {
          id: "fri_sub_towel_rows",
          name: "Towel Rows",
          muscle: "Back (Lats Width & Upper Back)",
          cue: "Anchor towel around solid door, lean back at 45 degrees, pull chest smoothly to anchor.",
          equipment: "Towel + Door Anchor",
          targetSets: 4,
          targetReps: "8–15",
          safetyWarning: "⚠️ SAFETY INSTRUCTION: Ensure towel is securely knotted behind a locked/solid door before leaning. Verify door latch holds your full weight.",
          variants: ["Towel Rows", "Pull-ups (if safe bar exists)"],
          defaultVariant: "Towel Rows",
          isPrimaryCompound: true,
        },
        {
          id: "fri_sub_jar_rows",
          name: "Jar Rows",
          muscle: "Back (Mid-Back Thickness)",
          cue: "Hinge at hips, row 5L jar to lower ribs, squeeze lats and shoulder blades.",
          equipment: "5L Jar",
          targetSets: 4,
          targetReps: "12–20",
          isPrimaryCompound: true,
        },
        {
          id: "fri_sub_jar_curls",
          name: "Jar Curls",
          muscle: "Biceps (Biceps Brachii)",
          cue: "Strict form, pin elbows to sides, supinate wrist at peak squeeze.",
          equipment: "5L Jar",
          targetSets: 3,
          targetReps: "12–20",
          isPrimaryCompound: true,
        },
        {
          id: "fri_sub_jar_hammer_curls",
          name: "Jar Hammer Curls",
          muscle: "Biceps & Forearms (Brachialis)",
          cue: "Neutral grip thumbs up; slow negative descent for forearm and arm thickness.",
          equipment: "5L Jar",
          targetSets: 3,
          targetReps: "12–20",
          isPrimaryCompound: true,
        },
      ],
    },
  },

  // SATURDAY — GYM (with Complete Home Substitute): Triceps + Arms + Forearms
  6: {
    dayOfWeek: 6,
    dayName: "Saturday",
    location: "GYM",
    targetBodyParts: "Triceps + Arms + Forearms",
    focusBadges: ["Dips", "Rope Pushdown", "Overhead Triceps Extension", "Wrist Curl"],
    description: "Dedicated arm hypertrophy focusing on tricep long/lateral heads, grip strength, and forearm density.",
    equipmentSummary: "Dip Bar, Cable Crossover, Dumbbells / Barbell",
    shortSessionExerciseIds: ["sat_dips", "sat_rope_pushdowns", "sat_overhead_tricep_ext"],
    exercises: [
      {
        id: "sat_dips",
        name: "Dips",
        muscle: "Triceps (Long & Lateral Heads) & Lower Chest",
        cue: "Stay upright to emphasize triceps, lower to 90 degrees elbow bend and lockout at top.",
        equipment: "Dip Bar / Parallel Bars",
        targetSets: 3,
        targetReps: "8–12",
        isPrimaryCompound: true,
      },
      {
        id: "sat_rope_pushdowns",
        name: "Rope Pushdown",
        muscle: "Triceps (Lateral Horseshoe Head)",
        cue: "Lock elbows to sides, spread rope apart forcefully at bottom contraction.",
        equipment: "Cable & Rope",
        targetSets: 3,
        targetReps: "10–15",
        startingWeightKg: 17.5,
        startingWeightGuide: "approximately 15–20 kg",
        isPrimaryCompound: true,
      },
      {
        id: "sat_overhead_tricep_ext",
        name: "Overhead Triceps Extension",
        muscle: "Triceps (Long Head / Overall Thickness)",
        cue: "Full deep stretch behind head, keep elbows tucked, extend straight upward.",
        equipment: "Dumbbell or Cable",
        targetSets: 3,
        targetReps: "10–15",
        startingWeightKg: 10,
        startingWeightGuide: "approximately 10 kg",
        isPrimaryCompound: true,
      },
      {
        id: "sat_wrist_curls",
        name: "Wrist Curl",
        muscle: "Forearms (Flexors & Grip Power)",
        cue: "Rest forearms on bench/thighs, curl weight up using wrists only, pause at top.",
        equipment: "Barbell or Dumbbell",
        targetSets: 3,
        targetReps: "12–20",
        startingWeightKg: 5,
        startingWeightGuide: "approximately 5 kg",
      },
      {
        id: "sat_hammer_curl_opt",
        name: "Hammer Curl (Arm Volume)",
        muscle: "Biceps & Brachialis",
        cue: "Neutral grip strict curls for additional arm volume if needed.",
        equipment: "Dumbbells",
        targetSets: 2,
        targetReps: "10–12",
        startingWeightKg: 10,
        startingWeightGuide: "approximately 10 kg",
        isOptional: true,
      },
    ],
    homeSubstitute: {
      location: "HOME",
      targetBodyParts: "Triceps + Arms + Forearms (Home Substitute)",
      focusBadges: ["Diamond Push-ups", "Bench/Chair Dips", "Jar Overhead Extension", "Jar Wrist Curls"],
      description: "Complete home replacement for Saturday targeting triceps lockout, long head thickness, and forearms.",
      equipmentSummary: "Bodyweight + 5L jar + chair",
      exercises: [
        {
          id: "sat_sub_diamond_pushups",
          name: "Diamond Push-ups",
          muscle: "Triceps (Lockout Horseshoe)",
          cue: "Thumbs and index fingers touching under sternum; slow controlled descent.",
          equipment: "Bodyweight",
          targetSets: 3,
          targetReps: "10–15",
          isPrimaryCompound: true,
        },
        {
          id: "sat_sub_chair_dips",
          name: "Bench/Chair Dips (if safe)",
          muscle: "Triceps (All Heads)",
          cue: "Hands on stable chair/bench, lower body to 90 degrees elbow bend, press up to lockout.",
          equipment: "Sturdy Chair / Bench",
          targetSets: 3,
          targetReps: "8–12",
          safetyWarning: "⚠️ SAFETY INSTRUCTION: Ensure chair or bench is sturdy, weighted, and cannot slide on the floor.",
          isPrimaryCompound: true,
        },
        {
          id: "sat_sub_jar_overhead_ext",
          name: "Jar Overhead Extension",
          muscle: "Triceps (Long Head)",
          cue: "Hold 5L jar overhead with both hands, lower behind head, extend straight up.",
          equipment: "5L Jar",
          targetSets: 3,
          targetReps: "10–15",
          isPrimaryCompound: true,
        },
        {
          id: "sat_sub_jar_wrist_curls",
          name: "Jar Wrist Curls",
          muscle: "Forearms (Grip & Flexors)",
          cue: "Rest forearm on thigh/table, curl 5L jar up using wrist flexion only.",
          equipment: "5L Jar",
          targetSets: 3,
          targetReps: "12–20",
        },
      ],
    },
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
 * Deload Week Evaluator:
 * Every 6th week is designated as a strategic deload week reducing total volume by ~40%.
 */
export function isDeloadWeek(weekNumber: number): boolean {
  return weekNumber > 0 && weekNumber % 6 === 0;
}

/**
 * Returns muscle info, cue, and safety warnings for any exercise name.
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
    if (day.homeSubstitute) {
      for (const ex of day.homeSubstitute.exercises) {
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
  }

  // Check Core A & B
  for (const core of [...CORE_ROUTINE_A.exercises, ...CORE_ROUTINE_B.exercises]) {
    if (core.name.toLowerCase() === lower || core.id.toLowerCase() === lower) {
      return {
        muscle: "Abdominals & Core Stability",
        cue: core.cue,
      };
    }
  }

  return {
    muscle: "Target Muscle Group",
    cue: "Maintain controlled form, clean technique, and progressive tension throughout the movement.",
  };
}

/**
 * Progressive Overload Evaluator:
 * Identifies when the user hit the top of their target rep range consistently.
 * Generates a non-intrusive recommendation badge. NEVER modifies actual weights in the database.
 */
export function getProgressiveOverloadSuggestion(
  exerciseName: string,
  lastSets?: Array<{ weightKg?: number | string | null; reps?: number | string | null; completed?: boolean }>,
  targetReps?: string
): { isReady: boolean; suggestion: string } | null {
  if (!lastSets || lastSets.length === 0) return null;

  const allCompleted = lastSets.every((s) => s.completed);
  if (!allCompleted) return null;

  const weights = lastSets
    .map((s) => Number(s.weightKg))
    .filter((w) => Number.isFinite(w) && w > 0);

  const repNumbers = lastSets.map((s) => Number(s.reps)).filter((r) => Number.isFinite(r) && r > 0);
  if (repNumbers.length === 0) return null;

  const avgReps = repNumbers.reduce((a, b) => a + b, 0) / repNumbers.length;
  const targetTop = targetReps ? Number(targetReps.split(/[–-]/).pop()?.trim()) || 10 : 10;

  // If hitting the top of rep range consistently across all sets:
  if (avgReps >= targetTop) {
    if (weights.length > 0) {
      const currentWeight = weights[0];
      const suggestedIncrease = currentWeight >= 30 ? 2.5 : 1.25;
      return {
        isReady: true,
        suggestion: `PROGRESSION READY · You hit the top rep target (${targetTop} reps). Consider testing a +${suggestedIncrease} kg increase next session if form remains strict.`,
      };
    } else {
      // Home / Bodyweight progression
      return {
        isReady: true,
        suggestion: `PROGRESSION READY · Top reps achieved! Progress by adding 2–3 reps, slowing the eccentric to 3 seconds, or pausing 1s at peak contraction.`,
      };
    }
  }

  return null;
}

