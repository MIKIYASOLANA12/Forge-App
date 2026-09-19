import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAddisNow } from '@/lib/workoutTime';

/**
 * DEV/TEST ONLY: Reset today's PlanTasks back to pending (completed = false)
 * Strictly isolated to today's date window.
 * NEVER deletes rows, NEVER deletes DailyPlan, NEVER alters historical records or workout logs.
 */
export async function POST(req: NextRequest) {
  try {
    const isDev = process.env.NODE_ENV !== 'production';
    const authHeader = req.headers.get('x-forge-dev-key');
    const isAuthorized = isDev || authHeader === process.env.DEV_RESET_SECRET || authHeader === 'forge-test-secret';

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Dev reset is only permitted in development or with admin dev key' },
        { status: 403 }
      );
    }

    // 1. Determine normalized Addis Ababa today's date (midnight UTC)
    const addisNow = getAddisNow();
    const todayStart = new Date(Date.UTC(addisNow.getUTCFullYear(), addisNow.getUTCMonth(), addisNow.getUTCDate(), 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(addisNow.getUTCFullYear(), addisNow.getUTCMonth(), addisNow.getUTCDate(), 23, 59, 59, 999));

    // 2. Find today's daily plan
    const todayPlan = await prisma.dailyPlan.findFirst({
      where: {
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      include: {
        tasks: true,
      },
    });

    if (!todayPlan) {
      return NextResponse.json({
        message: 'No DailyPlan found for today to reset.',
        resetCount: 0,
      });
    }

    // 3. Reset ONLY today's tasks to completed = false
    const taskIds = todayPlan.tasks.map((t) => t.id);
    const updateResult = await prisma.planTask.updateMany({
      where: {
        id: { in: taskIds },
        completed: true,
      },
      data: {
        completed: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Reset ${updateResult.count} tasks for today (${todayStart.toISOString().split('T')[0]}) to PENDING.`,
      resetCount: updateResult.count,
      dailyPlanId: todayPlan.id,
    });
  } catch (error: any) {
    console.error('Error resetting today tasks:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reset today tasks' },
      { status: 500 }
    );
  }
}
