import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const todayRange = () => {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { gte: start, lt: end }
}

export async function GET() {
  const reflections = await prisma.reflection.findMany({ orderBy: { date: 'desc' }, take: 30 })
  return NextResponse.json(reflections.map((reflection) => ({ id: reflection.id, date: reflection.date, workedWell: reflection.whatWorked, tomorrowDependsOn: reflection.tomorrowKey })))
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (!body.workedWell?.trim() || !body.tomorrowDependsOn?.trim()) return NextResponse.json({ error: 'Both reflection answers are required' }, { status: 400 })
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  const reflection = await prisma.reflection.upsert({
    where: { date },
    create: { date, whatWorked: body.workedWell.trim(), tomorrowKey: body.tomorrowDependsOn.trim() },
    update: { whatWorked: body.workedWell.trim(), tomorrowKey: body.tomorrowDependsOn.trim() },
  })
  return NextResponse.json({ id: reflection.id, date: reflection.date, workedWell: reflection.whatWorked, tomorrowDependsOn: reflection.tomorrowKey })
}