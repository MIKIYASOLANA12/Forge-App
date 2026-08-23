import { prisma } from './prisma';
import { getAddisNow } from './workoutTime';

export interface AchievementDef {
  code: string;
  title: string;
  description: string;
  icon: string;
  category: 'workout' | 'streak' | 'xp' | 'general' | 'mastery';
}

export const ACHIEVEMENTS_CATALOG: AchievementDef[] = [
  {
    code: 'FIRST_WORKOUT',
    title: 'Iron Genesis',
    description: 'Completed your first Forge workout session.',
    icon: 'dumbbell',
    category: 'workout',
  },
  {
    code: 'WORKOUTS_10',
    title: 'Disciplined Athlete',
    description: 'Completed 10 total workout sessions.',
    icon: 'flame',
    category: 'workout',
  },
  {
    code: 'STREAK_3',
    title: 'Momentum Builder',
    description: 'Achieved a 3-day consistency streak (>= 60% daily consistency).',
    icon: 'zap',
    category: 'streak',
  },
  {
    code: 'STREAK_7',
    title: 'Unstoppable Force',
    description: 'Maintained a 7-day consistency streak.',
    icon: 'shield-check',
    category: 'streak',
  },
  {
    code: 'STREAK_30',
    title: 'Titan of Consistency',
    description: 'Maintained a 30-day consistency streak.',
    icon: 'crown',
    category: 'streak',
  },
  {
    code: 'PERFECT_DAY',
    title: 'Flawless Execution',
    description: 'Achieved a 100% daily consistency score.',
    icon: 'star',
    category: 'mastery',
  },
  {
    code: 'XP_100',
    title: 'First Hundred',
    description: 'Earned 100 total XP in Forge.',
    icon: 'award',
    category: 'xp',
  },
  {
    code: 'XP_1000',
    title: 'Centurion',
    description: 'Earned 1,000 total XP in Forge.',
    icon: 'sparkles',
    category: 'xp',
  },
  {
    code: 'LEVEL_5',
    title: 'Ascension Level 5',
    description: 'Reached User Level 5.',
    icon: 'trending-up',
    category: 'xp',
  },
  {
    code: 'MONTHLY_IMPROVEMENT',
    title: 'Monthly Breakthrough',
    description: 'Generated a monthly report demonstrating consistent improvement.',
    icon: 'bar-chart-2',
    category: 'general',
  },
];

/**
 * Checks criteria against live DB data and awards any unlocked achievements.
 * Never awards the same achievement twice.
 */
export async function checkAndAwardAchievements() {
  const [profile, workoutCount, unlockedList, dailyProgressRecords] = await Promise.all([
    prisma.userProfile.findUnique({ where: { id: 'singleton' } }),
    prisma.workoutLog.count(),
    prisma.achievement.findMany(),
    prisma.progressDaily.findMany({ orderBy: { date: 'asc' } }),
  ]);

  const unlockedCodes = new Set(unlockedList.map((a) => a.code));
  const newAwards: AchievementDef[] = [];

  const totalXp = profile?.totalXp ?? 0;
  const level = profile?.level ?? 1;

  // Streak calculation
  let maxStreak = 0;
  let curStreak = 0;
  let hasPerfectDay = false;

  for (const record of dailyProgressRecords) {
    if (record.consistencyScore >= 99) hasPerfectDay = true;
    if (record.consistencyScore >= 60) {
      curStreak++;
      if (curStreak > maxStreak) maxStreak = curStreak;
    } else {
      curStreak = 0;
    }
  }

  // Evaluate each milestone
  if (!unlockedCodes.has('FIRST_WORKOUT') && workoutCount >= 1) {
    newAwards.push(ACHIEVEMENTS_CATALOG.find((a) => a.code === 'FIRST_WORKOUT')!);
  }

  if (!unlockedCodes.has('WORKOUTS_10') && workoutCount >= 10) {
    newAwards.push(ACHIEVEMENTS_CATALOG.find((a) => a.code === 'WORKOUTS_10')!);
  }

  if (!unlockedCodes.has('STREAK_3') && maxStreak >= 3) {
    newAwards.push(ACHIEVEMENTS_CATALOG.find((a) => a.code === 'STREAK_3')!);
  }

  if (!unlockedCodes.has('STREAK_7') && maxStreak >= 7) {
    newAwards.push(ACHIEVEMENTS_CATALOG.find((a) => a.code === 'STREAK_7')!);
  }

  if (!unlockedCodes.has('STREAK_30') && maxStreak >= 30) {
    newAwards.push(ACHIEVEMENTS_CATALOG.find((a) => a.code === 'STREAK_30')!);
  }

  if (!unlockedCodes.has('PERFECT_DAY') && hasPerfectDay) {
    newAwards.push(ACHIEVEMENTS_CATALOG.find((a) => a.code === 'PERFECT_DAY')!);
  }

  if (!unlockedCodes.has('XP_100') && totalXp >= 100) {
    newAwards.push(ACHIEVEMENTS_CATALOG.find((a) => a.code === 'XP_100')!);
  }

  if (!unlockedCodes.has('XP_1000') && totalXp >= 1000) {
    newAwards.push(ACHIEVEMENTS_CATALOG.find((a) => a.code === 'XP_1000')!);
  }

  if (!unlockedCodes.has('LEVEL_5') && level >= 5) {
    newAwards.push(ACHIEVEMENTS_CATALOG.find((a) => a.code === 'LEVEL_5')!);
  }

  // Insert awarded achievements to database
  for (const award of newAwards) {
    await prisma.achievement.create({
      data: {
        code: award.code,
        title: award.title,
        description: award.description,
        icon: award.icon,
        category: award.category,
        unlockedAt: new Date(),
      },
    });
  }

  return newAwards;
}
