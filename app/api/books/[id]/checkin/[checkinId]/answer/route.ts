import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assessAnswer } from '@/lib/checkin'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; checkinId: string }> }
) {
  try {
    const { id: bookId, checkinId } = await params
    const { answer } = await req.json()

    if (!answer?.trim()) {
      return NextResponse.json({ error: 'answer required' }, { status: 400 })
    }

    const [checkIn, book] = await Promise.all([
      prisma.bookCheckIn.findUnique({ where: { id: checkinId } }),
      prisma.book.findUnique({ where: { id: bookId } }),
    ])

    if (!checkIn || !book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const chunks = book.chunks ? JSON.parse(book.chunks) : []
    const contextChunk = chunks[checkIn.chunkIndex]?.slice(0, 2000) || `Book: "${book.title}" by ${book.author || 'unknown'}`
    const assessment = await assessAnswer(checkIn.question, answer, contextChunk)
    const gapDetected = assessment.assessment === 'gap detected'
    const aiAssessment = `${assessment.assessment}: ${assessment.note}`

    const updated = await prisma.bookCheckIn.update({
      where: { id: checkinId },
      data: {
        userAnswer: answer,
        aiAssessment,
        gapDetected,
      },
    })

    // If understood, advance the book page
    if (!gapDetected) {
      const chunks = book.chunks ? JSON.parse(book.chunks) : []
      const nextPage = Math.min(book.currentPage + 1, Math.max(chunks.length - 1, 0))
      await prisma.book.update({
        where: { id: bookId },
        data: { currentPage: nextPage },
      })
    }

    return NextResponse.json({
      checkIn: updated,
      verdict: assessment.assessment,
      feedback: assessment.note,
      gapDetected,
    })
  } catch (error) {
    console.error('Check-in assessment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
