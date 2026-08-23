import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const todayRange = () => {
  const { getAddisNow, workoutWindowForAddisDate } = require('@/lib/workoutTime');
  const addisNow = getAddisNow();
  const { startUtc, endUtc } = workoutWindowForAddisDate(addisNow);
  return { gte: startUtc, lt: new Date(endUtc.getTime() + 1) };
}


export async function GET() {
  const reflections = await prisma.reflection.findMany({ orderBy: { date: 'desc' }, take: 30 })
  return NextResponse.json(reflections.map((reflection) => ({ id: reflection.id, date: reflection.date, workedWell: reflection.whatWorked, tomorrowDependsOn: reflection.tomorrowKey })))
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (!body.workedWell?.trim() || !body.tomorrowDependsOn?.trim()) return NextResponse.json({ error: 'Both reflection answers are required' }, { status: 400 })
  const { getAddisNow, toUtcFromAddis, workoutWindowForAddisDate } = await import('@/lib/workoutTime');
  const addisNow = getAddisNow();
  const { startUtc } = workoutWindowForAddisDate(addisNow);
  const reflection = await prisma.reflection.upsert({
    where: { date: startUtc },
    create: { date: startUtc, whatWorked: body.workedWell.trim(), tomorrowKey: body.tomorrowDependsOn.trim() },
    update: { whatWorked: body.workedWell.trim(), tomorrowKey: body.tomorrowDependsOn.trim() },
  })
  return NextResponse.json({ id: reflection.id, date: reflection.date, workedWell: reflection.whatWorked, tomorrowDependsOn: reflection.tomorrowKey })
}