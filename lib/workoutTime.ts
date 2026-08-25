export const TIMEZONE = 'Africa/Addis_Ababa';
export const WORKOUT_DAY_START_HOUR = 5; // 05:00 AM Ethiopia Time
export const TOTAL_JOURNEY_DAYS = 300;

// Program benchmark start date (fixed anchor for the 300-day journey in Addis Ababa timezone)
// Program anchor: August 10, 2026 05:00:00 (Addis time)
export const JOURNEY_START_YEAR = 2026;
export const JOURNEY_START_MONTH = 7; // August (0-indexed: 7)
export const JOURNEY_START_DAY = 10;

// Ethiopia is UTC+3 (no DST). Use a fixed +3 hour offset from UTC for conversions.
export const ADDIS_OFFSET_MS = 3 * 60 * 60 * 1000;

export function getAddisNow(): Date {
  return new Date(Date.now() + ADDIS_OFFSET_MS);
}

// Convert an "Addis-local" Date (constructed in local Addis time) to the equivalent UTC Date
export function toUtcFromAddis(addisDate: Date): Date {
  return new Date(addisDate.getTime() - ADDIS_OFFSET_MS);
}

// Given any Date (UTC), compute the Addis-local Date by applying the fixed offset
export function addisFromUtc(utcDate: Date): Date {
  return new Date(utcDate.getTime() + ADDIS_OFFSET_MS);
}

/**
 * Workout Protocol Schedule:
 * GYM Days: Monday (1), Wednesday (3), Saturday (6)
 * HOME Days: Tuesday (2), Thursday (4), Friday (5), Sunday (0)
 */
export function isGymDay(addisDate: Date): boolean {
  const dayOfWeek = addisDate.getDay();
  return dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 6;
}

export function getWorkoutLocationForAddisDate(addisDate: Date): 'GYM' | 'HOME' {
  return isGymDay(addisDate) ? 'GYM' : 'HOME';
}

// For a given Addis-local date, return the UTC window (start/end) that corresponds to the
// workout day which begins at WORKOUT_DAY_START_HOUR (05:00 AM) in Addis timezone.
export function workoutWindowForAddisDate(addisDate: Date) {
  // If current Addis time is before 05:00 AM, it still belongs to yesterday's 05:00 window
  let baseDate = new Date(addisDate);
  if (baseDate.getHours() < WORKOUT_DAY_START_HOUR) {
    baseDate.setDate(baseDate.getDate() - 1);
  }

  const startAddis = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    WORKOUT_DAY_START_HOUR,
    0,
    0,
    0
  );
  const startUtc = toUtcFromAddis(startAddis);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { startUtc, endUtc, startAddis };
}

/**
 * 300-DAY JOURNEY COUNTER
 * Computes exact DAY X / 300 based on Africa/Addis_Ababa 05:00 AM boundary.
 */
export function getDayOfJourney300(targetDate?: Date): {
  dayNumber: number;
  totalDays: number;
  formatted: string;
  percentage: number;
  daysRemaining: number;
} {
  const currentAddis = targetDate ? addisFromUtc(targetDate) : getAddisNow();
  const { startAddis: currentWindowStart } = workoutWindowForAddisDate(currentAddis);

  const anchorStart = new Date(
    JOURNEY_START_YEAR,
    JOURNEY_START_MONTH,
    JOURNEY_START_DAY,
    WORKOUT_DAY_START_HOUR,
    0,
    0,
    0
  );

  const diffMs = currentWindowStart.getTime() - anchorStart.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const dayNumber = Math.max(1, Math.min(TOTAL_JOURNEY_DAYS, diffDays + 1));
  const percentage = Math.round((dayNumber / TOTAL_JOURNEY_DAYS) * 1000) / 10;
  const daysRemaining = Math.max(0, TOTAL_JOURNEY_DAYS - dayNumber);

  return {
    dayNumber,
    totalDays: TOTAL_JOURNEY_DAYS,
    formatted: `DAY ${dayNumber} / ${TOTAL_JOURNEY_DAYS}`,
    percentage,
    daysRemaining,
  };
}

/**
 * Hard 05:00 AM Workout Cutoff Checker
 * Returns whether a workout for a specific window can still be submitted.
 */
export function isWorkoutWindowOpen(windowStartUtc: Date): boolean {
  const now = new Date();
  const windowEndUtc = new Date(windowStartUtc.getTime() + 24 * 60 * 60 * 1000);
  return now.getTime() <= windowEndUtc.getTime();
}
