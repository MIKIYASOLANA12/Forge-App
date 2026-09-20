import { NextRequest, NextResponse } from 'next/server';
import {
  getAddisNow,
  getAddisTimeComponents,
  workoutWindowForAddisDate,
  TIMEZONE,
  DAY_OPEN_HOUR,
  DAY_OPEN_MINUTE,
  DAY_CLOSE_HOUR,
  DAY_CLOSE_MINUTE,
} from '@/lib/workoutTime';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const now = getAddisNow();
    const addisParts = getAddisTimeComponents(now);
    const windowInfo = workoutWindowForAddisDate(now);

    return NextResponse.json({
      success: true,
      timezone: TIMEZONE,
      utcTime: now.toISOString(),
      utcTimestamp: now.getTime(),
      addisTime: {
        formatted12h: addisParts.formatted12h,
        formatted24h: addisParts.formatted24h,
        year: addisParts.year,
        month: addisParts.month,
        day: addisParts.day,
        hour: addisParts.hour,
        minute: addisParts.minute,
        second: addisParts.second,
        dayOfWeek: addisParts.dayOfWeek,
        ethiopianTime: addisParts.ethiopianTime,
      },
      executionDate: windowInfo.dateKey,
      configuredSchedule: {
        openTime: `${String(DAY_OPEN_HOUR).padStart(2, '0')}:${String(DAY_OPEN_MINUTE).padStart(2, '0')} AM Addis`,
        closeTime: `${String(DAY_CLOSE_HOUR > 12 ? DAY_CLOSE_HOUR - 12 : DAY_CLOSE_HOUR).padStart(2, '0')}:${String(DAY_CLOSE_MINUTE).padStart(2, '0')} PM Addis (21:28)`,
      },
      openTimestamp: windowInfo.startUtc.getTime(),
      openUtcIso: windowInfo.startUtc.toISOString(),
      closeTimestamp: windowInfo.closeUtc.getTime(),
      closeUtcIso: windowInfo.closeUtc.toISOString(),
      nextUnlockTimestamp: windowInfo.nextUnlockUtc.getTime(),
      nextUnlockUtcIso: windowInfo.nextUnlockUtc.toISOString(),
      isOpen: windowInfo.isOpen,
      isClosed: windowInfo.isClosed,
      isPastCutoff: windowInfo.isPastCutoff,
      secondsUntilClose: windowInfo.isOpen ? Math.max(0, Math.floor((windowInfo.closeUtc.getTime() - now.getTime()) / 1000)) : 0,
      secondsUntilUnlock: windowInfo.isClosed ? Math.max(0, Math.floor((windowInfo.nextUnlockUtc.getTime() - now.getTime()) / 1000)) : 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
