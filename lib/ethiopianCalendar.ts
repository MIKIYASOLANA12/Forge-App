/**
 * FORGE — AUTHORITATIVE ETHIOPIAN CALENDAR & GOAL YEAR ENGINE
 * 
 * Source of truth for:
 * 1. Fixed Target Goal Year: 2019 E.C.
 * 2. Fixed Exam Date: June 21, 2027 (Sene 14, 2019 E.C. / ሰኔ 14, 2019 ዓ.ም.)
 * 3. Exact Gregorian <-> Ethiopian Calendar Conversions (Julian Day Number algorithmic model)
 * 4. Africa/Addis_Ababa Timezone Integration
 */

import { getAddisTimeComponents, getAddisNow, toAddisDateString } from './workoutTime';

// ── 1. CENTRAL SOURCE OF TRUTH (IMMUTABLE TARGET CONSTANTS) ───────────────────
export const FIXED_GOAL_YEAR_EC = 2019;
export const FIXED_GOAL_YEAR_LABEL = '2019 E.C.';
export const FIXED_GOAL_YEAR_AMHARIC = '2019 ዓ.ም.';

export const TARGET_EXAM_GREGORIAN = '2027-06-21'; // June 21, 2027
export const TARGET_EXAM_ETHIOPIAN = 'Sene 14, 2019 E.C.';
export const TARGET_EXAM_ETHIOPIAN_AMHARIC = 'ሰኔ 14, 2019 ዓ.ም.';
export const TARGET_EXAM_YEAR_EC = 2019;
export const TARGET_EXAM_MONTH_EC = 10; // Sene (ሰኔ)
export const TARGET_EXAM_DAY_EC = 14;

export const GOAL_MOTTO = 'This is the year I must become the person I planned to become.';

// ── 2. ETHIOPIAN CALENDAR MONTH & DAY NAMES ──────────────────────────────────
export const ETHIOPIAN_MONTHS = [
  { id: 1, english: 'Meskerem', amharic: 'መስከረም', days: 30 },
  { id: 2, english: 'Tikimt', amharic: 'ጥቅምት', days: 30 },
  { id: 3, english: 'Hidar', amharic: 'ኅዳር', days: 30 },
  { id: 4, english: 'Tahsas', amharic: 'ታኅሣሥ', days: 30 },
  { id: 5, english: 'Tir', amharic: 'ጥር', days: 30 },
  { id: 6, english: 'Yakatit', amharic: 'የካቲት', days: 30 },
  { id: 7, english: 'Megabit', amharic: 'መጋቢት', days: 30 },
  { id: 8, english: 'Miazia', amharic: 'ሚያዝያ', days: 30 },
  { id: 9, english: 'Ginbot', amharic: 'ግንቦት', days: 30 },
  { id: 10, english: 'Sene', amharic: 'ሰኔ', days: 30 },
  { id: 11, english: 'Hamle', amharic: 'ሐምሌ', days: 30 },
  { id: 12, english: 'Nehase', amharic: 'ነሐሴ', days: 30 },
  { id: 13, english: 'Pagume', amharic: 'ጳጉሜን', days: 5 }, // 6 in leap year
] as const;

export const ETHIOPIAN_DAYS_AMHARIC = [
  'እሑድ',    // 0: Sunday
  'ሰኞ',      // 1: Monday
  'ማክሰኞ',   // 2: Tuesday
  'ረቡዕ',     // 3: Wednesday
  'ሐሙስ',    // 4: Thursday
  'ዓርብ',     // 5: Friday
  'ቅዳሜ',    // 6: Saturday
];

export interface EthiopianDate {
  ethYear: number;
  ethMonth: number; // 1-13
  ethDay: number;   // 1-30 (1-6 for Pagume)
}

export interface EthiopianDateInfo extends EthiopianDate {
  monthNameEnglish: string;
  monthNameAmharic: string;
  dayNameAmharic: string;
  formattedEnglish: string; // e.g. "Meskerem 4, 2019 E.C."
  formattedAmharic: string; // e.g. "መስከረም 4, 2019 ዓ.ም."
  formattedFull: string;    // e.g. "Meskerem 4, 2019 E.C. (መስከረም 4, 2019 ዓ.ም.)"
  isLeapYear: boolean;
}

export interface GoalYearStatus {
  // Goal Year (Fixed to 2019 E.C.)
  fixedGoalYear: number; // 2019
  fixedGoalYearLabel: string; // "2019 E.C."
  fixedGoalYearAmharic: string; // "2019 ዓ.ም."
  
  // Current Ethiopian Date & Year
  currentEthiopianDate: EthiopianDateInfo;
  currentEthiopianYear: number;
  currentEthiopianYearLabel: string; // e.g. "2019 E.C." or "2020 E.C."
  
  // Goal Year Status Flags
  isGoalYearActive: boolean; // true if current Ethiopian year is 2019
  hasGoalYearEnded: boolean; // true if current Ethiopian year >= 2020
  statusNotice?: string;
  
  // Exam Countdown Info
  examTargetGregorian: string; // "June 21, 2027"
  examTargetEthiopian: string; // "Sene 14, 2019 E.C."
  examTargetEthiopianAmharic: string; // "ሰኔ 14, 2019 ዓ.ም."
  examDaysRemaining: number; // e.g. 280 (never negative)
  examCountdownStatus: 'UPCOMING' | 'TODAY' | 'COMPLETED';
  examCountdownBadge: string; // "280 DAYS LEFT" | "🎯 EXAM DAY" | "🎯 EXAM COMPLETED"
  
  // 2019 E.C. Goal Year Progress
  goalYearTotalDays: number; // 366 (2019 is a leap year)
  goalYearDaysElapsed: number; // 1 to 366
  goalYearProgressPercent: number; // 0.0 to 100.0%
  goalYearStartGregorian: string; // "September 11, 2026"
  goalYearEndGregorian: string; // "September 11, 2027"
  
  // Inspiring Motto
  motto: string;
}

// ── 3. PURE MATHEMATICAL ALGORITHMS ──────────────────────────────────────────

/**
 * Checks if a given Ethiopian year is a leap year (Year % 4 === 3).
 * Pagume has 6 days in Ethiopian leap years.
 */
export function isEthiopianLeapYear(ethYear: number): boolean {
  return (ethYear % 4) === 3;
}

/**
 * Total days in an Ethiopian year (366 for leap, 365 for regular).
 */
export function getDaysInEthiopianYear(ethYear: number): number {
  return isEthiopianLeapYear(ethYear) ? 366 : 365;
}

/**
 * Converts a Gregorian calendar date (year, month [1-12], day [1-31])
 * into Julian Day Number (JDN).
 */
export function gregorianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/**
 * Converts Julian Day Number (JDN) to Gregorian Date { year, month, day }.
 */
export function jdnToGregorian(jdn: number): { year: number; month: number; day: number } {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { year, month, day };
}

/**
 * Converts Julian Day Number (JDN) to Ethiopian Date { ethYear, ethMonth, ethDay }.
 * Ethiopian Epoch (Meskerem 1, 1 E.C.) corresponds to JDN 1723856.
 */
export function jdnToEthiopian(jdn: number): EthiopianDate {
  const r = (jdn - 1723856) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const ethYear = 4 * Math.floor((jdn - 1723856) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
  const ethMonth = Math.floor(n / 30) + 1;
  const ethDay = (n % 30) + 1;
  return { ethYear, ethMonth, ethDay };
}

/**
 * Converts Ethiopian Date { ethYear, ethMonth, ethDay } to Julian Day Number (JDN).
 */
export function ethiopianToJdn(ethYear: number, ethMonth: number, ethDay: number): number {
  return (
    1723856 +
    365 * ethYear +
    Math.floor(ethYear / 4) +
    30 * (ethMonth - 1) +
    ethDay -
    1
  );
}

/**
 * Converts Gregorian calendar date to Ethiopian calendar date.
 */
export function gregorianToEthiopian(year: number, month: number, day: number): EthiopianDate {
  const jdn = gregorianToJdn(year, month, day);
  return jdnToEthiopian(jdn);
}

/**
 * Converts Ethiopian calendar date to Gregorian calendar date.
 */
export function ethiopianToGregorian(ethYear: number, ethMonth: number, ethDay: number): { year: number; month: number; day: number } {
  const jdn = ethiopianToJdn(ethYear, ethMonth, ethDay);
  return jdnToGregorian(jdn);
}

// ── 4. HIGH LEVEL CONVERTER (AFRICA/ADDIS_ABABA TIMEZONE AWARE) ──────────────

/**
 * Formats full Ethiopian date info from a given Date (or current Addis Ababa time).
 */
export function getEthiopianDate(customDate?: Date): EthiopianDateInfo {
  const comp = getAddisTimeComponents(customDate);
  const { ethYear, ethMonth, ethDay } = gregorianToEthiopian(comp.year, comp.month, comp.day);

  const monthObj = ETHIOPIAN_MONTHS[ethMonth - 1] || ETHIOPIAN_MONTHS[0];
  
  // Calculate day of week using local Addis date
  const addisDate = new Date(comp.year, comp.month - 1, comp.day);
  const dayOfWeekIndex = addisDate.getDay();
  const dayNameAmharic = ETHIOPIAN_DAYS_AMHARIC[dayOfWeekIndex] || '';

  const formattedEnglish = `${monthObj.english} ${ethDay}, ${ethYear} E.C.`;
  const formattedAmharic = `${monthObj.amharic} ${ethDay} ቀን ${ethYear} ዓ.ም.`;
  const formattedFull = `${formattedEnglish} (${monthObj.amharic} ${ethDay}, ${ethYear} ዓ.ም.)`;

  return {
    ethYear,
    ethMonth,
    ethDay,
    monthNameEnglish: monthObj.english,
    monthNameAmharic: monthObj.amharic,
    dayNameAmharic,
    formattedEnglish,
    formattedAmharic,
    formattedFull,
    isLeapYear: isEthiopianLeapYear(ethYear),
  };
}

/**
 * Authoritative Goal Year & Exam Countdown Calculator.
 * Everything is evaluated strictly within Africa/Addis_Ababa calendar coordinates.
 */
export function getGoalYearStatus(customDate?: Date): GoalYearStatus {
  const now = customDate || getAddisNow();
  const comp = getAddisTimeComponents(now);
  const currentEthDate = getEthiopianDate(now);

  // 1. Fixed Goal Year is ALWAYS 2019 E.C.
  const fixedGoalYear = FIXED_GOAL_YEAR_EC;
  const currentEthYear = currentEthDate.ethYear;

  const isGoalYearActive = currentEthYear === FIXED_GOAL_YEAR_EC;
  const hasGoalYearEnded = currentEthYear > FIXED_GOAL_YEAR_EC;

  let statusNotice: string | undefined;
  if (hasGoalYearEnded) {
    statusNotice = `⚠️ ${FIXED_GOAL_YEAR_LABEL} GOAL YEAR HAS ENDED`;
  }

  // 2. Exam Countdown Calculations
  const [examY, examM, examD] = TARGET_EXAM_GREGORIAN.split('-').map(Number);
  const examJdn = gregorianToJdn(examY, examM, examD);
  const currentJdn = gregorianToJdn(comp.year, comp.month, comp.day);
  const diffDays = examJdn - currentJdn;

  let examCountdownStatus: 'UPCOMING' | 'TODAY' | 'COMPLETED' = 'UPCOMING';
  let examCountdownBadge = '';

  if (diffDays > 0) {
    examCountdownStatus = 'UPCOMING';
    examCountdownBadge = `${diffDays} DAYS LEFT`;
  } else if (diffDays === 0) {
    examCountdownStatus = 'TODAY';
    examCountdownBadge = '🎯 EXAM DAY';
  } else {
    examCountdownStatus = 'COMPLETED';
    examCountdownBadge = '🎯 EXAM COMPLETED';
  }

  const examDaysRemaining = Math.max(0, diffDays);

  // 3. 2019 E.C. Goal Year Progress Calculation
  // Meskerem 1, 2019 E.C. = September 11, 2026 (JDN: 2461295)
  // Pagume 6, 2019 E.C. = September 11, 2027 (JDN: 2461660) — 366 days (leap year)
  const goalYearStartJdn = ethiopianToJdn(FIXED_GOAL_YEAR_EC, 1, 1);
  const goalYearTotalDays = getDaysInEthiopianYear(FIXED_GOAL_YEAR_EC); // 366
  const goalYearEndJdn = goalYearStartJdn + goalYearTotalDays - 1;

  let goalYearDaysElapsed = 0;
  let goalYearProgressPercent = 0;

  if (currentJdn < goalYearStartJdn) {
    goalYearDaysElapsed = 0;
    goalYearProgressPercent = 0;
  } else if (currentJdn >= goalYearEndJdn) {
    goalYearDaysElapsed = goalYearTotalDays;
    goalYearProgressPercent = 100;
  } else {
    goalYearDaysElapsed = currentJdn - goalYearStartJdn + 1;
    goalYearProgressPercent = Math.round((goalYearDaysElapsed / goalYearTotalDays) * 1000) / 10;
  }

  return {
    fixedGoalYear,
    fixedGoalYearLabel: FIXED_GOAL_YEAR_LABEL,
    fixedGoalYearAmharic: FIXED_GOAL_YEAR_AMHARIC,
    
    currentEthiopianDate: currentEthDate,
    currentEthiopianYear: currentEthYear,
    currentEthiopianYearLabel: `${currentEthYear} E.C.`,
    
    isGoalYearActive,
    hasGoalYearEnded,
    statusNotice,
    
    examTargetGregorian: 'June 21, 2027',
    examTargetEthiopian: TARGET_EXAM_ETHIOPIAN,
    examTargetEthiopianAmharic: TARGET_EXAM_ETHIOPIAN_AMHARIC,
    examDaysRemaining,
    examCountdownStatus,
    examCountdownBadge,
    
    goalYearTotalDays,
    goalYearDaysElapsed,
    goalYearProgressPercent,
    goalYearStartGregorian: 'September 11, 2026',
    goalYearEndGregorian: 'September 11, 2027',
    
    motto: GOAL_MOTTO,
  };
}
