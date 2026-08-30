/**
 * Master Smart Schedule & Personal Focus Engine
 * 
 * Provides dynamic current-activity, next-activity, time-remaining,
 * and personalized greetings with full timezone-accuracy for Africa/Addis_Ababa
 * and Ethiopian traditional clock support.
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
} from './workoutTime';
import { ensureTodayDailyPlan } from './dailyPlanGenerator';
import { getHolidayWorkoutStatus } from './holidayWorkout';

export interface ScheduledActivityItem {
  id?: string;
  title: string;
  category: 'WAKE' | 'STUDY' | 'CODING' | 'WORKOUT' | 'READING' | 'CLOSE' | 'WIND_DOWN' | 'SLEEP' | 'FREE';
  startTimeFormatted: string;
  endTimeFormatted: string;
  startMinutes: number;
  endMinutes: number;
  minutesTarget: number;
  isCompleted: boolean;
  subject?: string;
  topic?: string;
  isWorkout?: boolean;
}

export interface SmartScheduleStatus {
  greeting: string;
  subGreeting: string;
  addisTimeFormatted: string; // e.g. "11:00 AM"
  currentHourMinute: string; // "11:00"
  ethiopianTimeFormatted?: string; // e.g. "ከረፋዱ 5:00"
  ethiopianTimeFull?: string; // e.g. "ከረፋዱ 5:00 · 5:00 Ethiopian (Late Morning)"
  ethiopianPeriodAmharic?: string; // e.g. "ረፋድ", "ጠዋት", "ምሽት", "ሌሊት"
  ethiopianPrefix?: string; // e.g. "ከረፋዱ", "ከጠዋቱ", "ከምሽቱ", "ከሌሊቱ"
  targetWakeTime: string; // "11:00 AM"
  targetSleepTime: string; // "11:00 PM"
  
  // High-level current status
  currentActivityTitle: string;
  currentActivityCategory: 'WAKE' | 'STUDY' | 'CODING' | 'WORKOUT' | 'READING' | 'CLOSE' | 'WIND_DOWN' | 'SLEEP' | 'FREE';
  statusMessage: string;
  actionCallout?: string;
  
  // Rich Structured Schedule Info
  currentActivity?: {
    id?: string;
    title: string;
    category: 'WAKE' | 'STUDY' | 'CODING' | 'WORKOUT' | 'READING' | 'CLOSE' | 'WIND_DOWN' | 'SLEEP' | 'FREE';
    startTimeFormatted?: string;
    endTimeFormatted?: string;
    minutesRemaining?: number;
    isCompleted?: boolean;
    minutesTarget?: number;
  };
  
  nextActivity?: {
    id?: string;
    title: string;
    category: string;
    startTimeFormatted: string;
    endTimeFormatted?: string;
    minutesUntilStart: number;
    gapMinutes: number;
  };

  laterToday: ScheduledActivityItem[];

  dayProgression: {
    completedCount: number;
    totalCount: number;
    percentage: number;
  };

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

export function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

export function formatMinutesTo12Hour(mins: number): string {
  const normalized = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function getTaskCleanTitle(task: any): string {
  try {
    const parsed = JSON.parse(task.description);
    if (parsed.title) return parsed.title;
  } catch {}
  if (task.subject && task.topic) return `${task.subject}: ${task.topic}`;
  if (task.subject) return `${task.subject} Session`;
  return task.description || 'Focus Session';
}

export function getTaskCategory(task: any): 'STUDY' | 'CODING' | 'WORKOUT' | 'READING' | 'FREE' {
  const text = `${task.subject || ''} ${task.topic || ''} ${task.description || ''}`.toLowerCase();
  if (/workout|gym|exercise|push|pull|legs/i.test(text)) return 'WORKOUT';
  if (/javascript|code|coding|5 million|python|ts/i.test(text)) return 'CODING';
  if (/chemistry|biology|math|physics|english|study/i.test(text) || task.isStudy) return 'STUDY';
  if (/reading|book|faith|reflection|bible/i.test(text)) return 'READING';
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

  // Build sorted parsed activities from database tasks
  const parsedActivities: ScheduledActivityItem[] = tasks
    .map((t) => {
      const startM = parseTimeToMinutes(t.plannedStartTime);
      const defaultDuration = t.minutesTarget || 60;
      const endM = parseTimeToMinutes(t.plannedEndTime) ?? (startM !== null ? startM + defaultDuration : null);
      const cleanTitle = getTaskCleanTitle(t);
      const category = getTaskCategory(t);
      const isWorkout = category === 'WORKOUT';
      const isDone = isWorkout ? workoutCompleted || t.completed : t.completed;

      return {
        id: t.id,
        title: cleanTitle,
        category,
        startTimeFormatted: startM !== null ? formatMinutesTo12Hour(startM) : '',
        endTimeFormatted: endM !== null ? formatMinutesTo12Hour(endM) : '',
        startMinutes: startM ?? -1,
        endMinutes: endM ?? -1,
        minutesTarget: defaultDuration,
        isCompleted: isDone,
        subject: t.subject || undefined,
        topic: t.topic || undefined,
        isWorkout,
      };
    })
    .filter((a) => a.startMinutes >= 0 && a.endMinutes >= 0)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const completedCount = parsedActivities.filter((a) => a.isCompleted).length;
  const totalCount = parsedActivities.length;
  const dayPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const dayProgression = {
    completedCount,
    totalCount,
    percentage: dayPercentage,
  };

  const commonTimeFields = {
    addisTimeFormatted: formatted12h,
    currentHourMinute: hourMinStr,
    ethiopianTimeFormatted: ethiopianTime.formattedAmharic,
    ethiopianTimeFull: ethiopianTime.formattedFull,
    ethiopianPeriodAmharic: ethiopianTime.periodAmharic,
    ethiopianPrefix: ethiopianTime.prefixAmharic,
    targetWakeTime: '11:00 AM',
    targetSleepTime: '11:00 PM',
    dayProgression,
  };

  // Find upcoming activities for later today
  const laterToday = parsedActivities.filter((a) => a.startMinutes > totalMinutes);

  // ── [1] DEEP SLEEP WINDOW (11:00 PM – 05:59 AM) ──────────────────────────────
  // 1380..1439 mins (11:00 PM – 11:59 PM) OR 0..359 mins (12:00 AM – 05:59 AM)
  if (totalMinutes >= 1380 || totalMinutes < 360) {
    const { getSleepAccountabilityStatus } = await import('./sleepAccountability');
    const sleepStatus = await getSleepAccountabilityStatus(customNow);

    let sleepTitle = "It's time to sleep.";
    let sleepMessage = 'Target sleep time is 11:00 PM (ከሌሊቱ 5:00). Rest deeply for an energized 11:00 AM wake-up tomorrow.';
    let actionCallout = 'Sleep on time to preserve circadian consistency and recovery.';
    let suggestedAction: any = { type: 'SLEEP', label: "I'm going to sleep ✓", href: '#sleep' };

    if (sleepStatus.isAcknowledged) {
      sleepTitle = 'Sleep Acknowledged ✓';
      sleepMessage = 'Sleep acknowledged for tonight. Deep restoration active before 11:00 AM wake-up.';
      actionCallout = 'Rest deeply, Mikiyas.';
      suggestedAction = { type: 'SLEEP', label: 'Sleep Target (11:00 PM)', href: '#sleep' };
    } else if (sleepStatus.isOverdue) {
      sleepTitle = `Sleep Overdue (${sleepStatus.overdueMinutes}m)`;
      sleepMessage = `You're ${sleepStatus.overdueMinutes} minutes past your 11:00 PM sleep target. Close Forge and go to sleep.`;
      actionCallout = 'Close Forge and disconnect from screens.';
      suggestedAction = { type: 'SLEEP', label: "I'm going to sleep ✓", href: '#sleep' };
    }

    return {
      ...commonTimeFields,
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      currentActivityTitle: sleepTitle,
      currentActivityCategory: 'SLEEP',
      statusMessage: sleepMessage,
      actionCallout,
      suggestedAction,
      upcomingNext: { title: 'Wake up (11:00 AM)', timeFormatted: '11:00 AM', category: 'WAKE' },
      nextActivity: {
        title: 'Wake up',
        category: 'WAKE',
        startTimeFormatted: '11:00 AM',
        minutesUntilStart: totalMinutes < 360 ? 660 - totalMinutes : 1440 - totalMinutes + 660,
        gapMinutes: 0,
      },
      laterToday: [],
    };
  }

  // ── [2] MORNING PREPARATION & PRE-WAKE (06:00 AM – 10:59 AM) ────────────────
  // 360..659 mins: MUST NEVER SAY SLEEP!
  if (totalMinutes >= 360 && totalMinutes < 660) {
    const firstTask = parsedActivities[0];
    const minsToWake = 660 - totalMinutes;

    return {
      ...commonTimeFields,
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      currentActivityTitle: totalMinutes >= 600
        ? 'Target Wake-Up Approaching (11:00 AM)'
        : 'Morning Focus — Wake Target at 11:00 AM',
      currentActivityCategory: 'WAKE',
      statusMessage: `Fixed daily wake-up target is 11:00 AM (ከረፋዱ 5:00). Prepare for your planned daily roadmap.`,
      actionCallout: 'Wake up, hydrate, and prepare for your scheduled sessions.',
      suggestedAction: { type: 'CHECKIN', label: 'Open Today Roadmap', href: '/today' },
      upcomingNext: {
        title: firstTask ? firstTask.title : 'Target Wake-Up (11:00 AM)',
        timeFormatted: firstTask ? firstTask.startTimeFormatted : '11:00 AM',
        category: firstTask ? firstTask.category : 'WAKE',
      },
      nextActivity: {
        title: 'Wake up (11:00 AM)',
        category: 'WAKE',
        startTimeFormatted: '11:00 AM',
        minutesUntilStart: minsToWake,
        gapMinutes: 0,
      },
      laterToday: parsedActivities,
    };
  }

  // ── [3] FIXED WAKE-UP TARGET (11:00 AM – 11:59 AM) ───────────────────────────
  // 660..719 mins (ከረፋዱ 5:00 – 5:59)
  if (totalMinutes >= 660 && totalMinutes < 720) {
    const firstTask = parsedActivities[0];
    const minsUntilFirst = firstTask ? Math.max(0, firstTask.startMinutes - totalMinutes) : 0;

    return {
      ...commonTimeFields,
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      currentActivityTitle: 'Good morning, Mikiyas. Time to wake up.',
      currentActivityCategory: 'WAKE',
      statusMessage: firstTask
        ? `It's 11:00 AM (ከረፋዱ 5:00) — wake-up time. Next: ${firstTask.title} at ${firstTask.startTimeFormatted}.`
        : `It's 11:00 AM (ከረፋዱ 5:00) — wake-up time. Review your roadmap in Forge.`,
      actionCallout: 'Hydrate and prepare for your first planned session.',
      suggestedAction: { type: 'CHECKIN', label: 'Open Daily Roadmap', href: '/today' },
      upcomingNext: {
        title: firstTask ? firstTask.title : 'Afternoon Focus Block',
        timeFormatted: firstTask ? firstTask.startTimeFormatted : '12:00 PM',
        category: firstTask ? firstTask.category : 'STUDY',
      },
      nextActivity: firstTask
        ? {
            id: firstTask.id,
            title: firstTask.title,
            category: firstTask.category,
            startTimeFormatted: firstTask.startTimeFormatted,
            endTimeFormatted: firstTask.endTimeFormatted,
            minutesUntilStart: minsUntilFirst,
            gapMinutes: minsUntilFirst,
          }
        : {
            title: 'Daily Close (09:28 PM)',
            category: 'CLOSE',
            startTimeFormatted: '09:28 PM',
            minutesUntilStart: 1288 - totalMinutes,
            gapMinutes: 1288 - totalMinutes,
          },
      laterToday: parsedActivities,
    };
  }

  // ── [4] WIND-DOWN WINDOW (09:30 PM – 10:59 PM) ──────────────────────────────
  // 1290..1379 mins (ከሌሊቱ 3:30 – 4:59): ONLY WIND-DOWN (NOT SLEEP YET!)
  if (totalMinutes >= 1290 && totalMinutes < 1380) {
    const minsToSleep = 1380 - totalMinutes;
    return {
      ...commonTimeFields,
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      currentActivityTitle: 'Start winding down.',
      currentActivityCategory: 'WIND_DOWN',
      statusMessage: 'Daily close passed at 09:28 PM. Disconnect from screens and prepare for restful 11:00 PM (ከሌሊቱ 5:00) sleep.',
      actionCallout: 'Wind down your mind and body before 11:00 PM sleep target.',
      suggestedAction: { type: 'SLEEP', label: 'View Sleep Target', href: '/today#sleep' },
      upcomingNext: { title: 'Sleep Target (11:00 PM)', timeFormatted: '11:00 PM', category: 'SLEEP' },
      nextActivity: {
        title: 'Sleep Target (11:00 PM)',
        category: 'SLEEP',
        startTimeFormatted: '11:00 PM',
        minutesUntilStart: minsToSleep,
        gapMinutes: minsToSleep,
      },
      laterToday: [],
    };
  }

  // ── [5] ACTIVE DAYTIME & EVENING FOCUS (12:00 PM – 09:29 PM) ─────────────────
  // 720..1289 mins: MUST NEVER SAY SLEEP! Dynamically resolve tasks from database.

  // 1. Check if a task is currently active: startMinutes <= totalMinutes < endMinutes
  const activeActivity = parsedActivities.find(
    (a) => a.startMinutes <= totalMinutes && totalMinutes < a.endMinutes
  );

  // Find next upcoming task
  const nextUpcoming = parsedActivities.find((a) => a.startMinutes > totalMinutes);

  if (activeActivity) {
    const isDone = activeActivity.isCompleted;
    const cat = activeActivity.category;
    const title = activeActivity.title;
    const remainingMins = Math.max(1, activeActivity.endMinutes - totalMinutes);

    let actionHref = '/todo';
    let actionType: 'TASK' | 'WORKOUT' | 'CHECKIN' = 'TASK';
    let activityTitle = isDone ? `${title} Complete` : `${title}`;

    if (cat === 'WORKOUT') {
      actionHref = '/workout';
      actionType = 'WORKOUT';
      const workoutName = holidayStatus.isHolidayPeriod
        ? `Holiday Home Workout (${holidayStatus.todayRoutine?.title || 'Home Session'})`
        : 'Gym Training Session';
      activityTitle = isDone ? 'Workout Session Completed ✓' : `Workout (${workoutName})`;
    }

    const gapBeforeNext = nextUpcoming ? Math.max(0, nextUpcoming.startMinutes - activeActivity.endMinutes) : 0;

    let statusMessage = '';
    if (isDone) {
      statusMessage = nextUpcoming
        ? `Completed! Next up: ${nextUpcoming.title} at ${nextUpcoming.startTimeFormatted}.`
        : `Completed! You're done with your planned tasks for now.`;
    } else {
      statusMessage = `In progress (${activeActivity.startTimeFormatted} – ${activeActivity.endTimeFormatted}). ⏱️ ${remainingMins} minutes remaining.`;
    }

    return {
      ...commonTimeFields,
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      currentActivityTitle: isDone ? `${title} (Completed)` : `Right now: ${activityTitle}`,
      currentActivityCategory: cat,
      statusMessage,
      actionCallout: isDone ? 'Session finished.' : `Focus on ${title}. ⏱️ ${remainingMins}m remaining.`,
      currentActivity: {
        id: activeActivity.id,
        title: activeActivity.title,
        category: cat,
        startTimeFormatted: activeActivity.startTimeFormatted,
        endTimeFormatted: activeActivity.endTimeFormatted,
        minutesRemaining: remainingMins,
        isCompleted: isDone,
        minutesTarget: activeActivity.minutesTarget,
      },
      suggestedAction: {
        type: actionType,
        label: isDone ? 'View Roadmap' : `Mark ${title} Complete ✓`,
        href: actionHref,
        taskId: isDone ? undefined : activeActivity.id,
      },
      nextActivity: nextUpcoming
        ? {
            id: nextUpcoming.id,
            title: nextUpcoming.title,
            category: nextUpcoming.category,
            startTimeFormatted: nextUpcoming.startTimeFormatted,
            endTimeFormatted: nextUpcoming.endTimeFormatted,
            minutesUntilStart: nextUpcoming.startMinutes - totalMinutes,
            gapMinutes: gapBeforeNext,
          }
        : {
            title: 'Daily Close (09:28 PM)',
            category: 'CLOSE',
            startTimeFormatted: '09:28 PM',
            minutesUntilStart: Math.max(0, 1288 - totalMinutes),
            gapMinutes: Math.max(0, 1288 - activeActivity.endMinutes),
          },
      upcomingNext: nextUpcoming
        ? {
            title: nextUpcoming.title,
            timeFormatted: nextUpcoming.startTimeFormatted,
            category: nextUpcoming.category,
          }
        : {
            title: 'Daily Close (09:28 PM)',
            timeFormatted: '09:28 PM',
            category: 'CLOSE',
          },
      laterToday,
    };
  }

  // 2. Check if a task just finished within recent window (0..15 minutes after end) and uncompleted
  const recentlyEnded = parsedActivities
    .filter((a) => totalMinutes >= a.endMinutes && totalMinutes < a.endMinutes + 15)
    .sort((a, b) => b.endMinutes - a.endMinutes)[0];

  if (recentlyEnded && !recentlyEnded.isCompleted) {
    const minsUntilNext = nextUpcoming ? nextUpcoming.startMinutes - totalMinutes : Math.max(0, 1288 - totalMinutes);

    return {
      ...commonTimeFields,
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      currentActivityTitle: `${recentlyEnded.title} finished.`,
      currentActivityCategory: recentlyEnded.category,
      statusMessage: `Scheduled session ended at ${recentlyEnded.endTimeFormatted}. Did you finish?`,
      afterwardPrompt: {
        question: `Did you complete ${recentlyEnded.title}?`,
        taskId: recentlyEnded.id,
        taskTitle: recentlyEnded.title,
      },
      actionCallout: `Mark ${recentlyEnded.title} complete.`,
      suggestedAction: {
        type: 'CHECKIN',
        label: `Mark ${recentlyEnded.title} Complete ✓`,
        href: '/todo',
        taskId: recentlyEnded.id,
      },
      nextActivity: nextUpcoming
        ? {
            id: nextUpcoming.id,
            title: nextUpcoming.title,
            category: nextUpcoming.category,
            startTimeFormatted: nextUpcoming.startTimeFormatted,
            endTimeFormatted: nextUpcoming.endTimeFormatted,
            minutesUntilStart: minsUntilNext,
            gapMinutes: nextUpcoming.startMinutes - recentlyEnded.endMinutes,
          }
        : {
            title: 'Daily Close (09:28 PM)',
            category: 'CLOSE',
            startTimeFormatted: '09:28 PM',
            minutesUntilStart: Math.max(0, 1288 - totalMinutes),
            gapMinutes: Math.max(0, 1288 - recentlyEnded.endMinutes),
          },
      upcomingNext: nextUpcoming
        ? {
            title: nextUpcoming.title,
            timeFormatted: nextUpcoming.startTimeFormatted,
            category: nextUpcoming.category,
          }
        : {
            title: 'Daily Close (09:28 PM)',
            timeFormatted: '09:28 PM',
            category: 'CLOSE',
          },
      laterToday,
    };
  }

  // 3. Between scheduled activities (Gap Window)
  if (nextUpcoming) {
    const minsUntilNext = nextUpcoming.startMinutes - totalMinutes;
    const gapMessage = minsUntilNext >= 30
      ? `You have ${minsUntilNext} minutes before your next session. Use it for a planned task, break, meal, or preparation.`
      : `Next activity starts in ${minsUntilNext} minutes. Get ready for ${nextUpcoming.title}.`;

    return {
      ...commonTimeFields,
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      currentActivityTitle: "You're between scheduled activities.",
      currentActivityCategory: 'FREE',
      statusMessage: `➡️ Next: ${nextUpcoming.title} at ${nextUpcoming.startTimeFormatted}. ${gapMessage}`,
      actionCallout: `Next: ${nextUpcoming.title} at ${nextUpcoming.startTimeFormatted} (in ${minsUntilNext}m).`,
      suggestedAction: { type: 'CHECKIN', label: 'View Today Plan', href: '/today' },
      nextActivity: {
        id: nextUpcoming.id,
        title: nextUpcoming.title,
        category: nextUpcoming.category,
        startTimeFormatted: nextUpcoming.startTimeFormatted,
        endTimeFormatted: nextUpcoming.endTimeFormatted,
        minutesUntilStart: minsUntilNext,
        gapMinutes: minsUntilNext,
      },
      upcomingNext: {
        title: nextUpcoming.title,
        timeFormatted: nextUpcoming.startTimeFormatted,
        category: nextUpcoming.category,
      },
      laterToday,
    };
  }

  // 4. Past all scheduled tasks, approaching 09:28 PM close
  if (totalMinutes >= 1260 && totalMinutes < 1290) {
    return {
      ...commonTimeFields,
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      currentActivityTitle: 'Daily Close Approaching (09:28 PM Cutoff)',
      currentActivityCategory: 'CLOSE',
      statusMessage: 'Final execution window. Review your checklist and submit all logs before the 09:28 PM cutoff passes.',
      actionCallout: 'Lock in your score and finish daily check-ins.',
      suggestedAction: { type: 'CHECKIN', label: 'Review Today Checklist', href: '/todo' },
      upcomingNext: { title: 'Start winding down (09:30 PM)', timeFormatted: '09:30 PM', category: 'WIND_DOWN' },
      nextActivity: {
        title: 'Start winding down (09:30 PM)',
        category: 'WIND_DOWN',
        startTimeFormatted: '09:30 PM',
        minutesUntilStart: Math.max(0, 1290 - totalMinutes),
        gapMinutes: 0,
      },
      laterToday: [],
    };
  }

  // 5. General active state (All tasks done for today)
  return {
    ...commonTimeFields,
    greeting: greetings.greeting,
    subGreeting: greetings.subGreeting,
    currentActivityTitle: "You're done with your planned tasks for now.",
    currentActivityCategory: 'FREE',
    statusMessage: 'All planned sessions for today have been completed or scheduled. Great discipline!',
    actionCallout: 'Review your progress or rest.',
    suggestedAction: { type: 'CHECKIN', label: 'Open Daily Roadmap', href: '/today' },
    nextActivity: {
      title: 'Daily Close (09:28 PM)',
      category: 'CLOSE',
      startTimeFormatted: '09:28 PM',
      minutesUntilStart: Math.max(0, 1288 - totalMinutes),
      gapMinutes: Math.max(0, 1288 - totalMinutes),
    },
    upcomingNext: {
      title: 'Daily Close (09:28 PM)',
      timeFormatted: '09:28 PM',
      category: 'CLOSE',
    },
    laterToday: [],
  };
}
