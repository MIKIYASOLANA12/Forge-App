import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const item = await prisma.scripturePlanItem.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'Passage not found' }, { status: 404 })
  const updated = await prisma.scripturePlanItem.update({ where: { id }, data: { status: 'done', readAt: new Date() } })
  const next = await prisma.scripturePlanItem.findFirst({ where: { order: { gt: item.order }, status: { not: 'done' } }, orderBy: { order: 'asc' } })
  if (next) await prisma.scripturePlanItem.update({ where: { id: next.id }, data: { status: 'reading' } })
  return NextResponse.json(updated)
}