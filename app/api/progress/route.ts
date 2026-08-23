import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAddisNow } from '@/lib/workoutTime';
import { levelProgress, computeLevel } from '@/lib/xp';
import { getDailyBreakdown, getProgressHistory, recordProgressActivity } from '@/lib/progressEngine';
import { ACHIEVEMENTS_CATALOG } from '@/lib/achievements';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const daysParam = parseInt(searchParams.get('days') || '30', 10);
    const yearParam = parseInt(searchParams.get('year') || '', 10);
    const monthParam = parseInt(searchParams.get('month') || '', 10);

    const addisNow = getAddisNow();
    const currentYear = !isNaN(yearParam) ? yearParam : addisNow.getFullYear();
    const currentMonth = !isNaN(monthParam) ? monthParam : addisNow.getMonth() + 1;

    const [profile, achievementsInDb, todayBreakdown, history] = await Promise.all([
      prisma.userProfile.findUnique({ where: { id: 'singleton' } }),
      prisma.achievement.findMany({ orderBy: { unlockedAt: 'desc' } }),
      getDailyBreakdown(addisNow),
      getProgressHistory(Math.min(365, Math.max(7, daysParam))),
    ]);

    const totalXp = profile?.totalXp ?? 0;
    const progressInfo = levelProgress(totalXp);

    // Map unlocked achievements
    const unlockedMap = new Map(achievementsInDb.map((a) => [a.code, a]));
    const fullAchievements = ACHIEVEMENTS_CATALOG.map((cat) => {
      const unlocked = unlockedMap.get(cat.code);
      return {
        ...cat,
        unlocked: Boolean(unlocked),
        unlockedAt: unlocked?.unlockedAt ?? null,
      };
    });

    // Compute active streak from history
    let activeStreak = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].consistencyScore >= 60) {
        activeStreak++;
      } else if (i === history.length - 1 && history[i].color === 'GRAY') {
        // If today has no activity yet, don't break streak from yesterday
        continue;
      } else {
        break;
      }
    }

    // Month calendar days
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const calendarDays = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(currentYear, currentMonth - 1, d, 12, 0, 0);
      const dayData = await getDailyBreakdown(dateObj);
      calendarDays.push(dayData);
    }

    return NextResponse.json({
      overview: {
        totalXp,
        level: progressInfo.level,
        currentLevelXp: progressInfo.currentLevelXp,
        nextLevelXp: progressInfo.nextLevelXp,
        progress: progressInfo.progress,
        activeStreak,
        unlockedAchievementsCount: achievementsInDb.length,
        totalAchievementsCount: ACHIEVEMENTS_CATALOG.length,
      },
      today: todayBreakdown,
      history,
      calendar: {
        year: currentYear,
        month: currentMonth,
        days: calendarDays,
      },
      achievements: fullAchievements,
    });
  } catch (error: any) {
    console.error('Error fetching progress dashboard:', error);
    return NextResponse.json({ error: error.message || 'Failed to load progress' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await recordProgressActivity(0);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error recalculating progress:', error);
    return NextResponse.json({ error: error.message || 'Failed to recalculate' }, { status: 500 });
  }
}
