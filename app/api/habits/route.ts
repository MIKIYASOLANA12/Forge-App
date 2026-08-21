import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { countActiveHabits, MAX_ACTIVE_HABITS } from '@/lib/streak'

export async function GET(req: NextRequest) {
  const includeInactive = req.nextUrl.searchParams.get('includeInactive') === '1'
  const habits = await prisma.habit.findMany({
    where: includeInactive ? undefined : { active: true },
    include: { domain: true },
    orderBy: { streakCount: 'desc' },
  })
  return NextResponse.json(habits)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { domainId, name } = body

    if (!domainId || !name?.trim()) {
      return NextResponse.json({ error: 'domainId and name are required' }, { status: 400 })
    }

    // Enforce 4-habit cap
    const activeCount = await countActiveHabits()
    if (activeCount >= MAX_ACTIVE_HABITS) {
      return NextResponse.json(
        {
          error: `You have ${MAX_ACTIVE_HABITS} active habits. Retire one before adding another. This cap is a feature — not a bug.`,
          code: 'HABIT_CAP_REACHED',
          activeCount,
        },
        { status: 409 }
      )
    }

    const domain = await prisma.domain.findUnique({ where: { id: domainId } })
    if (!domain) return NextResponse.json({ error: 'Domain not found' }, { status: 404 })

    const habit = await prisma.habit.create({
      data: { domainId, name: name.trim() },
      include: { domain: true },
    })

    return NextResponse.json(habit, { status: 201 })
  } catch (error) {
    console.error('Error creating habit:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
