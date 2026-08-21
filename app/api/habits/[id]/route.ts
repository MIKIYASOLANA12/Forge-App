import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const habit = await prisma.habit.findUnique({
    where: { id },
    include: { domain: true, logs: { orderBy: { date: 'desc' }, take: 60 } },
  })
  if (!habit) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(habit)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { action, name, active } = body

    const habit = await prisma.habit.findUnique({ where: { id } })
    if (!habit) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Mark complete for today
    if (action === 'complete') {
      const now = new Date()

      // Check if already logged today
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const existing = await prisma.habitLog.findFirst({
        where: {
          habitId: id,
          date: { gte: todayStart },
        },
      })

      if (existing?.completed) {
        return NextResponse.json({ error: 'Already completed today' }, { status: 409 })
      }

      // Check streak continuity
      let newStreak = habit.streakCount
      let streakStartedAt = habit.streakStartedAt

      if (habit.lastCompletedAt) {
        const hoursGap = (now.getTime() - habit.lastCompletedAt.getTime()) / (1000 * 60 * 60)
        if (hoursGap > 36) {
          // Missed a day — reset
          newStreak = 1
          streakStartedAt = now
        } else {
          newStreak = habit.streakCount + 1
          if (!streakStartedAt) streakStartedAt = now
        }
      } else {
        // First completion ever
        newStreak = 1
        streakStartedAt = now
      }

      // Log the completion
      await prisma.habitLog.create({
        data: { habitId: id, date: now, completed: true },
      })

      const updated = await prisma.habit.update({
        where: { id },
        data: {
          streakCount: newStreak,
          streakStartedAt,
          lastCompletedAt: now,
        },
        include: { domain: true },
      })

      return NextResponse.json({ habit: updated, newStreak, wasReset: newStreak === 1 && habit.streakCount > 1 })
    }

    // Rename
    if (name !== undefined) {
      const updated = await prisma.habit.update({
        where: { id },
        data: { name: name.trim() },
        include: { domain: true },
      })
      return NextResponse.json(updated)
    }

    // Retire (set active = false)
    if (active === false) {
      const updated = await prisma.habit.update({
        where: { id },
        data: { active: false },
        include: { domain: true },
      })
      return NextResponse.json(updated)
    }

    // Enforce the system-wide cap when a retired habit is reactivated.
    if (active === true && !habit.active) {
      const activeCount = await prisma.habit.count({ where: { active: true } })
      if (activeCount >= 4) {
        return NextResponse.json(
          {
            error: 'You have 4 active habits. Retire one before reactivating another.',
            code: 'HABIT_CAP_REACHED',
            activeCount,
          },
          { status: 409 }
        )
      }

      const updated = await prisma.habit.update({
        where: { id },
        data: { active: true },
        include: { domain: true },
      })
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'No valid action' }, { status: 400 })
  } catch (error) {
    console.error('Error updating habit:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const habit = await prisma.habit.findUnique({ where: { id } })
  if (!habit) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.habit.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
