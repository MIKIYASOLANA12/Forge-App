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
import {
  parseTimeToMinutes,
  formatMinutesTo12Hour,
  getTaskCleanTitle,
  getTaskCategory,
} from './smartSchedule';
import { getSleepAccountabilityStatus } from './sleepAccountability';
import { formatTaskForDisplay } from './planParser';

function formatTaskText(desc: any): string {
  return formatTaskForDisplay(desc);
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
  if (isWorkoutMissed) missedList.push(`Workout — ${targetType}`);
  for (const t of pendingTasks) {
    missedList.push(formatTaskText(t));
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
      confirmed = true;
    }
    if (!delivered.ok && !firstError) firstError = delivered?.description || 'Unknown telegram error';
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
 * Sends smart contextual coach reminders derived directly from Forge's single source of truth
 * (DailyPlan & PlanTask in database):
 * 
 * 1. 11:00 AM Fixed Wake-up
 * 2. Activity Start Notifications (at scheduled start time, with interactive complete button)
 * 3. Activity End Notifications (at scheduled end time, calculating next activity and gap)
 * 4. Missed Activity alerts (if window passed without completion, non-spamming)
 * 5. 09:30 PM Wind-down
 * 6. 11:00 PM Sleep target
 * 
 * Deduplicated per task per slot per date.
 */
export async function sendSmartCoachScheduleReminder(customNow?: Date) {
  const { hour, minute, totalMinutes, year, month, day, formatted12h } = getAddisTimeComponents(customNow);
  const addisNow = customNow || getAddisNow();
  const normalizedDateKey = new Date(Date.UTC(year, month - 1, day));

  const results: Array<{ slotType: string; sent: boolean; message: string }> = [];

  const accounts = await prisma.telegramAccount.findMany({
    where: { active: true },
  });

  if (accounts.length === 0) {
    return { sent: false, reason: 'No active Telegram accounts linked.', results: [] };
  }

  const helperSend = async (slotType: string, msg: string, replyMarkup?: any) => {
    // Deduplication check in DB
    const existing = await prisma.telegramNotificationLog.findUnique({
      where: {
        date_type: {
          date: normalizedDateKey,
          type: slotType,
        },
      },
    });

    if (existing) {
      return { slotType, sent: false, reason: 'Already sent' };
    }

    let confirmed = false;
    let lastMsgId: number | null = null;
    let firstChat: string | null = null;

    for (const acc of accounts) {
      const targetChat = acc.chatId || acc.telegramId;
      if (!targetChat) continue;
      if (!firstChat) firstChat = String(targetChat);
      const delivered = await sendTelegramMessage(targetChat, msg, {
        reply_markup: replyMarkup,
      });
      if (delivered.ok) {
        confirmed = true;
        if (typeof delivered.result?.message_id === 'number') {
          lastMsgId = delivered.result.message_id;
        }
      }
    }

    await prisma.telegramNotificationLog.create({
      data: {
        date: normalizedDateKey,
        type: slotType,
        chatId: firstChat || 'system',
        message: msg,
        status: confirmed ? 'SENT' : 'DELIVERY_FAILED',
        telegramMessageId: lastMsgId,
      },
    });

    results.push({ slotType, sent: confirmed, message: msg });
    return { slotType, sent: confirmed, message: msg };
  };

  // ── [1] FIXED 11:00 AM WAKE-UP (660..719 mins) ──────────────────────────────
  if (totalMinutes >= 660 && totalMinutes < 720) {
    const todayPlan = await ensureTodayDailyPlan();
    const firstTask = todayPlan?.tasks?.find((t) => parseTimeToMinutes(t.plannedStartTime) !== null);
    let nextMsg = 'Review your roadmap in Forge to start your day.';
    if (firstTask) {
      const title = getTaskCleanTitle(firstTask);
      const sTime = firstTask.plannedStartTime ? formatMinutesTo12Hour(parseTimeToMinutes(firstTask.plannedStartTime)!) : '12:00 PM';
      nextMsg = `Next planned activity: ${title} at ${sTime}.`;
    }

    const wakeMsg = `☀️ Good morning, Mikiyas.
It's 11:00 AM — time to wake up.

${nextMsg}`;

    await helperSend('COACH_WAKE_1100', wakeMsg);
  }

  // ── [2] 09:28 PM DAILY CLOSE CUTOFF (1288..1289 mins) ───────────────────────
  if (totalMinutes >= 1288 && totalMinutes < 1290) {
    const closeMsg = `⏳ Daily Close: 09:28 PM cutoff has arrived.
Submit all your completed tasks, workout logs, and check-ins to lock in your daily score!`;
    await helperSend('COACH_CLOSE_2128', closeMsg);
  }

  // ── [3] 09:30 PM WIND-DOWN REMINDER (1290..1379 mins) ──────────────────────
  if (totalMinutes >= 1290 && totalMinutes < 1380) {
    const windDownMsg = `🌙 Start winding down.
Disconnect from screens and prepare for restful 11:00 PM sleep, Mikiyas.`;
    await helperSend('COACH_WIND_DOWN_2130', windDownMsg);
  }

  // ── [4] PERSISTENT 15-MINUTE SLEEP ACCOUNTABILITY REMINDER (11:00 PM – 05:59 AM) ────
  if (totalMinutes >= 1380 || totalMinutes < 360) {
    const sleepStatus = await getSleepAccountabilityStatus(customNow);

    // Stop conditions:
    // 1. Acknowledged: Stop further reminders for tonight
    // 2. Snoozed: Skip until snooze expires
    if (!sleepStatus.isAcknowledged && !sleepStatus.isSnoozed) {
      const slot15 = Math.floor(minute / 15) * 15;
      const slotTimeStr = `${String(hour).padStart(2, '0')}${String(slot15).padStart(2, '0')}`;
      const isInitial11PM = hour === 23 && slot15 === 0;
      const slotType = isInitial11PM ? 'COACH_SLEEP_2300' : `COACH_SLEEP_${sleepStatus.dateKey}_${slotTimeStr}`;

      let sleepMsg = "😴 It's time to sleep, Mikiyas.";
      if (sleepStatus.overdueMinutes >= 45 && sleepStatus.overdueMinutes < 60) {
        sleepMsg = "⚠️ You're past your sleep target. Stop working, shut down your PC, and go to sleep.";
      } else if (sleepStatus.overdueMinutes >= 30) {
        sleepMsg = "😴 Still awake? Close Forge, shut down your PC, and get some rest.";
      } else if (sleepStatus.overdueMinutes >= 15) {
        sleepMsg = "🌙 Mikiyas, you're still up. Time to shut down your PC and sleep.";
      } else if (sleepStatus.overdueMinutes >= 60) {
        sleepMsg = `🚨 Sleep is overdue by ${sleepStatus.overdueMinutes} minutes. Shut down your PC now. Deep recovery is critical for tomorrow's discipline.`;
      }

      const buttons: Array<Array<{ text: string; callback_data: string }>> = [
        [
          { text: "✅ I'm going to sleep", callback_data: `sleep_ack_${sleepStatus.dateKey}` },
        ],
      ];

      if (sleepStatus.snoozeCount < 3) {
        buttons[0].push({
          text: '⏰ 5 more minutes',
          callback_data: `sleep_snooze_${sleepStatus.dateKey}`,
        });
      }

      await helperSend(slotType, sleepMsg, { inline_keyboard: buttons });
    }
  }

  // ── [5] DYNAMIC SCHEDULED TASKS FROM DATABASE (Active day: 11:00 AM to 09:28 PM) ──
  if (totalMinutes >= 660 && totalMinutes < 1288) {
    const todayPlan = await ensureTodayDailyPlan();
    const tasks = todayPlan?.tasks || [];

    // Parse tasks with time windows
    const parsedTasks = tasks
      .map((t) => {
        const startM = parseTimeToMinutes(t.plannedStartTime);
        const duration = t.minutesTarget || 60;
        const endM = parseTimeToMinutes(t.plannedEndTime) ?? (startM !== null ? startM + duration : null);
        return {
          task: t,
          title: getTaskCleanTitle(t),
          category: getTaskCategory(t),
          startM,
          endM,
          duration,
        };
      })
      .filter((item): item is typeof item & { startM: number; endM: number } => item.startM !== null && item.endM !== null)
      .sort((a, b) => a.startM - b.startM);

    for (let i = 0; i < parsedTasks.length; i++) {
      const current = parsedTasks[i];
      const t = current.task;
      const next = parsedTasks.slice(i + 1).find((other) => other.startM > current.startM);

      const nextInfoStr = next
        ? `➡️ Next:\n${getCategoryEmoji(next.category)} ${next.title}\n🕑 ${formatMinutesTo12Hour(next.startM)}`
        : `✅ You're done with your planned tasks for now.`;

      const gap = next ? next.startM - current.endM : 0;
      const gapStr = gap > 0
        ? `\n\n⏳ You have ${gap >= 60 ? `${Math.floor(gap / 60)} hour${Math.floor(gap / 60) > 1 ? 's' : ''}${gap % 60 ? ` ${gap % 60}m` : ''}` : `${gap} minutes`} before your next session. Use it for a planned task, break, meal, or preparation.`
        : '';

      // A. ACTIVITY START NOTIFICATION (totalMinutes within 0..30 mins of start time)
      if (totalMinutes >= current.startM && totalMinutes < current.startM + 30 && !t.completed) {
        const slotKey = `COACH_START_${t.id}_${t.plannedStartTime}`;
        const startMsg = getStartNotificationMessage(current.title, current.category);

        const completeMarkup = {
          inline_keyboard: [
            [
              {
                text: `✅ Mark ${truncateString(current.title, 20)} Complete`,
                callback_data: `comp_task_${t.id}`,
              },
            ],
          ],
        };

        await helperSend(slotKey, startMsg, completeMarkup);
      }

      // B. ACTIVITY END NOTIFICATION (totalMinutes within 0..30 mins of end time)
      if (totalMinutes >= current.endM && totalMinutes < current.endM + 30) {
        const slotKey = `COACH_END_${t.id}_${t.plannedEndTime || t.plannedStartTime}`;
        const endMsg = `✅ ${current.title} finished.\n\n${nextInfoStr}${gapStr}`;

        await helperSend(slotKey, endMsg);
      }

      // C. MISSED ACTIVITY ALERT (totalMinutes >= endM + 15 && totalMinutes < endM + 75 and !completed)
      if (totalMinutes >= current.endM + 15 && totalMinutes < current.endM + 75 && !t.completed) {
        const slotKey = `COACH_MISSED_${t.id}`;
        const missedMsg = `⚠️ You missed your planned ${current.title} session.\n\n${nextInfoStr}`;

        await helperSend(slotKey, missedMsg);
      }
    }
  }

  return {
    sent: results.some((r) => r.sent),
    count: results.filter((r) => r.sent).length,
    results,
  };
}

function getCategoryEmoji(category: string): string {
  switch (category) {
    case 'STUDY': return '📚';
    case 'CODING': return '💻';
    case 'WORKOUT': return '💪';
    case 'READING': return '📖';
    case 'WAKE': return '☀️';
    case 'SLEEP': return '😴';
    case 'WIND_DOWN': return '🌙';
    default: return '⚡';
  }
}

function getStartNotificationMessage(title: string, category: string): string {
  const lower = title.toLowerCase();
  if (category === 'WORKOUT' || lower.includes('workout') || lower.includes('gym')) {
    return `💪 Workout time. Get ready for ${title}.`;
  }
  if (category === 'CODING' || lower.includes('coding') || lower.includes('javascript')) {
    return `💻 Mikiyas, ${title} starts now.`;
  }
  if (lower.includes('bible') || lower.includes('scripture')) {
    return `🙏 It's Bible study time — ${title}.`;
  }
  if (category === 'READING' || lower.includes('reading') || lower.includes('book')) {
    return `📖 It's time for ${title}.`;
  }
  if (lower.includes('chemistry')) {
    return `⏰ Mikiyas, it's time to study Chemistry (${title}).`;
  }
  return `⏰ Mikiyas, it's time for ${title}. Let's get started.`;
}

function truncateString(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}
