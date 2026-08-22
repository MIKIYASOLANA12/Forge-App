import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export async function GET() {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date(end)
  start.setDate(start.getDate() - 6)
  start.setHours(0, 0, 0, 0)

  const [domains, sessions] = await Promise.all([
    prisma.domain.findMany({ orderBy: { name: 'asc' } }),
    prisma.session.findMany({
      where: { startedAt: { gte: start, lte: end } },
      select: { domainId: true, startedAt: true, minutes: true },
    }),
  ])

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })

  return NextResponse.json({
    days: days.map((date) => DAY_NAMES[date.getDay()]),
    domains: domains.map((domain) => ({
      name: domain.name,
      color: domain.color,
      minutes: days.map((day) => sessions
        .filter((session) => session.domainId === domain.id && session.startedAt.toDateString() === day.toDateString())
        .reduce((total, session) => total + session.minutes, 0)),
    })),
  })
}