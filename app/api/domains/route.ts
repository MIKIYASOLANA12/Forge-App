import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const domains = await prisma.domain.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(domains)
}