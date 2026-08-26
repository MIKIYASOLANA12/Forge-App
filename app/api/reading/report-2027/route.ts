import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { get2027DeadlineMetrics, PERSONAL_DEVELOPMENT_AREAS } from '@/lib/readingEngine';
import { getAddisNow, workoutWindowForAddisDate } from '@/lib/workoutTime';

export async function GET() {
  try {
    const addisNow = getAddisNow();
    const deadline2027 = get2027DeadlineMetrics(addisNow);

    // Books & reflections
    const [books, reflections, workoutLogs, masteries, profile] = await Promise.all([
      prisma.book.findMany({ orderBy: { order: 'asc' } }),
      prisma.bookDailyReflection.findMany({ orderBy: { date: 'desc' } }),
      prisma.workoutLog.findMany({ take: 30 }),
      prisma.studyTopicMastery.findMany(),
      prisma.userProfile.findUnique({ where: { id: 'singleton' } }),
    ]);

    const finishedBooks = books.filter((b) => b.status === 'finished');
    const totalPagesRead = books.reduce((sum, b) => sum + (b.status === 'finished' ? b.totalPages : b.currentPage), 0);

    // Competency breakdown
    const competencyGrowth = PERSONAL_DEVELOPMENT_AREAS.map((area) => {
      const relatedBooks = books.filter((b) => {
        try {
          const tags = JSON.parse(b.competencyTags || '[]');
          return tags.some((t: string) => t.toLowerCase().includes(area.name.toLowerCase().split(' ')[0]));
        } catch {
          return b.category === area.id;
        }
      });

      const relatedReflections = reflections.filter((r) =>
        relatedBooks.some((b) => b.id === r.bookId)
      );

      const score = Math.min(100, Math.round(relatedBooks.filter((b) => b.status === 'finished').length * 40 + relatedReflections.length * 8));

      return {
        area: area.name,
        category: area.id,
        score,
        booksCount: relatedBooks.length,
        reflectionsCount: relatedReflections.length,
      };
    });

    const jsMastered = masteries.filter((m) => m.subject === 'JavaScript' && m.isMastered).length;
    const chemMastered = masteries.filter((m) => m.subject === 'Chemistry' && m.isMastered).length;

    const report = {
      title: 'FORGE — 2027 LIFE PREPARATION REPORT',
      targetDate: deadline2027.targetDateFormatted,
      daysRemaining: deadline2027.daysRemaining,
      journeyProgress: deadline2027.journeyFormatted,
      generatedAt: addisNow.toISOString(),
      readingPillar: {
        booksCompletedCount: finishedBooks.length,
        totalBooksQueued: books.length,
        totalPagesRead,
        totalReflectionsLogged: reflections.length,
        finishedBooks: finishedBooks.map((b) => ({
          title: b.title,
          author: b.author,
          pages: b.totalPages,
          completedAt: b.completedAt,
        })),
        appliedLessons: reflections.filter((r) => r.actionItem).map((r) => r.actionItem).slice(0, 8),
      },
      competencies: competencyGrowth,
      academics: {
        javascriptMasteredTopics: jsMastered,
        chemistryMasteredTopics: chemMastered,
        totalMasteredTopics: jsMastered + chemMastered,
      },
      physicalConsistency: {
        totalWorkoutsLogged: workoutLogs.length,
        currentXp: profile?.totalXp || 0,
        level: profile?.level || 1,
      },
      synthesis: {
        strongestPillars: competencyGrowth.filter((c) => c.score >= 50).map((c) => c.area),
        focusAreasBefore2027: competencyGrowth.filter((c) => c.score < 50).map((c) => c.area),
        verdict: 'Continuous 303-day sequential execution active toward June 25, 2027 personal deadline.',
      },
    };

    return NextResponse.json(report);
  } catch (error: any) {
    console.error('2027 Report error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
