import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: mealId } = await params
    const body = await req.json()
    const { name, quantity, gramsAmount, fdcId, calories, protein, carbs, fat } = body

    if (!name || !quantity) {
      return NextResponse.json({ error: 'name and quantity are required' }, { status: 400 })
    }

    // If nutrition data is provided directly (from USDA search result), use it
    // Otherwise return error — we don't invent nutrition data
    if (calories === undefined || protein === undefined) {
      return NextResponse.json(
        { error: 'Nutrition data required. Search for the food item first.' },
        { status: 400 }
      )
    }

    // Adjust from per-100g to actual amount
    const multiplier = (gramsAmount || 100) / 100
    const item = await prisma.foodItem.create({
      data: {
        mealId,
        name,
        quantity,
        calories: Math.round(calories * multiplier),
        protein: Math.round(protein * multiplier * 10) / 10,
        carbs: Math.round(carbs * multiplier * 10) / 10,
        fat: Math.round(fat * multiplier * 10) / 10,
      },
    })

    // Update meal totals
    const allItems = await prisma.foodItem.findMany({ where: { mealId } })
    await prisma.meal.update({
      where: { id: mealId },
      data: {
        totalCalories: allItems.reduce((sum, i) => sum + i.calories, 0),
        totalProtein: allItems.reduce((sum, i) => sum + i.protein, 0),
        totalCarbs: allItems.reduce((sum, i) => sum + i.carbs, 0),
        totalFat: allItems.reduce((sum, i) => sum + i.fat, 0),
      },
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Error adding food item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: mealId } = await params
  const { searchParams } = new URL(req.url)
  const itemId = searchParams.get('itemId')

  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })

  await prisma.foodItem.delete({ where: { id: itemId } })

  // Recalculate meal totals
  const allItems = await prisma.foodItem.findMany({ where: { mealId } })
  await prisma.meal.update({
    where: { id: mealId },
    data: {
      totalCalories: allItems.reduce((sum, i) => sum + i.calories, 0),
      totalProtein: Math.round(allItems.reduce((sum, i) => sum + i.protein, 0) * 10) / 10,
      totalCarbs: Math.round(allItems.reduce((sum, i) => sum + i.carbs, 0) * 10) / 10,
      totalFat: Math.round(allItems.reduce((sum, i) => sum + i.fat, 0) * 10) / 10,
    },
  })

  return NextResponse.json({ success: true })
}
