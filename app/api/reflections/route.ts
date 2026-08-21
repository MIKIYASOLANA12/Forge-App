import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const reflections = await prisma.reflection.findMany({
    orderBy: { date: 'desc' },
    take: 30,
  })
  return NextResponse.json(reflections)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { whatWorked, tomorrowKey } = body

    if (!whatWorked || !tomorrowKey) {
      return NextResponse.json({ error: 'Both fields required' }, { status: 400 })
    }

    const today = new Date()
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    const reflection = await prisma.reflection.upsert({
      where: { date: dayStart },
      update: { whatWorked, tomorrowKey },
      create: { date: dayStart, whatWorked, tomorrowKey },
    })

    return NextResponse.json(reflection, { status: 201 })
  } catch (error) {
    console.error('Reflection error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
