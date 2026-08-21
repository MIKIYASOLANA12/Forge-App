import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

    // Check if the last check-in had a gap detected — if so, re-test same concept
    const lastCheckIn = book.checkIns[0]
    const retest = lastCheckIn?.gapDetected && !lastCheckIn.userAnswer

    let contextChunk = ''
    let question = ''

    if (retest && lastCheckIn) {
      // Re-test the same passage
      question = lastCheckIn.question
      contextChunk = `Re-testing comprehension from previous check-in.`
    } else {
      // Generate new question based on book content or general knowledge
      const chunks = book.chunks ? JSON.parse(book.chunks) : []
      const chunkIndex = Math.min(book.currentPage, chunks.length - 1)
      contextChunk = chunks.length > 0
        ? chunks[chunkIndex]
        : `The book "${book.title}" by ${book.author || 'unknown author'}. General comprehension questions about the content and themes.`

      const prompt = `You are reviewing "${book.title}" by ${book.author || 'unknown'}. 

Context from the book:
${contextChunk.slice(0, 2000)}

Recent check-in history:
${book.checkIns.map(c => `Q: ${c.question}\nA: ${c.userAnswer || 'unanswered'}`).join('\n\n')}

Generate ONE comprehension question about the content. The question should:
- Test genuine understanding, not surface recall
- Be specific to the content (not "what did you think of this chapter?")
- Be answerable in 2-5 sentences

Return ONLY the question text, nothing else.`

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      })

      question = response.content[0].type === 'text' ? response.content[0].text.trim() : 'What was the main idea covered in what you just read?'
    }

    const checkIn = await prisma.bookCheckIn.create({
      data: {
        bookId,
        question,
        chunkIndex: book.currentPage,
      },
    })

    return NextResponse.json(checkIn, { status: 201 })
  } catch (error) {
    console.error('Check-in generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
