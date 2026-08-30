/**
 * FORGE — DYNAMIC SCHEDULE & COMMAND CENTER STATUS ENGINE
 * SINGLE SOURCE OF TRUTH: Derives active focus from Forge's actual database tasks & calendar.
 * Fixed targets: 11:00 AM Daily Wake-Up & 11:00 PM Sleep.
 */
import { getAddisNow, workoutWindowForAddisDate, getWorkoutLocationForAddisDate } from './workoutTime';
import { prisma } from './prisma';
import { getHolidayWorkoutStatus } from './holidayWorkout';
import { ensureTodayDailyPlan } from './dailyPlanGenerator';

export interface SmartScheduleStatus {
  greeting: string;
  subGreeting: string;
  addisTimeFormatted: string;
  currentHourMinute: string; // "14:30"
  targetWakeTime: string; // "11:00 AM"
  targetSleepTime: string; // "11:00 PM"
  currentActivityTitle: string;
  currentActivityCategory: 'WAKE' | 'STUDY' | 'CODING' | 'WORKOUT' | 'READING' | 'CLOSE' | 'WIND_DOWN' | 'SLEEP' | 'FREE';
  statusMessage: string;
  actionCallout: string;
  suggestedAction?: {
    type: 'TASK' | 'WORKOUT' | 'CHECKIN' | 'SLEEP';
    label: string;
    href: string;
    taskId?: string;
  };
  afterwardPrompt?: {
    question: string;
    itemTitle: string;
    taskId?: string;
  };
  upcomingNext: {
    title: string;
    timeFormatted: string;
    category: string;
  };
}

function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function formatMinutesTo12Hour(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${ampm}`;
}

function getTaskCleanTitle(task: any): string {
  try {
    const parsed = JSON.parse(task.description);
    if (parsed.title) return parsed.title;
  } catch {}
  if (task.subject && task.topic) return `${task.subject}: ${task.topic}`;
  if (task.subject) return `${task.subject} Session`;
  return task.description || 'Focus Session';
}

function getTaskCategory(task: any): 'STUDY' | 'CODING' | 'WORKOUT' | 'READING' | 'FREE' {
  const text = `${task.subject || ''} ${task.topic || ''} ${task.description || ''}`.toLowerCase();
  if (/workout|gym|exercise|push|pull|legs/i.test(text)) return 'WORKOUT';
  if (/javascript|code|coding|5 million|python|ts/i.test(text)) return 'CODING';
  if (/chemistry|biology|math|physics|english|study/i.test(text) || task.isStudy) return 'STUDY';
  if (/reading|book|faith|reflection/i.test(text)) return 'READING';
  return 'FREE';
}

/**
 * Returns dynamic personalized greeting based on Addis Ababa hour.
 */
export function getPersonalizedGreeting(customNow?: Date): { greeting: string; subGreeting: string } {
  const now = customNow || getAddisNow();
  const hour = now.getHours();

  if (hour >= 5 && hour < 12) {
    return {
      greeting: 'Good morning, Mikiyas.',
      subGreeting: 'Start strong. High energy and sharp focus for today’s roadmap.',
    };
  }
  if (hour >= 12 && hour < 17) {
    return {
      greeting: 'Good afternoon, Mikiyas.',
      subGreeting: 'Maintain momentum across your scheduled study, coding, and workout blocks.',
    };
  }
  if (hour >= 17 && hour < 22) {
    return {
      greeting: 'Good evening, Mikiyas.',
      subGreeting: 'Review today’s achievements and ensure all checklist items are locked in.',
    };
  }
  return {
    greeting: "Night owl, Mikiyas? It's getting late.",
    subGreeting: 'Prioritize deep recovery — quality sleep is the foundation of tomorrow’s discipline.',
  };
}

/**
 * Resolves what Mikiyas should be doing RIGHT NOW dynamically from Forge's real scheduled tasks.
 */
export async function getSmartScheduleStatus(customNow?: Date): Promise<SmartScheduleStatus> {
  const now = customNow || getAddisNow();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const totalMinutes = hour * 60 + minute; // 0..1439

  const timeFormatted = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const hourMinStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const greetings = getPersonalizedGreeting(now);

  const windowInfo = workoutWindowForAddisDate(now);
  const holidayStatus = getHolidayWorkoutStatus(now);

  // 1. Fetch today's actual plan and tasks from database (Single Source of Truth)
  const todayPlan = await ensureTodayDailyPlan();
  const tasks = todayPlan?.tasks || [];

  // Check today's workout completion
  const todayWorkoutLog = await prisma.workoutLog.findFirst({
    where: {
      completedAt: { gte: windowInfo.startUtc, lte: windowInfo.endUtc },
      submittedAt: { not: null },
    },
  });
  const workoutCompleted = Boolean(todayWorkoutLog);

  // Target Boundaries:
  // Wake-up: 11:00 AM (660 min)
  // Daily Close: 09:28 PM (1288 min)
  // Wind-Down: 09:30 PM (1290 min)
  // Target Sleep: 11:00 PM (1380 min)

  // ── A. PRE-WAKE & SLEEP TIME (< 11:00 AM) ──────────────────────────────────
  if (totalMinutes < 660) {
    if (totalMinutes >= 600) {
      // 10:00 AM – 11:00 AM: Pre-Wake Target
      return {
        greeting: greetings.greeting,
        subGreeting: greetings.subGreeting,
        addisTimeFormatted: timeFormatted,
        currentHourMinute: hourMinStr,
        targetWakeTime: '11:00 AM',
        targetSleepTime: '11:00 PM',
        currentActivityTitle: 'Target Wake-Up Approaching (11:00 AM)',
        currentActivityCategory: 'WAKE',
        statusMessage: 'Fixed daily wake-up target is 11:00 AM. Prepare for a disciplined day.',
        actionCallout: 'Wake up, hydrate, and prepare for your scheduled tasks.',
        suggestedAction: { type: 'CHECKIN', label: 'Open Today Roadmap', href: '/today' },
        upcomingNext: {
          title: tasks[0] ? getTaskCleanTitle(tasks[0]) : 'First Scheduled Task',
          timeFormatted: tasks[0]?.plannedStartTime ? formatMinutesTo12Hour(parseTimeToMinutes(tasks[0].plannedStartTime)!) : '12:00 PM',
          category: 'STUDY',
        },
      };
    }

    return {
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      addisTimeFormatted: timeFormatted,
      currentHourMinute: hourMinStr,
      targetWakeTime: '11:00 AM',
      targetSleepTime: '11:00 PM',
      currentActivityTitle: 'Now it’s time to sleep.',
      currentActivityCategory: 'SLEEP',
      statusMessage: 'Physical and cognitive recovery window. Quality sleep drives willpower and muscle repair.',
      actionCallout: 'Rest up until 11:00 AM target wake-up.',
      suggestedAction: { type: 'SLEEP', label: 'View Sleep Target', href: '/today#sleep' },
      upcomingNext: { title: 'Fixed Wake-Up Target (11:00 AM)', timeFormatted: '11:00 AM', category: 'WAKE' },
    };
  }

  // ── B. POST DAILY CUTOFF / WIND-DOWN / SLEEP (>= 09:28 PM / 1288 min) ───────
  if (totalMinutes >= 1288) {
    if (totalMinutes < 1380) {
      // 09:28 PM – 11:00 PM: Wind-Down
      return {
        greeting: greetings.greeting,
        subGreeting: greetings.subGreeting,
        addisTimeFormatted: timeFormatted,
        currentHourMinute: hourMinStr,
        targetWakeTime: '11:00 AM',
        targetSleepTime: '11:00 PM',
        currentActivityTitle: 'Start winding down.',
        currentActivityCategory: 'WIND_DOWN',
        statusMessage: 'Daily close passed at 09:28 PM. Disconnect from screens and prepare for restful sleep.',
        actionCallout: 'Wind down your mind and body before 11:00 PM sleep target.',
        suggestedAction: { type: 'SLEEP', label: 'View Sleep Target', href: '/today#sleep' },
        upcomingNext: { title: 'Sleep Target (11:00 PM)', timeFormatted: '11:00 PM', category: 'SLEEP' },
      };
    }

    // 11:00 PM+
    return {
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      addisTimeFormatted: timeFormatted,
      currentHourMinute: hourMinStr,
      targetWakeTime: '11:00 AM',
      targetSleepTime: '11:00 PM',
      currentActivityTitle: 'Now it’s time to sleep.',
      currentActivityCategory: 'SLEEP',
      statusMessage: 'Target sleep time is 11:00 PM. Rest deeply for an energized 11:00 AM wake-up tomorrow.',
      actionCallout: 'Sleep on time to preserve circadian consistency.',
      suggestedAction: { type: 'SLEEP', label: 'Sleep Target', href: '/today#sleep' },
      upcomingNext: { title: 'Wake up (11:00 AM)', timeFormatted: '11:00 AM', category: 'WAKE' },
    };
  }

  // ── C. ACTIVE DAY (11:00 AM – 09:28 PM): DYNAMIC TASK SCHEDULE RESOLUTION ──
  // Check tasks with plannedStartTime to find active, upcoming, or past tasks
  const tasksWithTimes = tasks
    .map((t) => {
      const startMins = parseTimeToMinutes(t.plannedStartTime);
      const endMins = parseTimeToMinutes(t.plannedEndTime) || (startMins !== null ? startMins + (t.minutesTarget || 60) : null);
      return { task: t, startMins, endMins, title: getTaskCleanTitle(t), category: getTaskCategory(t) };
    })
    .filter((item) => item.startMins !== null);

  // 1. Find currently active task where startMins <= totalMinutes <= endMins
  const activeTaskItem = tasksWithTimes.find(
    (item) => item.startMins! <= totalMinutes && totalMinutes <= (item.endMins || item.startMins! + 60)
  );

  // Find next upcoming task
  const upcomingTaskItem = tasksWithTimes
    .filter((item) => item.startMins! > totalMinutes)
    .sort((a, b) => a.startMins! - b.startMins!)[0];

  // If a task is scheduled RIGHT NOW:
  if (activeTaskItem) {
    const t = activeTaskItem.task;
    const isDone = t.completed;
    const cat = activeTaskItem.category;
    const title = activeTaskItem.title;

    let actionHref = '/todo';
    let actionType: 'TASK' | 'WORKOUT' | 'CHECKIN' = 'TASK';
    let activityTitle = `Now it’s time for ${title}.`;

    if (cat === 'WORKOUT') {
      actionHref = '/workout';
      actionType = 'WORKOUT';
      const workoutName = holidayStatus.isHolidayPeriod
        ? `Holiday Home Workout (${holidayStatus.todayRoutine?.title || 'Home Session'})`
        : 'Gym Training Session';
      activityTitle = workoutCompleted ? 'Workout Session Completed ✓' : `Now it’s time for your workout (${workoutName}).`;
    } else if (cat === 'CODING') {
      activityTitle = isDone ? `${title} — Completed ✓` : `Now it’s time to code (${title}).`;
    } else if (cat === 'STUDY') {
      activityTitle = isDone ? `${title} — Completed ✓` : `Now it’s time to study (${title}).`;
    } else if (cat === 'READING') {
      actionHref = '/reading';
      activityTitle = isDone ? `${title} — Completed ✓` : `Now it’s time to read & reflect (${title}).`;
    }

    return {
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      addisTimeFormatted: timeFormatted,
      currentHourMinute: hourMinStr,
      targetWakeTime: '11:00 AM',
      targetSleepTime: '11:00 PM',
      currentActivityTitle: activityTitle,
      currentActivityCategory: cat,
      statusMessage: isDone
        ? `Great execution! ${title} is completed. Ready for the next scheduled block.`
        : `Scheduled block: ${formatMinutesTo12Hour(activeTaskItem.startMins!)} – ${formatMinutesTo12Hour(activeTaskItem.endMins!)}.`,
      actionCallout: isDone ? 'Logged in Forge.' : `Complete your target minutes for ${title}.`,
      suggestedAction: isDone
        ? { type: 'CHECKIN', label: upcomingTaskItem ? `Next: ${upcomingTaskItem.title}` : 'Review Checklist', href: actionHref }
        : { type: actionType, label: `Mark ${title.split('—')[0].trim()} Complete`, href: actionHref, taskId: t.id },
      afterwardPrompt: !isDone ? { question: `Did you complete ${title}?`, itemTitle: title, taskId: t.id } : undefined,
      upcomingNext: upcomingTaskItem
        ? { title: upcomingTaskItem.title, timeFormatted: formatMinutesTo12Hour(upcomingTaskItem.startMins!), category: upcomingTaskItem.category }
        : { title: 'Daily Cutoff & Final Lock (09:28 PM)', timeFormatted: '09:28 PM', category: 'CLOSE' },
    };
  }

  // 2. If between scheduled tasks: suggest highest priority uncompleted task or next upcoming
  const uncompletedPending = tasks.find((t) => !t.completed);
  const pendingTitle = uncompletedPending ? getTaskCleanTitle(uncompletedPending) : null;

  return {
    greeting: greetings.greeting,
    subGreeting: greetings.subGreeting,
    addisTimeFormatted: timeFormatted,
    currentHourMinute: hourMinStr,
    targetWakeTime: '11:00 AM',
    targetSleepTime: '11:00 PM',
    currentActivityTitle: uncompletedPending
      ? `Focus Target: ${pendingTitle}`
      : 'All Scheduled Focus Tasks Completed ✓',
    currentActivityCategory: uncompletedPending ? getTaskCategory(uncompletedPending) : 'FREE',
    statusMessage: uncompletedPending
      ? `You have pending tasks scheduled today. Work on ${pendingTitle} or prepare for upcoming sessions.`
      : 'All current scheduled tasks are checked off. Maintain momentum or review upcoming material.',
    actionCallout: uncompletedPending ? `Open Forge to complete ${pendingTitle}.` : 'Great discipline today.',
    suggestedAction: uncompletedPending
      ? { type: 'TASK', label: `Complete ${pendingTitle?.split('—')[0].trim()}`, href: '/todo', taskId: uncompletedPending.id }
      : { type: 'CHECKIN', label: 'View Today Command Center', href: '/today' },
    afterwardPrompt: uncompletedPending ? { question: `Did you complete ${pendingTitle}?`, itemTitle: pendingTitle!, taskId: uncompletedPending.id } : undefined,
    upcomingNext: upcomingTaskItem
      ? { title: upcomingTaskItem.title, timeFormatted: formatMinutesTo12Hour(upcomingTaskItem.startMins!), category: upcomingTaskItem.category }
      : { title: 'Daily Cutoff & Final Lock (09:28 PM)', timeFormatted: '09:28 PM', category: 'CLOSE' },
  };
}
