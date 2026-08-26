import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recordProgressActivity } from '@/lib/progressEngine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bookId,
      q1FiveMainIdeas,
      q2ThinkingChanged,
      q3ActuallyApply,
      q4RealLifeExample,
      q5OwnWordsSummary,
      q6DisagreeIdea,
      q7StartDoing,
    } = body;

    if (!bookId || !q1FiveMainIdeas || !q2ThinkingChanged || !q3ActuallyApply) {
      return NextResponse.json(
        { error: 'bookId and core final review answers are required' },
        { status: 400 }
      );
    }

    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const finalReviewData = {
      q1FiveMainIdeas: q1FiveMainIdeas.trim(),
      q2ThinkingChanged: q2ThinkingChanged.trim(),
      q3ActuallyApply: q3ActuallyApply.trim(),
      q4RealLifeExample: q4RealLifeExample?.trim() || '',
      q5OwnWordsSummary: q5OwnWordsSummary?.trim() || '',
      q6DisagreeIdea: q6DisagreeIdea?.trim() || '',
      q7StartDoing: q7StartDoing?.trim() || '',
      submittedAt: new Date().toISOString(),
    };

    // Mark current book finished
    await prisma.book.update({
      where: { id: bookId },
      data: {
        status: 'finished',
        currentPage: book.totalPages,
        completedAt: new Date(),
        finalReview: JSON.stringify(finalReviewData),
      },
    });

    // Unlock next book in queue
    const nextBook = await prisma.book.findFirst({
      where: {
        status: 'queued',
        id: { not: bookId },
      },
      orderBy: { order: 'asc' },
    });

    let nextBookTitle = '';
    if (nextBook) {
      const targetFinish = new Date(Date.now() + (nextBook.deadlineDays || 30) * 86400000);
      await prisma.book.update({
        where: { id: nextBook.id },
        data: {
          status: 'reading',
          startDate: new Date(),
          targetFinishDate: targetFinish,
        },
      });
      nextBookTitle = nextBook.title;
    }

    // Award 250 XP bonus
    await prisma.userProfile.update({
      where: { id: 'singleton' },
      data: {
        totalXp: { increment: 250 },
      },
    });

    await recordProgressActivity(250).catch(() => {});

    return NextResponse.json({
      success: true,
      completedBook: book.title,
      nextBook: nextBookTitle || 'All queued books completed!',
      xpEarned: 250,
      message: `🏆 BOOK COMPLETED: "${book.title}"! Unlocked: "${nextBookTitle || 'Next Milestone'}" (+250 XP)`,
    });
  } catch (error: any) {
    console.error('Final book test error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
