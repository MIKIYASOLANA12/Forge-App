import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentWeek, getPhase } from '@/lib/workout'

const ORDER = ['Push', 'Pull', 'LegsCore']

export async function GET() {
  const [program, lastLog, days] = await Promise.all([
    prisma.workoutProgram.findUnique({ where: { id: 'singleton' } }),
    prisma.workoutLog.findFirst({ orderBy: { completedAt: 'desc' }, include: { workoutDay: true } }),
    prisma.workoutDay.findMany({ include: { exercises: { orderBy: { order: 'asc' } } } }),
  ])
  if (!program || !days.length) return NextResponse.json({ error: 'Workout program is not seeded' }, { status: 404 })
  const lastIndex = lastLog ? ORDER.indexOf(lastLog.workoutDay.type) : -1
  const type = ORDER[(lastIndex + 1) % ORDER.length]
  const day = days.find((item) => item.type === type) ?? days[0]
  const week = getCurrentWeek(program.startDate)
  const phase = getPhase(week)
  const previousLogs = await prisma.exerciseLog.findMany({ where: { exercise: { workoutDayId: day.id } }, orderBy: { workoutLog: { completedAt: 'desc' } }, include: { workoutLog: { select: { completedAt: true } } } })
  const lastByExercise = new Map<string, typeof previousLogs[number]>()
  for (const log of previousLogs) if (!lastByExercise.has(log.exerciseId)) lastByExercise.set(log.exerciseId, log)
  return NextResponse.json({ day: { id: day.id, type: day.type, exercises: day.exercises.map((exercise) => ({ ...exercise, lastLog: lastByExercise.get(exercise.id) ?? null })) }, weekNumber: week, phase, isNewPhase: week > 1 && phase.weeks[0] === week })
}