import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateCheckIn } from '@/lib/checkin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: bookId } = await params

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        checkIns: { orderBy: { askedAt: 'desc' }, take: 3 },
      },
    })

    if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 })

    const chunks = book.chunks ? JSON.parse(book.chunks) : []
    const passage = chunks[Math.min(book.currentPage, Math.max(chunks.length - 1, 0))] || `The book "${book.title}" by ${book.author || 'unknown author'}.`
    const generated = await generateCheckIn('book', passage, book.checkIns.map((checkIn) => ({ question: checkIn.question, answer: checkIn.userAnswer || '', assessment: checkIn.aiAssessment || (checkIn.gapDetected ? 'gap detected' : '') })))

    const checkIn = await prisma.bookCheckIn.create({
      data: {
        bookId,
        question: generated.question,
        chunkIndex: book.currentPage,
      },
    })

    return NextResponse.json(checkIn, { status: 201 })
  } catch (error) {
    console.error('Check-in generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
