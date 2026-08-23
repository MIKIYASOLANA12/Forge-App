import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export async function GET() {
  const { getAddisNow, workoutWindowForAddisDate } = await import('@/lib/workoutTime');
  const addisNow = getAddisNow();
  // Use Addis-local day window. Compute the startAddis for 6 days ago (week window start) and then create UTC range.
  const startAddis = new Date(addisNow);
  startAddis.setDate(startAddis.getDate() - 6);
  const { startUtc: startUtc } = workoutWindowForAddisDate(startAddis);
  const { endUtc: endUtc } = workoutWindowForAddisDate(addisNow);

  const [domains, sessions] = await Promise.all([
    prisma.domain.findMany({ orderBy: { name: 'asc' } }),
    prisma.session.findMany({
      where: { startedAt: { gte: startUtc, lte: endUtc } },
      select: { domainId: true, startedAt: true, minutes: true },
    }),
  ])

  const days = Array.from({ length: 7 }, (_, index) => {
    const d = new Date(startAddis);
    d.setDate(startAddis.getDate() + index);
    return d;
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