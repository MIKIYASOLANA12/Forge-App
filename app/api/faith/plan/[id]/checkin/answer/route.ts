import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assessAnswer } from '@/lib/checkin'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { checkInId, answer } = await request.json()
  if (!checkInId || !answer?.trim()) return NextResponse.json({ error: 'checkInId and answer are required' }, { status: 400 })
  const checkIn = await prisma.scriptureCheckIn.findFirst({ where: { id: checkInId, planItemId: id } })
  const item = await prisma.scripturePlanItem.findUnique({ where: { id } })
  if (!checkIn || !item) return NextResponse.json({ error: 'Check-in not found' }, { status: 404 })
  const assessment = await assessAnswer(checkIn.question, answer, item.reference)
  const updated = await prisma.scriptureCheckIn.update({ where: { id: checkInId }, data: { userAnswer: answer, aiAssessment: `${assessment.assessment}: ${assessment.note}`, gapDetected: assessment.assessment === 'gap detected' } })
  return NextResponse.json({ checkIn: updated, ...assessment, gapDetected: assessment.assessment === 'gap detected' })
}