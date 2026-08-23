import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAddisNow } from '@/lib/workoutTime';
import { generateMonthlyAnalysis } from '@/lib/progressEngine';

export async function GET() {
  try {
    const reports = await prisma.monthlyProgressReport.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    const parsedReports = reports.map((r) => {
      let details = null;
      try {
        details = JSON.parse(r.reportJson);
      } catch {}
      return {
        id: r.id,
        year: r.year,
        month: r.month,
        totalXp: r.totalXp,
        endingLevel: r.endingLevel,
        xpEarned: r.xpEarned,
        workoutRate: r.workoutRate,
        studyRate: r.studyRate,
        codingRate: r.codingRate,
        readingRate: r.readingRate,
        nutritionScore: r.nutritionScore,
        habitRate: r.habitRate,
        perfectDays: r.perfectDays,
        missedDays: r.missedDays,
        longestStreak: r.longestStreak,
        bestDay: r.bestDay,
        weakestDay: r.weakestDay,
        strongestArea: r.strongestArea,
        weakestArea: r.weakestArea,
        biggestImprovement: r.biggestImprovement,
        biggestDecline: r.biggestDecline,
        createdAt: r.createdAt,
        details,
      };
    });

    return NextResponse.json({ reports: parsedReports });
  } catch (error: any) {
    console.error('Error fetching monthly reports:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch reports' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const addisNow = getAddisNow();
    const year = body.year ?? addisNow.getFullYear();
    const month = body.month ?? (addisNow.getMonth() + 1);

    const result = await generateMonthlyAnalysis(year, month);
    return NextResponse.json({ success: true, report: result.report, payload: result.payload });
  } catch (error: any) {
    console.error('Error generating monthly report:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate report' }, { status: 500 });
  }
}
