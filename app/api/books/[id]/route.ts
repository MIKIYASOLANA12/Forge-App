import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  if (body.status !== undefined && !['reading', 'finished'].includes(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  const book = await prisma.book.findUnique({ where: { id } })
  if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  const updated = await prisma.book.update({ where: { id }, data: { ...(body.status ? { status: body.status } : {}), ...(Number.isInteger(body.currentPage) && body.currentPage >= 0 ? { currentPage: body.currentPage } : {}) } })
  if (body.status === 'finished') {
    const next = await prisma.book.findFirst({ where: { order: { gt: book.order }, status: { not: 'finished' } }, orderBy: { order: 'asc' } })
    if (next) await prisma.book.update({ where: { id: next.id }, data: { status: 'reading' } })
  }
  return NextResponse.json(updated)
}