import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateDailyPlan } from '@/lib/planner'
import { startOfDay } from 'date-fns'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const dateStr = body.date || new Date().toISOString().split('T')[0]
    const date = new Date(dateStr)
    const dayStart = startOfDay(date)

    // Delete existing plan for today if regenerating
    const existing = await prisma.dailyPlan.findUnique({ where: { date: dayStart } })
    if (existing) {
      await prisma.planTask.deleteMany({ where: { dailyPlanId: existing.id } })
      await prisma.dailyPlan.delete({ where: { id: existing.id } })
    }

    const { tasks } = await generateDailyPlan(date)

    const plan = await prisma.dailyPlan.create({
      data: {
        date: dayStart,
        generatedByAI: true,
        tasks: {
          create: tasks.map(t => ({
            domainId: t.domainId,
            description: t.description,
            minutesTarget: t.minutesTarget,
          })),
        },
      },
      include: {
        tasks: {
          include: {
            // include domain info via join  
          },
        },
      },
    })

    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    console.error('Plan generation error:', error)
    return NextResponse.json({ error: 'Failed to generate plan', detail: String(error) }, { status: 500 })
  }
}
