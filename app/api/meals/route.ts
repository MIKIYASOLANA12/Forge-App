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
    const { label, eatenAt, items } = body

    if (!label?.trim() || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'label and at least one item are required' }, { status: 400 })
    }

    const cleanItems: { name: string; quantity: string; calories: number; protein: number; carbs: number; fat: number }[] = items.map((item: { name?: string; quantity?: string; calories?: number; protein?: number; carbs?: number; fat?: number }) => ({
      name: item.name?.trim() ?? '',
      quantity: item.quantity?.trim() || '100g',
      calories: Number(item.calories),
      protein: Number(item.protein),
      carbs: Number(item.carbs),
      fat: Number(item.fat),
    }))
    if (cleanItems.some((item) => !item.name || [item.calories, item.protein, item.carbs, item.fat].some((value) => !Number.isFinite(value) || value < 0))) {
      return NextResponse.json({ error: 'Each item needs valid nutrition data' }, { status: 400 })
    }
    const totals = cleanItems.reduce((total, item) => ({
      calories: total.calories + Math.round(item.calories),
      protein: total.protein + item.protein,
      carbs: total.carbs + item.carbs,
      fat: total.fat + item.fat,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

    const meal = await prisma.meal.create({
      data: {
        label: label.trim(),
        eatenAt: eatenAt ? new Date(eatenAt) : new Date(),
        totalCalories: totals.calories,
        totalProtein: Math.round(totals.protein * 10) / 10,
        totalCarbs: Math.round(totals.carbs * 10) / 10,
        totalFat: Math.round(totals.fat * 10) / 10,
        items: { create: cleanItems },
      },
      include: { items: true },
    })

    return NextResponse.json(meal, { status: 201 })
  } catch (error) {
    console.error('Error creating meal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
