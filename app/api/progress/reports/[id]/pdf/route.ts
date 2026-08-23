import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateMonthlyReportPdf } from '@/lib/pdfGenerator';
import { generateMonthlyAnalysis } from '@/lib/progressEngine';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let report = await prisma.monthlyProgressReport.findUnique({
      where: { id },
    });

    let payload: any = null;

    if (!report) {
      // Check if id is year-month formatted e.g. "2026-8"
      const parts = id.split('-');
      if (parts.length === 2) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(y) && !isNaN(m)) {
          const generated = await generateMonthlyAnalysis(y, m);
          report = generated.report;
          payload = generated.payload;
        }
      }
    }

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    if (!payload && report.reportJson) {
      try {
        payload = JSON.parse(report.reportJson);
      } catch {}
    }

    const pdfData = {
      year: report.year,
      month: report.month,
      totalXp: report.totalXp,
      endingLevel: report.endingLevel,
      xpEarned: report.xpEarned,
      workoutRate: report.workoutRate,
      studyRate: report.studyRate,
      codingRate: report.codingRate,
      readingRate: report.readingRate,
      nutritionScore: report.nutritionScore,
      habitRate: report.habitRate,
      perfectDays: report.perfectDays,
      missedDays: report.missedDays,
      longestStreak: report.longestStreak,
      bestDay: report.bestDay || 'N/A',
      weakestDay: report.weakestDay || 'N/A',
      strongestArea: report.strongestArea || 'N/A',
      weakestArea: report.weakestArea || 'N/A',
      biggestImprovement: report.biggestImprovement || 'N/A',
      biggestDecline: report.biggestDecline || 'N/A',
      recommendations: payload?.recommendations || [
        'Maintain daily workout and habit discipline.',
        'Focus on structured study and coding blocks.',
      ],
      monthDays: payload?.monthDays || [],
    };

    const pdfBytes = generateMonthlyReportPdf(pdfData);

    const filename = `forge-progress-report-${report.year}-${String(report.month).padStart(2, '0')}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('Error generating PDF report:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate PDF' }, { status: 500 });
  }
}
