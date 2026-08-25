export const TIMEZONE = 'Africa/Addis_Ababa';
export const WORKOUT_DAY_START_HOUR = 5; // 05:00

// Ethiopia is UTC+3 (no DST). Use a fixed +3 hour offset from UTC for conversions.
export const ADDIS_OFFSET_MS = 3 * 60 * 60 * 1000;

export function getAddisNow(): Date {
  return new Date(Date.now() + ADDIS_OFFSET_MS);
}

// Convert an "Addis-local" Date (constructed in local AddIs time) to the equivalent UTC Date
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
// workout day which begins at WORKOUT_DAY_START_HOUR in Addis timezone.
export function workoutWindowForAddisDate(addisDate: Date) {
  const startAddis = new Date(
    addisDate.getFullYear(),
    addisDate.getMonth(),
    addisDate.getDate(),
    WORKOUT_DAY_START_HOUR,
    0,
    0,
    0
  );
  const startUtc = toUtcFromAddis(startAddis);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { startUtc, endUtc, startAddis };
}
