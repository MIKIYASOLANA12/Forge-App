import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateCheckIn } from '@/lib/checkin'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const item = await prisma.scripturePlanItem.findUnique({ where: { id }, include: { checkIns: { orderBy: { askedAt: 'desc' }, take: 5 } } })
  if (!item) return NextResponse.json({ error: 'Passage not found' }, { status: 404 })
  const generated = await generateCheckIn('scripture', item.reference, item.checkIns.map((checkIn) => ({ question: checkIn.question, answer: checkIn.userAnswer || '', assessment: checkIn.aiAssessment || (checkIn.gapDetected ? 'gap detected' : '') })))
  const checkIn = await prisma.scriptureCheckIn.create({ data: { planItemId: id, question: generated.question } })
  return NextResponse.json(checkIn, { status: 201 })
}