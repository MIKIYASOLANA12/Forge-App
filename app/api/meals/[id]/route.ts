import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await prisma.$transaction([
      prisma.foodItem.deleteMany({ where: { mealId: id } }),
      prisma.meal.delete({ where: { id } }),
    ])
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Meal not found' }, { status: 404 })
  }
}