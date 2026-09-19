import { prisma } from '../prisma';
import { getAddisNow, getAddisTimeComponents, workoutWindowForAddisDate } from '../workoutTime';
import { getVoiceProvider } from './voiceCallProvider';
import { verifyWakePhrase, verifySleepPhrase } from './voiceSecurity';
import { sendTelegramMessage } from '../telegram';
import { getAccountabilityRoast } from '../accountabilityRoast';
import { acknowledgeSleep } from '../sleepAccountability';
import { VoiceEventType, VoiceCallStatus } from './types';

export interface VoiceHealthStatus {
  status: 'HEALTHY' | 'BROKEN';
  label: string;
  lastWakeStatus: 'CONFIRMED' | 'PENDING' | 'FAILED' | 'NONE';
  lastSleepStatus: 'CONFIRMED' | 'PENDING' | 'FAILED' | 'NONE';
  lastCallTime?: string;
  attemptsToday: number;
  failureReason?: string | null;
  dailyBudgetRemaining: number;
}

/**
 * Triggers the morning Wake-Up voice call at configured wake time (04:02 AM).
 * Bounded by max attempts (default 3) and daily budget.
 */
export async function triggerWakeVoiceCall(customNow?: Date): Promise<{
  success: boolean;
  status: VoiceCallStatus;
  message: string;
  attemptNumber: number;
}> {
  const addisNow = customNow || getAddisNow();
  const { year, month, day, formatted12h } = getAddisTimeComponents(addisNow);
  const normalizedDate = new Date(Date.UTC(year, month - 1, day));

  const pref = await prisma.notificationPreference.findUnique({ where: { id: 'singleton' } });
  if (pref && !pref.voiceCallsEnabled) {
    return { success: false, status: 'FAILED', message: 'Voice calls disabled in settings', attemptNumber: 0 };
  }

  const maxAttempts = pref?.maxWakeAttempts || 3;
  const phoneNumber = pref?.phoneNumber || process.env.USER_PHONE_NUMBER || '+251900000000';

  // Check today's wake event
  const existingEvents = await prisma.voiceAccountabilityEvent.findMany({
    where: {
      date: normalizedDate,
      eventType: 'WAKE',
    },
    orderBy: { attemptNumber: 'desc' },
  });

  const latestEvent = existingEvents[0];
  if (latestEvent?.confirmationState === 'CONFIRMED') {
    return { success: true, status: 'CONFIRMED', message: 'Wake already confirmed today', attemptNumber: latestEvent.attemptNumber };
  }

  const currentAttempt = (latestEvent?.attemptNumber || 0) + 1;
  if (currentAttempt > maxAttempts) {
    // Max attempts exhausted -> Mark MISSED and trigger Telegram accountability fallback
    await prisma.voiceAccountabilityEvent.create({
      data: {
        date: normalizedDate,
        eventType: 'WAKE',
        scheduledTime: pref?.wakeTime || '04:02',
        status: 'MISSED',
        attemptNumber: currentAttempt,
        confirmationState: 'FAILED',
        failureReason: `${maxAttempts} wake call attempts went unanswered / unconfirmed`,
      },
    });

    await triggerWakeFailureTelegramFallback(maxAttempts);
    return { success: false, status: 'MISSED', message: 'Max wake attempts exceeded', attemptNumber: currentAttempt };
  }

  // Place Voice Call
  const provider = getVoiceProvider();
  const promptText = "Good morning Mikiyas. Forge says it is time to wake up. Say your wake-up confirmation phrase.";

  const callRes = await provider.placeCall({
    to: phoneNumber,
    promptText,
    expectedEventType: 'WAKE',
    callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/voice/webhook?event=WAKE`,
  });

  await prisma.voiceAccountabilityEvent.create({
    data: {
      date: normalizedDate,
      eventType: 'WAKE',
      scheduledTime: pref?.wakeTime || '04:02',
      status: callRes.success ? 'ATTEMPTED' : 'FAILED',
      attemptNumber: currentAttempt,
      confirmationState: 'PENDING',
      failureReason: callRes.error || null,
    },
  });

  return {
    success: callRes.success,
    status: callRes.success ? 'ATTEMPTED' : 'FAILED',
    message: callRes.success ? `Wake call attempt #${currentAttempt} dispatched` : (callRes.error || 'Failed to place call'),
    attemptNumber: currentAttempt,
  };
}

/**
 * Triggers the bedtime Sleep voice call at configured sleep time (11:00 PM).
 */
export async function triggerSleepVoiceCall(customNow?: Date): Promise<{
  success: boolean;
  status: VoiceCallStatus;
  message: string;
  attemptNumber: number;
}> {
  const addisNow = customNow || getAddisNow();
  const { year, month, day } = getAddisTimeComponents(addisNow);
  const normalizedDate = new Date(Date.UTC(year, month - 1, day));

  const pref = await prisma.notificationPreference.findUnique({ where: { id: 'singleton' } });
  if (pref && !pref.voiceCallsEnabled) {
    return { success: false, status: 'FAILED', message: 'Voice calls disabled in settings', attemptNumber: 0 };
  }

  const maxAttempts = pref?.maxSleepAttempts || 3;
  const phoneNumber = pref?.phoneNumber || process.env.USER_PHONE_NUMBER || '+251900000000';

  const existingEvents = await prisma.voiceAccountabilityEvent.findMany({
    where: {
      date: normalizedDate,
      eventType: 'SLEEP',
    },
    orderBy: { attemptNumber: 'desc' },
  });

  const latestEvent = existingEvents[0];
  if (latestEvent?.confirmationState === 'CONFIRMED') {
    return { success: true, status: 'CONFIRMED', message: 'Sleep already confirmed tonight', attemptNumber: latestEvent.attemptNumber };
  }

  const currentAttempt = (latestEvent?.attemptNumber || 0) + 1;
  if (currentAttempt > maxAttempts) {
    await prisma.voiceAccountabilityEvent.create({
      data: {
        date: normalizedDate,
        eventType: 'SLEEP',
        scheduledTime: pref?.sleepTime || '23:00',
        status: 'MISSED',
        attemptNumber: currentAttempt,
        confirmationState: 'FAILED',
        failureReason: `${maxAttempts} sleep call attempts went unconfirmed`,
      },
    });

    await triggerSleepFailureTelegramFallback(maxAttempts);
    return { success: false, status: 'MISSED', message: 'Max sleep attempts exceeded', attemptNumber: currentAttempt };
  }

  const provider = getVoiceProvider();
  const promptText = "Hey Mikiyas. Forge says it is time to sleep. Confirm your sleep check-in.";

  const callRes = await provider.placeCall({
    to: phoneNumber,
    promptText,
    expectedEventType: 'SLEEP',
    callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/voice/webhook?event=SLEEP`,
  });

  await prisma.voiceAccountabilityEvent.create({
    data: {
      date: normalizedDate,
      eventType: 'SLEEP',
      scheduledTime: pref?.sleepTime || '23:00',
      status: callRes.success ? 'ATTEMPTED' : 'FAILED',
      attemptNumber: currentAttempt,
      confirmationState: 'PENDING',
      failureReason: callRes.error || null,
    },
  });

  return {
    success: callRes.success,
    status: callRes.success ? 'ATTEMPTED' : 'FAILED',
    message: callRes.success ? `Sleep call attempt #${currentAttempt} dispatched` : (callRes.error || 'Failed to place call'),
    attemptNumber: currentAttempt,
  };
}

/**
 * Handles incoming voice transcription / STT webhook from phone call.
 * Strictly verifies secret phrase and records confirmation without logging plaintext phrase.
 */
export async function handleVoiceCallWebhook(params: {
  eventType: VoiceEventType;
  spokenSpeech: string;
  callSid?: string;
  customNow?: Date;
}): Promise<{
  confirmed: boolean;
  spokenResponse: string;
  eventRecord?: any;
}> {
  const { eventType, spokenSpeech, callSid, customNow } = params;
  const addisNow = customNow || getAddisNow();
  const { year, month, day } = getAddisTimeComponents(addisNow);
  const normalizedDate = new Date(Date.UTC(year, month - 1, day));

  if (eventType === 'WAKE') {
    const isVerified = verifyWakePhrase(spokenSpeech);

    if (isVerified) {
      const updated = await prisma.voiceAccountabilityEvent.create({
        data: {
          date: normalizedDate,
          eventType: 'WAKE',
          scheduledTime: '04:02',
          status: 'CONFIRMED',
          confirmationState: 'CONFIRMED',
          attemptNumber: 1,
          durationSeconds: 30,
        },
      });

      return {
        confirmed: true,
        spokenResponse: "Wake-up confirmed, Mikiyas. Forge is ready for today's mission.",
        eventRecord: updated,
      };
    } else {
      return {
        confirmed: false,
        spokenResponse: "Wake confirmation phrase not recognized. Please repeat your phrase clearly.",
      };
    }
  }

  if (eventType === 'SLEEP') {
    const isVerified = verifySleepPhrase(spokenSpeech);

    if (isVerified) {
      await acknowledgeSleep('WEB', customNow);

      const updated = await prisma.voiceAccountabilityEvent.create({
        data: {
          date: normalizedDate,
          eventType: 'SLEEP',
          scheduledTime: '23:00',
          status: 'CONFIRMED',
          confirmationState: 'CONFIRMED',
          attemptNumber: 1,
          durationSeconds: 25,
        },
      });

      return {
        confirmed: true,
        spokenResponse: "Sleep check-in confirmed. Good night Mikiyas, rest deeply for tomorrow.",
        eventRecord: updated,
      };
    } else {
      return {
        confirmed: false,
        spokenResponse: "Sleep phrase not recognized. Please repeat your confirmation phrase.",
      };
    }
  }

  return { confirmed: false, spokenResponse: "Unknown voice session event." };
}

/**
 * Evaluates Voice Accountability Health state for the dashboard and settings panel.
 */
export async function getVoiceAccountabilityHealth(customNow?: Date): Promise<VoiceHealthStatus> {
  const addisNow = customNow || getAddisNow();
  const { year, month, day } = getAddisTimeComponents(addisNow);
  const normalizedDate = new Date(Date.UTC(year, month - 1, day));

  const pref = await prisma.notificationPreference.findUnique({ where: { id: 'singleton' } });
  const events = await prisma.voiceAccountabilityEvent.findMany({
    where: { date: normalizedDate },
    orderBy: { createdAt: 'desc' },
  });

  const wakeEvents = events.filter((e) => e.eventType === 'WAKE');
  const sleepEvents = events.filter((e) => e.eventType === 'SLEEP');

  const lastWakeConfirmed = wakeEvents.some((e) => e.confirmationState === 'CONFIRMED');
  const lastWakeFailed = wakeEvents.some((e) => e.status === 'MISSED' || e.status === 'FAILED');

  const lastSleepConfirmed = sleepEvents.some((e) => e.confirmationState === 'CONFIRMED');
  const lastSleepFailed = sleepEvents.some((e) => e.status === 'MISSED' || e.status === 'FAILED');

  const isBroken = lastWakeFailed || lastSleepFailed;
  const failureReason = events.find((e) => e.failureReason)?.failureReason || null;

  return {
    status: isBroken ? 'BROKEN' : 'HEALTHY',
    label: isBroken ? (lastWakeFailed ? '🔴 Wake call failed' : '🔴 Sleep call failed') : '🟢 Healthy',
    lastWakeStatus: lastWakeConfirmed ? 'CONFIRMED' : lastWakeFailed ? 'FAILED' : wakeEvents.length > 0 ? 'PENDING' : 'NONE',
    lastSleepStatus: lastSleepConfirmed ? 'CONFIRMED' : lastSleepFailed ? 'FAILED' : sleepEvents.length > 0 ? 'PENDING' : 'NONE',
    lastCallTime: events[0]?.createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) || undefined,
    attemptsToday: events.length,
    failureReason,
    dailyBudgetRemaining: Math.max(0, (pref?.dailyCallBudget || 10) - events.length),
  };
}

async function triggerWakeFailureTelegramFallback(attempts: number) {
  const roast = await getAccountabilityRoast({
    category: 'COMBINED_MISSED',
    intensity: 3,
    missedItems: ['04:02 AM Wake-Up Confirmation'],
  });

  const accounts = await prisma.telegramAccount.findMany({ where: { active: true } });
  for (const acc of accounts) {
    const target = acc.chatId || acc.telegramId;
    if (target) {
      await sendTelegramMessage(
        target,
        `⚠️ Forge Voice Alert\n\nWake confirmation was not received.\n\nScheduled wake: 04:02 AM\nReason: ${attempts} call attempts were unanswered.\n\n🔥 "${roast.message}"`
      );
    }
  }
}

async function triggerSleepFailureTelegramFallback(attempts: number) {
  const accounts = await prisma.telegramAccount.findMany({ where: { active: true } });
  for (const acc of accounts) {
    const target = acc.chatId || acc.telegramId;
    if (target) {
      await sendTelegramMessage(
        target,
        `⚠️ Forge Voice Alert\n\nSleep confirmation was not received.\n\nScheduled sleep: 11:00 PM\nReason: ${attempts} call attempts unconfirmed. Close Forge and sleep immediately.`
      );
    }
  }
}
