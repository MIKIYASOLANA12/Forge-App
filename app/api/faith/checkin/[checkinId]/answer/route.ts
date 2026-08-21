import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateGeminiJson } from '@/lib/gemini'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ checkinId: string }> }
) {
  try {
    const { checkinId } = await params
    const { answer } = await req.json()

    if (!answer?.trim()) return NextResponse.json({ error: 'answer required' }, { status: 400 })

    const checkIn = await prisma.scriptureCheckIn.findUnique({ where: { id: checkinId } })
    if (!checkIn) return NextResponse.json({ error: 'Check-in not found' }, { status: 404 })

    const planItem = await prisma.scripturePlanItem.findUnique({ where: { id: checkIn.planItemId } })

    const assessPrompt = `You are assessing someone's engagement with ${planItem?.reference || 'a Bible passage'}.

Question: ${checkIn.question}

Their answer: ${answer}

Assess whether they genuinely engaged with the passage. Return ONLY a JSON object:
{
  "verdict": "understood" | "gap detected",
  "feedback": "<1-2 sentences, blunt. If gap detected, say what was missing or what they should re-read.>"
}

Note: For reflection questions, 'understood' means they gave a genuine, thoughtful personal response. 
A superficial or generic answer should be 'gap detected'.`

    const { parsed: assessment } = await generateGeminiJson<{ verdict: string; feedback: string }>(assessPrompt, {
      type: 'object',
      properties: { verdict: { type: 'string', enum: ['understood', 'gap detected'] }, feedback: { type: 'string' } },
      required: ['verdict', 'feedback'],
    })

    const gapDetected = assessment.verdict === 'gap detected'

    const updated = await prisma.scriptureCheckIn.update({
      where: { id: checkinId },
      data: {
        userAnswer: answer,
        aiAssessment: `${assessment.verdict}: ${assessment.feedback}`,
        gapDetected,
      },
    })

    // If understood, mark plan item as done and advance
    if (!gapDetected && planItem) {
      await prisma.scripturePlanItem.update({
        where: { id: planItem.id },
        data: { status: 'done', readAt: new Date() },
      })
    }

    return NextResponse.json({
      checkIn: updated,
      verdict: assessment.verdict,
      feedback: assessment.feedback,
      gapDetected,
    })
  } catch (error) {
    console.error('Faith answer error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
