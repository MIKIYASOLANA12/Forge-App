import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeXp, computeLevel, computeStreakBonus, computeBalanceDayBonus } from '@/lib/xp'
import { getStudyWeight } from '@/lib/taperCurve'
import { recordProgressActivity } from '@/lib/progressEngine'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  
  const where = date ? {
    startedAt: {
      gte: new Date(date + 'T00:00:00.000Z'),
      lt: new Date(date + 'T23:59:59.999Z'),
    }
  } : {}

  const sessions = await prisma.session.findMany({
    where,
    include: { domain: true },
    orderBy: { startedAt: 'desc' },
  })

  return NextResponse.json(sessions)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { domainId, minutes, note, startedAt } = body

    if (!domainId || !minutes || minutes < 1) {
      return NextResponse.json({ error: 'domainId and minutes are required' }, { status: 400 })
    }

    // Get domain + user profile for weight computation
    const [domain, profile] = await Promise.all([
      prisma.domain.findUnique({ where: { id: domainId } }),
      prisma.userProfile.findUnique({ where: { id: 'singleton' } }),
    ])

    if (!domain) return NextResponse.json({ error: 'Domain not found' }, { status: 404 })

    // Use taper curve weight for Study domain
    let effectiveWeight = domain.weight
    if (domain.name === 'Study' && profile?.examDate) {
      effectiveWeight = getStudyWeight(profile.examDate)
    }

    const xpEarned = computeXp(minutes, effectiveWeight)

    // Create session
    const session = await prisma.session.create({
      data: {
        domainId,
        minutes,
        note: note || null,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
        xpEarned,
      },
      include: { domain: true },
    })

    // Update total XP and level
    const updatedProfile = await prisma.userProfile.update({
      where: { id: 'singleton' },
      data: {
        totalXp: { increment: xpEarned },
      },
    })

    const newLevel = computeLevel(updatedProfile.totalXp)
    if (newLevel !== updatedProfile.level) {
      await prisma.userProfile.update({
        where: { id: 'singleton' },
        data: { level: newLevel },
      })
    }

    // Check for balance-day bonus
    const today = new Date()
    const todaySessions = await prisma.session.groupBy({
      by: ['domainId'],
      where: {
        startedAt: {
          gte: new Date(today.toDateString()),
          lt: new Date(today.toDateString() + ' 23:59:59'),
        },
      },
    })
    const totalDomains = 6
    const balanceBonus = computeBalanceDayBonus(todaySessions.length, totalDomains)

    let bonusXp = 0
    if (balanceBonus > 0) {
      bonusXp = balanceBonus
      await prisma.userProfile.update({
        where: { id: 'singleton' },
        data: { totalXp: { increment: balanceBonus } },
      })
    }

    await recordProgressActivity(0).catch(() => {});
    return NextResponse.json({ session, xpEarned, bonusXp }, { status: 201 })
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
