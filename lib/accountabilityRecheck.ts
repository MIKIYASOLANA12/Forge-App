import { prisma } from './prisma';
import {
  getAddisNow,
  workoutWindowForAddisDate,
  getDayOfJourney300,
} from './workoutTime';
import { sendTelegramMessage } from './telegram';
import { getDailyBreakdown } from './progressEngine';
import { computeLevel } from './xp';
import { getAccountabilityRoast } from './accountabilityRoast';

export type AccountabilityDeliveryState = 'NOT_SENT' | 'SENT' | 'DELIVERY_FAILED' | 'UNKNOWN';

const ACCOUNTABILITY_TYPES = ['ACCOUNTABILITY', 'MISSED_DAY_REPORT', 'COMPLETION_REPORT'];

export const REMINDER_MIN_INTERVAL_MS = 3 * 60 * 1000;
export const DELIVERY_RETRY_MIN_INTERVAL_MS = 60 * 1000;
export const MAX_REMINDERS_PER_DAY = 24;

/** Distinct reminder roasts (spec section 6) — rotate to avoid repeats. */
export const REMINDER_ROASTS: string[] = [
  'Workout missed. The checkbox survived another day.',
  'Still waiting for that apology. Your schedule is collecting evidence.',
  'Yesterday remains officially undefeated by you.',
  'At this point the Todo list is waiting for a formal apology.',
  'Your missed items are now more consistent than your workout routine.',
  "The checkbox doesn't need a rest day. It's still waiting for you.",
  'Forge noticed. The silence is not a pass; it is a pending charge.',
  'One unchecked day turns into two. Two turns into a habit. Acknowledge it.',
  "Today's plan closed at 9:28 PM. The apology window is still open.",
  'Missed items stay missed until you own them. This is that moment.',
];

export function normalizedDateKeyFromAddis(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** UTC-midnight normalized date used as TelegramNotificationLog `date` (matches scheduler). */
export function getLogDateForWindow(
  windowInfo: ReturnType<typeof workoutWindowForAddisDate>
): Date {
  return new Date(
    Date.UTC(windowInfo.startAddis.getFullYear(), windowInfo.startAddis.getMonth(), windowInfo.startAddis.getDate())
  );
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return String(Math.abs(hash));
}

function normalizeAck(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019`]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Decide whether an incoming Telegram message is an explicit accountability
 * acknowledgement (spec section 5). Only clear acknowledgement phrases count.
 */
export function isAcknowledgementText(text: string): string | null {
  const n = normalizeAck(text);
  if (!n) return null;

  const exact = new Set([
    "i'm sorry, i will not do it again",
    "i'm so sorry, i will not do it again",
    'i am so sorry, i will not do it again',
    'sorry',
    "i won't do it again",
    'i understand',
    "i'll do better",
    'i will do better',
    'i will be better',
  ]);
  if (exact.has(n)) return n;

  if (n.startsWith('sorry')) return n;
  if (n.includes("won't do it again") || n.includes('will not do it again')) return n;
  if (n.includes('i understand')) return n;
  if ((n.includes("i'll") || n.includes('i will')) && n.includes('better')) return n;

  return null;
}

function labelOf(description: string): { title?: string; bookTitle?: string } {
  try {
    const parsed = typeof description === 'string' ? JSON.parse(description) : description;
    return {
      title: parsed?.title ? String(parsed.title) : undefined,
      bookTitle: parsed?.bookTitle ? String(parsed.bookTitle) : undefined,
    };
  } catch {
    return {};
  }
}
/**
 * Detect which required activities were missed for a given Addis day window.
 * Keyed off the window (not "now"), so a delayed cron still flags the same day.
 */
export async function detectMissedActivities(
  windowInfo: ReturnType<typeof workoutWindowForAddisDate>
): Promise<string[]> {
  const missedKeys = new Map<string, boolean>();
  const otherMissed: string[] = [];

  const [workoutLog, planres] = await Promise.all([
    prisma.workoutLog.findFirst({
      where: { completedAt: { gte: windowInfo.startUtc, lte: windowInfo.endUtc } },
      include: { workoutDay: true },
    }),
    prisma.dailyPlan.findFirst({
      where: { date: { gte: windowInfo.startUtc, lte: windowInfo.endUtc } },
      include: { tasks: true },
    }),
  ]);

  if (!workoutLog) missedKeys.set('Workout', true);

  for (const t of planres?.tasks ?? []) {
    if (t.completed) continue;
    const meta = labelOf(t.description);
    const label = meta.title || t.description;
    const subj = (t.subject || label).toLowerCase();

    if (subj.includes('chemistry')) {
      missedKeys.set('Chemistry', true);
    } else if (subj.includes('javascript') || subj.includes('5 million coders') || subj.includes('coding')) {
      missedKeys.set('JavaScript / 5 Million Coders', true);
    } else if (subj.includes('reading')) {
      missedKeys.set(`Reading${meta.bookTitle ? ` — ${meta.bookTitle}` : ''}`, true);
    } else if (
      subj.includes('biology') ||
      subj.includes('physics') ||
      subj.includes('mathematics') ||
      subj.includes(' math') ||
      subj.includes('english')
    ) {
      missedKeys.set(label, true);
    } else {
      otherMissed.push(label);
    }
  }

  for (const o of otherMissed.slice(0, 4)) missedKeys.set(o, true);

  const missed: string[] = [];
  for (const [key, val] of missedKeys.entries()) {
    if (val) missed.push(key);
  }
  return missed;
}

/** Ensure exactly one accountability session exists for a given day (no duplicates). */
async function ensureSession(userId: string, addisDateKey: string, missed: string[], roast: string) {
  return prisma.accountabilitySession.upsert({
    where: { addisDateKey },
    create: {
      addisDateKey,
      userId,
      state: 'PENDING',
      missedItems: JSON.stringify(missed),
      initialRoast: roast,
    },
    update: {},
  });
}

function deliveryStatusOf(log?: {
  status: string;
  telegramMessageId?: number | null;
}): AccountabilityDeliveryState {
  if (!log) return 'NOT_SENT';
  if (log.status === 'SENT' && log.telegramMessageId != null) return 'SENT';
  if (log.status === 'DELIVERY_FAILED') return 'DELIVERY_FAILED';
  if (log.status === 'NOT_SENT') return 'NOT_SENT';
  return 'UNKNOWN';
}

/** Which chat to deliver to — the first active verified Telegram account. */
async function getTargetChat(): Promise<string | null> {
  const accounts = await prisma.telegramAccount.findMany({
    where: { active: true },
    orderBy: { createdAt: 'asc' },
  });
  for (const acc of accounts) {
    const chat = acc.chatId || acc.telegramId;
    if (chat) return String(chat);
  }
  return null;
}

/** Combined accountability message (spec section 9). */
async function buildMissedMessage(
  windowInfo: ReturnType<typeof workoutWindowForAddisDate>,
  missed: string[]
): Promise<string> {
  const day300 = getDayOfJourney300(windowInfo.startAddis);
  const [breakdown, profile] = await Promise.all([
    getDailyBreakdown(windowInfo.startAddis),
    prisma.userProfile.findUnique({ where: { id: 'singleton' } }),
  ]);
  const totalXp = profile?.totalXp ?? 0;
  const level = profile?.level ?? computeLevel(totalXp);

  const roast =
    missed.length > 1
      ? await getAccountabilityRoast({ category: 'COMBINED_MISSED', intensity: 3, missedItems: missed })
      : await getAccountabilityRoast({ category: 'WORKOUT_MISSED', intensity: 3, missedItems: missed });

  const formattedDate = windowInfo.startAddis.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    '🔥 FORGE ACCOUNTABILITY\n' +
    `${formattedDate} \u2022 ${day300.formatted}\n\n` +
    'MISSED:\n' +
    missed.map((m) => `❌ ${m}`).join('\n') +
    '\n\n' +
    `Consistency:\n${breakdown.consistencyScore}%\n` +
    `XP:\n${totalXp}\n` +
    `Level:\n${level}\n\n` +
    'ROAST:\n' +
    `${roast.message}\n\n` +
    'Reply with "I\'m so sorry, I will not do it again" to acknowledge.'
  );
}
async function verifyNotification(windowInfo: ReturnType<typeof workoutWindowForAddisDate>) {
  const logDate = getLogDateForWindow(windowInfo);
  const logs = await prisma.telegramNotificationLog.findMany({
    where: { date: logDate, type: { in: ACCOUNTABILITY_TYPES } },
    orderBy: { sentAt: 'desc' },
  });
  return { state: deliveryStatusOf((logs[0] as { status: string; telegramMessageId?: number | null } | undefined)), logs };
}

/** Determine current accountability delivery state from the DB (spec section 2). */
export async function verifyAccountabilityDelivery(
  windowInfo: ReturnType<typeof workoutWindowForAddisDate>
): Promise<{ state: AccountabilityDeliveryState; log: unknown }> {
  const { state, logs } = await verifyNotification(windowInfo);
  return { state, log: (logs[0] as { status: string; telegramMessageId?: number | null } | undefined) ?? null };
}

/**
 * Deliver (or retry) the missed-day accountability message. Only marks SENT when
 * Telegram's API confirms success with a message_id (spec section 3).
 */
async function deliverMissedMessage(
  session: Awaited<ReturnType<typeof ensureSession>>,
  windowInfo: ReturnType<typeof workoutWindowForAddisDate>,
  missed: string[],
  opts?: { force?: boolean }
): Promise<{ delivered: boolean; state: AccountabilityDeliveryState; messageId?: number }> {
  const logDate = getLogDateForWindow(windowInfo);
  const { state } = await verifyNotification(windowInfo);
  if (state === 'SENT' && !opts?.force) return { delivered: false, state };

  const chat = await getTargetChat();
  if (!chat) return { delivered: false, state: 'NOT_SENT' };

  const message = await buildMissedMessage(windowInfo, missed);
  const existing = await prisma.telegramNotificationLog.findUnique({
    where: { date_type: { date: logDate, type: 'ACCOUNTABILITY' } },
  });
  const retryCount = existing ? existing.retryCount : 0;

  // Controlled retry interval to respect Telegram rate limits (spec section 4).
  if (retryCount > 0 && existing?.sentAt && !opts?.force) {
    const last = new Date(existing.sentAt).getTime();
    if (Date.now() - last < DELIVERY_RETRY_MIN_INTERVAL_MS) {
      return { delivered: false, state: 'DELIVERY_FAILED' };
    }
  }

  const res = await sendTelegramMessage(chat, message);
  const ok = res.ok && typeof res.result?.message_id === 'number';
  const msgId = ok ? Number(res.result.message_id) : null;
  const nextRetry = retryCount + 1;

  await prisma.telegramNotificationLog.upsert({
    where: { date_type: { date: logDate, type: 'ACCOUNTABILITY' } },
    create: {
      date: logDate,
      type: 'ACCOUNTABILITY',
      chatId: chat,
      message,
      status: ok ? 'SENT' : 'DELIVERY_FAILED',
      telegramMessageId: ok ? msgId : null,
      errorMessage: ok ? null : (res?.description ?? undefined),
      retryCount: nextRetry,
    },
    update: {
      sentAt: new Date(),
      chatId: chat,
      message,
      status: ok ? 'SENT' : 'DELIVERY_FAILED',
      telegramMessageId: ok ? msgId : (existing?.telegramMessageId ?? null),
      errorMessage: ok ? null : (res?.description ?? undefined),
      retryCount: nextRetry,
    },
  });

  if (ok) {
    await prisma.accountabilitySession.update({
      where: { id: session.id },
      data: { telegramMessageId: msgId },
    });
    return { delivered: true, state: 'SENT', messageId: msgId as number };
  }
  return { delivered: false, state: (res as any)?.ok === false ? 'DELIVERY_FAILED' : 'UNKNOWN' };
}
/** Send another distinct roast/reminder while a session is still PENDING (spec section 6). */
async function sendRepeatedReminder(
  session: Awaited<ReturnType<typeof ensureSession>>
): Promise<{ sent: boolean; roast?: string }> {
  if (session.state !== 'PENDING') return { sent: false };
  if (session.reminderCount >= MAX_REMINDERS_PER_DAY) return { sent: false };
  if (session.lastReminderAt) {
    const last = new Date(session.lastReminderAt).getTime();
    if (Date.now() - last < REMINDER_MIN_INTERVAL_MS) return { sent: false };
  }
  const chat = await getTargetChat();
  if (!chat) return { sent: false };

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recent = await prisma.accountabilityRoastLog.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { roastHash: true },
  });
  const used = new Set(recent.map((r) => r.roastHash));
  const pool = REMINDER_ROASTS.filter((r) => !used.has(hashString(r)));
  const chosen =
    (pool.length > 0 ? pool : REMINDER_ROASTS)[
      Math.floor(Math.random() * (pool.length > 0 ? pool.length : REMINDER_ROASTS.length))
    ];

  const day300 = getDayOfJourney300(getAddisNow());
  const text = `🔥 ${day300.formatted}\n\n"${chosen}"\n\nReply with "I'm so sorry, I will not do it again" to acknowledge.`;

  const res = await sendTelegramMessage(chat, text);
  const ok = res.ok && typeof res.result?.message_id === 'number';
  const msgId = ok ? Number(res.result.message_id) : null;
  const logDate = getLogDateForWindow(getAddisWindow());

  await prisma.telegramNotificationLog.upsert({
    where: { date_type: { date: logDate, type: 'ACCOUNTABILITY_REMINDER' } },
    create: { date: logDate, type: 'ACCOUNTABILITY_REMINDER', chatId: chat, message: text, status: ok ? 'SENT' : 'DELIVERY_FAILED', telegramMessageId: ok ? msgId : null, errorMessage: ok ? null : (res?.description ?? undefined) },
    update: { sentAt: new Date(), message: text, status: ok ? 'SENT' : 'DELIVERY_FAILED', telegramMessageId: ok ? msgId : undefined, errorMessage: ok ? null : (res?.description ?? undefined) },
  });
  await prisma.accountabilityRoastLog.upsert({
    where: { date_category: { date: logDate, category: 'ACCOUNTABILITY_REMINDER' } },
    create: { date: logDate, category: 'ACCOUNTABILITY_REMINDER', intensity: 3, roastHash: hashString(chosen), message: text },
    update: { roastHash: hashString(chosen), message: text },
  }).catch(() => {});

  if (ok) {
    await prisma.accountabilitySession.update({
      where: { id: session.id },
      data: {
        reminderCount: { increment: 1 },
        lastReminderAt: new Date(),
        lastReminderRoast: chosen,
        telegramMessageId: msgId,
      },
    });
    return { sent: true, roast: chosen };
  }
  return { sent: false };
}

function getAddisWindow(): ReturnType<typeof workoutWindowForAddisDate> {
  return workoutWindowForAddisDate(getAddisNow());
}
/**
 * Main reliable recheck entry point. Safe under repeated/delayed cron triggers:
 * idempotent, Addis-time authoritative, delivery-confirmed, rate-limited.
 */
export async function runAccountabilityRecheck(opts?: { force?: boolean }): Promise<any> {
  const now = getAddisNow();
  const windowInfo = workoutWindowForAddisDate(now);
  const addisDateKey = normalizedDateKeyFromAddis(windowInfo.startAddis);

  // Only enforce after the authoritative 09:28 PM close (spec section 13).
  if (!windowInfo.isClosed && !opts?.force) {
    return { status: 'OPEN', message: 'Execution window still open (closes 21:28 Addis)', addisDateKey };
  }

  const missed = await detectMissedActivities(windowInfo);
  if (missed.length === 0) {
    return { status: 'NO_MISSED', addisDateKey, missedItems: [] };
  }

  // One session per day (no duplicates — spec section 8).
  const session = await ensureSession('singleton', addisDateKey, missed, missed.join(', '));

  // Verify delivery; deliver or retry only if not confirmed SENT.
  const delivery = await deliverMissedMessage(session, windowInfo, missed, { force: opts?.force });

  let reminder: { sent: boolean; roast?: string } | undefined;
  if (session.state === 'PENDING') {
    reminder = await sendRepeatedReminder(session);
  }

  const fresh = await prisma.accountabilitySession.findUnique({ where: { addisDateKey } });
  return {
    status: fresh?.state ?? 'PENDING',
    addisDateKey,
    missedItems: missed,
    deliveryState: delivery.state,
    delivered: delivery.delivered,
    telegramMessageId: delivery.messageId ?? session.telegramMessageId,
    reminderSent: reminder?.sent ?? false,
    reminderRoast: reminder?.roast ?? session.lastReminderRoast,
    reminderCount: fresh?.reminderCount ?? session.reminderCount,
  };
}

/** Status for the website /today + /todo (spec section 10). */
export async function getAccountabilityStatus() {
  const now = getAddisNow();
  const windowInfo = workoutWindowForAddisDate(now);
  const addisDateKey = normalizedDateKeyFromAddis(windowInfo.startAddis);

  const session = await prisma.accountabilitySession.findUnique({ where: { addisDateKey } });
  const active = session && session.state === 'PENDING' ? session : null;

  return {
    status: active ? 'PENDING' : 'RESOLVED',
    addisDateKey,
    missedItems: session ? JSON.parse(session.missedItems || '[]') : [],
    roast: session?.initialRoast ?? null,
    acknowledged: Boolean(session?.acknowledgementText),
    acknowledgementText: session?.acknowledgementText ?? null,
    acknowledgementAt: session?.acknowledgementAt ?? null,
    resolvedAt: session?.resolvedAt ?? null,
    reminderCount: session?.reminderCount ?? 0,
    state: session?.state ?? null,
  };
}

/**
 * Resolve a PENDING session when the user explicitly acknowledges (spec section 5/7).
 * `found:false` when there is no pending session or the text is not an acknowledgement.
 */
export async function resolveAccountabilityByMessage(text: string): Promise<{
  found: boolean;
  acknowledged?: Awaited<ReturnType<typeof ensureSession>>;
}> {
  const phrase = isAcknowledgementText(text);
  if (!phrase) return { found: false };

  const pending = await prisma.accountabilitySession.findFirst({
    where: { state: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
  if (!pending) return { found: false };

  const updated = await prisma.accountabilitySession.update({
    where: { id: pending.id },
    data: {
      state: 'RESOLVED',
      acknowledgementText: phrase,
      acknowledgementAt: new Date(),
      resolvedAt: new Date(),
    },
  });

  const chat = await getTargetChat();
  if (chat) {
    await sendTelegramMessage(
      chat,
      "Apology accepted. Tomorrow's checklist is waiting. Let's see if the checkbox survives this time."
    ).catch(() => {});
  }
  return { found: true, acknowledged: updated };
}