import { convertToEthiopianTraditionalTime, type EthiopianTimeResult } from './ethiopianTime';

export const TIMEZONE = 'Africa/Addis_Ababa';

// Daily Active Window (Addis Ababa Time: UTC+3)
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

// Ethiopia is strictly UTC+3 (no DST). Fixed +3 hour offset in milliseconds.
export const ADDIS_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Returns current timestamp as an authoritative Date.
 */
export function getAddisNow(): Date {
  return new Date();
}

/**
 * Timezone-aware extractor for Africa/Addis_Ababa.
 * Uses exact UTC math with fixed UTC+3 offset — 100% independent of server/client runtime TZ.
 */
export function getAddisTimeComponents(customDate?: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
  totalMinutes: number;
  formatted12h: string;
  formatted24h: string;
  ethiopianTime: EthiopianTimeResult;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday in Addis Ababa
} {
  const instantMs = customDate ? customDate.getTime() : Date.now();
  const addisShifted = new Date(instantMs + ADDIS_OFFSET_MS);

  const year = addisShifted.getUTCFullYear();
  const month = addisShifted.getUTCMonth() + 1; // 1-indexed
  const day = addisShifted.getUTCDate();
  const hour = addisShifted.getUTCHours();
  const minute = addisShifted.getUTCMinutes();
  const second = addisShifted.getUTCSeconds();
  const millisecond = addisShifted.getUTCMilliseconds();
  const dayOfWeek = addisShifted.getUTCDay();
  const totalMinutes = hour * 60 + minute;

  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const formatted12h = `${String(h12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ampm}`;
  const formatted24h = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;

  const ethTime = convertToEthiopianTraditionalTime(hour, minute, second);

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    millisecond,
    totalMinutes,
    formatted12h,
    formatted24h,
    ethiopianTime: ethTime,
    dayOfWeek,
  };
}

/**
 * Convert an Addis local wall-clock date/time to UTC Date.
 */
export function toUtcFromAddis(addisDate: Date): Date {
  return new Date(addisDate.getTime() - ADDIS_OFFSET_MS);
}

/**
 * Given any UTC Date, compute the Addis wall-clock shifted Date.
 */
export function addisFromUtc(utcDate: Date): Date {
  return new Date(utcDate.getTime() + ADDIS_OFFSET_MS);
}

/**
 * Formats a Date into Addis Ababa calendar date string (YYYY-MM-DD).
 */
export function toAddisDateString(date: Date): string {
  const parts = getAddisTimeComponents(date);
  const y = parts.year;
  const m = String(parts.month).padStart(2, '0');
  const d = String(parts.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Workout Protocol Schedule:
 * GYM Days: Wednesday (3), Friday (5), Saturday (6)
 * HOME Days: Sunday (0), Monday (1), Tuesday (2), Thursday (4)
 */
export function isGymDay(date: Date): boolean {
  const parts = getAddisTimeComponents(date);
  return parts.dayOfWeek === 3 || parts.dayOfWeek === 5 || parts.dayOfWeek === 6;
}

export function getWorkoutLocationForAddisDate(date: Date): 'GYM' | 'HOME' {
  return isGymDay(date) ? 'GYM' : 'HOME';
}

/**
 * Authoritative Workout & Todo Execution Window:
 * - Daily cycle in Addis Ababa runs from 05:00 AM to 04:59:59 AM next morning.
 * - Opens at exactly 05:00:00.000 AM Addis Time (02:00:00.000 UTC).
 * - Closes at exactly 09:28:00.000 PM Addis Time (18:28:00.000 UTC).
 * - Cutoff rule: instant >= 21:28:00.000 Addis -> window is CLOSED.
 * - If current Addis time is 00:00 to 04:59:59.999, it belongs to yesterday's cycle and is CLOSED until 05:00 AM today.
 */
export function workoutWindowForAddisDate(customDate?: Date) {
  const instantMs = customDate ? customDate.getTime() : Date.now();
  const addisShifted = new Date(instantMs + ADDIS_OFFSET_MS);

  let cycleYear = addisShifted.getUTCFullYear();
  let cycleMonthIndex = addisShifted.getUTCMonth();
  let cycleDay = addisShifted.getUTCDate();
  const hour = addisShifted.getUTCHours();

  // If current Addis time is before 05:00 AM, it still belongs to yesterday's day cycle
  if (hour < DAY_OPEN_HOUR) {
    const prevDay = new Date(Date.UTC(cycleYear, cycleMonthIndex, cycleDay - 1));
    cycleYear = prevDay.getUTCFullYear();
    cycleMonthIndex = prevDay.getUTCMonth();
    cycleDay = prevDay.getUTCDate();
  }

  // Exact UTC timestamps for the active cycle:
  // Open: cycle date 05:00 AM Addis = cycle date 02:00:00.000 UTC
  const startUtcMs = Date.UTC(cycleYear, cycleMonthIndex, cycleDay, DAY_OPEN_HOUR - 3, DAY_OPEN_MINUTE, 0, 0);
  const startUtc = new Date(startUtcMs);

  // Close: cycle date 09:28 PM Addis = cycle date 18:28:00.000 UTC
  const closeUtcMs = Date.UTC(cycleYear, cycleMonthIndex, cycleDay, DAY_CLOSE_HOUR - 3, DAY_CLOSE_MINUTE, 0, 0);
  const closeUtc = new Date(closeUtcMs);

  // Next Unlock: cycle date + 1 day at 05:00 AM Addis = cycle date + 1 at 02:00:00.000 UTC
  const nextUnlockUtcMs = Date.UTC(cycleYear, cycleMonthIndex, cycleDay + 1, DAY_OPEN_HOUR - 3, DAY_OPEN_MINUTE, 0, 0);
  const nextUnlockUtc = new Date(nextUnlockUtcMs);

  // Cycle End: 1 millisecond before next unlock
  const endUtc = new Date(nextUnlockUtcMs - 1);

  // Addis display Dates (for formatting/display in local representations):
  const startAddis = new Date(startUtcMs + ADDIS_OFFSET_MS);
  const closeAddis = new Date(closeUtcMs + ADDIS_OFFSET_MS);
  const nextUnlockAddis = new Date(nextUnlockUtcMs + ADDIS_OFFSET_MS);

  // Exact Boundary Checks:
  // 1) Is open: instant is on or after 05:00:00.000 AM Addis AND strictly before 09:28:00.000 PM Addis
  const isOpen = instantMs >= startUtcMs && instantMs < closeUtcMs;
  // 2) Is closed: instant is at or after 09:28:00.000 PM Addis OR before 05:00:00.000 AM Addis
  const isPastCutoff = instantMs >= closeUtcMs;
  const isClosed = isPastCutoff || instantMs < startUtcMs;

  const dateKey = `${cycleYear}-${String(cycleMonthIndex + 1).padStart(2, '0')}-${String(cycleDay).padStart(2, '0')}`;

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
    dateKey,
    cycleYear,
    cycleMonth: cycleMonthIndex + 1,
    cycleDay,
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
  const windowInfo = workoutWindowForAddisDate(targetDate);
  const anchorUtcMs = Date.UTC(JOURNEY_START_YEAR, JOURNEY_START_MONTH, JOURNEY_START_DAY, DAY_OPEN_HOUR - 3, 0, 0, 0);

  const diffMs = windowInfo.startUtc.getTime() - anchorUtcMs;
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
 * Returns true only if current Addis time is currently within [05:00 AM, 09:28 PM).
 */
export function isExecutionWindowOpenNow(): boolean {
  const { isOpen } = workoutWindowForAddisDate();
  return isOpen;
}

