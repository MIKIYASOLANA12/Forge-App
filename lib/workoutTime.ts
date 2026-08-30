export const TIMEZONE = 'Africa/Addis_Ababa';

// Daily Active Window (Addis Ababa Time)
export const DAY_OPEN_HOUR = 5; // 05:00 AM
export const DAY_OPEN_MINUTE = 0;
export const WORKOUT_DAY_START_HOUR = DAY_OPEN_HOUR;

export const DAY_CLOSE_HOUR = 21; // 09:28 PM (21:28)
export const DAY_CLOSE_MINUTE = 28;

export const TOTAL_JOURNEY_DAYS = 300;

// Program benchmark start date (fixed anchor for the 300-day journey in Addis Ababa timezone)
// Anchor: August 10, 2026 05:00:00 (Addis time)
export const JOURNEY_START_YEAR = 2026;
export const JOURNEY_START_MONTH = 7; // August (0-indexed: 7)
export const JOURNEY_START_DAY = 10;

// Ethiopia is UTC+3 (no DST). Use a fixed +3 hour offset from UTC for conversions.
export const ADDIS_OFFSET_MS = 3 * 60 * 60 * 1000;

export function getAddisNow(): Date {
  return new Date(Date.now() + ADDIS_OFFSET_MS);
}

/**
 * Timezone-aware extractor for Africa/Addis_Ababa with Ethiopian traditional clock conversion.
 * Works uniformly regardless of server or client runtime timezone.
 */
export function getAddisTimeComponents(customDate?: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  totalMinutes: number;
  formatted12h: string;
  ethiopianTime: {
    hour: number;
    minute: number;
    period: 'Day' | 'Night';
    periodAmharic: 'ቀን' | 'ምሽት' | 'ሌሊት';
    formatted: string;
  };
} {
  const d = customDate || new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      map[p.type] = parseInt(p.value, 10);
    }
  }

  const year = map.year ?? 2026;
  const month = map.month ?? 8;
  const day = map.day ?? 30;
  let hour = map.hour ?? 0;
  if (hour === 24) hour = 0;
  const minute = map.minute ?? 0;
  const second = map.second ?? 0;
  const totalMinutes = hour * 60 + minute;

  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const formatted12h = `${String(h12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ampm}`;

  // Ethiopian Traditional Clock:
  // Starts at standard 6:00 AM as 12:00 Ethiopian
  let ethHour = (hour + 6) % 12;
  if (ethHour === 0) ethHour = 12;
  const isDay = hour >= 6 && hour < 18;
  const period: 'Day' | 'Night' = isDay ? 'Day' : 'Night';
  const periodAmharic: 'ቀን' | 'ምሽት' | 'ሌሊት' = isDay
    ? 'ቀን'
    : hour >= 18 && hour < 24
    ? 'ምሽት'
    : 'ሌሊት';

  const ethFormatted = `${ethHour}:${String(minute).padStart(2, '0')} Ethiopian (${period})`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    totalMinutes,
    formatted12h,
    ethiopianTime: {
      hour: ethHour,
      minute,
      period,
      periodAmharic,
      formatted: ethFormatted,
    },
  };
}

// Convert an "Addis-local" Date (constructed in local Addis time) to the equivalent UTC Date
export function toUtcFromAddis(addisDate: Date): Date {
  return new Date(addisDate.getTime() - ADDIS_OFFSET_MS);
}

// Given any Date (UTC), compute the Addis-local Date by applying the fixed offset
export function addisFromUtc(utcDate: Date): Date {
  return new Date(utcDate.getTime() + ADDIS_OFFSET_MS);
}

export function toAddisDateString(date: Date): string {
  const parts = getAddisTimeComponents(date);
  const y = parts.year;
  const m = String(parts.month).padStart(2, '0');
  const d = String(parts.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

/**
 * Workout & Todo Execution Window:
 * - Opens at exactly 05:00 AM Addis Time
 * - Closes at exactly 09:28 PM (21:28) Addis Time
 * - If current time is past 21:28, the execution window is CLOSED/LOCKED until 05:00 AM next morning.
 */
export function workoutWindowForAddisDate(addisDate: Date) {
  let baseDate = new Date(addisDate);
  // If current Addis time is before 05:00 AM, it still belongs to yesterday's day cycle
  if (baseDate.getHours() < DAY_OPEN_HOUR) {
    baseDate.setDate(baseDate.getDate() - 1);
  }

  const startAddis = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    DAY_OPEN_HOUR,
    DAY_OPEN_MINUTE,
    0,
    0
  );

  const closeAddis = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    DAY_CLOSE_HOUR,
    DAY_CLOSE_MINUTE,
    0,
    0
  );

  const nextUnlockAddis = new Date(startAddis);
  nextUnlockAddis.setDate(nextUnlockAddis.getDate() + 1);
  nextUnlockAddis.setHours(DAY_OPEN_HOUR, DAY_OPEN_MINUTE, 0, 0);

  const startUtc = toUtcFromAddis(startAddis);
  const closeUtc = toUtcFromAddis(closeAddis);
  const nextUnlockUtc = toUtcFromAddis(nextUnlockAddis);
  const endUtc = new Date(nextUnlockUtc.getTime() - 1);

  // Authoritative Cutoff Status
  const isPastCutoff = addisDate.getTime() >= closeAddis.getTime();
  const isOpen = addisDate.getTime() >= startAddis.getTime() && !isPastCutoff;
  const isClosed = isPastCutoff;

  return {
    startUtc,
    closeUtc,
    endUtc,
    nextUnlockUtc,
    startAddis,
    closeAddis,
    nextUnlockAddis,
    isOpen,
    isClosed,
    isPastCutoff,
  };
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
    DAY_OPEN_HOUR,
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
 * Authoritative 09:28 PM Cutoff Checker:
 * Returns true only if current Addis time is before 09:28 PM on the active day.
 */
export function isExecutionWindowOpenNow(): boolean {
  const addisNow = getAddisNow();
  const { isOpen } = workoutWindowForAddisDate(addisNow);
  return isOpen;
}
