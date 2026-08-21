import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateGeminiText } from '@/lib/gemini'

export async function GET() {
  const [currentItem, totalItems, doneItems] = await Promise.all([
    prisma.scripturePlanItem.findFirst({ where: { status: 'queued' }, orderBy: { order: 'asc' } }),
    prisma.scripturePlanItem.count(),
    prisma.scripturePlanItem.count({ where: { status: 'done' } }),
  ])

  const recentCheckIns = currentItem
    ? await prisma.scriptureCheckIn.findMany({
        where: { planItemId: currentItem.id },
        orderBy: { askedAt: 'desc' },
        take: 3,
      })
    : []

  return NextResponse.json({ currentItem, totalItems, doneItems, recentCheckIns })
}

export async function POST(req: NextRequest) {
  // Generate a check-in for the current plan item
  try {
    const body = await req.json().catch(() => ({}))
    const { planItemId } = body

    // Find the item
    const item = planItemId
      ? await prisma.scripturePlanItem.findUnique({ where: { id: planItemId } })
      : await prisma.scripturePlanItem.findFirst({ where: { status: 'queued' }, orderBy: { order: 'asc' } })

    if (!item) return NextResponse.json({ error: 'No current scripture item found' }, { status: 404 })

    // Check for pending gap re-test
    const lastCheckIn = await prisma.scriptureCheckIn.findFirst({
      where: { planItemId: item.id },
      orderBy: { askedAt: 'desc' },
    })

    let question = ''

    if (lastCheckIn?.gapDetected && !lastCheckIn.userAnswer) {
      question = lastCheckIn.question
    } else {
      // Mix: ~50% comprehension, ~50% reflection
      const isReflection = Math.random() > 0.5

      const prompt = isReflection
        ? `Generate a reflection question for someone who just read ${item.reference}. 
The question should ask how the passage applies to their life this week — specific and personal, not generic.
Return ONLY the question text.`
        : `Generate a comprehension question for someone who just read ${item.reference}.
The question should test whether they understood what happened or what was taught in this specific passage.
Be specific to the content of ${item.reference}, not general Bible knowledge.
Return ONLY the question text.`

      question = await generateGeminiText(prompt, undefined, 150) || `What stood out to you in ${item.reference}?`
    }

    const checkIn = await prisma.scriptureCheckIn.create({
      data: { planItemId: item.id, question },
    })

    return NextResponse.json(checkIn, { status: 201 })
  } catch (error) {
    console.error('Faith check-in error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
