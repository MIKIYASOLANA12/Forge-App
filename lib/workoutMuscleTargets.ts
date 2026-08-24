export interface MuscleTargetInfo {
  primaryBodyParts: string;
  focusBadges: string[];
  description: string;
}

export const WORKOUT_DAY_TARGETS: Record<string, MuscleTargetInfo> = {
  Push: {
    primaryBodyParts: "Chest, Shoulders & Triceps",
    focusBadges: ["Upper & Mid Chest", "Front & Side Deltoids", "Triceps (Horseshoe & Long Head)"],
    description: "Heavy horizontal and vertical pressing targeting pectoral mass, shoulder cap width, and triceps lockout strength.",
  },
  Pull: {
    primaryBodyParts: "Back (Wings), Biceps & Rear Delts",
    focusBadges: ["Lats Width (Wings)", "Mid-Back & Traps", "Biceps Peaks", "Rear Deltoids & Forearms"],
    description: "Vertical and horizontal pulling targeting V-taper lat width, upper back thickness, and bicep peak development.",
  },
  LegsCore: {
    primaryBodyParts: "Legs (Quads, Hamstrings, Glutes) & Core/Abs",
    focusBadges: ["Quadriceps & Glutes", "Hamstrings & Calves", "Upper/Lower Abs", "Obliques & Core Bracing"],
    description: "Lower body compound power, knee stability, and rotational/isometric abdominal strength.",
  },
  ArmsShoulders: {
    primaryBodyParts: "Biceps, Chest & Shoulders",
    focusBadges: ["Biceps (Peak & Thickness)", "Upper & Mid Chest", "Shoulder Caps (Delts)", "Triceps Horseshoe"],
    description: "Upper body hypertrophy focus emphasizing arm size, chest shelf thickness, and 3D shoulder roundness.",
  },
};

export const EXERCISE_MUSCLE_MAP: Record<string, { muscle: string; cue: string }> = {
  // Push Exercises
  "Dumbbell Shoulder Press": {
    muscle: "Shoulders (Anterior Deltoids & Triceps)",
    cue: "Press straight up, touch dumbbells softly at top without locking elbows.",
  },
  "Cable Lateral Raises (cable crossover)": {
    muscle: "Shoulders (Lateral Side Delts for Width)",
    cue: "Lead with your elbows and pause for 0.5s at shoulder height.",
  },
  "Barbell Bench Press": {
    muscle: "Chest (Mid/Lower Pectoralis Major)",
    cue: "Arch lower back lightly, tuck elbows 45 degrees, explode upward off chest.",
  },
  "Pec Deck Machine": {
    muscle: "Chest (Inner Squeeze & Cleavage)",
    cue: "Keep slight bend in elbows and focus on squeezing pec fibers together.",
  },
  "Cable Tricep Pushdown (cable crossover)": {
    muscle: "Triceps (Lateral Head 'Horseshoe')",
    cue: "Lock elbows to your ribs, flare wrists outward at the bottom contraction.",
  },
  "Overhead Tricep Extension (EZ-bar or cable)": {
    muscle: "Triceps (Long Head / Arm Thickness)",
    cue: "Full deep stretch behind your head, extend arms fully to the ceiling.",
  },

  // Pull Exercises
  "Lat Pulldown (wide grip)": {
    muscle: "Back (Lats Width / 'Wings')",
    cue: "Pull through your elbows down to your collarbone while arching upper chest.",
  },
  "Cable Row": {
    muscle: "Back (Mid-Back Thickness & Lower Lats)",
    cue: "Pull handles to your navel, squeeze shoulder blades together at peak.",
  },
  "Hammer Strength Row": {
    muscle: "Back (Upper Traps, Rhomboids & Teres Major)",
    cue: "Full stretch forward on the eccentric, drive elbows back hard.",
  },
  "Face Pulls (cable crossover)": {
    muscle: "Shoulders (Rear Delts) & Upper Traps",
    cue: "Pull rope to eye level, rotating hands backward to target rear delts.",
  },
  "EZ-Bar Bicep Curl": {
    muscle: "Biceps (Inner/Outer Head Peak & Power)",
    cue: "Keep elbows stationary, supinate wrists and squeeze biceps at top.",
  },
  "Hammer Curl": {
    muscle: "Biceps (Brachialis & Forearm Thickness)",
    cue: "Neutral grip with palms facing each other, control the descent.",
  },

  // Legs & Core Exercises
  "Barbell Squat": {
    muscle: "Legs (Quadriceps, Glutes & Adductors)",
    cue: "Brace core 360 degrees, break at hips and knees, drive through mid-foot.",
  },
  "Hammer Strength Leg Press": {
    muscle: "Legs (Quadriceps Sweep & Hamstrings)",
    cue: "Feet shoulder-width on platform, descend until 90-degree knee bend.",
  },
  "Ab Crunch Machine": {
    muscle: "Abs (Rectus Abdominis / 6-Pack)",
    cue: "Crunch ribcage down toward pelvis, exhale on the contraction.",
  },
  "Hanging Knee Raises (pull-up bar)": {
    muscle: "Abs (Lower Abs & Hip Flexors)",
    cue: "Curl your pelvis up toward your chest, avoid swinging.",
  },
  "Dip Bar L-Sit Hold": {
    muscle: "Core (Isometric Core & Serratus Strength)",
    cue: "Lock arms straight, hold legs parallel to ground with toes pointed.",
  },
  "Cable Woodchop (cable crossover)": {
    muscle: "Core (Obliques & Rotational Power)",
    cue: "Pivot back foot, rotate torso with arms extended across the body.",
  },
};

export function getExerciseMuscleInfo(name: string) {
  return EXERCISE_MUSCLE_MAP[name] || {
    muscle: "Target Muscle Group",
    cue: "Maintain controlled form and progressive tension throughout the range of motion.",
  };
}
