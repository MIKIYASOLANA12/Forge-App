import { prisma } from './prisma';
import { getCurrentWeek, getPhase } from './workout';
import { levelProgress, computeLevel } from './xp';
import { isHabitLocked } from './streak';

import { getAddisNow, workoutWindowForAddisDate } from './workoutTime';

function getTodayDateRange() {
  const now = getAddisNow();
  const { startUtc: todayStart, endUtc: todayEnd } = workoutWindowForAddisDate(now);
  return { now, todayStart, todayEnd };
}

export async function getTodaySummary(): Promise<string> {
  const { now, todayStart, todayEnd } = getTodayDateRange();

  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const formattedDate = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const [profile, plan, program, lastLog, days, domains, todayWorkoutLog] = await Promise.all([
    prisma.userProfile.findUnique({ where: { id: 'singleton' } }),
    prisma.dailyPlan.findFirst({
      where: { date: { gte: todayStart, lte: todayEnd } },
      include: { tasks: true },
    }),
    prisma.workoutProgram.findUnique({ where: { id: 'singleton' } }),
    prisma.workoutLog.findFirst({
      orderBy: { completedAt: 'desc' },
      include: { workoutDay: true },
    }),
    prisma.workoutDay.findMany({
      include: { exercises: { orderBy: { order: 'asc' } } },
    }),
    prisma.domain.findMany(),
    prisma.workoutLog.findFirst({
      where: { completedAt: { gte: todayStart, lte: todayEnd } },
      include: { workoutDay: true },
    }),
  ]);

  const domainMap = new Map(domains.map((d) => [d.id, d.name]));

  // XP & Level
  const totalXp = profile?.totalXp ?? 0;
  const level = profile?.level ?? computeLevel(totalXp);

  // Plan & Tasks
  const tasks = plan?.tasks ?? [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const nextTask = tasks.find((t) => !t.completed);

  // Workout details
  const ORDER = ['Push', 'Pull', 'LegsCore'];
  let currentWorkoutType = 'Rest / Active Recovery';
  let weekNumber = 1;
  let phase = getPhase(1);

  if (program && days.length > 0) {
    weekNumber = getCurrentWeek(program.startDate);
    phase = getPhase(weekNumber);
    const lastIndex = lastLog ? ORDER.indexOf(lastLog.workoutDay.type) : -1;
    currentWorkoutType = ORDER[(lastIndex + 1) % ORDER.length];
  }

  const workoutStatus = todayWorkoutLog
    ? `✅ Completed (${todayWorkoutLog.workoutDay.type})`
    : `⏳ Pending (${currentWorkoutType} - Gym / Home)`;

  // Format Task List
  let taskListStr = 'No plan generated for today yet.';
  if (tasks.length > 0) {
    taskListStr = tasks
      .map((t) => {
        const domainName = domainMap.get(t.domainId) || 'Task';
        const mark = t.completed ? '✓' : ' ';
        const status = t.completed ? 'Done' : 'Pending';
        return `• [${mark}] ${t.description} (${domainName}, ${t.minutesTarget}m) - ${status}`;
      })
      .join('\n');
  }

  const nextUpStr = nextTask
    ? `• ${nextTask.description} (${domainMap.get(nextTask.domainId) || 'Task'}, ${nextTask.minutesTarget}m)`
    : totalTasks > 0
    ? '🎉 All tasks completed for today!'
    : '• Generate today’s plan in Forge';

  return `📅 TODAY: ${weekday}, ${formattedDate}

⚡ Level: ${level} | XP: ${totalXp.toLocaleString()} XP
📊 Completion: ${completedTasks}/${totalTasks} tasks (${completionPct}%)

📋 Scheduled Tasks:
${taskListStr}

🏋️ Workout:
• Program: Week ${weekNumber} of 24
• Phase: ${phase.goal} (${phase.sets} sets × ${phase.reps} reps)
• Status: ${workoutStatus}

🎯 Next Up:
${nextUpStr}`;
}

export async function getProgressSummary(): Promise<string> {
  const { todayStart, todayEnd, now } = getTodayDateRange();

  // seven days ago in Addis-local time, converted to UTC for DB queries
  const sevenDaysAgoAddis = new Date(now);
  sevenDaysAgoAddis.setDate(sevenDaysAgoAddis.getDate() - 7);
  const { toUtcFromAddis } = await import('./workoutTime');
  const sevenDaysAgoUtc = toUtcFromAddis(sevenDaysAgoAddis);

  const [profile, habits, recentSessions, domains, weeklyLogs] = await Promise.all([
    prisma.userProfile.findUnique({ where: { id: 'singleton' } }),
    prisma.habit.findMany({
      where: { active: true },
      include: { domain: true },
      orderBy: { streakCount: 'desc' },
    }),
    prisma.session.findMany({
      where: { startedAt: { gte: todayStart, lte: todayEnd } },
      include: { domain: true },
    }),
    prisma.domain.findMany(),
    prisma.workoutLog.findMany({
      where: { completedAt: { gte: sevenDaysAgoUtc } },
    }),
  ]);

  const totalXp = profile?.totalXp ?? 0;
  const progressInfo = levelProgress(totalXp);
  const xpNeeded = progressInfo.nextLevelXp - totalXp;
  const pctToNext = Math.round(progressInfo.progress * 100);

  // Habits breakdown
  let habitsStr = 'No active habits.';
  if (habits.length > 0) {
    habitsStr = habits
      .map((h) => {
        const locked = isHabitLocked(h.streakCount) ? ' 🔒 (Locked In)' : '';
        const streakIcon = h.streakCount > 0 ? '🔥' : '⚪';
        return `• ${streakIcon} ${h.name} (${h.domain.name}): ${h.streakCount} day streak${locked}`;
      })
      .join('\n');
  }

  // Today's focus sessions
  const todayMinutes = recentSessions.reduce((acc, s) => acc + s.minutes, 0);
  const todayXp = recentSessions.reduce((acc, s) => acc + s.xpEarned, 0);

  return `📈 FORGE PROGRESS & STATS

⚡ Level & XP:
• Level: ${progressInfo.level}
• Total XP: ${totalXp.toLocaleString()} XP
• Next Level: Level ${progressInfo.level + 1} (${pctToNext}% progress, ${xpNeeded.toLocaleString()} XP to go)

🔥 Habit Streaks:
${habitsStr}

⏱️ Today's Focus:
• Sessions: ${recentSessions.length} logged
• Time: ${todayMinutes} mins
• XP Earned Today: +${todayXp.toLocaleString()} XP

🏋️ 7-Day Workout Consistency:
• ${weeklyLogs.length} workouts completed this week`;
}

export async function getWorkoutSummary(): Promise<string> {
  const { now, todayStart, todayEnd } = getTodayDateRange();

  const [program, lastLog, days, todayLog] = await Promise.all([
    prisma.workoutProgram.findUnique({ where: { id: 'singleton' } }),
    prisma.workoutLog.findFirst({
      orderBy: { completedAt: 'desc' },
      include: { workoutDay: true },
    }),
    prisma.workoutDay.findMany({
      include: { exercises: { orderBy: { order: 'asc' } } },
    }),
    prisma.workoutLog.findFirst({
      where: { completedAt: { gte: todayStart, lte: todayEnd } },
      include: { workoutDay: true, exerciseLogs: { include: { exercise: true } } },
    }),
  ]);

  if (!program || days.length === 0) {
    return `🏋️ Workout Program is not initialized in Forge. Please visit the Workout tab to set up your plan.`;
  }

  const ORDER = ['Push', 'Pull', 'LegsCore'];
  const week = getCurrentWeek(program.startDate);
  const phase = getPhase(week);

  const lastIndex = lastLog ? ORDER.indexOf(lastLog.workoutDay.type) : -1;
  const targetType = ORDER[(lastIndex + 1) % ORDER.length];
  const targetDay = days.find((d) => d.type === targetType) ?? days[0];

  // Fetch previous exercise weights for this day
  const previousLogs = await prisma.exerciseLog.findMany({
    where: { exercise: { workoutDayId: targetDay.id } },
    orderBy: { workoutLog: { completedAt: 'desc' } },
    include: { workoutLog: { select: { completedAt: true } } },
  });

  const lastByExercise = new Map<string, (typeof previousLogs)[number]>();
  for (const log of previousLogs) {
    if (!lastByExercise.has(log.exerciseId)) lastByExercise.set(log.exerciseId, log);
  }

  let exerciseListStr = '';
  if (targetDay && targetDay.exercises.length > 0) {
    exerciseListStr = targetDay.exercises
      .map((ex, idx) => {
        const prev = lastByExercise.get(ex.id);
        const prevStr = prev?.weightKg ? ` (last: ${prev.weightKg}kg × ${prev.repsCompleted} reps)` : '';
        return `  ${idx + 1}. ${ex.name} — ${phase.sets} sets × ${phase.reps} reps${prevStr}`;
      })
      .join('\n');
  }

  // Next workout date in Addis-local terms (tomorrow at the same local day boundary)
  const nextWorkoutDate = new Date(now);
  nextWorkoutDate.setDate(nextWorkoutDate.getDate() + 1);
  const nextDateFormatted = nextWorkoutDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const locationType = targetDay.type === 'LegsCore' ? '🏠 HOME / GYM' : '🏋️‍♂️ GYM';

  const statusHeader = todayLog
    ? `✅ COMPLETED TODAY (${todayLog.workoutDay.type})\n⏳ Next Workout: ${nextDateFormatted} (${targetType} - ${locationType})`
    : `⏳ TODAY'S SCHEDULED WORKOUT: ${targetDay.type}`;

  return `🏋️ FORGE WORKOUT TRACKER

${statusHeader}
• Location: ${locationType}
• Program: Week ${week} of 24
• Phase: ${phase.goal}
• Target Volume: ${phase.sets} sets × ${phase.reps} reps

📋 Planned Exercises (${targetDay.type}):
${exerciseListStr || 'No exercises configured for this day.'}

💡 Tip: Mark checkboxes and submit on the website or log sets when finished.`;
}

export async function getPlanSummary(): Promise<string> {
  const { now, todayStart, todayEnd } = getTodayDateRange();

  const formattedDate = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const [plan, domains, habits] = await Promise.all([
    prisma.dailyPlan.findFirst({
      where: { date: { gte: todayStart, lte: todayEnd } },
      include: { tasks: true },
    }),
    prisma.domain.findMany(),
    prisma.habit.findMany({ where: { active: true } }),
  ]);

  const domainMap = new Map(domains.map((d) => [d.id, d.name]));

  if (!plan || plan.tasks.length === 0) {
    return `📋 DAILY PLAN: ${formattedDate}

No plan generated for today yet.
Open Forge → Plans to generate your AI-optimized schedule.`;
  }

  const tasks = plan.tasks;
  const completed = tasks.filter((t) => t.completed);
  const totalMinutes = tasks.reduce((sum, t) => sum + t.minutesTarget, 0);
  const completedMinutes = completed.reduce((sum, t) => sum + t.minutesTarget, 0);

  const taskItems = tasks
    .map((t) => {
      const dName = domainMap.get(t.domainId) || 'Task';
      const statusIcon = t.completed ? '✅' : '⏳';
      return `${statusIcon} ${t.description}\n   └ Domain: ${dName} | Target: ${t.minutesTarget} min`;
    })
    .join('\n\n');

  return `📋 DAILY PLAN: ${formattedDate}

📊 Progress: ${completed.length}/${tasks.length} tasks completed
⏱️ Time: ${completedMinutes}/${totalMinutes} minutes completed

Tasks:
${taskItems}

🎯 Active Habits for Today:
${habits.map((h) => `• ${h.name} (${h.streakCount}d streak)`).join('\n') || 'None'}`;
}

export async function getMissedSummary(): Promise<string> {
  const { todayStart, todayEnd } = getTodayDateRange();

  const [plan, habits, domains, bookGaps, scriptureGaps] = await Promise.all([
    prisma.dailyPlan.findFirst({
      where: { date: { gte: todayStart, lte: todayEnd } },
      include: { tasks: true },
    }),
    prisma.habit.findMany({
      where: { active: true },
      include: { domain: true },
    }),
    prisma.domain.findMany(),
    prisma.bookCheckIn.findMany({
      where: { gapDetected: true },
      include: { book: true },
      take: 3,
    }),
    prisma.scriptureCheckIn.findMany({
      where: { gapDetected: true },
      include: { planItem: true },
      take: 3,
    }),
  ]);

  const domainMap = new Map(domains.map((d) => [d.id, d.name]));

  // Incomplete tasks
  const pendingTasks = plan ? plan.tasks.filter((t) => !t.completed) : [];

  // Incomplete habits today
  const pendingHabits = habits.filter((h) => {
    if (!h.lastCompletedAt) return true;
    const last = new Date(h.lastCompletedAt);
    return last < todayStart;
  });

  const hasItems = pendingTasks.length > 0 || pendingHabits.length > 0 || bookGaps.length > 0 || scriptureGaps.length > 0;

  if (!hasItems) {
    return `🎉 NO MISSED ITEMS!

All scheduled tasks and habits for today are complete, and no learning gaps are pending. Great job staying on track! 🚀`;
  }

  let result = `⚠️ MISSED & PENDING ITEMS\n\n`;

  if (pendingTasks.length > 0) {
    result += `📋 Incomplete Tasks (${pendingTasks.length}):\n`;
    result += pendingTasks
      .map((t) => `• [ ] ${t.description} (${domainMap.get(t.domainId) || 'Task'}, ${t.minutesTarget}m)`)
      .join('\n');
    result += `\n\n`;
  }

  if (pendingHabits.length > 0) {
    result += `🔥 Habits Not Yet Completed Today (${pendingHabits.length}):\n`;
    result += pendingHabits.map((h) => `• ${h.name} (${h.domain.name}, current streak: ${h.streakCount}d)`).join('\n');
    result += `\n\n`;
  }

  if (bookGaps.length > 0 || scriptureGaps.length > 0) {
    result += `🧠 Knowledge Gaps Requiring Review:\n`;
    for (const bg of bookGaps) {
      result += `• Book: ${bg.book.title} (Check-in question review needed)\n`;
    }
    for (const sg of scriptureGaps) {
      result += `• Scripture: ${sg.planItem.reference} (Assessment gap detected)\n`;
    }
    result += `\n`;
  }

  result += `💡 Complete these in Forge to protect your streaks and earn XP!`;
  return result;
}
