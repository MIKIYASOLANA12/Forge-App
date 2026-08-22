import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const profile = await prisma.userProfile.findUnique({ where: { id: 'singleton' } })
  return NextResponse.json({
    calorieTarget: profile?.calorieTarget ?? 2500,
    proteinTarget: profile?.proteinTarget ?? 150,
    carbTarget: profile?.carbTarget ?? 300,
    fatTarget: profile?.fatTarget ?? 80,
  })
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const fields = ['calorieTarget', 'proteinTarget', 'carbTarget', 'fatTarget'] as const
  const data = Object.fromEntries(fields.filter((field) => Number.isFinite(Number(body[field])) && Number(body[field]) > 0).map((field) => [field, Math.round(Number(body[field]))]))
  if (Object.keys(data).length !== fields.length) return NextResponse.json({ error: 'All targets must be positive numbers' }, { status: 400 })
  const profile = await prisma.userProfile.update({ where: { id: 'singleton' }, data })
  return NextResponse.json({ calorieTarget: profile.calorieTarget, proteinTarget: profile.proteinTarget, carbTarget: profile.carbTarget, fatTarget: profile.fatTarget })
}