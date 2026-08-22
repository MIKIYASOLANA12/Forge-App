import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const exercises = await prisma.workoutExercise.findMany({ orderBy: [{ workoutDay: { type: 'asc' } }, { order: 'asc' }], include: { logs: { where: { weightKg: { not: null } }, orderBy: { workoutLog: { completedAt: 'asc' } }, select: { weightKg: true, workoutLog: { select: { completedAt: true } } } } } })
  return NextResponse.json(exercises.map((exercise) => ({ id: exercise.id, name: exercise.name, weights: exercise.logs.map((log) => ({ weightKg: log.weightKg, date: log.workoutLog.completedAt })) })))
}