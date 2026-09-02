import { NextRequest, NextResponse } from 'next/server';
import { getAccountabilityRoast, RoastCategory } from '@/lib/accountabilityRoast';
import { getDailyBreakdown } from '@/lib/progressEngine';
import { getAddisNow, workoutWindowForAddisDate } from '@/lib/workoutTime';
import { prisma } from '@/lib/prisma';
import { formatTaskForDisplay } from '@/lib/planParser';

export async function GET(req: NextRequest) {
  try {
    const addisNow = getAddisNow();
    const { startUtc, endUtc } = workoutWindowForAddisDate(addisNow);

    const [breakdown, plan] = await Promise.all([
      getDailyBreakdown(addisNow),
      prisma.dailyPlan.findFirst({
        where: { date: { gte: startUtc, lte: endUtc } },
        include: { tasks: true },
      }),
    ]);

    const missedTasks = plan ? plan.tasks.filter((t) => !t.completed) : [];
    const missedTitles = missedTasks
      .map((t) => formatTaskForDisplay(t))
      .filter((title) => Boolean(title) && !title.startsWith('{'));

    let category: RoastCategory = 'COMBINED_MISSED';

    if (breakdown.consistencyScore >= 80 && breakdown.workout.completed) {
      category = 'PERFECT_DAY';
    } else if (!breakdown.workout.completed && missedTasks.length === 0) {
      category = 'WORKOUT_MISSED';
    } else if (missedTitles.some((d) => d.toLowerCase().includes('chemistry'))) {
      category = 'CHEMISTRY_MISSED';
    } else if (missedTitles.some((d) => d.toLowerCase().includes('javascript') || d.toLowerCase().includes('coding'))) {
      category = 'JAVASCRIPT_MISSED';
    } else {
      category = 'COMBINED_MISSED';
    }

    const missedItemsList: string[] = [];
    if (!breakdown.workout.completed) {
      missedItemsList.push('Workout — Daily Workout Session');
    }
    for (const title of missedTitles.slice(0, 4)) {
      if (!missedItemsList.includes(title)) {
        missedItemsList.push(title);
      }
    }

    const roast = await getAccountabilityRoast({
      category,
      intensity: 3,
      missedItems: missedItemsList,
    });

    return NextResponse.json({
      roast: roast.message,
      category: roast.category,
      missedItems: roast.missedItems,
      consistencyScore: breakdown.consistencyScore,
      isPerfectDay: category === 'PERFECT_DAY',
    });
  } catch (error: any) {
    console.error('Roast API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch roast' }, { status: 500 });
  }
}
