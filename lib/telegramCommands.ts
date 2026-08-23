import { isGoogleCalendarConnected } from './googleCalendar';

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

import { prisma } from './prisma';
import { getCurrentWeek, getPhase } from './workout';
import { levelProgress, computeLevel } from './xp';
import { getAddisNow, workoutWindowForAddisDate, toUtcFromAddis } from './workoutTime';
import { getDailyBreakdown, getProgressHistory } from './progressEngine';
import { ACHIEVEMENTS_CATALOG } from './achievements';

function getTodayDateRange() {
  const now = getAddisNow();
  const { startUtc: todayStart, endUtc: todayEnd } = workoutWindowForAddisDate(now);
  return { now, todayStart, todayEnd };
}

/**
 * /today command: returns complete daily overview
 */
export async function getTodaySummary(): Promise<string> {
  const { now, todayStart, todayEnd } = getTodayDateRange();
  const breakdown = await getDailyBreakdown(now);

  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const formattedDate = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const [profile, program, lastLog, days] = await Promise.all([
    prisma.userProfile.findUnique({ where: { id: 'singleton' } }),
    prisma.workoutProgram.findUnique({ where: { id: 'singleton' } }),
    prisma.workoutLog.findFirst({
      orderBy: { completedAt: 'desc' },
      include: { workoutDay: true },
    }),
    prisma.workoutDay.findMany({
      include: { exercises: { orderBy: { order: 'asc' } } },
    }),
  ]);

  const totalXp = profile?.totalXp ?? 0;
  const level = profile?.level ?? computeLevel(totalXp);
  const pInfo = levelProgress(totalXp);

  const ORDER = ['Push', 'Pull', 'LegsCore'];
  const lastIndex = lastLog ? ORDER.indexOf(lastLog.workoutDay.type) : -1;
  const targetType = ORDER[(lastIndex + 1) % ORDER.length];
  const targetDay = days.find((d) => d.type === targetType) ?? days[0];
  const locationType = targetDay?.type === 'LegsCore' ? '🏠 HOME / GYM' : '🏋️‍♂️ GYM';

  const workoutStatus = breakdown.workout.completed
    ? `✅ Completed (${breakdown.workout.type || targetType})`
    : `⏳ Scheduled: ${targetType} (${locationType})`;

  return `🛡️ FORGE DAILY SUMMARY: ${weekday}, ${formattedDate}
(Addis Ababa Time • 05:00 Day Boundary)

⚡ Character Status:
• Level ${level} (${totalXp.toLocaleString()} XP)
• Next Level: ${Math.round(pInfo.progress * 100)}%

🎯 Daily Consistency Score: ${breakdown.consistencyScore}% [${breakdown.color}]
• Strongest Area: ${breakdown.strongestArea}
• Focus Tomorrow: ${breakdown.whatNeedsAttentionTomorrow}

🏋️ Workout:
• Status: ${workoutStatus}

📋 Daily Tasks:
• ${breakdown.tasks.completed}/${breakdown.tasks.total} completed (${breakdown.tasks.percentage}%)

⏱️ Focus Sessions:
• Study: ${breakdown.study.minutes}m | Coding: ${breakdown.coding.minutes}m | Reading: ${breakdown.reading.minutes}m

🔥 Habits:
• ${breakdown.habits.completed}/${breakdown.habits.total} habits logged

🥗 Nutrition:
• ${breakdown.nutrition.calories} kcal / ${breakdown.nutrition.protein}g protein`;
}

/**
 * /workout command: detailed scheduled workout details & exercises
 */
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
    return `🏋️ Workout Program is not initialized in Forge. Visit Forge → Workout to set up.`;
  }

  const ORDER = ['Push', 'Pull', 'LegsCore'];
  const week = getCurrentWeek(program.startDate);
  const phase = getPhase(week);

  const lastIndex = lastLog ? ORDER.indexOf(lastLog.workoutDay.type) : -1;
  const targetType = ORDER[(lastIndex + 1) % ORDER.length];
  const targetDay = days.find((d) => d.type === targetType) ?? days[0];

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

  const nextWorkoutDate = new Date(now);
  nextWorkoutDate.setDate(nextWorkoutDate.getDate() + 1);
  const nextDateFormatted = nextWorkoutDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
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

💡 Tip: Mark checkboxes and submit on Forge web when complete.`;
}

/**
 * /progress command: real-time progress engine metrics
 */
export async function getProgressSummary(): Promise<string> {
  const { now } = getTodayDateRange();
  const [breakdown, history, profile, achievementsInDb] = await Promise.all([
    getDailyBreakdown(now),
    getProgressHistory(7),
    prisma.userProfile.findUnique({ where: { id: 'singleton' } }),
    prisma.achievement.findMany(),
  ]);

  const totalXp = profile?.totalXp ?? 0;
  const progressInfo = levelProgress(totalXp);
  const xpNeeded = progressInfo.nextLevelXp - totalXp;
  const pctToNext = Math.round(progressInfo.progress * 100);

  // Calculate active streak
  let activeStreak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].consistencyScore >= 60) activeStreak++;
    else if (i === history.length - 1 && history[i].color === 'GRAY') continue;
    else break;
  }

  return `📈 FORGE REAL PROGRESS ENGINE

⚡ Level & XP:
• Level: ${progressInfo.level} (${totalXp.toLocaleString()} XP)
• Next Level: Level ${progressInfo.level + 1} (${pctToNext}%, ${xpNeeded.toLocaleString()} XP remaining)

🎯 Today's Consistency: ${breakdown.consistencyScore}% [${breakdown.color}]
• Workout: ${breakdown.workout.completed ? '100%' : '0%'}
• Daily Tasks: ${breakdown.tasks.percentage}%
• Study: ${breakdown.study.score}% (${breakdown.study.minutes}m)
• Coding: ${breakdown.coding.score}% (${breakdown.coding.minutes}m)
• Reading: ${breakdown.reading.score}% (${breakdown.reading.minutes}m)
• Habits: ${breakdown.habits.score}%
• Nutrition: ${breakdown.nutrition.score}%

🔥 Streak & Milestones:
• Active Consistency Streak: ${activeStreak} consecutive days (≥60%)
• Achievements Unlocked: ${achievementsInDb.length} of ${ACHIEVEMENTS_CATALOG.length}
• Strongest Domain: ${breakdown.strongestArea}

🌐 View detailed interactive graphs & calendar at: /progress`;
}

/**
 * /plan command: daily tasks and time targets
 */
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
Open Forge → Plans to generate your schedule.`;
  }

  const tasks = plan.tasks;
  const completed = tasks.filter((t) => t.completed);
  const totalMinutes = tasks.reduce((sum, t) => sum + t.minutesTarget, 0);
  const completedMinutes = completed.reduce((sum, t) => sum + t.minutesTarget, 0);

  const taskItems = tasks
    .map((t) => {
      const dName = domainMap.get(t.domainId) || 'Task';
      const statusIcon = t.completed ? '✅' : '⏳';
      return `${statusIcon} ${formatTaskText(t.description)}\n   └ Domain: ${dName} | Target: ${t.minutesTarget} min`;
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

/**
 * /missed command: uncompleted tasks, habits, and gaps
 */
export async function getMissedSummary(): Promise<string> {
  const { now, todayStart, todayEnd } = getTodayDateRange();
  const breakdown = await getDailyBreakdown(now);

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
  const pendingTasks = plan ? plan.tasks.filter((t) => !t.completed) : [];
  const pendingHabits = habits.filter((h) => {
    if (!h.lastCompletedAt) return true;
    const last = new Date(h.lastCompletedAt);
    return last < todayStart;
  });

  const isWorkoutPending = !breakdown.workout.completed;
  const hasItems = isWorkoutPending || pendingTasks.length > 0 || pendingHabits.length > 0 || bookGaps.length > 0 || scriptureGaps.length > 0;

  if (!hasItems) {
    return `🎉 NO MISSED ITEMS!

All scheduled workouts, tasks, and habits for today are complete! Outstanding consistency! 🚀`;
  }

  let result = `⚠️ MISSED & PENDING ACTIVITIES\n\n`;

  if (isWorkoutPending) {
    result += `🏋️ Workout: Today's scheduled session not yet completed!\n\n`;
  }

  if (pendingTasks.length > 0) {
    result += `📋 Incomplete Tasks (${pendingTasks.length}):\n`;
    result += pendingTasks
      .map((t) => `• [ ] ${formatTaskText(t.description)} (${domainMap.get(t.domainId) || 'Task'}, ${t.minutesTarget}m)`)
      .join('\n');
    result += `\n\n`;
  }

  if (pendingHabits.length > 0) {
    result += `🔥 Habits Remaining Today (${pendingHabits.length}):\n`;
    result += pendingHabits.map((h) => `• ${h.name} (${h.domain.name}, ${h.streakCount}d streak)`).join('\n');
    result += `\n\n`;
  }

  if (bookGaps.length > 0 || scriptureGaps.length > 0) {
    result += `🧠 Learning Gaps Needing Review:\n`;
    for (const bg of bookGaps) result += `• Book: ${bg.book.title}\n`;
    for (const sg of scriptureGaps) result += `• Scripture: ${sg.planItem.reference}\n`;
    result += `\n`;
  }

  result += `💡 Log completed activities in Forge to maintain your streak!`;
  return result;
}

/**
 * /report command: daily performance analysis & monthly summary
 */
export async function getReportSummary(): Promise<string> {
  const { now } = getTodayDateRange();
  const breakdown = await getDailyBreakdown(now);

  return `📊 FORGE PERFORMANCE REPORT
Day: ${breakdown.dayOfWeek}, ${breakdown.formattedDate}

🎯 Consistency Score: ${breakdown.consistencyScore}% [${breakdown.color}]
• Strongest Area: ${breakdown.strongestArea}
• Weakest Area: ${breakdown.weakestArea}

🔍 Analysis:
• Improvement: ${breakdown.whatImproved}
• Tomorrow's Focus: ${breakdown.whatNeedsAttentionTomorrow}

📋 Activities Breakdown:
• Workout: ${breakdown.workout.completed ? '✅ Done' : '❌ Incomplete'}
• Tasks: ${breakdown.tasks.completed}/${breakdown.tasks.total} (${breakdown.tasks.percentage}%)
• Study Focus: ${breakdown.study.minutes} mins
• Coding Sessions: ${breakdown.coding.minutes} mins
• Reading: ${breakdown.reading.minutes} mins
• Habits: ${breakdown.habits.completed}/${breakdown.habits.total}
• Nutrition: ${breakdown.nutrition.calories} kcal / ${breakdown.nutrition.protein}g protein

📄 Official Monthly PDF Reports: Available at /progress/reports`;
}

/**
 * /nutrition command: today's calorie/protein targets and adherence
 */
export async function getNutritionSummary(): Promise<string> {
  const { now, todayStart, todayEnd } = getTodayDateRange();

  const [profile, meals] = await Promise.all([
    prisma.userProfile.findUnique({ where: { id: 'singleton' } }),
    prisma.meal.findMany({
      where: { eatenAt: { gte: todayStart, lte: todayEnd } },
      include: { items: true },
    }),
  ]);

  const targetCalories = profile?.targetCalories || 2500;
  const targetProtein = profile?.targetProtein || 150;
  const totalCalories = meals.reduce((sum, m) => sum + m.totalCalories, 0);
  const totalProtein = meals.reduce((sum, m) => sum + m.totalProtein, 0);

  const calPct = Math.round((totalCalories / targetCalories) * 100);
  const protPct = Math.round((totalProtein / targetProtein) * 100);

  let mealList = 'No meals logged yet today.';
  if (meals.length > 0) {
    mealList = meals.map((m) => `• ${m.label}: ${m.totalCalories} kcal, ${m.totalProtein}g protein`).join('\n');
  }

  return `🥗 FORGE NUTRITION TRACKER

📊 Daily Targets & Adherence:
• Calories: ${totalCalories} / ${targetCalories} kcal (${calPct}%)
• Protein: ${totalProtein} / ${targetProtein}g (${protPct}%)

🍽️ Logged Meals (${meals.length}):
${mealList}

💡 Log meals in Forge → Nutrition to hit daily macro targets.`;
}

/**
 * /calendar command: 7-day consistency calendar summary
 */
export async function getCalendarSummary(): Promise<string> {
  const history = await getProgressHistory(7);

  const daysStr = history
    .map((d) => {
      const icon = d.color === 'GREEN' ? '🟢' : d.color === 'BLUE' ? '🔵' : d.color === 'YELLOW' ? '🟡' : d.color === 'RED' ? '🔴' : '⚪';
      const wIcon = d.workout.completed ? '🏋️' : '  ';
      return `${icon} ${d.dayOfWeek.slice(0, 3)} (${d.formattedDate}): ${d.consistencyScore}% ${wIcon} [${d.color}]`;
    })
    .join('\n');

  const googleConnected = await isGoogleCalendarConnected();
  const gStatus = googleConnected ? "✅ Connected & Synced" : "⚪ Disconnected";

  return `📅 FORGE SCHEDULE & CALENDAR\n• Google Calendar: ${gStatus}\n\n📈 7-DAY CONSISTENCY HEATMAP
(Africa/Addis_Ababa 05:00 Day Boundary)

${daysStr}

Legend:
🟢 Excellent (≥80%) | 🔵 Good (60-79%)
🟡 Partial (40-59%) | 🔴 Missed (<40%) | ⚪ No Activity`;
}

/**
 * /physique command: 7-month physical progression status and 5-pose stand instructions
 */
export async function getPhysiqueSummary(): Promise<string> {
  const checkins = await prisma.physiqueCheckin.findMany({
    orderBy: { monthNumber: 'asc' },
  });

  const completed = checkins.filter(
    (c) => c.frontRelaxedUrl || c.frontBicepsUrl || c.backWingsUrl || c.backBicepsUrl || c.sideTricepsUrl
  );

  const latest = checkins[checkins.length - 1];
  const weightStr = latest?.weightKg ? ` (Latest: ${latest.weightKg} kg)` : '';

  return `📸 FORGE 7-MONTH PHYSIQUE TRACKER

🏆 Roadmap Progress: ${completed.length}/8 Checkpoints Completed${weightStr}
Target Muscle Focus: Chest, Back, Triceps, Biceps, Neck, Abs & Wings

📐 5 MANDATORY UPPER BODY POSES:
1️⃣ Front Relaxed — Chest, Neck posture, Abs & Core alignment
2️⃣ Front Double Biceps — Biceps peak, Forearms, Front Delts
3️⃣ Back Lat Spread (Wings) — Lats width flare, Upper Back & Traps
4️⃣ Back Double Biceps — Triceps long head, Rear Delts & Traps
5️⃣ Side Chest & Triceps — Triceps horseshoe flare & Chest depth

📷 STAND & CAMERA GUIDANCE:
• Tripod Height: Chest level (~1.2m)
• Distance: 2.5–3.0 meters
• Lighting: 45° overhead or frontal light

Upload your monthly photos on Forge:
https://forge-app-eight-kappa.vercel.app/physique`;
}

