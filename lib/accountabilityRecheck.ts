import { prisma } from './prisma';
import {
  getAddisNow,
  workoutWindowForAddisDate,
  getDayOfJourney300,
} from './workoutTime';
import { sendTelegramMessage } from './telegram';
import { getDailyBreakdown, getProgressHistory } from './progressEngine';
import { computeLevel } from './xp';
import { getAccountabilityRoast, RoastCategory } from './accountabilityRoast';
import { parsePlanMetadata, formatTaskForDisplay } from './planParser';

export type WorkoutWindow = ReturnType<typeof workoutWindowForAddisDate>;
export type AccountabilityDeliveryState = 'NOT_SENT' | 'SENT' | 'DELIVERY_FAILED' | 'UNKNOWN';

const ACCOUNTABILITY_TYPES = ['ACCOUNTABILITY', 'MISSED_DAY_REPORT', 'COMPLETION_REPORT'];

export const REMINDER_MIN_INTERVAL_MS = 3 * 60 * 1000;
export const MAX_REMINDERS_PER_DAY = 24;

// Controlled delivery retry schedule (spec section 8). Index = retryCount.
// Escalating backoff so we never spam Telegram (>=1 msg/sec per chat).
export const DELIVERY_RETRY_BACKOFF_MS = [
  0,
  2 * 60 * 1000, // +2 minutes
  5 * 60 * 1000, // +5 minutes
  10 * 60 * 1000,
  30 * 60 * 1000,
  60 * 60 * 1000,
  2 * 60 * 60 * 1000,
  4 * 60 * 60 * 1000,
];
export const MAX_DELIVERY_RETRIES = DELIVERY_RETRY_BACKOFF_MS.length;

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

// ── Report types ─────────────────────────────────────────────────────────────

export type MissedTaskItem = {
  title: string;
  category: string;
  subject?: string;
  taskId?: string;
  label?: string; // backwards compatibility
};

export type MissedReport = {
  addisDateKey: string;
  window: WorkoutWindow;
  workoutMissed: boolean;
  workoutType: string | null;
  workoutSubmitted: boolean;
  missedTasks: MissedTaskItem[];
  completedTasks: string[];
  habits: { completed: number; total: number; missedNames: string[] };
  missedAll: string[];
  completedAll: string[];
  notRequired: string[];
};
export function normalizedDateKeyFromAddis(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** UTC-midnight normalized date used as TelegramNotificationLog `date` (matches scheduler). */
export function getLogDateForWindow(windowInfo: WorkoutWindow): Date {
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

/**
 * Which Addis day we grade. At/after the 21:28 close we grade the day that
 * just closed. Before 05:00 (or during an open day) we grade the *previous*
 * closed day — we never grade the current open day. This keeps a delayed cron
 * from rechecking the freshly-unlocked day and dropping yesterday's missed list
 * (spec sections 12/13).
 */
export function windowToGrade(now: Date = getAddisNow()): WorkoutWindow {
  const win = workoutWindowForAddisDate(now);
  if (win.isClosed) return win;
  const prevAddis = new Date(win.startAddis);
  prevAddis.setDate(prevAddis.getDate() - 1);
  return workoutWindowForAddisDate(prevAddis);
}
function labelOf(description: string): { title?: string; bookTitle?: string; pagesTarget?: string; subject?: string; mainTopic?: string } {
  try {
    const parsed = typeof description === 'string' ? JSON.parse(description) : description;
    return {
      title: parsed?.title ? String(parsed.title) : undefined,
      bookTitle: parsed?.bookTitle ? String(parsed.bookTitle) : undefined,
      pagesTarget: parsed?.pagesTarget ? String(parsed.pagesTarget) : undefined,
      subject: parsed?.subject ? String(parsed.subject) : undefined,
      mainTopic: parsed?.mainTopic ? String(parsed.mainTopic) : undefined,
    };
  } catch {
    return {};
  }
}

/** Classify a task into a category by subject/title (never hard-coded to one subject). */
function classifyTask(subjectRaw?: string | null, titleRaw = '', descriptionRaw = ''): string {
  const s = `${subjectRaw || ''} ${titleRaw} ${descriptionRaw}`.toLowerCase();
  if (/workout|gym|legs|push|pull/i.test(s)) return 'Workout';
  if (/chem/i.test(s)) return 'Chemistry';
  if (/javascript|js\s?cod|5 million/i.test(s)) return 'JavaScript';
  if (/reading|book/i.test(s)) return 'Reading';
  if (/biolog/i.test(s)) return 'Biology';
  if (/math|calculus|geometry/i.test(s)) return 'Mathematics';
  if (/physics|kinematics|newton/i.test(s)) return 'Physics';
  if (/english|vocab/i.test(s)) return 'English';
  if (/habit/i.test(s)) return 'Habit';
  return 'Other';
}

/** Per-item display line (e.g. "Chemistry — Stoichiometry", "Reading — Book (pages 42–53)"). */
function taskDisplayLabel(category: string, t: { subject?: string | null; topic?: string | null; description: string }): string {
  return formatTaskForDisplay(t);
}
/**
 * Detect ALL missed + completed required activities for a closed Addis day
 * window (spec sections 1-4). Checks Workout independently, every scheduled
 * PlanTask by real category/subject/topic, and Habits. Returns a full report,
 * not just "Chemistry".
 */
export async function detectMissedActivities(windowInfo: WorkoutWindow): Promise<MissedReport> {
  const addisDateKey = normalizedDateKeyFromAddis(windowInfo.startAddis);

  const [workoutLog, planres, activeHabits, doneHabits] = await Promise.all([
    prisma.workoutLog.findFirst({
      where: { completedAt: { gte: windowInfo.startUtc, lte: windowInfo.endUtc } },
      include: { workoutDay: true },
    }),
    prisma.dailyPlan.findFirst({
      where: { date: { gte: windowInfo.startUtc, lte: windowInfo.endUtc } },
      include: { tasks: true },
    }),
    prisma.habit.findMany({ where: { active: true } }),
    prisma.habitLog.findMany({
      where: { date: { gte: windowInfo.startUtc, lte: windowInfo.endUtc }, completed: true },
    }),
  ]);

  const workoutMissed = !workoutLog;
  const workoutType = workoutLog?.workoutDay?.type ?? null;
  const workoutSubmitted = Boolean(workoutLog);

  const missedTasks: MissedTaskItem[] = [];
  const completedTasks: string[] = [];
  for (const t of planres?.tasks ?? []) {
    const meta = parsePlanMetadata(t.description, t);
    const category = meta.category === 'GENERAL' ? classifyTask(t.subject, meta.displayTitle, t.description) : meta.category;
    const formattedTitle = formatTaskForDisplay(t);
    if (t.completed) {
      completedTasks.push(formattedTitle);
    } else {
      missedTasks.push({
        title: formattedTitle,
        category,
        subject: meta.subject || t.subject || undefined,
        taskId: t.id,
        label: formattedTitle,
      });
    }
  }

  const doneHabitIds = new Set(doneHabits.map((hl) => hl.habitId));
  const missedHabits = activeHabits.filter((h) => !doneHabitIds.has(h.id)).map((h) => h.name);
  const doneHabitNames = activeHabits.filter((h) => doneHabitIds.has(h.id)).map((h) => h.name);

  const missedAll: string[] = [];
  const seen = new Set<string>();
  const pushMissed = (line: string) => {
    const k = line.toLowerCase();
    if (line && !seen.has(k)) {
      seen.add(k);
      missedAll.push(line);
    }
  };
  if (workoutMissed) pushMissed('Workout');
  for (const m of missedTasks) pushMissed(m.title);
  missedHabits.forEach((h) => pushMissed(h));

  const completedAll: string[] = [];
  const cseen = new Set<string>();
  const pushCompleted = (line: string) => {
    const k = line.toLowerCase();
    if (line && !cseen.has(k)) {
      cseen.add(k);
      completedAll.push(line);
    }
  };
  if (!workoutMissed && workoutType) pushCompleted(`Workout (${workoutType})`);
  completedTasks.forEach(pushCompleted);
  doneHabitNames.forEach(pushCompleted);

  const scheduled = new Set<string>(['Workout']);
  missedTasks.forEach((m) => scheduled.add(m.category));
  completedTasks.forEach((c) => scheduled.add(classifyTask(null, c)));
  if (activeHabits.length > 0) scheduled.add('Habit');
  const ALL_CATEGORIES = ['Workout', 'Chemistry', 'JavaScript', 'Reading', 'Biology', 'Mathematics', 'Physics', 'English', 'Habit'];
  const notRequired = ALL_CATEGORIES.filter((c) => !scheduled.has(c));

  return {
    addisDateKey,
    window: windowInfo,
    workoutMissed,
    workoutType,
    workoutSubmitted,
    missedTasks,
    completedTasks,
    habits: { completed: doneHabitIds.size, total: activeHabits.length, missedNames: missedHabits },
    missedAll,
    completedAll,
    notRequired,
  };
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

function deliveryStatusOf(log?: { status: string; telegramMessageId?: number | null }): AccountabilityDeliveryState {
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

/** Days with consistency >= 60 formed a streak (matches the existing scheduler). */
function computeActiveStreak(history: { consistencyScore: number }[]): number {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].consistencyScore >= 60) streak++;
    else break;
  }
  return streak;
}

/** Choose a roast category from the ACTUAL misses (spec section 5 — never just one hard-coded subject). */
function singleCategory(report: MissedReport): RoastCategory {
  if (report.missedAll.length === 0 || report.missedAll.length > 1) return 'COMBINED_MISSED';
  const c = (report.missedTasks[0]?.category ?? report.missedAll[0] ?? '').toLowerCase();
  if (c.includes('chem')) return 'CHEMISTRY_MISSED';
  if (c.includes('javascript') || c.includes('cod')) return 'JAVASCRIPT_MISSED';
  if (c.includes('read')) return 'READING_MISSED';
  return 'WORKOUT_MISSED';
}

function celebrateText(): string {
  return 'Flawless execution today: every scheduled task locked in. Unstoppable momentum — keep this standard. 🚀';
}

/** Best-effort "Tomorrow" focus list from the next open day's scheduled plan. */
async function buildTomorrowFocus(windowInfo: WorkoutWindow): Promise<string> {
  const nextAddis = new Date(windowInfo.startAddis);
  nextAddis.setDate(nextAddis.getDate() + 1);
  try {
    const nextWindow = workoutWindowForAddisDate(nextAddis);
    const plan = await prisma.dailyPlan.findFirst({
      where: { date: { gte: nextWindow.startUtc, lte: nextWindow.endUtc } },
      include: { tasks: true },
    });
    if (plan && plan.tasks.length > 0) {
      return plan.tasks
        .map((t) => `• ${taskDisplayLabel(classifyTask(t.subject, t.description, t.description), t)}`)
        .join('\n');
    }
  } catch {
    /* fall through */
  }
  return ['Workout', 'Chemistry', 'JavaScript', 'Reading'].join('\n');
}

/**
 * Combined accountability message (spec section 6). Contains EVERY actual
 * missed item (all ❌ lines) + completed (✅ lines), consistency/XP/level/streak,
 * a contextual roast, and tomorrow's focus. Exported so tests can verify the
 * message actually contains every missed category.
 */
export async function buildMissedMessage(windowInfo: WorkoutWindow, report: MissedReport): Promise<string> {
  const day300 = getDayOfJourney300(windowInfo.startAddis);
  const [breakdown, profile, history, tomorrow] = await Promise.all([
    getDailyBreakdown(windowInfo.startAddis),
    prisma.userProfile.findUnique({ where: { id: 'singleton' } }),
    getProgressHistory(7),
    buildTomorrowFocus(windowInfo),
  ]);
  const totalXp = profile?.totalXp ?? 0;
  const level = profile?.level ?? computeLevel(totalXp);
  const activeStreak = computeActiveStreak(history);

  const missedLines = report.missedAll.length > 0 ? report.missedAll.map((m) => `❌ ${m}`) : ['(nothing missed)'];
  const completedLines = report.completedAll.length > 0 ? report.completedAll.map((c) => `✅ ${c}`) : ['(none)'];

  const roast = await getAccountabilityRoast({
    category: singleCategory(report),
    intensity: 3,
    missedItems: report.missedAll,
  });
  const roastText = report.missedAll.length === 0 ? celebrateText() : roast.message;

  const formattedDate = windowInfo.startAddis.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    '🔥 FORGE ACCOUNTABILITY\n' +
    `DAY ${day300.dayNumber} / ${day300.totalDays}\n` +
    `${formattedDate}\n\n` +
    'MISSED:\n' +
    missedLines.join('\n') +
    '\n\nCompleted:\n' +
    completedLines.join('\n') +
    '\n\n' +
    `Consistency: ${breakdown.consistencyScore}%\n` +
    `XP: ${totalXp}\n` +
    `Level: ${level}\n` +
    `Streak: ${activeStreak}\n\n` +
    '🔥 ROAST:\n' +
    roastText +
    '\n\nTomorrow:\n' +
    (tomorrow || '—') +
    '\n\nReply with "I\'m so sorry, I will not do it again" to acknowledge.'
  );
}
async function verifyNotification(windowInfo: WorkoutWindow) {
  const logDate = getLogDateForWindow(windowInfo);
  const logs = await prisma.telegramNotificationLog.findMany({
    where: { date: logDate, type: { in: ACCOUNTABILITY_TYPES } },
    orderBy: { sentAt: 'desc' },
  });
  return { state: deliveryStatusOf(logs[0] as { status: string; telegramMessageId?: number | null } | undefined), logs };
}

/**
 * Determine current accountability delivery state from the DB (spec section 2).
 */
export async function verifyAccountabilityDelivery(
  windowInfo: WorkoutWindow
): Promise<{ state: AccountabilityDeliveryState; log: unknown }> {
  const { state, logs } = await verifyNotification(windowInfo);
  return { state, log: (logs[0] as { status: string; telegramMessageId?: number | null } | undefined) ?? null };
}

/**
 * Deliver (or retry) the missed-day accountability message (spec sections 3/7/8).
 * - Duplicate prevention: one `ACCOUNTABILITY` log per day, unless the first
 *   delivery genuinely failed (DELIVERY_FAILED) and needs a retry.
 * - Only marks SENT when Telegram confirms success with a message_id.
 * - Uses escalating backoff (DELIVERY_RETRY_BACKOFF_MS) to respect rate limits.
 */
async function deliverMissedMessage(
  session: Awaited<ReturnType<typeof ensureSession>>,
  windowInfo: WorkoutWindow,
  report: MissedReport
): Promise<{ delivered: boolean; state: AccountabilityDeliveryState; messageId?: number }> {
  const logDate = getLogDateForWindow(windowInfo);
  const existing = await prisma.telegramNotificationLog.findUnique({
    where: { date_type: { date: logDate, type: 'ACCOUNTABILITY' } },
  });

  // Already confirmed SENT => done (duplicate prevention, spec section 9).
  if (existing && existing.status === 'SENT' && existing.telegramMessageId != null) {
    return { delivered: false, state: 'SENT', messageId: existing.telegramMessageId ?? undefined };
  }

  // Retry pacing (spec section 8).
  const retryCount = existing ? existing.retryCount : 0;
  const backoffMs =
    DELIVERY_RETRY_BACKOFF_MS[Math.min(retryCount, MAX_DELIVERY_RETRIES - 1)] ?? 0;
  if (retryCount > 0 && existing?.sentAt && backoffMs > 0) {
    const last = new Date(existing.sentAt).getTime();
    if (Date.now() - last < backoffMs) {
      return { delivered: false, state: 'DELIVERY_FAILED' };
    }
  }

  const chat = await getTargetChat();
  if (!chat) return { delivered: false, state: 'NOT_SENT' };

  const message = await buildMissedMessage(windowInfo, report);
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
      telegramMessageId: ok ? msgId : undefined,
      errorMessage: ok ? null : (res?.description ?? undefined),
      retryCount: nextRetry,
    },
  });

  if (ok && msgId != null) {
    await prisma.accountabilitySession.update({
      where: { id: session.id },
      data: { telegramMessageId: msgId },
    });
    return { delivered: true, state: 'SENT', messageId: msgId };
  }
  return { delivered: false, state: res?.ok === false ? 'DELIVERY_FAILED' : 'UNKNOWN' };
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
  const logDate = getLogDateForWindow(windowToGrade());

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
/**
 * Main reliable recheck entry point (spec sections 4/7/8/9). Safe under
 * repeated/delayed cron triggers: idempotent, Addis-authoritative, always
 * grades the last CLOSED day, delivery-confirmed, and rate-limited.
 */
export async function runAccountabilityRecheck(opts?: { force?: boolean }): Promise<any> {
  const now = getAddisNow();
  const windowInfo = windowToGrade(now);
  const addisDateKey = normalizedDateKeyFromAddis(windowInfo.startAddis);

  // Only enforce after the authoritative 21:28 close of the graded day.
  if (!windowInfo.isClosed && !opts?.force) {
    return { status: 'OPEN', message: 'Execution window still open (closes 21:28 Addis)', addisDateKey };
  }

  const report = await detectMissedActivities(windowInfo);

  // No misses at all -> no missed-day roast (spec section 15). Reuse the
  // existing completion/celebration behavior and still record a session.
  if (report.missedAll.length === 0) {
    const session = await ensureSession('singleton', addisDateKey, [], '');
    return {
      status: 'NO_MISSED',
      addisDateKey,
      missedItems: [],
      completedItems: report.completedAll,
      deliveryState: 'NOT_SENT',
      delivered: false,
    };
  }

  // Exactly one accountability session per day (duplicate prevention, spec 9).
  const stale = await ensureSession('singleton', addisDateKey, report.missedAll, report.missedAll.join(', '));

  // Verify delivery; deliver or retry only if not confirmed SENT.
  const delivery = await deliverMissedMessage(stale, windowInfo, report);

  let reminder: { sent: boolean; roast?: string } | undefined;
  if (stale.state === 'PENDING') {
    reminder = await sendRepeatedReminder(stale);
  }

  const fresh = await prisma.accountabilitySession.findUnique({ where: { addisDateKey } });
  return {
    status: fresh?.state ?? 'PENDING',
    addisDateKey,
    missedItems: report.missedAll,
    completedItems: report.completedAll,
    deliveryState: delivery.state,
    delivered: delivery.delivered,
    telegramMessageId: delivery.messageId ?? fresh?.telegramMessageId ?? null,
    reminderSent: reminder?.sent ?? false,
    reminderRoast: reminder?.roast ?? fresh?.lastReminderRoast ?? null,
    reminderCount: fresh?.reminderCount ?? 0,
  };
}

/** Status / missed history for the website /today + /todo (spec section 10/11). */
export async function getAccountabilityStatus() {
  const windowInfo = windowToGrade(getAddisNow());
  const addisDateKey = normalizedDateKeyFromAddis(windowInfo.startAddis);

  const session = await prisma.accountabilitySession.findUnique({ where: { addisDateKey } });
  const active = session && session.state === 'PENDING' ? session : null;

  let rawMissed: any[] = [];
  if (session?.missedItems) {
    try {
      rawMissed = JSON.parse(session.missedItems);
    } catch {
      rawMissed = [];
    }
  }
  const cleanMissed = rawMissed
    .map((m) => formatTaskForDisplay(m))
    .filter((m) => Boolean(m) && m.trim().length > 0 && !m.startsWith('{'));

  // Sanitize initial roast text in case legacy records had raw JSON in it
  let cleanRoast = session?.initialRoast ?? null;
  if (cleanRoast && cleanRoast.includes('{"')) {
    cleanRoast = cleanRoast.replace(/\{[^{}]*\}/g, (match) => formatTaskForDisplay(match));
  }

  return {
    status: active ? 'PENDING' : 'RESOLVED',
    addisDateKey,
    missedItems: cleanMissed,
    roast: cleanRoast,
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