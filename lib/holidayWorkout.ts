/**
 * FORGE — 16-DAY GRANDMOTHER-HOUSE HOME WORKOUT SYSTEM
 * Exact Day-by-Day Bodyweight Protocol (August 31, 2026 – September 15, 2026)
 * Focused on Chest, Core, Abs, Lower Abs, and Obliques.
 */
import { toAddisDateString, getAddisNow } from './workoutTime';

export interface HolidayExercise {
  name: string;
  target: string;
  sets: number;
  reps: string;
  notes?: string;
  targetMuscle?: string;
  masterCue?: string;
}

export interface HolidayWorkoutDay {
  dayNumber: number; // 1..16
  title: string;
  focus: string;
  targetBodyParts: string;
  focusBadges: string[];
  description: string;
  isRest: boolean;
  exercises: HolidayExercise[];
}

export const HOLIDAY_START_DATE_KEY = '2026-08-31';
export const HOLIDAY_DURATION_DAYS = 16;

export const HOLIDAY_ROUTINES: Record<number, HolidayWorkoutDay> = {
  1: {
    dayNumber: 1,
    title: 'Day 1 — Chest + Abs',
    focus: 'Chest & Core Overload',
    targetBodyParts: 'Chest, Upper Abs, Lower Abs, Core',
    focusBadges: ['Chest Volume', 'Core Stability', 'Bodyweight Overload'],
    description: 'High volume push-up variations combined with reverse crunches, leg raises, and plank stability.',
    isRest: false,
    exercises: [
      { name: 'Standard Push-ups', target: 'Chest & Triceps', sets: 4, reps: '15–20 reps', notes: 'Full chest depth, squeeze at top' },
      { name: 'Wide Push-ups', target: 'Outer Chest & Shoulders', sets: 3, reps: '12–15 reps', notes: 'Hands wider than shoulder-width' },
      { name: 'Diamond Push-ups', target: 'Inner Chest & Triceps', sets: 3, reps: '10–15 reps', notes: 'Index fingers and thumbs touching' },
      { name: 'Reverse Crunches', target: 'Lower Abs', sets: 3, reps: '15 reps', notes: 'Control the pelvic tilt, do not swing' },
      { name: 'Leg Raises', target: 'Lower Abs', sets: 3, reps: '12–15 reps', notes: 'Lower legs slowly without arching lower back' },
      { name: 'Plank Hold', target: 'Full Core', sets: 3, reps: '40–60 seconds', notes: 'Glutes clenched, ribcage pulled down' },
    ],
  },
  2: {
    dayNumber: 2,
    title: 'Day 2 — Core + Obliques',
    focus: 'Rotational Strength & Side Abs',
    targetBodyParts: 'Obliques, Rotational Core, Lower Abs',
    focusBadges: ['Obliques & Sides', 'Rotational Power', 'V-Taper Core'],
    description: 'Targeted rotational and side-abdominal work to tighten the waist and build razor-sharp obliques.',
    isRest: false,
    exercises: [
      { name: 'Bicycle Crunches', target: 'Obliques & Upper Abs', sets: 4, reps: '20 total reps', notes: 'Elbow to opposite knee with controlled rotation' },
      { name: 'Russian Twists', target: 'Obliques', sets: 3, reps: '20 total reps', notes: 'Feet elevated or heels lightly touching floor' },
      { name: 'Reverse Crunches', target: 'Lower Abs', sets: 4, reps: '15 reps', notes: 'Smooth curling motion' },
      { name: 'Side Plank', target: 'Lateral Core & Obliques', sets: 3, reps: '30–45s each side', notes: 'Straight body line from ankles to shoulders' },
      { name: 'Mountain Climbers', target: 'Core Conditioning', sets: 3, reps: '30 seconds', notes: 'Fast controlled knee drives in plank' },
      { name: 'Plank Hold', target: 'Full Core', sets: 3, reps: '45–60 seconds', notes: 'Breathe steadily while maintaining tension' },
    ],
  },
  3: {
    dayNumber: 3,
    title: 'Day 3 — Chest Hypertrophy',
    focus: 'Pure Chest Development',
    targetBodyParts: 'Upper Chest, Lower Chest, Triceps',
    focusBadges: ['Incline & Decline', 'Inner Chest', 'Pectoral Density'],
    description: 'Multi-angle bodyweight chest stimulus incorporating decline push-ups, wide grip, and slow eccentrics.',
    isRest: false,
    exercises: [
      { name: 'Standard Push-ups', target: 'Mid Chest', sets: 4, reps: '15–20 reps', notes: 'Solid cadence' },
      { name: 'Decline Push-ups', target: 'Upper Chest', sets: 3, reps: '10–15 reps', notes: 'Elevate feet on a sturdy chair or step' },
      { name: 'Wide Push-ups', target: 'Outer Chest', sets: 3, reps: '12–15 reps', notes: 'Stretch deep at the bottom' },
      { name: 'Diamond Push-ups', target: 'Inner Chest', sets: 3, reps: '10–15 reps', notes: 'Lock out triceps with control' },
      { name: 'Slow Tempo Push-ups', target: 'Time Under Tension', sets: 2, reps: '8–12 reps', notes: '3-second negative, 1-second pause at bottom' },
      { name: 'Plank Hold', target: 'Core Finisher', sets: 3, reps: '45–60 seconds', notes: 'Finish strong with full core brace' },
    ],
  },
  4: {
    dayNumber: 4,
    title: 'Day 4 — Abs + Lower Abs Focus',
    focus: 'Lower Abdominal & Hip Flexor Control',
    targetBodyParts: 'Lower Abs, Hip Flexors, Deep Transverse Abdominis',
    focusBadges: ['Lower Ab Flatness', 'Pelvic Control', 'Abdominal Density'],
    description: 'Intense lower abdominal isolation to carve the lower belly and build deep core endurance.',
    isRest: false,
    exercises: [
      { name: 'Leg Raises', target: 'Lower Abs', sets: 4, reps: '12–15 reps', notes: 'Keep lumbar spine flush against floor' },
      { name: 'Reverse Crunches', target: 'Lower Abs', sets: 4, reps: '15 reps', notes: 'Lift hips off the floor, do not swing' },
      { name: 'Heel Touches', target: 'Obliques & Upper Abs', sets: 3, reps: '20 total reps', notes: 'Reach side to side touching heels' },
      { name: 'Bicycle Crunches', target: 'Cross Core', sets: 3, reps: '20 total reps', notes: 'Full extension of opposite leg' },
      { name: 'Flutter Kicks', target: 'Lower Abs & Hip Flexors', sets: 3, reps: '30 seconds', notes: 'Small crisp kicks 6 inches off ground' },
      { name: 'Plank Hold', target: 'Isometric Core', sets: 3, reps: '60 seconds', notes: 'Maximal abdominal tension' },
    ],
  },
  5: {
    dayNumber: 5,
    title: 'Day 5 — Chest + Core Compound',
    focus: 'Upper Body Density & Abdominal Balance',
    targetBodyParts: 'Chest, Upper Chest, Lower Abs, Core',
    focusBadges: ['Chest Density', 'Upper Chest Elevation', 'Compound Core'],
    description: 'Comprehensive chest session with decline and diamond variations paired with leg raises and plank hold.',
    isRest: false,
    exercises: [
      { name: 'Standard Push-ups', target: 'Chest', sets: 4, reps: '15–20 reps', notes: 'Crisp rhythm' },
      { name: 'Diamond Push-ups', target: 'Inner Chest', sets: 3, reps: '10–15 reps', notes: 'Elbows tight to ribs' },
      { name: 'Wide Push-ups', target: 'Outer Chest', sets: 3, reps: '12–15 reps', notes: 'Wide foundation' },
      { name: 'Decline Push-ups', target: 'Upper Chest', sets: 3, reps: '10–15 reps', notes: 'Feet on chair, upper chest focus' },
      { name: 'Leg Raises', target: 'Lower Abs', sets: 3, reps: '15 reps', notes: 'Strict form without momentum' },
      { name: 'Plank Hold', target: 'Core', sets: 3, reps: '60 seconds', notes: 'Full body brace' },
    ],
  },
  6: {
    dayNumber: 6,
    title: 'Day 6 — Active Recovery + Light Abs',
    focus: 'Active Recovery & Core Mobility',
    targetBodyParts: 'Abs, Obliques, Posture',
    focusBadges: ['Active Recovery', 'Mobility', 'Core Refresh'],
    description: 'Lighter recovery day to allow pectoral recovery while keeping abdominal muscle tone and posture active.',
    isRest: false,
    exercises: [
      { name: 'Standard Crunches', target: 'Upper Abs', sets: 3, reps: '20 reps', notes: 'Curl ribcage toward pelvis' },
      { name: 'Reverse Crunches', target: 'Lower Abs', sets: 3, reps: '15 reps', notes: 'Light smooth movement' },
      { name: 'Side Plank', target: 'Lateral Core', sets: 2, reps: '30–45s each side', notes: 'Breathe steadily' },
      { name: 'Plank Hold', target: 'Core', sets: 2, reps: '45 seconds', notes: 'Light brace' },
      { name: 'Light Walking / Stretching', target: 'Recovery & Bloodflow', sets: 1, reps: '10–20 minutes', notes: 'Relaxed walking, posture and mobility work' },
    ],
  },
  7: {
    dayNumber: 7,
    title: 'Day 7 — Chest + Abs Peak',
    focus: 'Week 1 Peak Volume',
    targetBodyParts: 'Entire Chest, Rectus Abdominis',
    focusBadges: ['Peak Volume', 'Pectoral Endurance', '6-Pack Definition'],
    description: 'End of Week 1 high-volume chest and core routine with strict 20-rep standard sets.',
    isRest: false,
    exercises: [
      { name: 'Standard Push-ups', target: 'Chest', sets: 4, reps: '20 reps', notes: 'Target full 20 clean reps' },
      { name: 'Wide Push-ups', target: 'Outer Chest', sets: 3, reps: '15 reps', notes: 'Deep stretch' },
      { name: 'Diamond Push-ups', target: 'Inner Chest', sets: 3, reps: '12 reps', notes: 'Squeeze inner pecs' },
      { name: 'Decline Push-ups', target: 'Upper Chest', sets: 3, reps: '12 reps', notes: 'Feet on chair' },
      { name: 'Leg Raises', target: 'Lower Abs', sets: 4, reps: '15 reps', notes: 'Clean leg drive' },
      { name: 'Reverse Crunches', target: 'Lower Abs', sets: 3, reps: '15 reps', notes: 'Pelvic curl' },
      { name: 'Plank Hold', target: 'Core', sets: 3, reps: '60 seconds', notes: 'Solid lock' },
    ],
  },
  8: {
    dayNumber: 8,
    title: 'Day 8 — Rest & Regeneration',
    focus: 'Full Recovery & Muscle Rebuilding',
    targetBodyParts: 'Full Body Regeneration',
    focusBadges: ['Rest Day', 'Systemic Recovery', 'Tissue Rebuilding'],
    description: 'Dedicated rest day. No heavy training. Walking, light stretching, and posture mobility are recommended.',
    isRest: true,
    exercises: [
      { name: 'Light Walking (Optional)', target: 'Cardiovascular Health', sets: 1, reps: '15–30 minutes', notes: 'Pleasant walk' },
      { name: 'Full Body Mobility & Stretching (Optional)', target: 'Flexibility', sets: 1, reps: '10–15 minutes', notes: 'Chest open stretches & spine decompression' },
    ],
  },
  9: {
    dayNumber: 9,
    title: 'Day 9 — Chest + Abs Progression',
    focus: 'Week 2 Chest Progression',
    targetBodyParts: 'Chest, Upper & Lower Abs',
    focusBadges: ['Volume Progression', 'Lower Ab Density', 'Upper Body Shape'],
    description: 'Resuming Week 2 with elevated volume across decline, diamond, and multi-set ab curls.',
    isRest: false,
    exercises: [
      { name: 'Standard Push-ups', target: 'Chest', sets: 4, reps: '20 reps', notes: 'Strong locked cadence' },
      { name: 'Wide Push-ups', target: 'Outer Chest', sets: 3, reps: '15 reps', notes: 'Full range' },
      { name: 'Diamond Push-ups', target: 'Inner Chest', sets: 3, reps: '12–15 reps', notes: 'Strict form' },
      { name: 'Decline Push-ups', target: 'Upper Chest', sets: 3, reps: '12–15 reps', notes: 'Feet elevated' },
      { name: 'Leg Raises', target: 'Lower Abs', sets: 4, reps: '15 reps', notes: 'High control' },
      { name: 'Reverse Crunches', target: 'Lower Abs', sets: 4, reps: '15 reps', notes: 'Crisp curls' },
      { name: 'Plank Hold', target: 'Core', sets: 3, reps: '60 seconds', notes: 'Unbroken hold' },
    ],
  },
  10: {
    dayNumber: 10,
    title: 'Day 10 — Obliques + Core Power',
    focus: 'Obliques, Serratus & Lateral Core',
    targetBodyParts: 'Side Abs, Obliques, Serratus Anterior',
    focusBadges: ['Serratus Carving', 'Side Ab Definition', 'Rotational Power'],
    description: 'High rep bicycle crunches and Russian twists with extended side planks and mountain climbers.',
    isRest: false,
    exercises: [
      { name: 'Bicycle Crunches', target: 'Obliques', sets: 4, reps: '24 total reps', notes: 'Extended leg drive' },
      { name: 'Russian Twists', target: 'Obliques & Rotation', sets: 4, reps: '20 total reps', notes: 'Slow deliberate twist' },
      { name: 'Heel Touches', target: 'Side Abs', sets: 3, reps: '24 total reps', notes: 'Shoulders off floor' },
      { name: 'Side Plank', target: 'Lateral Core', sets: 3, reps: '45s each side', notes: 'Solid hip elevation' },
      { name: 'Mountain Climbers', target: 'Core Conditioning', sets: 3, reps: '40 seconds', notes: 'Rhythmic tempo' },
      { name: 'Plank Hold', target: 'Full Core', sets: 3, reps: '60 seconds', notes: 'Deep belly breath' },
    ],
  },
  11: {
    dayNumber: 11,
    title: 'Day 11 — Pure Chest Overload',
    focus: 'Pectoral Shape & Upper Shelf',
    targetBodyParts: 'Upper Chest, Outer Chest, Triceps',
    focusBadges: ['Upper Shelf', 'Pectoral Separation', 'Time Under Tension'],
    description: 'Dedicated 5-exercise chest workout featuring 4 sets of decline push-ups and slow eccentric tempo sets.',
    isRest: false,
    exercises: [
      { name: 'Standard Push-ups', target: 'Chest', sets: 4, reps: '20 reps', notes: 'Smooth cadence' },
      { name: 'Decline Push-ups', target: 'Upper Chest', sets: 4, reps: '12–15 reps', notes: 'Feet on chair' },
      { name: 'Wide Push-ups', target: 'Outer Chest', sets: 3, reps: '15 reps', notes: 'Deep stretch at base' },
      { name: 'Diamond Push-ups', target: 'Inner Chest', sets: 3, reps: '12 reps', notes: 'Triceps and inner chest squeeze' },
      { name: 'Slow Tempo Push-ups', target: 'Time Under Tension', sets: 2, reps: '10 reps', notes: '4-second eccentric descent' },
    ],
  },
  12: {
    dayNumber: 12,
    title: 'Day 12 — Lower Abs Isolation',
    focus: 'Deep Lower Abdominal Tightening',
    targetBodyParts: 'Lower Abs, V-Line, Transverse Abdominis',
    focusBadges: ['V-Line Development', 'Lower Ab Isolation', 'Core Endurance'],
    description: 'Focused lower abdominal attack to tighten the lower waistline and develop prominent ab blocks.',
    isRest: false,
    exercises: [
      { name: 'Leg Raises', target: 'Lower Abs', sets: 4, reps: '15 reps', notes: 'Strict control' },
      { name: 'Reverse Crunches', target: 'Lower Abs', sets: 4, reps: '15–20 reps', notes: 'Smooth pelvic tuck' },
      { name: 'Flutter Kicks', target: 'Lower Abs', sets: 4, reps: '30 seconds', notes: 'Crisp low kicks' },
      { name: 'Bicycle Crunches', target: 'Full Abs', sets: 3, reps: '24 total reps', notes: 'Full extension' },
      { name: 'Plank Hold', target: 'Core Finisher', sets: 3, reps: '60 seconds', notes: 'Final 60-second lock' },
    ],
  },
  13: {
    dayNumber: 13,
    title: 'Day 13 — Chest + Core Power',
    focus: 'Upper Body Compound Density',
    targetBodyParts: 'Chest, Upper Chest, Lower Abs, Core',
    focusBadges: ['Chest Power', 'Ab Stability', 'Full Upper Shape'],
    description: 'High performance combo of 4 chest variations with leg raises, reverse crunches, and plank.',
    isRest: false,
    exercises: [
      { name: 'Standard Push-ups', target: 'Chest', sets: 4, reps: '20 reps', notes: '20 clean reps' },
      { name: 'Wide Push-ups', target: 'Outer Chest', sets: 3, reps: '15 reps', notes: 'Wide foundation' },
      { name: 'Diamond Push-ups', target: 'Inner Chest', sets: 3, reps: '12–15 reps', notes: 'Pec squeeze' },
      { name: 'Decline Push-ups', target: 'Upper Chest', sets: 3, reps: '12–15 reps', notes: 'Chair elevation' },
      { name: 'Leg Raises', target: 'Lower Abs', sets: 3, reps: '15 reps', notes: 'Strict leg lift' },
      { name: 'Reverse Crunches', target: 'Lower Abs', sets: 3, reps: '15 reps', notes: 'Control the descent' },
      { name: 'Plank Hold', target: 'Core', sets: 3, reps: '60 seconds', notes: 'Lock it down' },
    ],
  },
  14: {
    dayNumber: 14,
    title: 'Day 14 — Active Recovery & Reset',
    focus: 'Active Recovery Prior to Final Peak',
    targetBodyParts: 'Core Mobility & Posture',
    focusBadges: ['Active Recovery', 'Mobility Reset', 'Pre-Peak Recovery'],
    description: 'Light walking followed by 4 light core exercises to prepare the nervous system for the final 2 peak days.',
    isRest: false,
    exercises: [
      { name: 'Light Walking', target: 'Active Recovery', sets: 1, reps: '15–20 minutes', notes: 'Breathe fresh air' },
      { name: 'Standard Crunches', target: 'Upper Abs', sets: 3, reps: '20 reps', notes: 'Light ab curl' },
      { name: 'Reverse Crunches', target: 'Lower Abs', sets: 3, reps: '15 reps', notes: 'Smooth motion' },
      { name: 'Side Plank', target: 'Lateral Core', sets: 2, reps: '45s each side', notes: 'Steady hold' },
      { name: 'Plank Hold', target: 'Core', sets: 2, reps: '60 seconds', notes: 'Solid posture' },
    ],
  },
  15: {
    dayNumber: 15,
    title: 'Day 15 — Final Hard Chest + Abs Session',
    focus: 'Maximal Volume Peak',
    targetBodyParts: 'Entire Chest, Upper Abs, Lower Abs, Obliques',
    focusBadges: ['Peak Intensity', 'Full Volume Overload', 'Ultimate Density'],
    description: 'High-intensity penultimate session combining all push-up variations, leg raises, bicycle crunches, and plank.',
    isRest: false,
    exercises: [
      { name: 'Standard Push-ups', target: 'Chest', sets: 4, reps: '20 reps', notes: '20 explosive reps' },
      { name: 'Wide Push-ups', target: 'Outer Chest', sets: 3, reps: '15 reps', notes: 'Deep stretch' },
      { name: 'Diamond Push-ups', target: 'Inner Chest', sets: 3, reps: '12–15 reps', notes: 'Lock triceps' },
      { name: 'Decline Push-ups', target: 'Upper Chest', sets: 3, reps: '12–15 reps', notes: 'Upper pectoral overload' },
      { name: 'Leg Raises', target: 'Lower Abs', sets: 4, reps: '15 reps', notes: 'Direct lower ab pump' },
      { name: 'Reverse Crunches', target: 'Lower Abs', sets: 4, reps: '15 reps', notes: 'Pelvic elevation' },
      { name: 'Bicycle Crunches', target: 'Obliques', sets: 3, reps: '24 total reps', notes: 'Crisp rotation' },
      { name: 'Plank Hold', target: 'Core Finisher', sets: 3, reps: '60 seconds', notes: 'Total body brace' },
    ],
  },
  16: {
    dayNumber: 16,
    title: 'Day 16 — Final Full Core + Chest Mastery',
    focus: '16-Day Home Protocol Completion',
    targetBodyParts: 'Full Chest, Full Abdominal Wall, Obliques',
    focusBadges: ['Protocol Completion', 'Grandmother-House Mastery', 'Gym Ready'],
    description: 'Final championship session of the 16-day grandmother-house program before returning to normal gym training.',
    isRest: false,
    exercises: [
      { name: 'Standard Push-ups', target: 'Chest', sets: 4, reps: '20 reps', notes: 'Mastery standard' },
      { name: 'Wide Push-ups', target: 'Outer Chest', sets: 3, reps: '15 reps', notes: 'Pectoral fullness' },
      { name: 'Diamond Push-ups', target: 'Inner Chest', sets: 3, reps: '12 reps', notes: 'Diamond lock' },
      { name: 'Leg Raises', target: 'Lower Abs', sets: 4, reps: '15 reps', notes: 'Clean reps' },
      { name: 'Reverse Crunches', target: 'Lower Abs', sets: 4, reps: '15 reps', notes: 'Maximum squeeze' },
      { name: 'Bicycle Crunches', target: 'Obliques', sets: 3, reps: '24 total reps', notes: 'Controlled pace' },
      { name: 'Side Plank', target: 'Lateral Core', sets: 3, reps: '45s each side', notes: 'Lateral stability' },
      { name: 'Plank Hold', target: 'Grand Finale', sets: 3, reps: '60 seconds', notes: 'Celebrate completion!' },
    ],
  },
};

export interface HolidayStatus {
  isHolidayPeriod: boolean; // true if current Addis date is within Aug 31 - Sep 15
  isBeforeHoliday: boolean; // true if current Addis date is before Aug 31
  isAfterHoliday: boolean;  // true if after Sep 15 (auto-reverts to gym)
  daysUntilStart: number;
  currentDayNumber: number; // 1..16 if active, otherwise 0
  remainingDays: number;
  totalDays: number;
  startDateFormatted: string;
  endDateFormatted: string;
  todayRoutine: HolidayWorkoutDay | null;
}

/**
 * Calculates whether the temporary holiday home workout is active, upcoming, or completed
 * based on Addis Ababa time.
 */
export function getHolidayWorkoutStatus(customNow?: Date): HolidayStatus {
  const now = customNow || getAddisNow();
  const dateKey = toAddisDateString(now); // e.g. "2026-08-30"

  // Parse start date: 2026-08-31
  const [startYear, startMonth, startDay] = HOLIDAY_START_DATE_KEY.split('-').map(Number);
  const [curYear, curMonth, curDay] = dateKey.split('-').map(Number);

  const startDate = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const curDate = new Date(Date.UTC(curYear, curMonth - 1, curDay));

  const diffDays = Math.round((curDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  const startDateFormatted = 'August 31, 2026';
  const endDateFormatted = 'September 15, 2026';

  // 1. Before Holiday
  if (diffDays < 0) {
    return {
      isHolidayPeriod: false,
      isBeforeHoliday: true,
      isAfterHoliday: false,
      daysUntilStart: Math.abs(diffDays),
      currentDayNumber: 0,
      remainingDays: HOLIDAY_DURATION_DAYS,
      totalDays: HOLIDAY_DURATION_DAYS,
      startDateFormatted,
      endDateFormatted,
      todayRoutine: null,
    };
  }

  // 2. Active Holiday Period (Day 1..16: diffDays 0..15)
  if (diffDays >= 0 && diffDays < HOLIDAY_DURATION_DAYS) {
    const dayNumber = diffDays + 1; // 1-indexed
    const routine = HOLIDAY_ROUTINES[dayNumber] || HOLIDAY_ROUTINES[1];
    const remainingDays = HOLIDAY_DURATION_DAYS - diffDays;

    return {
      isHolidayPeriod: true,
      isBeforeHoliday: false,
      isAfterHoliday: false,
      daysUntilStart: 0,
      currentDayNumber: dayNumber,
      remainingDays,
      totalDays: HOLIDAY_DURATION_DAYS,
      startDateFormatted,
      endDateFormatted,
      todayRoutine: routine,
    };
  }

  // 3. After Holiday (Completed -> Auto-reverts to normal gym program)
  return {
    isHolidayPeriod: false,
    isBeforeHoliday: false,
    isAfterHoliday: true,
    daysUntilStart: 0,
    currentDayNumber: 0,
    remainingDays: 0,
    totalDays: HOLIDAY_DURATION_DAYS,
    startDateFormatted,
    endDateFormatted,
    todayRoutine: null,
  };
}
