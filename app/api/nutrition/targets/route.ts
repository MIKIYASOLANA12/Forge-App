import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const profile = await prisma.userProfile.findUnique({ where: { id: 'singleton' } })
  return NextResponse.json({
    targetCalories: profile?.targetCalories ?? 2500,
    targetProtein: profile?.targetProtein ?? 150,
    targetCarbs: profile?.targetCarbs ?? 300,
    targetFat: profile?.targetFat ?? 80,
  })
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const fields = ['targetCalories', 'targetProtein', 'targetCarbs', 'targetFat'] as const
  const data = Object.fromEntries(fields.filter((field) => Number.isFinite(Number(body[field])) && Number(body[field]) > 0).map((field) => [field, Math.round(Number(body[field]))]))
  if (Object.keys(data).length !== fields.length) return NextResponse.json({ error: 'All targets must be positive numbers' }, { status: 400 })
  const profile = await prisma.userProfile.update({ where: { id: 'singleton' }, data })
  return NextResponse.json({ targetCalories: profile.targetCalories, targetProtein: profile.targetProtein, targetCarbs: profile.targetCarbs, targetFat: profile.targetFat })
}