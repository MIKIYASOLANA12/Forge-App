import { prisma } from './prisma';
import { getAddisNow, getAddisTimeComponents, workoutWindowForAddisDate } from './workoutTime';

export interface SleepAccountabilityStatus {
  dateKey: string;
  isSleepWindow: boolean; // true if between 11:00 PM and 05:59 AM
  isOverdue: boolean;
  overdueMinutes: number;
  isAcknowledged: boolean;
  acknowledgedAt: Date | null;
  acknowledgementSource?: 'TELEGRAM' | 'WEB';
  isSnoozed: boolean;
  snoozedUntil: Date | null;
  snoozeCount: number;
  isSessionActive: boolean;
  lastSessionActiveAt: Date | null;
  statusText: string;
  actionRequired: boolean;
}

/**
 * Returns a normalized string date key for the current night's sleep cycle.
 * For hours 23:00..23:59: uses today's Addis date.
 * For hours 00:00..05:59 (early morning before unlock): uses the previous calendar day's date
 * so the night's sleep cycle is continuous and resets at 05:00/11:00 AM.
 */
export function getSleepCycleDateKey(customNow?: Date): string {
  const { year, month, day, hour } = getAddisTimeComponents(customNow);
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  if (hour < 6) {
    dateObj.setUTCDate(dateObj.getUTCDate() - 1);
  }
  return dateObj.toISOString().split('T')[0];
}

/**
 * Returns the normalized UTC date object used for TelegramNotificationLog.
 */
export function getSleepCycleDateObj(customNow?: Date): Date {
  const dateKey = getSleepCycleDateKey(customNow);
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Checks whether user has an active Forge web session (heartbeat within threshold).
 * Default inactivity threshold: 25 minutes.
 */
export async function isUserSessionActive(inactivityThresholdMinutes: number = 25, customNow?: Date): Promise<{ active: boolean; lastActiveAt: Date | null }> {
  const now = customNow || getAddisNow();
  const thresholdTime = new Date(now.getTime() - inactivityThresholdMinutes * 60 * 1000);

  const activeSession = await prisma.userSession.findFirst({
    where: {
      revoked: false,
      lastActiveAt: { gte: thresholdTime },
    },
    orderBy: { lastActiveAt: 'desc' },
  });

  if (activeSession) {
    return { active: true, lastActiveAt: activeSession.lastActiveAt };
  }

  const latestSession = await prisma.userSession.findFirst({
    where: { revoked: false },
    orderBy: { lastActiveAt: 'desc' },
  });

  return { active: false, lastActiveAt: latestSession?.lastActiveAt || null };
}

/**
 * Resolves current sleep accountability status for the current Addis night window.
 */
export async function getSleepAccountabilityStatus(customNow?: Date): Promise<SleepAccountabilityStatus> {
  const { hour, minute, totalMinutes, formatted12h } = getAddisTimeComponents(customNow);
  const now = customNow || getAddisNow();
  const dateKey = getSleepCycleDateKey(customNow);
  const dateObj = getSleepCycleDateObj(customNow);

  // Sleep window: 11:00 PM (1380 mins) to 05:59 AM (359 mins)
  const isSleepWindow = totalMinutes >= 1380 || totalMinutes < 360;

  // Calculate overdue minutes past 11:00 PM
  let overdueMinutes = 0;
  if (totalMinutes >= 1380) {
    overdueMinutes = totalMinutes - 1380;
  } else if (totalMinutes < 360) {
    overdueMinutes = 60 + totalMinutes; // 11:00 PM to 12:00 AM (60 mins) + minutes past midnight
  }

  // 1. Check Acknowledgement in TelegramNotificationLog
  const ackLog = await prisma.telegramNotificationLog.findUnique({
    where: {
      date_type: {
        date: dateObj,
        type: `SLEEP_ACK_${dateKey}`,
      },
    },
  });

  const isAcknowledged = Boolean(ackLog && ackLog.status === 'SENT');
  const acknowledgedAt = ackLog ? ackLog.sentAt : null;
  const acknowledgementSource = ackLog?.message?.includes('WEB') ? 'WEB' : 'TELEGRAM';

  // 2. Check Snooze status
  const snoozeLogs = await prisma.telegramNotificationLog.findMany({
    where: {
      date: dateObj,
      type: { startsWith: `SLEEP_SNOOZE_${dateKey}_` },
    },
    orderBy: { sentAt: 'desc' },
  });

  const snoozeCount = snoozeLogs.length;
  let isSnoozed = false;
  let snoozedUntil: Date | null = null;

  if (snoozeLogs.length > 0) {
    const latestSnooze = snoozeLogs[0];
    try {
      const parsed = JSON.parse(latestSnooze.message || '{}');
      if (parsed.snoozeUntil) {
        snoozedUntil = new Date(parsed.snoozeUntil);
        if (now < snoozedUntil) {
          isSnoozed = true;
        }
      }
    } catch {}
  }

  // 3. Check Session Heartbeat / Activity
  const sessionCheck = await isUserSessionActive(25, customNow);

  let statusText = '🌙 Sleep target: 11:00 PM (ከሌሊቱ 5:00)';
  let actionRequired = false;

  if (isAcknowledged) {
    statusText = '✅ Sleep acknowledged. Rest deeply, Mikiyas.';
  } else if (isSnoozed && snoozedUntil) {
    const minsLeft = Math.max(1, Math.round((snoozedUntil.getTime() - now.getTime()) / 60000));
    statusText = `⏰ Snoozed for ${minsLeft} more minutes.`;
  } else if (isSleepWindow) {
    actionRequired = true;
    if (overdueMinutes === 0) {
      statusText = "😴 It's 11:00 PM — time to sleep, Mikiyas.";
    } else {
      statusText = `⚠️ Sleep overdue by ${overdueMinutes} minutes. Close Forge and get some rest.`;
    }
  } else if (totalMinutes >= 1290 && totalMinutes < 1380) {
    statusText = '🌙 09:30 PM — Wind-down window active. Prepare for 11:00 PM sleep.';
  }

  return {
    dateKey,
    isSleepWindow,
    isOverdue: isSleepWindow && overdueMinutes > 0,
    overdueMinutes,
    isAcknowledged,
    acknowledgedAt,
    acknowledgementSource,
    isSnoozed,
    snoozedUntil,
    snoozeCount,
    isSessionActive: sessionCheck.active,
    lastSessionActiveAt: sessionCheck.lastActiveAt,
    statusText,
    actionRequired,
  };
}

/**
 * Acknowledges sleep for the current night cycle.
 * Called when user clicks "[✅ I'm going to sleep]" in Telegram or web dashboard.
 */
export async function acknowledgeSleep(source: 'TELEGRAM' | 'WEB' = 'TELEGRAM', customNow?: Date) {
  const dateKey = getSleepCycleDateKey(customNow);
  const dateObj = getSleepCycleDateObj(customNow);
  const now = customNow || new Date();

  await prisma.telegramNotificationLog.upsert({
    where: {
      date_type: {
        date: dateObj,
        type: `SLEEP_ACK_${dateKey}`,
      },
    },
    create: {
      date: dateObj,
      type: `SLEEP_ACK_${dateKey}`,
      chatId: 'system',
      message: `SLEEP_ACKNOWLEDGED via ${source}`,
      status: 'SENT',
      sentAt: now,
    },
    update: {
      message: `SLEEP_ACKNOWLEDGED via ${source}`,
      status: 'SENT',
      sentAt: now,
    },
  });

  return {
    success: true,
    dateKey,
    acknowledgedAt: now,
    source,
    message: '✅ Sleep acknowledged. Good night, Mikiyas!',
  };
}

/**
 * Snoozes sleep reminder for the specified number of minutes (default: 5 mins).
 * Enforces max 3 snoozes per night to prevent abuse.
 */
export async function snoozeSleep(minutes: number = 5, customNow?: Date) {
  const dateKey = getSleepCycleDateKey(customNow);
  const dateObj = getSleepCycleDateObj(customNow);
  const now = customNow || new Date();

  const existingSnoozes = await prisma.telegramNotificationLog.count({
    where: {
      date: dateObj,
      type: { startsWith: `SLEEP_SNOOZE_${dateKey}_` },
    },
  });

  if (existingSnoozes >= 3) {
    return {
      success: false,
      snoozed: false,
      reason: 'MAX_SNOOZE_REACHED',
      message: '⚠️ Maximum of 3 snoozes reached for tonight. Please shut down and go to sleep.',
    };
  }

  const snoozeUntil = new Date(now.getTime() + minutes * 60 * 1000);
  const snoozeIndex = existingSnoozes + 1;

  await prisma.telegramNotificationLog.create({
    data: {
      date: dateObj,
      type: `SLEEP_SNOOZE_${dateKey}_${snoozeIndex}`,
      chatId: 'system',
      message: JSON.stringify({ snoozeIndex, minutes, snoozeUntil: snoozeUntil.toISOString() }),
      status: 'SENT',
      sentAt: now,
    },
  });

  return {
    success: true,
    snoozed: true,
    snoozeCount: snoozeIndex,
    snoozeUntil,
    message: `⏰ Snoozed for ${minutes} minutes (Snooze ${snoozeIndex}/3). Next reminder at ${snoozeUntil.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}.`,
  };
}
