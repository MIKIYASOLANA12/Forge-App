import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const date = new Date(dateStr)
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayEnd = new Date(dayStart.getTime() + 86400000)

  const meals = await prisma.meal.findMany({
    where: { eatenAt: { gte: dayStart, lt: dayEnd } },
    include: { items: true },
    orderBy: { eatenAt: 'asc' },
  })

  return NextResponse.json(meals)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { label, eatenAt } = body

    if (!label) return NextResponse.json({ error: 'label is required' }, { status: 400 })

    const meal = await prisma.meal.create({
      data: {
        label,
        eatenAt: eatenAt ? new Date(eatenAt) : new Date(),
      },
      include: { items: true },
    })

    return NextResponse.json(meal, { status: 201 })
  } catch (error) {
    console.error('Error creating meal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
