import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeLevel } from '@/lib/xp'
import { recordProgressActivity } from '@/lib/progressEngine'

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (!body.workoutDayId || !Number.isInteger(body.weekNumber) || !Array.isArray(body.exerciseLogs) || !body.exerciseLogs.length) return NextResponse.json({ error: 'workoutDayId, weekNumber, and exerciseLogs are required' }, { status: 400 })
  const exercises = body.exerciseLogs.map((log: { exerciseId?: string; setsCompleted?: number; repsCompleted?: number; weightKg?: number | null; checked?: boolean }) => ({ exerciseId: log.exerciseId ?? '', setsCompleted: Number(log.setsCompleted), repsCompleted: Number(log.repsCompleted), weightKg: log.weightKg === null || log.weightKg === undefined ? null : Number(log.weightKg), checked: Boolean(log.checked) }))
  if (exercises.some((log: { exerciseId: string; setsCompleted: number; repsCompleted: number; weightKg: number | null; checked: boolean }) => !log.exerciseId || !Number.isInteger(log.setsCompleted) || log.setsCompleted < 0 || !Number.isInteger(log.repsCompleted) || log.repsCompleted < 0 || (log.weightKg !== null && (!Number.isFinite(log.weightKg) || log.weightKg < 0)))) return NextResponse.json({ error: 'Invalid exercise log' }, { status: 400 })
  const xpEarned = exercises.filter((log: { checked: boolean }) => log.checked).reduce((sum: number, log: { setsCompleted: number; repsCompleted: number }) => sum + log.setsCompleted * log.repsCompleted * 2, 0)
  const result = await prisma.$transaction(async (transaction) => {
    const log = await transaction.workoutLog.create({ data: { workoutDayId: body.workoutDayId, weekNumber: body.weekNumber, notes: body.notes?.trim() || null, exerciseLogs: { create: exercises } }, include: { exerciseLogs: true, workoutDay: true } })
    const profile = await transaction.userProfile.update({ where: { id: 'singleton' }, data: { totalXp: { increment: xpEarned } } })
    const level = computeLevel(profile.totalXp)
    if (level !== profile.level) await transaction.userProfile.update({ where: { id: 'singleton' }, data: { level } })
    return log
  })
  await recordProgressActivity(0).catch(() => {});
  return NextResponse.json({ log: result, xpEarned }, { status: 201 })
}