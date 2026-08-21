import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeXp } from '@/lib/xp'
import { computeLevel } from '@/lib/xp'
import { getStudyWeight } from '@/lib/taperCurve'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const task = await prisma.planTask.findUnique({ where: { id } })
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    if (task.completed) return NextResponse.json({ error: 'Already completed' }, { status: 409 })

    // Mark complete
    const updatedTask = await prisma.planTask.update({
      where: { id },
      data: { completed: true },
    })

    // Award XP for completing
    const domain = await prisma.domain.findUnique({ where: { id: task.domainId } })
    const profile = await prisma.userProfile.findUnique({ where: { id: 'singleton' } })

    let effectiveWeight = domain?.weight ?? 1.0
    if (domain?.name === 'Study' && profile?.examDate) {
      effectiveWeight = getStudyWeight(profile.examDate)
    }

    const xpEarned = computeXp(task.minutesTarget, effectiveWeight)

    const updated = await prisma.userProfile.update({
      where: { id: 'singleton' },
      data: { totalXp: { increment: xpEarned } },
    })

    const newLevel = computeLevel(updated.totalXp)
    if (newLevel !== updated.level) {
      await prisma.userProfile.update({ where: { id: 'singleton' }, data: { level: newLevel } })
    }

    return NextResponse.json({ task: updatedTask, xpEarned })
  } catch (error) {
    console.error('Error completing task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
