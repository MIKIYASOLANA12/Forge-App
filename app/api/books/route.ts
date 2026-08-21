import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const books = await prisma.book.findMany({
    orderBy: { order: 'asc' },
    include: {
      checkIns: {
        orderBy: { askedAt: 'desc' },
        take: 5,
      },
    },
  })
  return NextResponse.json(books)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, author, order } = body

    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

    // Get next order if not provided
    let bookOrder = order
    if (!bookOrder) {
      const last = await prisma.book.findFirst({ orderBy: { order: 'desc' } })
      bookOrder = (last?.order ?? 0) + 1
    }

    const book = await prisma.book.create({
      data: { title, author, order: bookOrder },
    })

    return NextResponse.json(book, { status: 201 })
  } catch (error) {
    console.error('Error creating book:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
