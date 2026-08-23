import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const checkins = await prisma.physiqueCheckin.findMany({
      orderBy: { monthNumber: 'asc' },
    });

    const checkinsMap = new Map(checkins.map((c) => [c.monthNumber, c]));

    // Roadmap of 8 checkpoints: Month 0 (Baseline) up to Month 7
    const roadmap = Array.from({ length: 8 }, (_, monthNum) => {
      const existing = checkinsMap.get(monthNum);
      const isCompleted = Boolean(
        existing &&
        (existing.frontRelaxedUrl || existing.frontBicepsUrl || existing.backWingsUrl || existing.backBicepsUrl || existing.sideTricepsUrl)
      );

      return {
        monthNumber: monthNum,
        label: monthNum === 0 ? 'Month 0 (Baseline)' : `Month ${monthNum}`,
        isCompleted,
        data: existing || null,
      };
    });

    const completedCount = roadmap.filter((r) => r.isCompleted).length;

    return NextResponse.json({
      roadmap,
      totalMonths: 7,
      completedCount,
      progressPercentage: Math.round((completedCount / 8) * 100),
    });
  } catch (error: any) {
    console.error('Failed to fetch physique roadmap:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch roadmap' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      monthNumber,
      weightKg,
      notes,
      frontRelaxedUrl,
      frontBicepsUrl,
      backWingsUrl,
      backBicepsUrl,
      sideTricepsUrl,
    } = body;

    const mNum = Number(monthNumber);
    if (isNaN(mNum) || mNum < 0 || mNum > 7) {
      return NextResponse.json(
        { error: 'Invalid monthNumber. Must be between 0 (Baseline) and 7.' },
        { status: 400 }
      );
    }

    const saved = await prisma.physiqueCheckin.upsert({
      where: { monthNumber: mNum },
      create: {
        monthNumber: mNum,
        weightKg: weightKg ? parseFloat(weightKg) : null,
        notes: notes || null,
        frontRelaxedUrl: frontRelaxedUrl || null,
        frontBicepsUrl: frontBicepsUrl || null,
        backWingsUrl: backWingsUrl || null,
        backBicepsUrl: backBicepsUrl || null,
        sideTricepsUrl: sideTricepsUrl || null,
        date: new Date(),
      },
      update: {
        weightKg: weightKg !== undefined ? (weightKg ? parseFloat(weightKg) : null) : undefined,
        notes: notes !== undefined ? notes : undefined,
        frontRelaxedUrl: frontRelaxedUrl !== undefined ? frontRelaxedUrl : undefined,
        frontBicepsUrl: frontBicepsUrl !== undefined ? frontBicepsUrl : undefined,
        backWingsUrl: backWingsUrl !== undefined ? backWingsUrl : undefined,
        backBicepsUrl: backBicepsUrl !== undefined ? backBicepsUrl : undefined,
        sideTricepsUrl: sideTricepsUrl !== undefined ? sideTricepsUrl : undefined,
        date: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      checkin: saved,
      message: `Month ${mNum} physical progression check-in saved successfully!`,
    });
  } catch (error: any) {
    console.error('Failed to save physique checkin:', error);
    return NextResponse.json({ error: error.message || 'Failed to save checkin' }, { status: 500 });
  }
}
