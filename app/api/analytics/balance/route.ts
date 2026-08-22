import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeBalanceScore, getTargetAllocation } from '@/lib/taperCurve'

export async function GET() {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date(end)
  start.setDate(start.getDate() - 6)
  start.setHours(0, 0, 0, 0)

  const [domains, profile, sessions] = await Promise.all([
    prisma.domain.findMany({ orderBy: { name: 'asc' } }),
    prisma.userProfile.findUnique({ where: { id: 'singleton' } }),
    prisma.session.findMany({
      where: { startedAt: { gte: start, lte: end } },
      select: { minutes: true, domain: { select: { name: true } } },
    }),
  ])

  const actual = Object.fromEntries(domains.map((domain) => [domain.name, 0]))
  for (const session of sessions) actual[session.domain.name] += session.minutes
  const target = profile ? getTargetAllocation(profile.examDate, domains) : Object.fromEntries(domains.map((domain) => [domain.name, 100 / domains.length]))
  const totalMinutes = Object.values(actual).reduce((sum, minutes) => sum + minutes, 0)
  const deviations = domains.map((domain) => ({
    name: domain.name,
    difference: Math.round((((actual[domain.name] / (totalMinutes || 1)) * 100 - target[domain.name]) * 10)) / 10,
  }))

  return NextResponse.json({ score: computeBalanceScore(actual, target), deviations, hasSessions: sessions.length > 0 })
}