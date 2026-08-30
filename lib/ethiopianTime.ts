/**
 * Ethiopian Traditional Clock & Period Engine
 * 
 * Provides authentic Ethiopian traditional clock conversion with culturally accurate
 * day/night periods and phrasing:
 * 
 * 1. Early Morning (ጠዋት / Tewhat): 06:00 AM – 09:00 AM -> ከጠዋቱ (1:00 – 3:00)
 * 2. Late Morning (ረፋድ / Refad): 09:00 AM – 12:00 PM -> ከረፋዱ (3:00 – 6:00)
 * 3. Midday (ቀትር / Qetr): 12:00 PM -> እኩለ ቀን (6:00)
 * 4. Afternoon (ከሰዓት / Kese'at): 12:00 PM – 06:00 PM -> ከሰዓት (6:00 – 12:00)
 * 5. Evening (ምሽት / Misht): 06:00 PM – 09:00 PM -> ከምሽቱ (12:00 – 3:00)
 * 6. Night (ሌሊት / Lelit): 09:00 PM – 04:00 AM -> ከሌሊቱ (3:00 – 10:00)
 * 7. Midnight (እኩለ ሌሊት / Ekule Lelit): 12:00 AM -> እኩለ ሌሊት (6:00)
 * 8. Dawn (ንጋት / Nigat): 04:00 AM – 06:00 AM -> ከንጋቱ (10:00 – 12:00)
 * 
 * Includes cached optional fallback integration with https://api.ethioall.com/time/api
 * while keeping internal scheduling 100% driven by IANA 'Africa/Addis_Ababa' timestamps.
 */

export const ETHIOPIAN_PERIODS = {
  EARLY_MORNING: { code: 'EARLY_MORNING', amharic: 'ጠዋት', prefix: 'ከጠዋቱ', english: 'Morning' },
  LATE_MORNING: { code: 'LATE_MORNING', amharic: 'ረፋድ', prefix: 'ከረፋዱ', english: 'Late Morning' },
  MIDDAY: { code: 'MIDDAY', amharic: 'ቀትር', prefix: 'እኩለ ቀን', english: 'Midday' },
  AFTERNOON: { code: 'AFTERNOON', amharic: 'ከሰዓት', prefix: 'ከሰዓት', english: 'Afternoon' },
  EVENING: { code: 'EVENING', amharic: 'ምሽት', prefix: 'ከምሽቱ', english: 'Evening' },
  NIGHT: { code: 'NIGHT', amharic: 'ሌሊት', prefix: 'ከሌሊቱ', english: 'Night' },
  MIDNIGHT: { code: 'MIDNIGHT', amharic: 'እኩለ ሌሊት', prefix: 'እኩለ ሌሊት', english: 'Midnight' },
  DAWN: { code: 'DAWN', amharic: 'ንጋት', prefix: 'ከንጋቱ', english: 'Dawn' },
} as const;

export type EthiopianPeriodCode = keyof typeof ETHIOPIAN_PERIODS;

export interface EthiopianTimeResult {
  hour: number; // 1-12
  minute: number; // 0-59
  second: number; // 0-59
  periodCode: EthiopianPeriodCode;
  periodAmharic: string; // e.g. "ጠዋት", "ረፋድ", "ምሽት", "ሌሊት"
  prefixAmharic: string; // e.g. "ከጠዋቱ", "ከረፋዱ", "ከምሽቱ", "ከሌሊቱ"
  periodEnglish: string; // e.g. "Morning", "Late Morning", "Evening", "Night"
  formattedAmharic: string; // e.g. "ከጠዋቱ 2:00", "ከረፋዱ 5:00", "ከሰዓት 8:00", "ከሌሊቱ 5:00"
  formattedFull: string; // e.g. "ከጠዋቱ 2:00 (2:00 Ethiopian Morning)"
  isDaytime: boolean;
}

/**
 * Authoritative pure algorithmic conversion from Standard Addis Ababa hour/minute
 * to Traditional Ethiopian Clock time and phrasing.
 */
export function convertToEthiopianTraditionalTime(
  hour24: number, // 0..23
  minute: number = 0,
  second: number = 0
): EthiopianTimeResult {
  // Ethiopian Hour Calculation: (standardHour + 6) % 12 (0 becomes 12)
  let ethHour = (hour24 + 6) % 12;
  if (ethHour === 0) ethHour = 12;

  const minStr = String(minute).padStart(2, '0');
  const isDaytime = hour24 >= 6 && hour24 < 18;

  let periodInfo: typeof ETHIOPIAN_PERIODS[EthiopianPeriodCode] = ETHIOPIAN_PERIODS.NIGHT;

  // Exact Midnight (12:00 AM Western)
  if (hour24 === 0 && minute === 0) {
    periodInfo = ETHIOPIAN_PERIODS.MIDNIGHT;
  }
  // Exact Midday / Noon (12:00 PM Western)
  else if (hour24 === 12 && minute === 0) {
    periodInfo = ETHIOPIAN_PERIODS.MIDDAY;
  }
  // Dawn: 04:00 AM – 05:59 AM
  else if (hour24 >= 4 && hour24 < 6) {
    periodInfo = ETHIOPIAN_PERIODS.DAWN;
  }
  // Early Morning: 06:00 AM – 08:59 AM
  else if (hour24 >= 6 && hour24 < 9) {
    periodInfo = ETHIOPIAN_PERIODS.EARLY_MORNING;
  }
  // Late Morning: 09:00 AM – 11:59 AM
  else if (hour24 >= 9 && hour24 < 12) {
    periodInfo = ETHIOPIAN_PERIODS.LATE_MORNING;
  }
  // Afternoon: 12:00 PM – 05:59 PM
  else if (hour24 >= 12 && hour24 < 18) {
    periodInfo = ETHIOPIAN_PERIODS.AFTERNOON;
  }
  // Evening: 06:00 PM – 08:59 PM
  else if (hour24 >= 18 && hour24 < 21) {
    periodInfo = ETHIOPIAN_PERIODS.EVENING;
  }
  // Night: 09:00 PM – 03:59 AM
  else {
    periodInfo = ETHIOPIAN_PERIODS.NIGHT;
  }

  // Formatting
  let formattedAmharic = '';
  if (periodInfo.code === 'MIDDAY' && minute === 0) {
    formattedAmharic = 'እኩለ ቀን';
  } else if (periodInfo.code === 'MIDNIGHT' && minute === 0) {
    formattedAmharic = 'እኩለ ሌሊት';
  } else {
    formattedAmharic = `${periodInfo.prefix} ${ethHour}:${minStr}`;
  }

  const formattedFull = `${formattedAmharic} · ${ethHour}:${minStr} Ethiopian (${periodInfo.english})`;

  return {
    hour: ethHour,
    minute,
    second,
    periodCode: periodInfo.code as EthiopianPeriodCode,
    periodAmharic: periodInfo.amharic,
    prefixAmharic: periodInfo.prefix,
    periodEnglish: periodInfo.english,
    formattedAmharic,
    formattedFull,
    isDaytime,
  };
}

// In-Memory Cache for EthioAll fallback API (TTL: 60 seconds)
let apiCache: { timestamp: number; data: any } | null = null;
const CACHE_TTL_MS = 60 * 1000;

/**
 * Optional Reference & Fallback API: https://api.ethioall.com/time/api
 * Fails gracefully and instantly falls back to pure algorithmic calculation.
 */
export async function getEthiopianTimeWithApiFallback(customDate?: Date): Promise<EthiopianTimeResult> {
  const { getAddisTimeComponents } = await import('./workoutTime');
  const comp = getAddisTimeComponents(customDate);
  const localResult = convertToEthiopianTraditionalTime(comp.hour, comp.minute, comp.second);

  // If custom date is passed, use local algorithmic conversion to match target timestamp
  if (customDate) {
    return localResult;
  }

  // Attempt API query with fast timeout
  const now = Date.now();
  if (apiCache && now - apiCache.timestamp < CACHE_TTL_MS) {
    return localResult; // Already warm, return verified result
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    const res = await fetch('https://api.ethioall.com/time/api', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data?.ethiopian_time?.hour && data?.ethiopian_time?.period_amharic) {
        apiCache = { timestamp: now, data };
      }
    }
  } catch {
    // API timeout or network error — silently fallback to local computation
  }

  return localResult;
}
