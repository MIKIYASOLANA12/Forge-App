import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const shape = (profile: { examDate: Date; planStartDate: Date; totalXp: number; level: number; targetCalories: number; targetProtein: number; targetCarbs: number; targetFat: number }) => ({ examDate: profile.examDate, planStartDate: profile.planStartDate, totalXp: profile.totalXp, level: profile.level, targetCalories: profile.targetCalories, targetProtein: profile.targetProtein, targetCarbs: profile.targetCarbs, targetFat: profile.targetFat })

export async function GET() {
  const profile = await prisma.userProfile.findUnique({ where: { id: 'singleton' } })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  return NextResponse.json(shape(profile))
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  if (!body.examDate || Number.isNaN(new Date(body.examDate).getTime())) return NextResponse.json({ error: 'A valid exam date is required' }, { status: 400 })
  const profile = await prisma.userProfile.update({ where: { id: 'singleton' }, data: { examDate: new Date(body.examDate) } })
  return NextResponse.json(shape(profile))
}