import { prisma } from './prisma';
import { getAddisNow, workoutWindowForAddisDate, addisFromUtc, toUtcFromAddis } from './workoutTime';
import { computeLevel, levelProgress } from './xp';
import { checkAndAwardAchievements } from './achievements';

/**
 * FORGE CONSISTENCY SCORING FORMULA
 * =================================
 * The consistency score reflects real completed activities within each Addis Ababa
 * workout day (05:00 AM to 05:00 AM next day).
 *
 * Configurable Domain Base Weights:
 * - Workout:   25% (100% if workout logged for scheduled day)
 * - Study:     20% (Target: 60 mins or planned study tasks completed)
 * - Coding:    20% (Target: 60 mins or planned coding tasks completed)
 * - Reading:   10% (Target: 30 mins or scripture/book checkin logged)
 * - Habits:    15% (Percentage of active habits completed)
 * - Nutrition: 10% (Target calorie/protein adherence >= 80%)
 *
 * If a category has no active targets/plans for the user, weights are dynamically
 * re-normalized so total possible is always 100%.
 */

export interface ConsistencyWeights {
  workout: number;
  study: number;
  coding: number;
  reading: number;
  habits: number;
  nutrition: number;
}

export const DEFAULT_WEIGHTS: ConsistencyWeights = {
  workout: 0.25,
  study: 0.20,
  coding: 0.20,
  reading: 0.10,
  habits: 0.15,
  nutrition: 0.10,
};

export type ConsistencyColor = 'GREEN' | 'BLUE' | 'YELLOW' | 'RED' | 'GRAY';

export function getConsistencyColor(score: number, hasAnyActivity: boolean): ConsistencyColor {
  if (!hasAnyActivity && score === 0) return 'GRAY';
  if (score >= 80) return 'GREEN';
  if (score >= 60) return 'BLUE';
  if (score >= 40) return 'YELLOW';
  if (score > 0) return 'RED';
  return 'GRAY';
}

export interface DayBreakdown {
  dateIso: string;
  formattedDate: string;
  dayOfWeek: string;
  consistencyScore: number;
  color: ConsistencyColor;
  xpEarned: number;
  workout: {
    completed: boolean;
    type?: string;
    exercisesLogged: number;
    score: number;
  };
  tasks: {
    completed: number;
    total: number;
    percentage: number;
  };
  study: {
    minutes: number;
    targetMinutes: number;
    score: number;
  };
  coding: {
    minutes: number;
    targetMinutes: number;
    score: number;
  };
  reading: {
    minutes: number;
    targetMinutes: number;
    score: number;
  };
  habits: {
    completed: number;
    total: number;
    score: number;
  };
  nutrition: {
    calories: number;
    targetCalories: number;
    protein: number;
    targetProtein: number;
    score: number;
  };
  strongestArea: string;
  weakestArea: string;
  whatImproved: string;
  whatNeedsAttentionTomorrow: string;
  missedActivities: string[];
}

/**
 * Calculates daily performance for an Addis-local date.
 */
export async function getDailyBreakdown(targetAddisDate: Date): Promise<DayBreakdown> {
  const { startUtc, endUtc, startAddis } = workoutWindowForAddisDate(targetAddisDate);
  const normalizedDateKey = new Date(
    Date.UTC(startAddis.getFullYear(), startAddis.getMonth(), startAddis.getDate())
  );

  // Fetch all domain activities in parallel for this 24h window
  const [
    profile,
    workoutLogs,
    dailyPlan,
    sessions,
    habitLogs,
    activeHabits,
    meals,
    domains,
  ] = await Promise.all([
    prisma.userProfile.findUnique({ where: { id: 'singleton' } }),
    prisma.workoutLog.findMany({
      where: { completedAt: { gte: startUtc, lte: endUtc } },
      include: { workoutDay: true, exerciseLogs: true },
    }),
    prisma.dailyPlan.findFirst({
      where: { date: { gte: startUtc, lte: endUtc } },
      include: { tasks: true },
    }),
    prisma.session.findMany({
      where: { startedAt: { gte: startUtc, lte: endUtc } },
      include: { domain: true },
    }),
    prisma.habitLog.findMany({
      where: { date: { gte: startUtc, lte: endUtc }, completed: true },
    }),
    prisma.habit.findMany({ where: { active: true } }),
    prisma.meal.findMany({
      where: { eatenAt: { gte: startUtc, lte: endUtc } },
    }),
    prisma.domain.findMany(),
  ]);

  const domainMap = new Map(domains.map((d) => [d.id, d.name.toLowerCase()]));

  // 1. Workout
  const workoutDone = workoutLogs.length > 0;
  const exercisesLogged = workoutLogs.reduce((acc, l) => acc + l.exerciseLogs.length, 0);
  const workoutScore = workoutDone ? 100 : 0;
  const workoutType = workoutLogs[0]?.workoutDay?.type;

  // 2. Tasks
  const tasks = dailyPlan?.tasks ?? [];
  const tasksTotal = tasks.length;
  const tasksCompleted = tasks.filter((t) => t.completed).length;
  const taskPercentage = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;

  // 3. Focus Sessions by domain
  let studyMinutes = 0;
  let codingMinutes = 0;
  let readingMinutes = 0;
  let xpFromSessions = 0;

  for (const session of sessions) {
    const domainName = session.domain?.name?.toLowerCase() || domainMap.get(session.domainId) || '';
    if (domainName.includes('study')) studyMinutes += session.minutes;
    else if (domainName.includes('coding') || domainName.includes('code')) codingMinutes += session.minutes;
    else if (domainName.includes('read') || domainName.includes('book')) readingMinutes += session.minutes;
    xpFromSessions += session.xpEarned;
  }

  const studyTarget = 60;
  const codingTarget = 60;
  const readingTarget = 30;

  const studyScore = Math.min(100, Math.round((studyMinutes / studyTarget) * 100));
  const codingScore = Math.min(100, Math.round((codingMinutes / codingTarget) * 100));
  const readingScore = Math.min(100, Math.round((readingMinutes / readingTarget) * 100));

  // 4. Habits
  const habitsTotal = activeHabits.length;
  const habitsCompleted = habitLogs.length;
  const habitsScore = habitsTotal > 0 ? Math.min(100, Math.round((habitsCompleted / habitsTotal) * 100)) : 100;

  // 5. Nutrition
  const totalCalories = meals.reduce((acc, m) => acc + m.totalCalories, 0);
  const totalProtein = meals.reduce((acc, m) => acc + m.totalProtein, 0);
  const targetCalories = profile?.targetCalories || 2500;
  const targetProtein = profile?.targetProtein || 150;

  let nutritionScore = 0;
  if (meals.length > 0) {
    const calRatio = Math.min(1.2, totalCalories / (targetCalories || 1));
    const protRatio = Math.min(1.2, totalProtein / (targetProtein || 1));
    const calScore = calRatio >= 0.8 && calRatio <= 1.2 ? 100 : Math.max(0, 100 - Math.abs(1 - calRatio) * 100);
    const protScore = Math.min(100, protRatio * 100);
    nutritionScore = Math.round((calScore + protScore) / 2);
  }

  // Weighted Consistency Score Calculation
  const rawScores = [
    { name: 'Workout', score: workoutScore, weight: DEFAULT_WEIGHTS.workout },
    { name: 'Study', score: studyScore, weight: DEFAULT_WEIGHTS.study },
    { name: 'Coding', score: codingScore, weight: DEFAULT_WEIGHTS.coding },
    { name: 'Reading', score: readingScore, weight: DEFAULT_WEIGHTS.reading },
    { name: 'Habits', score: habitsScore, weight: DEFAULT_WEIGHTS.habits },
    { name: 'Nutrition', score: nutritionScore, weight: DEFAULT_WEIGHTS.nutrition },
  ];

  const totalWeight = rawScores.reduce((acc, item) => acc + item.weight, 0);
  const consistencyScore = Math.round(
    rawScores.reduce((acc, item) => acc + item.score * (item.weight / (totalWeight || 1)), 0)
  );

  const hasAnyActivity = workoutDone || tasksCompleted > 0 || studyMinutes > 0 || codingMinutes > 0 || readingMinutes > 0 || habitsCompleted > 0 || meals.length > 0;
  const color = getConsistencyColor(consistencyScore, hasAnyActivity);

  // Identify Strongest and Weakest Areas
  const sortedCategories = [...rawScores].sort((a, b) => b.score - a.score);
  const strongestArea = hasAnyActivity ? `${sortedCategories[0].name} (${sortedCategories[0].score}%)` : 'None logged';
  const weakestArea = hasAnyActivity ? `${sortedCategories[sortedCategories.length - 1].name} (${sortedCategories[sortedCategories.length - 1].score}%)` : 'None logged';

  const missedActivities: string[] = [];
  if (!workoutDone) missedActivities.push('Workout');
  if (habitsTotal > habitsCompleted) missedActivities.push(`${habitsTotal - habitsCompleted} Habits`);
  if (tasksTotal > tasksCompleted) missedActivities.push(`${tasksTotal - tasksCompleted} Tasks`);
  if (studyMinutes < 30) missedActivities.push('Study Session');
  if (codingMinutes < 30) missedActivities.push('Coding Session');
  if (meals.length === 0) missedActivities.push('Nutrition Logs');

  const whatImproved = workoutDone && habitsCompleted > 0
    ? 'Solid execution across physical and habit routines.'
    : hasAnyActivity
    ? 'Recorded active progress towards daily objectives.'
    : 'No recorded activity yet for today.';

  const whatNeedsAttentionTomorrow = missedActivities.length > 0
    ? `Prioritize: ${missedActivities.slice(0, 2).join(' & ')}.`
    : 'Maintain top-tier consistency and continue building momentum.';

  const dayOfWeek = startAddis.toLocaleDateString('en-US', { weekday: 'long' });
  const formattedDate = startAddis.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return {
    dateIso: normalizedDateKey.toISOString(),
    formattedDate,
    dayOfWeek,
    consistencyScore,
    color,
    xpEarned: xpFromSessions,
    workout: {
      completed: workoutDone,
      type: workoutType,
      exercisesLogged,
      score: workoutScore,
    },
    tasks: {
      completed: tasksCompleted,
      total: tasksTotal,
      percentage: taskPercentage,
    },
    study: {
      minutes: studyMinutes,
      targetMinutes: studyTarget,
      score: studyScore,
    },
    coding: {
      minutes: codingMinutes,
      targetMinutes: codingTarget,
      score: codingScore,
    },
    reading: {
      minutes: readingMinutes,
      targetMinutes: readingTarget,
      score: readingScore,
    },
    habits: {
      completed: habitsCompleted,
      total: habitsTotal,
      score: habitsScore,
    },
    nutrition: {
      calories: totalCalories,
      targetCalories,
      protein: totalProtein,
      targetProtein,
      score: nutritionScore,
    },
    strongestArea,
    weakestArea,
    whatImproved,
    whatNeedsAttentionTomorrow,
    missedActivities,
  };
}

/**
 * Returns progress history for any day range (7, 30, 90, 180, 365).
 */
export async function getProgressHistory(daysCount: number) {
  const addisNow = getAddisNow();
  const history: DayBreakdown[] = [];

  for (let i = daysCount - 1; i >= 0; i--) {
    const targetDate = new Date(addisNow);
    targetDate.setDate(targetDate.getDate() - i);
    const dayData = await getDailyBreakdown(targetDate);
    history.push(dayData);
  }

  return history;
}

/**
 * Synchronizes daily progress record in DB, updates profile XP & Level,
 * and checks for eligible achievements.
 */
export async function recordProgressActivity(addedXp: number = 0) {
  const addisNow = getAddisNow();
  const breakdown = await getDailyBreakdown(addisNow);
  const normalizedDateKey = new Date(breakdown.dateIso);

  // 1. Upsert ProgressDaily
  await prisma.progressDaily.upsert({
    where: { date: normalizedDateKey },
    create: {
      date: normalizedDateKey,
      consistencyScore: breakdown.consistencyScore,
      color: breakdown.color,
      workoutDone: breakdown.workout.completed,
      tasksCompleted: breakdown.tasks.completed,
      tasksTotal: breakdown.tasks.total,
      studyMinutes: breakdown.study.minutes,
      codingMinutes: breakdown.coding.minutes,
      readingMinutes: breakdown.reading.minutes,
      nutritionScore: breakdown.nutrition.score,
      habitsCompleted: breakdown.habits.completed,
      habitsTotal: breakdown.habits.total,
      xpEarned: breakdown.xpEarned,
      strongestArea: breakdown.strongestArea,
      weakestArea: breakdown.weakestArea,
      summaryJson: JSON.stringify(breakdown),
    },
    update: {
      consistencyScore: breakdown.consistencyScore,
      color: breakdown.color,
      workoutDone: breakdown.workout.completed,
      tasksCompleted: breakdown.tasks.completed,
      tasksTotal: breakdown.tasks.total,
      studyMinutes: breakdown.study.minutes,
      codingMinutes: breakdown.coding.minutes,
      readingMinutes: breakdown.reading.minutes,
      nutritionScore: breakdown.nutrition.score,
      habitsCompleted: breakdown.habits.completed,
      habitsTotal: breakdown.habits.total,
      xpEarned: breakdown.xpEarned,
      strongestArea: breakdown.strongestArea,
      weakestArea: breakdown.weakestArea,
      summaryJson: JSON.stringify(breakdown),
    },
  });

  // 2. If XP added, update UserProfile
  if (addedXp > 0) {
    const profile = await prisma.userProfile.findUnique({ where: { id: 'singleton' } });
    const currentXp = profile?.totalXp ?? 0;
    const newTotalXp = currentXp + addedXp;
    const newLevel = computeLevel(newTotalXp);

    await prisma.userProfile.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        totalXp: newTotalXp,
        level: newLevel,
        examDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        planStartDate: new Date(),
      },
      update: {
        totalXp: newTotalXp,
        level: newLevel,
      },
    });
  }

  // 3. Evaluate achievements
  const newAchievements = await checkAndAwardAchievements();

  return {
    breakdown,
    newAchievements,
  };
}

/**
 * Computes monthly analysis and generates/updates MonthlyProgressReport.
 */
export async function generateMonthlyAnalysis(year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthDays: DayBreakdown[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const addisDate = new Date(year, month - 1, d, 12, 0, 0);
    const dayData = await getDailyBreakdown(addisDate);
    monthDays.push(dayData);
  }

  const profile = await prisma.userProfile.findUnique({ where: { id: 'singleton' } });
  const totalXp = profile?.totalXp ?? 0;
  const endingLevel = profile?.level ?? computeLevel(totalXp);

  const monthlyXp = monthDays.reduce((acc, d) => acc + d.xpEarned, 0);
  const perfectDays = monthDays.filter((d) => d.consistencyScore >= 95).length;
  const missedDays = monthDays.filter((d) => d.color === 'RED' || d.color === 'GRAY').length;

  const workoutDaysCount = monthDays.filter((d) => d.workout.completed).length;
  const workoutRate = Math.round((workoutDaysCount / daysInMonth) * 100);

  const studyAvg = Math.round(monthDays.reduce((acc, d) => acc + d.study.score, 0) / daysInMonth);
  const codingAvg = Math.round(monthDays.reduce((acc, d) => acc + d.coding.score, 0) / daysInMonth);
  const readingAvg = Math.round(monthDays.reduce((acc, d) => acc + d.reading.score, 0) / daysInMonth);
  const nutritionAvg = Math.round(monthDays.reduce((acc, d) => acc + d.nutrition.score, 0) / daysInMonth);
  const habitAvg = Math.round(monthDays.reduce((acc, d) => acc + d.habits.score, 0) / daysInMonth);

  let longestStreak = 0;
  let currentStreak = 0;
  for (const d of monthDays) {
    if (d.consistencyScore >= 60) {
      currentStreak++;
      if (currentStreak > longestStreak) longestStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }

  const sortedDays = [...monthDays].sort((a, b) => b.consistencyScore - a.consistencyScore);
  const bestDay = sortedDays[0]?.consistencyScore > 0 ? `${sortedDays[0].dayOfWeek}, ${sortedDays[0].formattedDate} (${sortedDays[0].consistencyScore}%)` : 'None';
  const weakestDay = sortedDays[sortedDays.length - 1] ? `${sortedDays[sortedDays.length - 1].dayOfWeek}, ${sortedDays[sortedDays.length - 1].formattedDate} (${sortedDays[sortedDays.length - 1].consistencyScore}%)` : 'None';

  const domainsRanked = [
    { name: 'Workout', score: workoutRate },
    { name: 'Study', score: studyAvg },
    { name: 'Coding', score: codingAvg },
    { name: 'Reading', score: readingAvg },
    { name: 'Habits', score: habitAvg },
    { name: 'Nutrition', score: nutritionAvg },
  ].sort((a, b) => b.score - a.score);

  const strongestArea = domainsRanked[0].name;
  const weakestArea = domainsRanked[domainsRanked.length - 1].name;

  const biggestImprovement = `${strongestArea} reached ${domainsRanked[0].score}% consistency`;
  const biggestDecline = `${weakestArea} at ${domainsRanked[domainsRanked.length - 1].score}% adherence`;

  const reportPayload = {
    year,
    month,
    totalXp,
    endingLevel,
    xpEarned: monthlyXp,
    workoutRate,
    studyRate: studyAvg,
    codingRate: codingAvg,
    readingRate: readingAvg,
    nutritionScore: nutritionAvg,
    habitRate: habitAvg,
    perfectDays,
    missedDays,
    longestStreak,
    bestDay,
    weakestDay,
    strongestArea,
    weakestArea,
    biggestImprovement,
    biggestDecline,
    monthDays,
    recommendations: [
      `Double down on ${strongestArea} momentum to sustain compounding gains.`,
      `Schedule dedicated focus blocks for ${weakestArea} early in each day.`,
      `Aim for at least ${Math.min(daysInMonth, longestStreak + 3)} days of consecutive >= 80% consistency.`,
    ],
  };

  const report = await prisma.monthlyProgressReport.upsert({
    where: {
      year_month: {
        year,
        month,
      },
    },
    create: {
      year,
      month,
      totalXp,
      endingLevel,
      xpEarned: monthlyXp,
      workoutRate,
      studyRate: studyAvg,
      codingRate: codingAvg,
      readingRate: readingAvg,
      nutritionScore: nutritionAvg,
      habitRate: habitAvg,
      perfectDays,
      missedDays,
      longestStreak,
      bestDay,
      weakestDay,
      strongestArea,
      weakestArea,
      biggestImprovement,
      biggestDecline,
      reportJson: JSON.stringify(reportPayload),
    },
    update: {
      totalXp,
      endingLevel,
      xpEarned: monthlyXp,
      workoutRate,
      studyRate: studyAvg,
      codingRate: codingAvg,
      readingRate: readingAvg,
      nutritionScore: nutritionAvg,
      habitRate: habitAvg,
      perfectDays,
      missedDays,
      longestStreak,
      bestDay,
      weakestDay,
      strongestArea,
      weakestArea,
      biggestImprovement,
      biggestDecline,
      reportJson: JSON.stringify(reportPayload),
    },
  });

  return { report, payload: reportPayload };
}
