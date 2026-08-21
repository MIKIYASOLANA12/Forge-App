import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const lessons = await prisma.lesson.findMany({
    orderBy: [{ track: 'asc' }, { order: 'asc' }],
    include: {
      domain: true,
      quiz: {
        include: {
          attempts: { orderBy: { takenAt: 'desc' }, take: 1 },
          questions: true,
        },
      },
    },
  })

  return NextResponse.json(lessons)
}
