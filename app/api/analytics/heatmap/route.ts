import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const habitId = request.nextUrl.searchParams.get('habitId')
  if (!habitId) return NextResponse.json({ error: 'habitId is required' }, { status: 400 })

  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date(end)
  start.setDate(start.getDate() - 89)
  start.setHours(0, 0, 0, 0)
  const logs = await prisma.habitLog.findMany({
    where: { habitId, date: { gte: start, lte: end } },
    select: { date: true, completed: true },
    orderBy: { date: 'asc' },
  })

  const byDate = new Map(logs.map((log) => [log.date.toDateString(), log.completed]))
  return NextResponse.json(Array.from({ length: 90 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return { date: date.toISOString().slice(0, 10), completed: byDate.get(date.toDateString()) ?? false }
  }))
}