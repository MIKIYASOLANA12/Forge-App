import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const habitId = request.nextUrl.searchParams.get('habitId')
  if (!habitId) return NextResponse.json({ error: 'habitId is required' }, { status: 400 })

  const { getAddisNow, workoutWindowForAddisDate } = await import('@/lib/workoutTime');
  const addisNow = getAddisNow();
  const startAddis = new Date(addisNow);
  startAddis.setDate(startAddis.getDate() - 89);
  const { startUtc: startUtc, endUtc: endUtc } = workoutWindowForAddisDate(addisNow);
  const { startUtc: startRangeStart } = workoutWindowForAddisDate(startAddis);

  const logs = await prisma.habitLog.findMany({
    where: { habitId, date: { gte: startRangeStart, lte: endUtc } },
    select: { date: true, completed: true },
    orderBy: { date: 'asc' },
  })

  const byDate = new Map(logs.map((log) => [log.date.toDateString(), log.completed]))
  return NextResponse.json(Array.from({ length: 90 }, (_, index) => {
    const date = new Date(startAddis)
    date.setDate(startAddis.getDate() + index)
    return { date: date.toISOString().slice(0, 10), completed: byDate.get(date.toDateString()) ?? false }
  }))
}