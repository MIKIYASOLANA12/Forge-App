import { prisma } from './prisma';
import {
  getAddisNow,
  workoutWindowForAddisDate,
  getWorkoutLocationForAddisDate,
  getDayOfJourney300,
} from './workoutTime';
import { sendTelegramMessage } from './telegram';
import { getDailyBreakdown, getProgressHistory } from './progressEngine';
import { computeLevel, levelProgress } from './xp';
import { getAccountabilityRoast, RoastCategory } from './accountabilityRoast';
import { ensureTodayDailyPlan } from './dailyPlanGenerator';
import { calculateChemistryOneMonthPlan, calculateJavaScriptPacing } from './studyRoadmaps';

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

/**
 * Sends the daily accountability / missed-day notification to linked Telegram accounts.
 * Triggered by Vercel Cron or manual API test.
 * Strictly prevents duplicate notifications for the same Addis day window.
 */
export async function sendDailyAccountabilityReminder(force: boolean = false) {
  const addisNow = getAddisNow();
  const windowInfo = workoutWindowForAddisDate(addisNow);
  const normalizedDateKey = new Date(
    Date.UTC(windowInfo.startAddis.getFullYear(), windowInfo.startAddis.getMonth(), windowInfo.startAddis.getDate())
  );

  const notificationType = windowInfo.isClosed ? 'MISSED_DAY_REPORT' : 'DAILY_REMINDER';

  // 1. Check duplicate log in database
  if (!force) {
    const existingLog = await prisma.telegramNotificationLog.findUnique({
      where: {
        date_type: {
          date: normalizedDateKey,
          type: notificationType,
        },
      },
    });

    if (existingLog) {
      return { sent: false, reason: `Notification [${notificationType}] already delivered today.` };
    }
  }

  // 2. Query active verified Telegram accounts
  const accounts = await prisma.telegramAccount.findMany({
    where: { active: true },
  });

  if (accounts.length === 0) {
    return { sent: false, reason: 'No active Telegram accounts linked.' };
  }

  // 3. Fetch performance data & ensure real daily tasks exist
  const [breakdown, profile, program, lastLog, days, todayPlan, history, masteries] = await Promise.all([
    getDailyBreakdown(addisNow),
    prisma.userProfile.findUnique({ where: { id: 'singleton' } }),
    prisma.workoutProgram.findUnique({ where: { id: 'singleton' } }),
    prisma.workoutLog.findFirst({ orderBy: { completedAt: 'desc' }, include: { workoutDay: true } }),
    prisma.workoutDay.findMany({ include: { exercises: true } }),
    ensureTodayDailyPlan(),
    getProgressHistory(7),
    prisma.studyTopicMastery.findMany(),
  ]);

  const ORDER = ['Push', 'Pull', 'LegsCore'];
  const lastIndex = lastLog ? ORDER.indexOf(lastLog.workoutDay.type) : -1;
  const targetType = ORDER[(lastIndex + 1) % ORDER.length] || 'Push';
  const location = getWorkoutLocationForAddisDate(windowInfo.startAddis);

  const pendingTasks = todayPlan.tasks.filter((t) => !t.completed);
  const isWorkoutMissed = !breakdown.workout.completed;

  // Next day roadmap targets
  const masteredTopicIds = masteries.filter((m) => m.isMastered).map((m) => m.topicId);
  const chemPlan = calculateChemistryOneMonthPlan(masteredTopicIds);
  const jsMasteredIds = masteries.filter((m) => m.subject === 'JavaScript' && m.isMastered).map((m) => m.topicId);
  const jsPlan = calculateJavaScriptPacing(jsMasteredIds);

  const tomorrowWorkoutType = ORDER[(ORDER.indexOf(targetType) + 1) % ORDER.length];
  const tomorrowLocation = getWorkoutLocationForAddisDate(windowInfo.nextUnlockAddis);

  // Active streak
  let activeStreak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].consistencyScore >= 60) activeStreak++;
    else if (i === history.length - 1 && history[i].color === 'GRAY') continue;
    else break;
  }

  const totalXp = profile?.totalXp ?? 0;
  const level = profile?.level ?? computeLevel(totalXp);
  const pInfo = levelProgress(totalXp);
  const day300 = getDayOfJourney300(addisNow);

  // Determine missed context and generate roast
  const missedList: string[] = [];
  if (isWorkoutMissed) missedList.push(`Workout: ${targetType} (${location})`);
  for (const t of pendingTasks) {
    missedList.push(formatTaskText(t.description));
  }

  let roastCategory: RoastCategory = 'COMBINED_MISSED';
  if (breakdown.consistencyScore >= 80 && breakdown.workout.completed) {
    roastCategory = 'PERFECT_DAY';
  } else if (isWorkoutMissed && pendingTasks.length === 0) {
    roastCategory = 'WORKOUT_MISSED';
  } else if (missedList.some((m) => m.toLowerCase().includes('chemistry'))) {
    roastCategory = 'CHEMISTRY_MISSED';
  } else if (missedList.some((m) => m.toLowerCase().includes('javascript') || m.toLowerCase().includes('coding'))) {
    roastCategory = 'JAVASCRIPT_MISSED';
  }

  const roast = await getAccountabilityRoast({
    category: roastCategory,
    intensity: 3,
    missedItems: missedList,
  });

  const formattedDate = windowInfo.startAddis.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  // Construct message
  let message = '';
  if (windowInfo.isClosed) {
    message = `🔥 FORGE DAILY ACCOUNTABILITY REPORT
${formattedDate} • ${day300.formatted}
⚠️ Daily Execution Window Closed at 09:28 PM (Ethiopia Time)

${
  missedList.length > 0
    ? `🔴 MISSED & LOCKED ACTIVITIES:\n${missedList.map((m) => `• ❌ ${m}`).join('\n')}`
    : `✅ All core daily targets successfully completed!`
}

🔥 ACCOUNTABILITY ROAST:
"${roast.message}"

⚡ Current Character Status:
• Level ${level} (${totalXp.toLocaleString()} XP) | Next: ${Math.round(pInfo.progress * 100)}%
• Consistency Score: ${breakdown.consistencyScore}% [${breakdown.color}]
• Active Streak: ${activeStreak} Days

🌅 Tomorrow's Scheduled Plan (05:00 AM Unlock):
• 🏋️ Workout: ${tomorrowWorkoutType} (${tomorrowLocation})
• 🧪 Chemistry: ${chemPlan.currentTopic.name} (~${chemPlan.minutesPerDay}m)
• 💻 JavaScript: ${jsPlan.currentLesson.title} (~60m)
• 📚 Reading & Focus blocks`;
  } else {
    message = `⚡ FORGE DAILY ACCOUNTABILITY REMINDER
${formattedDate} • ${day300.formatted}
🕒 Active Window: 05:00 AM – 09:28 PM (Closes at 09:28 PM)

🏋️ Today's Workout: ${targetType} (${location})
• Status: ${breakdown.workout.completed ? '✅ Completed' : '⏳ Incomplete — Action Required before 09:28 PM'}

📋 Tasks In Progress (${pendingTasks.length} pending):
${pendingTasks.length > 0 ? pendingTasks.slice(0, 4).map((t) => `• [ ] ${formatTaskText(t.description)} (${t.minutesTarget}m)`).join('\n') : '• All tasks completed!'}

⚡ Character Status:
• Level ${level} (${totalXp.toLocaleString()} XP) | Streak: ${activeStreak} Days
• Today's Consistency: ${breakdown.consistencyScore}% [${breakdown.color}]

🔥 Accountability Cue:
"${roast.message}"

⏳ Submit all activities before 09:28 PM to lock in your score!`;
  }

  // Deliver to linked Telegram accounts
  for (const acc of accounts) {
    const targetChatId = acc.chatId || acc.telegramId;
    if (targetChatId) {
      await sendTelegramMessage(targetChatId, message);
    }
  }

  // Record in TelegramNotificationLog
  await prisma.telegramNotificationLog.upsert({
    where: {
      date_type: {
        date: normalizedDateKey,
        type: notificationType,
      },
    },
    create: {
      date: normalizedDateKey,
      type: notificationType,
      chatId: accounts[0].chatId || accounts[0].telegramId,
      message,
    },
    update: {
      sentAt: new Date(),
      message,
    },
  });

  return { sent: true, count: accounts.length, notificationType, message };
}

/**
 * Sends a daily completion report to Telegram when consistency >= 80% and workout completed.
 */
export async function sendDailyCompletionReport(force: boolean = false) {
  return sendDailyAccountabilityReminder(force);
}

/**
 * Master cron runner executed on schedule by Vercel Cron.
 */
export async function processAccountabilityCron() {
  return sendDailyAccountabilityReminder(false);
}
