import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
    const contextChunk = chunks.length > 0
      ? chunks[checkIn.chunkIndex]?.slice(0, 2000) || ''
      : `Book: "${book.title}" by ${book.author || 'unknown'}`

    const assessPrompt = `You are assessing a reader's comprehension of "${book.title}".

Question asked: ${checkIn.question}

Source material context:
${contextChunk}

User's answer: ${answer}

Assess the answer. Return ONLY a JSON object:
{
  "verdict": "understood" | "gap detected",
  "feedback": "<1-2 sentences — blunt and specific. If gap detected, say exactly what was missing.>"
}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 300,
      messages: [{ role: 'user', content: assessPrompt }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    let assessment: { verdict: string; feedback: string }

    try {
      assessment = JSON.parse(raw)
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      assessment = match ? JSON.parse(match[0]) : { verdict: 'gap detected', feedback: 'Could not assess answer.' }
    }

    const gapDetected = assessment.verdict === 'gap detected'
    const aiAssessment = `${assessment.verdict}: ${assessment.feedback}`

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
      verdict: assessment.verdict,
      feedback: assessment.feedback,
      gapDetected,
    })
  } catch (error) {
    console.error('Check-in assessment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
