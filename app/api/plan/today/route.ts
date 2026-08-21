import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfDay } from 'date-fns'

export async function GET() {
  const today = startOfDay(new Date())

  const plan = await prisma.dailyPlan.findUnique({
    where: { date: today },
    include: {
      tasks: true,
    },
  })

  // Get domain data for the tasks
  if (plan) {
    const domainIds = [...new Set(plan.tasks.map(t => t.domainId))]
    const domains = await prisma.domain.findMany({ where: { id: { in: domainIds } } })
    const domainMap = Object.fromEntries(domains.map(d => [d.id, d]))

    const tasksWithDomain = plan.tasks.map(t => ({
      ...t,
      domain: domainMap[t.domainId] || null,
    }))

    return NextResponse.json({ ...plan, tasks: tasksWithDomain })
  }

  return NextResponse.json(null)
}
