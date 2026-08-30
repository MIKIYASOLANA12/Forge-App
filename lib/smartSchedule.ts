/**
 * Master Smart Schedule & Personal Focus Engine
 * 
 * Provides dynamic current-activity, next-activity, and personalized greetings
 * with full timezone-accuracy for Africa/Addis_Ababa and Ethiopian traditional clock support.
 * 
 * Fixed Rules:
 * - Target Wake-Up: 11:00 AM standard time every day (5:00 Ethiopian Day)
 * - Daily Close Cutoff: 09:28 PM standard time (3:28 Ethiopian Night)
 * - Wind-Down Period: 09:30 PM – 10:59 PM standard time (3:30 – 4:59 Ethiopian Night) -> "Start winding down."
 * - Sleep Window: 11:00 PM – 05:59 AM standard time (5:00 – 11:59 Ethiopian Night) -> "It's time to sleep."
 * - Morning Preparation: 06:00 AM – 10:59 AM standard time (12:00 – 4:59 Ethiopian Day) -> Morning focus / Wake-up approaching
 * - Daytime / Evening Focus: 11:00 AM – 09:29 PM standard time -> Dynamically resolved from Forge database tasks
 */

import { prisma } from './prisma';
import {
  getAddisNow,
  getAddisTimeComponents,
  workoutWindowForAddisDate,
  toAddisDateString,
} from './workoutTime';
import { ensureTodayDailyPlan } from './dailyPlanGenerator';
import { getHolidayWorkoutStatus } from './holidayWorkout';

export interface SmartScheduleStatus {
  greeting: string;
  subGreeting: string;
  addisTimeFormatted: string; // e.g. "11:00 AM"
  currentHourMinute: string; // "11:00"
  ethiopianTimeFormatted?: string; // e.g. "5:00 Ethiopian (Day)"
  ethiopianPeriod?: 'Day' | 'Night';
  targetWakeTime: string; // "11:00 AM"
  targetSleepTime: string; // "11:00 PM"
  currentActivityTitle: string;
  currentActivityCategory: 'WAKE' | 'STUDY' | 'CODING' | 'WORKOUT' | 'READING' | 'CLOSE' | 'WIND_DOWN' | 'SLEEP' | 'FREE';
  statusMessage: string;
  actionCallout?: string;
  suggestedAction?: {
    type: 'TASK' | 'WORKOUT' | 'CHECKIN' | 'SLEEP';
    label: string;
    href: string;
    taskId?: string;
  };
  afterwardPrompt?: {
    question: string;
    taskId?: string;
    taskTitle?: string;
  };
  upcomingNext?: {
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
 * Returns dynamic personalized greeting based on Addis Ababa standard hour.
 */
export function getPersonalizedGreeting(customNow?: Date): { greeting: string; subGreeting: string } {
  const { hour } = getAddisTimeComponents(customNow);

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
 * Uses exact timezone-aware Addis Ababa time and obeys strict wake/wind-down/sleep boundaries.
 */
export async function getSmartScheduleStatus(customNow?: Date): Promise<SmartScheduleStatus> {
  const addisComponents = getAddisTimeComponents(customNow);
  const { hour, minute, totalMinutes, formatted12h, ethiopianTime } = addisComponents;
  const hourMinStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  const greetings = getPersonalizedGreeting(customNow);
  const now = customNow || getAddisNow();
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

  // Target Boundaries (in minutes of day):
  // Wake-up: 11:00 AM (660 min)
  // Daily Close: 09:28 PM (1288 min)
  // Wind-Down: 09:30 PM (1290 min)
  // Target Sleep: 11:00 PM (1380 min)

  // ── [1] DEEP SLEEP WINDOW (11:00 PM – 05:59 AM) ──────────────────────────────
  // 1380..1439 mins (11:00 PM – 11:59 PM) OR 0..359 mins (12:00 AM – 05:59 AM)
  if (totalMinutes >= 1380 || totalMinutes < 360) {
    return {
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      addisTimeFormatted: formatted12h,
      currentHourMinute: hourMinStr,
      ethiopianTimeFormatted: ethiopianTime.formatted,
      ethiopianPeriod: ethiopianTime.period,
      targetWakeTime: '11:00 AM',
      targetSleepTime: '11:00 PM',
      currentActivityTitle: 'It’s time to sleep.',
      currentActivityCategory: 'SLEEP',
      statusMessage: 'Target sleep time is 11:00 PM. Rest deeply for an energized 11:00 AM wake-up tomorrow.',
      actionCallout: 'Sleep on time to preserve circadian consistency and recovery.',
      suggestedAction: { type: 'SLEEP', label: 'View Sleep Target', href: '/today#sleep' },
      upcomingNext: { title: 'Wake up (11:00 AM)', timeFormatted: '11:00 AM', category: 'WAKE' },
    };
  }

  // ── [2] MORNING PREPARATION & PRE-WAKE (06:00 AM – 10:59 AM) ────────────────
  // 360..659 mins: MUST NEVER SAY SLEEP!
  if (totalMinutes >= 360 && totalMinutes < 660) {
    if (totalMinutes >= 600) {
      // 10:00 AM – 10:59 AM: Pre-Wake Target
      return {
        greeting: greetings.greeting,
        subGreeting: greetings.subGreeting,
        addisTimeFormatted: formatted12h,
        currentHourMinute: hourMinStr,
        ethiopianTimeFormatted: ethiopianTime.formatted,
        ethiopianPeriod: ethiopianTime.period,
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

    // 06:00 AM – 09:59 AM: Early Morning Focus / Routine
    return {
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      addisTimeFormatted: formatted12h,
      currentHourMinute: hourMinStr,
      ethiopianTimeFormatted: ethiopianTime.formatted,
      ethiopianPeriod: ethiopianTime.period,
      targetWakeTime: '11:00 AM',
      targetSleepTime: '11:00 PM',
      currentActivityTitle: 'Morning Focus — Wake Target at 11:00 AM',
      currentActivityCategory: 'WAKE',
      statusMessage: 'Morning preparation window. Fixed daily wake-up target is 11:00 AM.',
      actionCallout: 'Hydrate, prepare your focus environment, and review today’s schedule.',
      suggestedAction: { type: 'CHECKIN', label: 'Open Today Roadmap', href: '/today' },
      upcomingNext: { title: 'Fixed Wake-Up Target (11:00 AM)', timeFormatted: '11:00 AM', category: 'WAKE' },
    };
  }

  // ── [3] FIXED WAKE-UP TARGET (11:00 AM – 11:59 AM) ───────────────────────────
  // 660..719 mins
  if (totalMinutes >= 660 && totalMinutes < 720) {
    return {
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      addisTimeFormatted: formatted12h,
      currentHourMinute: hourMinStr,
      ethiopianTimeFormatted: ethiopianTime.formatted,
      ethiopianPeriod: ethiopianTime.period,
      targetWakeTime: '11:00 AM',
      targetSleepTime: '11:00 PM',
      currentActivityTitle: 'Wake up — 11:00 AM Target',
      currentActivityCategory: 'WAKE',
      statusMessage: 'Fixed daily wake-up target is 11:00 AM. Hydrate, review your roadmap, and begin execution.',
      actionCallout: 'Open your tasks in Forge and start with high energy.',
      suggestedAction: { type: 'CHECKIN', label: 'Open Daily Roadmap', href: '/today' },
      upcomingNext: {
        title: tasks[0] ? getTaskCleanTitle(tasks[0]) : 'Afternoon Focus Block',
        timeFormatted: tasks[0]?.plannedStartTime ? formatMinutesTo12Hour(parseTimeToMinutes(tasks[0].plannedStartTime)!) : '12:00 PM',
        category: 'STUDY',
      },
    };
  }

  // ── [4] WIND-DOWN WINDOW (09:30 PM – 10:59 PM) ──────────────────────────────
  // 1290..1379 mins: ONLY WIND-DOWN (NOT SLEEP YET!)
  if (totalMinutes >= 1290 && totalMinutes < 1380) {
    return {
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      addisTimeFormatted: formatted12h,
      currentHourMinute: hourMinStr,
      ethiopianTimeFormatted: ethiopianTime.formatted,
      ethiopianPeriod: ethiopianTime.period,
      targetWakeTime: '11:00 AM',
      targetSleepTime: '11:00 PM',
      currentActivityTitle: 'Start winding down.',
      currentActivityCategory: 'WIND_DOWN',
      statusMessage: 'Daily close passed at 09:28 PM. Disconnect from screens and prepare for restful 11:00 PM sleep.',
      actionCallout: 'Wind down your mind and body before 11:00 PM sleep target.',
      suggestedAction: { type: 'SLEEP', label: 'View Sleep Target', href: '/today#sleep' },
      upcomingNext: { title: 'Sleep Target (11:00 PM)', timeFormatted: '11:00 PM', category: 'SLEEP' },
    };
  }

  // ── [5] ACTIVE DAYTIME & EVENING FOCUS (12:00 PM – 09:29 PM) ─────────────────
  // 720..1289 mins: MUST NEVER SAY SLEEP! Dynamically resolve tasks from database.
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
      actionHref = '/todo';
      actionType = 'TASK';
      activityTitle = isDone ? `${title} Completed ✓` : `Now it’s time for ${title}.`;
    } else if (cat === 'STUDY') {
      actionHref = '/todo';
      actionType = 'TASK';
      activityTitle = isDone ? `${title} Completed ✓` : `Now it’s time for ${title}.`;
    }

    return {
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      addisTimeFormatted: formatted12h,
      currentHourMinute: hourMinStr,
      ethiopianTimeFormatted: ethiopianTime.formatted,
      ethiopianPeriod: ethiopianTime.period,
      targetWakeTime: '11:00 AM',
      targetSleepTime: '11:00 PM',
      currentActivityTitle: activityTitle,
      currentActivityCategory: cat,
      statusMessage: isDone
        ? `Target completed on schedule! Great discipline. Upcoming: ${upcomingTaskItem ? upcomingTaskItem.title : 'Daily Close at 09:28 PM'}.`
        : `Scheduled focus window (${activeTaskItem.task.plannedStartTime || ''} - ${activeTaskItem.task.plannedEndTime || ''}). Execute with pure focus.`,
      actionCallout: isDone ? 'Target logged.' : `Focus on ${title}.`,
      suggestedAction: {
        type: actionType,
        label: isDone ? 'View Roadmap' : `Open ${title}`,
        href: actionHref,
        taskId: isDone ? undefined : t.id,
      },
      upcomingNext: upcomingTaskItem
        ? {
            title: upcomingTaskItem.title,
            timeFormatted: formatMinutesTo12Hour(upcomingTaskItem.startMins!),
            category: upcomingTaskItem.category,
          }
        : {
            title: 'Daily Close (09:28 PM)',
            timeFormatted: '09:28 PM',
            category: 'CLOSE',
          },
    };
  }

  // 2. Check if a task just finished within the last 45 minutes (Afterward Prompt)
  const recentlyCompleted = tasksWithTimes
    .filter((item) => item.endMins !== null && totalMinutes >= item.endMins && totalMinutes < item.endMins + 45)
    .sort((a, b) => (b.endMins || 0) - (a.endMins || 0))[0];

  if (recentlyCompleted && !recentlyCompleted.task.completed) {
    const t = recentlyCompleted.task;
    return {
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      addisTimeFormatted: formatted12h,
      currentHourMinute: hourMinStr,
      ethiopianTimeFormatted: ethiopianTime.formatted,
      ethiopianPeriod: ethiopianTime.period,
      targetWakeTime: '11:00 AM',
      targetSleepTime: '11:00 PM',
      currentActivityTitle: `Finish check-in: ${recentlyCompleted.title}`,
      currentActivityCategory: recentlyCompleted.category,
      statusMessage: `Scheduled block ended at ${formatMinutesTo12Hour(recentlyCompleted.endMins!)}. Did you complete your session?`,
      afterwardPrompt: {
        question: `Did you complete ${recentlyCompleted.title}?`,
        taskId: t.id,
        taskTitle: recentlyCompleted.title,
      },
      suggestedAction: {
        type: 'CHECKIN',
        label: 'Mark Completed ✓',
        href: '/todo',
        taskId: t.id,
      },
      upcomingNext: upcomingTaskItem
        ? {
            title: upcomingTaskItem.title,
            timeFormatted: formatMinutesTo12Hour(upcomingTaskItem.startMins!),
            category: upcomingTaskItem.category,
          }
        : {
            title: 'Daily Close (09:28 PM)',
            timeFormatted: '09:28 PM',
            category: 'CLOSE',
          },
    };
  }

  // 3. General Active Daytime State (Between tasks or open roadmap)
  // If approaching 09:28 PM close (09:00 PM – 09:29 PM)
  if (totalMinutes >= 1260 && totalMinutes < 1290) {
    return {
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      addisTimeFormatted: formatted12h,
      currentHourMinute: hourMinStr,
      ethiopianTimeFormatted: ethiopianTime.formatted,
      ethiopianPeriod: ethiopianTime.period,
      targetWakeTime: '11:00 AM',
      targetSleepTime: '11:00 PM',
      currentActivityTitle: 'Daily Close Approaching (09:28 PM Cutoff)',
      currentActivityCategory: 'CLOSE',
      statusMessage: 'Final execution window. Review your checklist and submit all logs before the 09:28 PM cutoff passes.',
      actionCallout: 'Lock in your score and finish daily check-ins.',
      suggestedAction: { type: 'CHECKIN', label: 'Review Today Checklist', href: '/todo' },
      upcomingNext: { title: 'Start winding down (09:30 PM)', timeFormatted: '09:30 PM', category: 'WIND_DOWN' },
    };
  }

  return {
    greeting: greetings.greeting,
    subGreeting: greetings.subGreeting,
    addisTimeFormatted: formatted12h,
    currentHourMinute: hourMinStr,
    ethiopianTimeFormatted: ethiopianTime.formatted,
    ethiopianPeriod: ethiopianTime.period,
    targetWakeTime: '11:00 AM',
    targetSleepTime: '11:00 PM',
    currentActivityTitle: upcomingTaskItem
      ? `Upcoming: ${upcomingTaskItem.title} (${formatMinutesTo12Hour(upcomingTaskItem.startMins!)})`
      : 'Daytime Focus & Scheduled Execution',
    currentActivityCategory: upcomingTaskItem ? (upcomingTaskItem.category as any) : 'FREE',
    statusMessage: upcomingTaskItem
      ? `Next scheduled session: ${upcomingTaskItem.title} at ${formatMinutesTo12Hour(upcomingTaskItem.startMins!)}. Stay focused.`
      : 'Maintain momentum across your daily roadmap. Ensure all planned targets are executed.',
    actionCallout: 'Review your roadmap and stay focused.',
    suggestedAction: { type: 'CHECKIN', label: 'Open Daily Roadmap', href: '/today' },
    upcomingNext: upcomingTaskItem
      ? {
          title: upcomingTaskItem.title,
          timeFormatted: formatMinutesTo12Hour(upcomingTaskItem.startMins!),
          category: upcomingTaskItem.category,
        }
      : {
          title: 'Daily Close (09:28 PM)',
          timeFormatted: '09:28 PM',
          category: 'CLOSE',
        },
  };
}
