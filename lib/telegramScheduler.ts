import { prisma } from './prisma';
import {
  getAddisNow,
  getAddisTimeComponents,
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

  // Deliver to linked Telegram accounts; only mark SENT on confirmed API success.
  let confirmed = false;
  let lastMsgId: number | null = null;
  let firstChat: string | null = null;
  let firstError: string | undefined;

  for (const acc of accounts) {
    const targetChatId = acc.chatId || acc.telegramId;
    if (!targetChatId) continue;
    if (!firstChat || firstChat === undefined) firstChat = String(targetChatId);
    const delivered = await sendTelegramMessage(targetChatId, message);
    if (delivered.ok && typeof delivered.result?.message_id === 'number') {
      if (!confirmed) lastMsgId = Number(delivered.result.message_id);
      confirmed = confirmed || true;
    }
    if (!delivered.ok && !firstError) firstError = delivered?.description || 'Unknown telegram error';
  }

  // Record in TelegramNotificationLog (status reflects actual confirmed delivery).
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
      chatId: firstChat ?? (accounts[0]?.chatId || accounts[0]?.telegramId),
      message,
      status: confirmed ? 'SENT' : 'DELIVERY_FAILED',
      telegramMessageId: lastMsgId,
      errorMessage: confirmed ? null : firstError,
      retryCount: confirmed ? 0 : 1,
    },
    update: {
      sentAt: new Date(),
      message,
      status: confirmed ? 'SENT' : 'DELIVERY_FAILED',
      telegramMessageId: lastMsgId ?? undefined,
      errorMessage: confirmed ? null : firstError,
    },
  });

  return { sent: confirmed, count: confirmed ? accounts.length : 0, notificationType, message, deliveryState: confirmed ? 'SENT' : 'DELIVERY_FAILED' };
}

/**
 * Sends a daily completion report to Telegram when consistency >= 80% and workout completed.
 */
export async function sendDailyCompletionReport(force: boolean = false) {
  return sendDailyAccountabilityReminder(force);
}

/**
 * Master cron runner executed on schedule by Vercel Cron.
 * Routed through the reliable recheck engine (Addis-time authoritative, idempotent).
 */
export async function processAccountabilityCron() {
  const { runAccountabilityRecheck } = await import('./accountabilityRecheck');
  const [recheckRes, coachRes] = await Promise.all([
    runAccountabilityRecheck({ force: false }),
    sendSmartCoachScheduleReminder(),
  ]);
  return { recheck: recheckRes, coach: coachRes };
}

/**
 * Sends smart contextual reminders (11:00 AM Wake-Up, dynamically scheduled Study/Coding/Workout tasks, Sleep)
 * derived directly from Forge's single source of truth (DailyPlan & PlanTask in database).
 * Deduplicated per task per date.
 */
export async function sendSmartCoachScheduleReminder(customNow?: Date) {
  const { totalMinutes, year, month, day } = getAddisTimeComponents(customNow);
  const addisNow = customNow || getAddisNow();

  const normalizedDateKey = new Date(Date.UTC(year, month - 1, day));

  let slotType: string | null = null;
  let coachMessage: string | null = null;

  // 1. FIXED 11:00 AM WAKE-UP REMINDER (660..719 mins)
  if (totalMinutes >= 660 && totalMinutes < 720) {
    slotType = 'COACH_WAKE_1100';
    coachMessage = `☀️ Good morning, Mikiyas! It is 11:00 AM — your target wake-up time.
Hydrate, review your daily roadmap in Forge, and prepare for a disciplined, high-impact day.`;
  }
  // 2. FIXED 09:28 PM DAILY CLOSE CUTOFF REMINDER (1288..1290 mins)
  else if (totalMinutes >= 1288 && totalMinutes < 1290) {
    slotType = 'COACH_CLOSE_2128';
    coachMessage = `⏳ Daily Close: 09:28 PM cutoff has arrived.
Submit all your completed tasks, workout logs, and check-ins to lock in your score!`;
  }
  // 3. WIND-DOWN REMINDER (09:30 PM – 10:59 PM / 1290..1379 mins)
  else if (totalMinutes >= 1290 && totalMinutes < 1380) {
    slotType = 'COACH_WIND_DOWN_2130';
    coachMessage = `🌙 09:30 PM — Start winding down, Mikiyas.
Disconnect from screens and prepare for restful 11:00 PM sleep.`;
  }
  // 4. FIXED 11:00 PM SLEEP TARGET REMINDER (1380..1439 mins) - ONLY AT NIGHT!
  else if (totalMinutes >= 1380) {
    slotType = 'COACH_SLEEP_2300';
    coachMessage = `😴 It's 11:00 PM — time to sleep, Mikiyas.
Consistent sleep drives tomorrow's cognitive focus and muscle recovery. Target wake-up is 11:00 AM.`;
  }
  // 5. DYNAMIC SCHEDULED TASKS FROM DATABASE (Active day only: 11:00 AM to 09:28 PM)
  else if (totalMinutes >= 660 && totalMinutes < 1288) {
    const todayPlan = await ensureTodayDailyPlan();
    const tasks = todayPlan?.tasks || [];

    for (const t of tasks) {
      if (!t.plannedStartTime || t.completed) continue;
      const match = t.plannedStartTime.trim().match(/^(\d{1,2}):(\d{2})$/);
      if (!match) continue;
      const taskStartMins = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);

      // Notification window: within 45 minutes of scheduled start time
      if (totalMinutes >= taskStartMins && totalMinutes < taskStartMins + 45) {
        let taskTitle = t.description;
        try {
          const parsed = JSON.parse(t.description);
          if (parsed.title) taskTitle = parsed.title;
        } catch {}

        const isWorkout = /workout|gym|exercise|push|pull|legs/i.test(`${t.subject || ''} ${t.description}`);
        const isStudy = t.isStudy || /chemistry|biology|math|physics|english|study/i.test(`${t.subject || ''} ${t.description}`);
        const isCoding = /javascript|code|coding|5 million/i.test(`${t.subject || ''} ${t.description}`);

        if (isWorkout) {
          const { getHolidayWorkoutStatus } = await import('./holidayWorkout');
          const holiday = getHolidayWorkoutStatus(addisNow);
          const workoutDesc = holiday.isHolidayPeriod
            ? `16-Day Holiday Home Workout (${holiday.todayRoutine?.title || 'Home Session'})`
            : `Scheduled Gym Training Session`;

          slotType = `COACH_TASK_${t.id}_${t.plannedStartTime}`;
          coachMessage = `🏋️ Workout time! Get ready for your ${workoutDesc}.
Focus on clean form, controlled cadence, and disciplined sets.`;
          break;
        } else if (isCoding) {
          slotType = `COACH_TASK_${t.id}_${t.plannedStartTime}`;
          coachMessage = `💻 Time to code — ${taskTitle}.
Open your editor and build your daily algorithmic coding target.`;
          break;
        } else if (isStudy) {
          slotType = `COACH_TASK_${t.id}_${t.plannedStartTime}`;
          coachMessage = `📚 Study time — ${taskTitle}.
Deep focus session. Open your notes and complete your target study minutes.`;
          break;
        } else {
          slotType = `COACH_TASK_${t.id}_${t.plannedStartTime}`;
          coachMessage = `⚡ Scheduled focus time — ${taskTitle}.
Stay disciplined and check off your target in Forge.`;
          break;
        }
      }
    }
  }

  if (!slotType || !coachMessage) {
    return { sent: false, reason: 'No scheduled reminder slot for current time.' };
  }

  // Deduplication check
  const existing = await prisma.telegramNotificationLog.findUnique({
    where: {
      date_type: {
        date: normalizedDateKey,
        type: slotType,
      },
    },
  });

  if (existing) {
    return { sent: false, reason: `Reminder [${slotType}] already sent today.` };
  }

  const accounts = await prisma.telegramAccount.findMany({
    where: { active: true },
  });

  if (accounts.length === 0) {
    return { sent: false, reason: 'No active Telegram accounts linked.' };
  }

  let confirmed = false;
  let lastMsgId: number | null = null;
  let firstChat: string | null = null;

  for (const acc of accounts) {
    const targetChat = acc.chatId || acc.telegramId;
    if (!targetChat) continue;
    if (!firstChat) firstChat = String(targetChat);
    const delivered = await sendTelegramMessage(targetChat, coachMessage);
    if (delivered.ok) {
      confirmed = true;
      if (typeof delivered.result?.message_id === 'number') lastMsgId = delivered.result.message_id;
    }
  }

  await prisma.telegramNotificationLog.create({
    data: {
      date: normalizedDateKey,
      type: slotType,
      chatId: firstChat || 'system',
      message: coachMessage,
      status: confirmed ? 'SENT' : 'DELIVERY_FAILED',
      telegramMessageId: lastMsgId,
    },
  });

  return { sent: confirmed, slotType, message: coachMessage };
}
