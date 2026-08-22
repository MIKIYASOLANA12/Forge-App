import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const logs = await prisma.workoutLog.findMany({ take: 12, orderBy: { completedAt: 'desc' }, include: { workoutDay: true, exerciseLogs: { include: { exercise: true } } } })
  return NextResponse.json(logs)
}