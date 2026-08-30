/**
 * FORGE — SMART "WHAT SHOULD I DO NOW?" & COMMAND CENTER SCHEDULE ENGINE
 * Timezone-aware (Africa/Addis_Ababa) schedule, dynamic greetings, and action check-ins.
 */
import { getAddisNow, workoutWindowForAddisDate } from './workoutTime';
import { prisma } from './prisma';
import { getHolidayWorkoutStatus } from './holidayWorkout';

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

/**
 * Returns dynamic personalized greeting based on Addis Ababa hour.
 */
export function getPersonalizedGreeting(customNow?: Date): { greeting: string; subGreeting: string } {
  const now = customNow || getAddisNow();
  const hour = now.getHours();

  if (hour >= 5 && hour < 12) {
    return {
      greeting: 'Good morning, Mikiyas.',
      subGreeting: 'Start strong. High energy and sharp focus for today’s goals.',
    };
  }
  if (hour >= 12 && hour < 17) {
    return {
      greeting: 'Good afternoon, Mikiyas.',
      subGreeting: 'Keep the momentum going across your study, coding, and workout blocks.',
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
 * Resolves what Mikiyas should be doing RIGHT NOW based on current Addis Ababa time,
 * daily plan tasks, and workout completion state.
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

  // Check today's plan tasks and workout status
  const [todayPlan, todayWorkoutLog] = await Promise.all([
    prisma.dailyPlan.findFirst({
      where: { date: { gte: windowInfo.startUtc, lte: windowInfo.endUtc } },
      include: { tasks: true },
    }),
    prisma.workoutLog.findFirst({
      where: {
        completedAt: { gte: windowInfo.startUtc, lte: windowInfo.endUtc },
        submittedAt: { not: null },
      },
    }),
  ]);

  const tasks = todayPlan?.tasks || [];
  const chemistryTask = tasks.find((t) => /chemistry/i.test(t.subject || t.description));
  const codingTask = tasks.find((t) => /javascript|code|coding/i.test(t.subject || t.description));
  const readingTask = tasks.find((t) => /reading|book|faith/i.test(t.subject || t.description));

  const workoutCompleted = Boolean(todayWorkoutLog);

  // Fixed Daily Targets:
  // Wake-up: 11:00 AM (660 min)
  // Study block: 12:00 PM – 02:00 PM (720..840 min)
  // Coding block: 02:00 PM – 04:00 PM (840..960 min)
  // Workout block: 04:00 PM – 06:00 PM (960..1080 min)
  // Reading & Review: 06:00 PM – 08:30 PM (1080..1230 min)
  // Daily Close Countdown: 08:30 PM – 09:28 PM (1230..1288 min)
  // Wind-down: 09:30 PM – 11:00 PM (1290..1380 min)
  // Sleep Target: 11:00 PM – 11:00 AM (1380+ / <660 min)

  // 1. SLEEP & EARLY MORNING (< 11:00 AM)
  if (totalMinutes < 660) {
    if (totalMinutes >= 600) {
      // 10:00 AM – 11:00 AM: Pre-Wake
      return {
        greeting: greetings.greeting,
        subGreeting: greetings.subGreeting,
        addisTimeFormatted: timeFormatted,
        currentHourMinute: hourMinStr,
        targetWakeTime: '11:00 AM',
        targetSleepTime: '11:00 PM',
        currentActivityTitle: 'Target Wake-Up Approaching',
        currentActivityCategory: 'WAKE',
        statusMessage: 'Target wake-up time is 11:00 AM. Prepare for a disciplined, high-impact day.',
        actionCallout: 'Wake up, hydrate, and prepare for your morning study block.',
        suggestedAction: { type: 'CHECKIN', label: 'Open Today Checklist', href: '/today' },
        upcomingNext: { title: 'Study Chemistry & Entrance Preparation', timeFormatted: '12:00 PM', category: 'STUDY' },
      };
    }

    return {
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      addisTimeFormatted: timeFormatted,
      currentHourMinute: hourMinStr,
      targetWakeTime: '11:00 AM',
      targetSleepTime: '11:00 PM',
      currentActivityTitle: 'Sleep & Physical Recovery',
      currentActivityCategory: 'SLEEP',
      statusMessage: 'Now it’s time to sleep. Deep sleep restores cognitive sharpness, muscle repair, and willpower.',
      actionCallout: 'Keep devices down and rest up until 11:00 AM wake-up.',
      suggestedAction: { type: 'SLEEP', label: 'View Sleep Schedule', href: '/today#sleep' },
      upcomingNext: { title: 'Wake up & Morning Check-in', timeFormatted: '11:00 AM', category: 'WAKE' },
    };
  }

  // 2. MORNING WAKE-UP & CHECKIN (11:00 AM – 12:00 PM / 660..720 min)
  if (totalMinutes >= 660 && totalMinutes < 720) {
    return {
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      addisTimeFormatted: timeFormatted,
      currentHourMinute: hourMinStr,
      targetWakeTime: '11:00 AM',
      targetSleepTime: '11:00 PM',
      currentActivityTitle: 'Wake Up & Morning Activation',
      currentActivityCategory: 'WAKE',
      statusMessage: 'Good morning! It is 11:00 AM wake-up time. Hydrate, review today’s roadmap, and get ready for deep work.',
      actionCallout: 'Review today’s plan tasks and start your first study block.',
      suggestedAction: { type: 'CHECKIN', label: 'Review Today’s Roadmap', href: '/today' },
      upcomingNext: { title: 'Chemistry & Entrance Exam Study', timeFormatted: '12:00 PM', category: 'STUDY' },
    };
  }

  // 3. STUDY TIME — CHEMISTRY & ENTRANCE PREP (12:00 PM – 02:00 PM / 720..840 min)
  if (totalMinutes >= 720 && totalMinutes < 840) {
    const isDone = chemistryTask?.completed;
    return {
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      addisTimeFormatted: timeFormatted,
      currentHourMinute: hourMinStr,
      targetWakeTime: '11:00 AM',
      targetSleepTime: '11:00 PM',
      currentActivityTitle: isDone ? 'Chemistry Study Block — Completed ✓' : 'Now it’s time to study Chemistry.',
      currentActivityCategory: 'STUDY',
      statusMessage: isDone
        ? 'Great work! Chemistry study block is completed. Prepare for coding session.'
        : 'Deep focus time: Grade 12 Chemistry & entrance exam mastery.',
      actionCallout: isDone ? 'Chemistry logged.' : 'Open Chemistry notes and complete your target study minutes.',
      suggestedAction: isDone
        ? { type: 'CHECKIN', label: 'Next: Coding Session', href: '/todo' }
        : { type: 'TASK', label: 'Mark Chemistry Complete', href: '/todo', taskId: chemistryTask?.id },
      afterwardPrompt: !isDone && chemistryTask ? { question: 'Did you complete your Chemistry study session?', itemTitle: 'Chemistry Study', taskId: chemistryTask.id } : undefined,
      upcomingNext: { title: 'JavaScript & Coding Session', timeFormatted: '02:00 PM', category: 'CODING' },
    };
  }

  // 4. CODING TIME — JAVASCRIPT / 5 MILLION CODERS (02:00 PM – 04:00 PM / 840..960 min)
  if (totalMinutes >= 840 && totalMinutes < 960) {
    const isDone = codingTask?.completed;
    const workoutType = holidayStatus.isHolidayPeriod ? '16-Day Home Session' : 'Gym Workout';
    return {
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      addisTimeFormatted: timeFormatted,
      currentHourMinute: hourMinStr,
      targetWakeTime: '11:00 AM',
      targetSleepTime: '11:00 PM',
      currentActivityTitle: isDone ? 'Coding Session — Completed ✓' : 'Now it’s time to code.',
      currentActivityCategory: 'CODING',
      statusMessage: isDone
        ? 'Coding session completed! Rest your eyes before workout time.'
        : 'Active coding session: JavaScript, algorithmic problem solving & 5 Million Coders.',
      actionCallout: isDone ? 'Coding logged.' : 'Open your editor and build your daily code target.',
      suggestedAction: isDone
        ? { type: 'CHECKIN', label: `Next: ${workoutType}`, href: '/workout' }
        : { type: 'TASK', label: 'Mark Coding Complete', href: '/todo', taskId: codingTask?.id },
      afterwardPrompt: !isDone && codingTask ? { question: 'Did you complete your coding target today?', itemTitle: 'JavaScript Coding', taskId: codingTask.id } : undefined,
      upcomingNext: { title: `Workout Time (${workoutType})`, timeFormatted: '04:00 PM', category: 'WORKOUT' },
    };
  }

  // 5. WORKOUT TIME (04:00 PM – 06:00 PM / 960..1080 min)
  if (totalMinutes >= 960 && totalMinutes < 1080) {
    const workoutName = holidayStatus.isHolidayPeriod
      ? `Holiday Home Workout — ${holidayStatus.todayRoutine?.title || 'Home Session'}`
      : 'Scheduled Gym Training Session';

    return {
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      addisTimeFormatted: timeFormatted,
      currentHourMinute: hourMinStr,
      targetWakeTime: '11:00 AM',
      targetSleepTime: '11:00 PM',
      currentActivityTitle: workoutCompleted ? 'Today’s Workout Completed ✓' : 'Now it’s time for your workout.',
      currentActivityCategory: 'WORKOUT',
      statusMessage: workoutCompleted
        ? 'Workout logged successfully! Muscles stimulated and progressive overload achieved.'
        : `Training time: ${workoutName}. Focus on clean form and disciplined sets.`,
      actionCallout: workoutCompleted ? 'Workout session finished.' : 'Get ready — push hard with strict reps and controlled rests.',
      suggestedAction: workoutCompleted
        ? { type: 'CHECKIN', label: 'View Workout Log', href: '/workout' }
        : { type: 'WORKOUT', label: 'Start & Log Workout', href: '/workout' },
      afterwardPrompt: !workoutCompleted ? { question: 'Did you finish your workout session?', itemTitle: workoutName } : undefined,
      upcomingNext: { title: 'Evening Reading & Reflection', timeFormatted: '06:00 PM', category: 'READING' },
    };
  }

  // 6. READING, FAITH & REVIEW (06:00 PM – 08:30 PM / 1080..1230 min)
  if (totalMinutes >= 1080 && totalMinutes < 1230) {
    const isDone = readingTask?.completed;
    return {
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      addisTimeFormatted: timeFormatted,
      currentHourMinute: hourMinStr,
      targetWakeTime: '11:00 AM',
      targetSleepTime: '11:00 PM',
      currentActivityTitle: isDone ? 'Reading & Reflection — Completed ✓' : 'Now it’s time to read and reflect.',
      currentActivityCategory: 'READING',
      statusMessage: isDone
        ? 'Reading and reflections completed. Prepare for the 09:28 PM daily close.'
        : 'Quiet focus: Discipline reading, notes reflection, and faith check-in.',
      actionCallout: isDone ? 'Reading logged.' : 'Read your target chapter and write your daily reflection.',
      suggestedAction: isDone
        ? { type: 'CHECKIN', label: 'Review Daily Close', href: '/today' }
        : { type: 'TASK', label: 'Complete Reading Check-in', href: '/reading', taskId: readingTask?.id },
      upcomingNext: { title: 'Daily Cutoff & Final Lock (09:28 PM)', timeFormatted: '08:30 PM', category: 'CLOSE' },
    };
  }

  // 7. DAILY CLOSE WINDOW (08:30 PM – 09:28 PM / 1230..1288 min)
  if (totalMinutes >= 1230 && totalMinutes < 1288) {
    const remainingToClose = 1288 - totalMinutes;
    return {
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      addisTimeFormatted: timeFormatted,
      currentHourMinute: hourMinStr,
      targetWakeTime: '11:00 AM',
      targetSleepTime: '11:00 PM',
      currentActivityTitle: `Daily Close at 09:28 PM — ${remainingToClose}m remaining`,
      currentActivityCategory: 'CLOSE',
      statusMessage: 'Crucial window! Check off all completed activities before 09:28 PM to protect your streak and score.',
      actionCallout: 'Lock in your tasks and workout before the daily grading deadline.',
      suggestedAction: { type: 'CHECKIN', label: 'Finalize Checklist Now', href: '/today' },
      upcomingNext: { title: 'Wind-Down & Sleep Preparation', timeFormatted: '09:30 PM', category: 'WIND_DOWN' },
    };
  }

  // 8. WIND-DOWN TIME (09:30 PM – 11:00 PM / 1290..1380 min)
  if (totalMinutes >= 1288 && totalMinutes < 1380) {
    return {
      greeting: greetings.greeting,
      subGreeting: greetings.subGreeting,
      addisTimeFormatted: timeFormatted,
      currentHourMinute: hourMinStr,
      targetWakeTime: '11:00 AM',
      targetSleepTime: '11:00 PM',
      currentActivityTitle: 'Start winding down.',
      currentActivityCategory: 'WIND_DOWN',
      statusMessage: 'The daily cutoff has passed. Disconnect from screens, prepare your environment, and wind down.',
      actionCallout: 'Wind down your mind and body for deep sleep at 11:00 PM.',
      suggestedAction: { type: 'SLEEP', label: 'View Sleep & Recovery Guide', href: '/today#sleep' },
      upcomingNext: { title: 'Sleep Target (11:00 PM)', timeFormatted: '11:00 PM', category: 'SLEEP' },
    };
  }

  // 9. SLEEP TIME (11:00 PM+ / >= 1380 min)
  return {
    greeting: greetings.greeting,
    subGreeting: greetings.subGreeting,
    addisTimeFormatted: timeFormatted,
    currentHourMinute: hourMinStr,
    targetWakeTime: '11:00 AM',
    targetSleepTime: '11:00 PM',
    currentActivityTitle: 'Now it’s time to sleep.',
    currentActivityCategory: 'SLEEP',
    statusMessage: 'It is 11:00 PM. Consistent sleep timing directly unlocks mental sharpness and muscle recovery.',
    actionCallout: 'Go to sleep on time. Target wake-up is 11:00 AM tomorrow.',
    suggestedAction: { type: 'SLEEP', label: 'Sleep & Recovery Mode', href: '/today#sleep' },
    upcomingNext: { title: 'Wake up (11:00 AM)', timeFormatted: '11:00 AM', category: 'WAKE' },
  };
}
