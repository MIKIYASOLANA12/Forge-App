
function formatTaskText(desc: string): string {
  try {
    const parsed = JSON.parse(desc);
    if (parsed.title && parsed.description && parsed.title !== parsed.description) {
      return `${parsed.title} - ${parsed.description}`;
    }
    return parsed.title || parsed.description || desc;
  } catch {
    return desc;
  }
}

import {
  getAddisNow,
  workoutWindowForAddisDate,
  getWorkoutLocationForAddisDate,
} from './workoutTime';
import { sendTelegramMessage } from './telegram';
import { getDailyBreakdown, getProgressHistory } from './progressEngine';
import { computeLevel, levelProgress } from './xp';
import { getCurrentWeek, getPhase } from './workout';

/**
 * Sends a single daily accountability reminder to verified Telegram accounts
 * if key activities remain incomplete.
 * Strictly prevents duplicate notifications for the same Addis workout day.
 */
export async function sendDailyAccountabilityReminder(force: boolean = false) {
  const addisNow = getAddisNow();
  const { startAddis, startUtc, endUtc } = workoutWindowForAddisDate(addisNow);
  const normalizedDateKey = new Date(
    Date.UTC(startAddis.getFullYear(), startAddis.getMonth(), startAddis.getDate())
  );

  // 1. Check if reminder already sent for today
  if (!force) {
    const existingLog = await prisma.telegramNotificationLog.findUnique({
      where: {
        date_type: {
          date: normalizedDateKey,
          type: 'DAILY_REMINDER',
        },
      },
    });

    if (existingLog) {
      return { sent: false, reason: 'Daily reminder already sent today.' };
    }
  }

  // 2. Get active verified Telegram accounts
  const accounts = await prisma.telegramAccount.findMany({
    where: { active: true },
  });

  if (accounts.length === 0) {
    return { sent: false, reason: 'No active Telegram accounts found.' };
  }

  // 3. Fetch today's real performance data
  const [breakdown, profile, program, lastLog, days, plan, history] = await Promise.all([
    getDailyBreakdown(addisNow),
    prisma.userProfile.findUnique({ where: { id: 'singleton' } }),
    prisma.workoutProgram.findUnique({ where: { id: 'singleton' } }),
    prisma.workoutLog.findFirst({ orderBy: { completedAt: 'desc' }, include: { workoutDay: true } }),
    prisma.workoutDay.findMany({ include: { exercises: true } }),
    prisma.dailyPlan.findFirst({
      where: { date: { gte: startUtc, lte: endUtc } },
      include: { tasks: true },
    }),
    getProgressHistory(7),
  ]);

  const ORDER = ['Push', 'Pull', 'LegsCore'];
  const lastIndex = lastLog ? ORDER.indexOf(lastLog.workoutDay.type) : -1;
  const targetType = ORDER[(lastIndex + 1) % ORDER.length];
  const targetDay = days.find((d) => d.type === targetType) ?? days[0];
  const location = getWorkoutLocationForAddisDate(startAddis);

  // Incomplete tasks
  const pendingTasks = plan ? plan.tasks.filter((t) => !t.completed) : [];
  const nextTask = formatTaskText(pendingTasks[0]?.description || "") || 'Complete scheduled focus session';

  // Calculate active streak
  let activeStreak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].consistencyScore >= 60) activeStreak++;
    else if (i === history.length - 1 && history[i].color === 'GRAY') continue;
    else break;
  }

  const totalXp = profile?.totalXp ?? 0;
  const level = profile?.level ?? computeLevel(totalXp);
  const pInfo = levelProgress(totalXp);

  // If user has not finished workout or has pending tasks
  const hasIncompleteActivities = !breakdown.workout.completed || pendingTasks.length > 0;

  if (!hasIncompleteActivities && !force) {
    return { sent: false, reason: 'All key activities already completed today.' };
  }

  const missedTasksStr = pendingTasks.length > 0
    ? pendingTasks.slice(0, 3).map((t) => `• ${formatTaskText(t.description)} (${t.minutesTarget}m)`).join('\n')
    : 'None pending';

  // Check if end of month physique check-in is pending
  const dayOfMonth = addisNow.getDate();
  let physiquePrompt = '';
  if (dayOfMonth >= 26 || dayOfMonth <= 2) {
    const existingCheckin = await prisma.physiqueCheckin.findFirst({
      where: {
        date: {
          gte: new Date(addisNow.getFullYear(), addisNow.getMonth(), 1),
        },
      },
    });

    const isDone = Boolean(
      existingCheckin &&
      (existingCheckin.frontRelaxedUrl || existingCheckin.frontBicepsUrl || existingCheckin.backWingsUrl)
    );

    if (!isDone) {
      physiquePrompt = `\n\n📸 MONTHLY PHYSIQUE PROGRESS CHECK-IN DUE:
• End of Month Checkpoint: Take your 5 upper body photos (Chest, Back, Triceps, Biceps, Neck, Abs, Wings).
• Review pose guides & upload: https://forge-app-eight-kappa.vercel.app/physique`;
    }
  }

  const reminderMessage = `⚡ FORGE DAILY ACCOUNTABILITY REMINDER
Timezone: Africa/Addis_Ababa • Day Rollover: 05:00 AM

🏋️ Today's Workout: ${targetType} (${location})
• Status: ${breakdown.workout.completed ? '✅ Completed' : '⏳ Incomplete — Action Required'}

📋 Pending Tasks (${pendingTasks.length}):
${missedTasksStr}

⚡ Character Progress:
• Level ${level} (${totalXp.toLocaleString()} XP) | Progress: ${Math.round(pInfo.progress * 100)}%
• Active Consistency Streak: ${activeStreak} Days
• Today's Consistency Score: ${breakdown.consistencyScore}% [${breakdown.color}]

🎯 Next Action: ${nextTask}${physiquePrompt}
⏳ Complete and log your activities before 05:00 AM to protect your streak!`;

  // Send to all linked chats
  for (const acc of accounts) {
    const targetChatId = acc.chatId || acc.telegramId;
    if (targetChatId) {
      await sendTelegramMessage(targetChatId, reminderMessage);
    }
  }

  // Record in DB to prevent duplicate reminder
  await prisma.telegramNotificationLog.upsert({
    where: {
      date_type: {
        date: normalizedDateKey,
        type: 'DAILY_REMINDER',
      },
    },
    create: {
      date: normalizedDateKey,
      type: 'DAILY_REMINDER',
      chatId: accounts[0].chatId || accounts[0].telegramId,
      message: reminderMessage,
    },
    update: {
      sentAt: new Date(),
      message: reminderMessage,
    },
  });

  return { sent: true, count: accounts.length, message: reminderMessage };
}

/**
 * Sends a daily completion report to Telegram when important activities are finished.
 * Strictly prevents duplicate reports for the same Addis workout day.
 */
export async function sendDailyCompletionReport(force: boolean = false) {
  const addisNow = getAddisNow();
  const { startAddis, startUtc, endUtc } = workoutWindowForAddisDate(addisNow);
  const normalizedDateKey = new Date(
    Date.UTC(startAddis.getFullYear(), startAddis.getMonth(), startAddis.getDate())
  );

  // 1. Check if completion report already sent for today
  if (!force) {
    const existingLog = await prisma.telegramNotificationLog.findUnique({
      where: {
        date_type: {
          date: normalizedDateKey,
          type: 'COMPLETION_REPORT',
        },
      },
    });

    if (existingLog) {
      return { sent: false, reason: 'Completion report already sent today.' };
    }
  }

  const accounts = await prisma.telegramAccount.findMany({
    where: { active: true },
  });

  if (accounts.length === 0) {
    return { sent: false, reason: 'No active Telegram accounts found.' };
  }

  const [breakdown, profile, lastLog, days, history] = await Promise.all([
    getDailyBreakdown(addisNow),
    prisma.userProfile.findUnique({ where: { id: 'singleton' } }),
    prisma.workoutLog.findFirst({ orderBy: { completedAt: 'desc' }, include: { workoutDay: true } }),
    prisma.workoutDay.findMany({ include: { exercises: true } }),
    getProgressHistory(7),
  ]);

  // Calculate active streak
  let activeStreak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].consistencyScore >= 60) activeStreak++;
    else if (i === history.length - 1 && history[i].color === 'GRAY') continue;
    else break;
  }

  const totalXp = profile?.totalXp ?? 0;
  const level = profile?.level ?? computeLevel(totalXp);

  const ORDER = ['Push', 'Pull', 'LegsCore'];
  const lastIndex = lastLog ? ORDER.indexOf(lastLog.workoutDay.type) : -1;
  const tomorrowType = ORDER[(lastIndex + 1) % ORDER.length];

  const reportMessage = `🏆 FORGE DAILY COMPLETION REPORT
Day: ${breakdown.dayOfWeek}, ${breakdown.formattedDate}

🎯 Final Consistency Score: ${breakdown.consistencyScore}% [${breakdown.color}]

✅ Execution Summary:
• Workout: ${breakdown.workout.completed ? `Completed (${breakdown.workout.type || 'Session'})` : 'Not Completed'}
• Tasks Completed: ${breakdown.tasks.completed}/${breakdown.tasks.total} (${breakdown.tasks.percentage}%)
• Study Focus: ${breakdown.study.minutes} mins
• Coding Sessions: ${breakdown.coding.minutes} mins
• Reading: ${breakdown.reading.minutes} mins
• Habits: ${breakdown.habits.completed}/${breakdown.habits.total}
• Nutrition: ${breakdown.nutrition.calories} kcal / ${breakdown.nutrition.protein}g protein

⚡ Rewards & Level:
• XP Earned Today: +${breakdown.xpEarned} XP
• Total XP: ${totalXp.toLocaleString()} XP (Level ${level})
• Consistency Streak: ${activeStreak} Days

🌅 Tomorrow's Scheduled Workout: ${tomorrowType} (05:00 AM Unlock)
Keep up the unstoppable momentum! 🚀`;

  for (const acc of accounts) {
    const targetChatId = acc.chatId || acc.telegramId;
    if (targetChatId) {
      await sendTelegramMessage(targetChatId, reportMessage);
    }
  }

  // Record in DB
  await prisma.telegramNotificationLog.upsert({
    where: {
      date_type: {
        date: normalizedDateKey,
        type: 'COMPLETION_REPORT',
      },
    },
    create: {
      date: normalizedDateKey,
      type: 'COMPLETION_REPORT',
      chatId: accounts[0].chatId || accounts[0].telegramId,
      message: reportMessage,
    },
    update: {
      sentAt: new Date(),
      message: reportMessage,
    },
  });

  return { sent: true, count: accounts.length, message: reportMessage };
}

/**
 * Master cron runner executed on schedule by Vercel Cron.
 */
export async function processAccountabilityCron() {
  const addisNow = getAddisNow();
  const breakdown = await getDailyBreakdown(addisNow);

  // If consistency is >= 80% and workout is done, send completion report if not sent
  if (breakdown.consistencyScore >= 80 && breakdown.workout.completed) {
    return sendDailyCompletionReport(false);
  }

  // Otherwise, send accountability reminder
  return sendDailyAccountabilityReminder(false);
}
