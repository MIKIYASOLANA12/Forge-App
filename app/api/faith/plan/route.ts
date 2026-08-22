import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const items = await prisma.scripturePlanItem.findMany({ orderBy: { order: 'asc' }, select: { id: true, reference: true, order: true, status: true, readAt: true } })
  const readingIndex = items.findIndex((item) => item.status === 'reading')
  const firstQueued = items.findIndex((item) => item.status === 'queued')
  const currentIndex = readingIndex >= 0 ? readingIndex : firstQueued >= 0 ? firstQueued : items.length
  return NextResponse.json({ current: items[currentIndex] ?? null, upcoming: items.slice(currentIndex + 1, currentIndex + 6), completed: items.filter((item) => item.status === 'done').slice(-5).reverse(), items })
}