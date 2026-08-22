import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (body.confirmation !== 'RESET') return NextResponse.json({ error: 'Type RESET to confirm' }, { status: 400 })
  await prisma.$transaction(async (transaction) => {
    await transaction.session.deleteMany()
    await transaction.habitLog.deleteMany()
    await transaction.foodItem.deleteMany()
    await transaction.meal.deleteMany()
    await transaction.reflection.deleteMany()
    await transaction.bookCheckIn.deleteMany()
    await transaction.scriptureCheckIn.deleteMany()
    await transaction.quizAttempt.deleteMany()
    await transaction.userProfile.update({ where: { id: 'singleton' }, data: { totalXp: 0, level: 1 } })
  })
  return NextResponse.json({ success: true })
}