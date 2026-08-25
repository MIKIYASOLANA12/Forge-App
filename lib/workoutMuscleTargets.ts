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

export interface ExerciseDefinition {
  name: string;
  muscle: string;
  cue: string;
  equipment: "GYM" | "HOME";
}

export const PROTOCOL_EXERCISES: Record<"GYM" | "HOME", Record<string, ExerciseDefinition[]>> = {
  GYM: {
    Push: [
      {
        name: "Barbell Bench Press",
        muscle: "Chest (Mid/Lower Pectoralis Major)",
        cue: "Arch lower back lightly, tuck elbows 45 degrees, explode upward off chest.",
        equipment: "GYM",
      },
      {
        name: "Dumbbell Shoulder Press",
        muscle: "Shoulders (Anterior Deltoids & Triceps)",
        cue: "Press straight up, touch dumbbells softly at top without locking elbows.",
        equipment: "GYM",
      },
      {
        name: "Cable Lateral Raises (cable crossover)",
        muscle: "Shoulders (Lateral Side Delts for Width)",
        cue: "Lead with your elbows and pause for 0.5s at shoulder height.",
        equipment: "GYM",
      },
      {
        name: "Pec Deck Machine",
        muscle: "Chest (Inner Squeeze & Cleavage)",
        cue: "Keep slight bend in elbows and focus on squeezing pec fibers together.",
        equipment: "GYM",
      },
      {
        name: "Cable Tricep Pushdown (cable crossover)",
        muscle: "Triceps (Lateral Head 'Horseshoe')",
        cue: "Lock elbows to your ribs, flare wrists outward at the bottom contraction.",
        equipment: "GYM",
      },
      {
        name: "Overhead Tricep Extension (EZ-bar or cable)",
        muscle: "Triceps (Long Head / Arm Thickness)",
        cue: "Full deep stretch behind your head, extend arms fully to the ceiling.",
        equipment: "GYM",
      },
    ],
    Pull: [
      {
        name: "Lat Pulldown (wide grip)",
        muscle: "Back (Lats Width / 'Wings')",
        cue: "Pull through your elbows down to your collarbone while arching upper chest.",
        equipment: "GYM",
      },
      {
        name: "Cable Row",
        muscle: "Back (Mid-Back Thickness & Lower Lats)",
        cue: "Pull handles to your navel, squeeze shoulder blades together at peak.",
        equipment: "GYM",
      },
      {
        name: "Hammer Strength Row",
        muscle: "Back (Upper Traps, Rhomboids & Teres Major)",
        cue: "Full stretch forward on the eccentric, drive elbows back hard.",
        equipment: "GYM",
      },
      {
        name: "Face Pulls (cable crossover)",
        muscle: "Shoulders (Rear Delts) & Upper Traps",
        cue: "Pull rope to eye level, rotating hands backward to target rear delts.",
        equipment: "GYM",
      },
      {
        name: "EZ-Bar Bicep Curl",
        muscle: "Biceps (Inner/Outer Head Peak & Power)",
        cue: "Keep elbows stationary, supinate wrists and squeeze biceps at top.",
        equipment: "GYM",
      },
      {
        name: "Hammer Curl",
        muscle: "Biceps (Brachialis & Forearm Thickness)",
        cue: "Neutral grip with palms facing each other, control the descent.",
        equipment: "GYM",
      },
    ],
    LegsCore: [
      {
        name: "Barbell Squat",
        muscle: "Legs (Quadriceps, Glutes & Adductors)",
        cue: "Brace core 360 degrees, break at hips and knees, drive through mid-foot.",
        equipment: "GYM",
      },
      {
        name: "Hammer Strength Leg Press",
        muscle: "Legs (Quadriceps Sweep & Hamstrings)",
        cue: "Feet shoulder-width on platform, descend until 90-degree knee bend.",
        equipment: "GYM",
      },
      {
        name: "Ab Crunch Machine",
        muscle: "Abs (Rectus Abdominis / 6-Pack)",
        cue: "Crunch ribcage down toward pelvis, exhale on the contraction.",
        equipment: "GYM",
      },
      {
        name: "Hanging Knee Raises (pull-up bar)",
        muscle: "Abs (Lower Abs & Hip Flexors)",
        cue: "Curl your pelvis up toward your chest, avoid swinging.",
        equipment: "GYM",
      },
      {
        name: "Dip Bar L-Sit Hold",
        muscle: "Core (Isometric Core & Serratus Strength)",
        cue: "Lock arms straight, hold legs parallel to ground with toes pointed.",
        equipment: "GYM",
      },
      {
        name: "Cable Woodchop (cable crossover)",
        muscle: "Core (Obliques & Rotational Power)",
        cue: "Pivot back foot, rotate torso with arms extended across the body.",
        equipment: "GYM",
      },
    ],
  },
  HOME: {
    Push: [
      {
        name: "Feet-Elevated Decline Push-Ups",
        muscle: "Chest (Upper Pectorals & Front Delts)",
        cue: "Place feet on chair or bed, lower chest slowly to floor and explode up.",
        equipment: "HOME",
      },
      {
        name: "Pike Push-Ups (or Wall Handstand Press)",
        muscle: "Shoulders (Anterior Deltoids & Overhead Power)",
        cue: "Elevate hips in an A-frame, lower head between hands, press through shoulders.",
        equipment: "HOME",
      },
      {
        name: "Dumbbell / Water-Bottle Lateral Raises",
        muscle: "Shoulders (Lateral Side Delts for Width)",
        cue: "Lead with your elbows, pause for 1 second at shoulder height with zero swing.",
        equipment: "HOME",
      },
      {
        name: "Diamond Push-Ups (or Chair Tricep Dips)",
        muscle: "Triceps (Horseshoe Lateral Head & Inner Chest)",
        cue: "Keep elbows tucked tight to ribs, squeeze triceps hard at lockout.",
        equipment: "HOME",
      },
      {
        name: "Overhead Dumbbell / Backpack Tricep Extension",
        muscle: "Triceps (Long Head / Arm Thickness)",
        cue: "Full deep stretch behind head, extend arms fully to ceiling.",
        equipment: "HOME",
      },
      {
        name: "Floor Isometric Squeeze Press / Floor Flyes",
        muscle: "Chest (Inner Pec Squeeze & Cleavage)",
        cue: "Lie on floor, press weights while driving palms inward with maximum tension.",
        equipment: "HOME",
      },
    ],
    Pull: [
      {
        name: "Doorframe / Towel Inverted Rows",
        muscle: "Back (Lats Width / 'Wings' & Upper Back)",
        cue: "Anchor towel around sturdy door or frame, lean back and pull chest to door.",
        equipment: "HOME",
      },
      {
        name: "Prone Cobra / Floor Y-T-W Raises",
        muscle: "Back (Upper Traps, Rhomboids & Posterior Chain)",
        cue: "Lie face down, lift chest, thumbs up to ceiling, squeeze shoulder blades.",
        equipment: "HOME",
      },
      {
        name: "Dumbbell / Backpack / Resistance Band Bicep Curls",
        muscle: "Biceps (Inner/Outer Peak & Strength)",
        cue: "Elbows pinned to sides, supinate wrists and squeeze biceps at peak contraction.",
        equipment: "HOME",
      },
      {
        name: "Hammer Curls (Dumbbell or Loaded Backpack)",
        muscle: "Biceps (Brachialis & Forearm Thickness)",
        cue: "Palms facing inward, slow 3-second negative descent on every rep.",
        equipment: "HOME",
      },
      {
        name: "Bent-Over Rear Delt Flyes",
        muscle: "Shoulders (Rear Deltoids & Upper Back)",
        cue: "Hinge at hips with flat back, fly arms out wide squeezing rear delts.",
        equipment: "HOME",
      },
      {
        name: "Superman Lat Pulls (Floor Lat Drive)",
        muscle: "Back (Lower Lats Width & Serratus)",
        cue: "Lie on stomach, reach arms overhead and pull elbows back to ribs squeezing lats.",
        equipment: "HOME",
      },
    ],
    LegsCore: [
      {
        name: "Bulgarian Split Squats (Rear Foot on Chair)",
        muscle: "Legs (Quadriceps Power & Glute Mass)",
        cue: "Elevate back foot on chair, descend until front thigh is parallel to floor.",
        equipment: "HOME",
      },
      {
        name: "Bodyweight / Dumbbell Goblet Squats",
        muscle: "Legs (Quadriceps Sweep & Adductors)",
        cue: "Break at hips and knees simultaneously, deep squat with chest tall.",
        equipment: "HOME",
      },
      {
        name: "Single-Leg Glute Bridges / Romanian Deadlifts",
        muscle: "Legs (Hamstrings & Glute Maximum)",
        cue: "Drive heel into floor, bridge hips up and lock glutes at the top.",
        equipment: "HOME",
      },
      {
        name: "Bicycle Crunches & Deadbugs",
        muscle: "Abs (Rectus Abdominis & Rotational Core)",
        cue: "Opposite elbow to opposite knee, slow controlled burn with lower back flat.",
        equipment: "HOME",
      },
      {
        name: "Lying Leg Raises / Reverse Crunches",
        muscle: "Abs (Lower 6-Pack & Hip Flexors)",
        cue: "Keep lower back glued to floor, raise legs to 90 degrees and curl pelvis.",
        equipment: "HOME",
      },
      {
        name: "Plank to Shoulder Taps & Side Planks",
        muscle: "Core (Obliques & Deep 360 Core Bracing)",
        cue: "Brace core tight with zero hip rotation while alternating shoulder taps.",
        equipment: "HOME",
      },
    ],
  },
};

export function getProtocolExercises(type: string, location: "GYM" | "HOME"): ExerciseDefinition[] {
  const normType = type === "LegsCore" ? "LegsCore" : type === "Pull" ? "Pull" : "Push";
  const locKey = location === "GYM" ? "GYM" : "HOME";
  return PROTOCOL_EXERCISES[locKey][normType] || PROTOCOL_EXERCISES[locKey]["Push"];
}

export function getExerciseMuscleInfo(name: string) {
  // Search across both GYM and HOME
  for (const loc of ["GYM", "HOME"] as const) {
    for (const type of ["Push", "Pull", "LegsCore"] as const) {
      const found = PROTOCOL_EXERCISES[loc][type].find(
        (ex) => ex.name.toLowerCase() === name.toLowerCase()
      );
      if (found) {
        return { muscle: found.muscle, cue: found.cue };
      }
    }
  }

  return {
    muscle: "Target Muscle Group",
    cue: "Maintain controlled form and progressive tension throughout the range of motion.",
  };
}
