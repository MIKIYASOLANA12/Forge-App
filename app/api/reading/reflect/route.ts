import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recordProgressActivity } from '@/lib/progressEngine';
import { getAddisNow, workoutWindowForAddisDate } from '@/lib/workoutTime';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bookId,
      pagesReadToday,
      startPage,
      endPage,
      q1Understood,
      q2MainIdea,
      q3RealLifeUse,
      q4Confused,
      q5ChangeTomorrow,
    } = body;

    if (!bookId || !q1Understood || !q2MainIdea) {
      return NextResponse.json({ error: 'bookId, q1Understood, and q2MainIdea are required' }, { status: 400 });
    }

    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const pages = Number(pagesReadToday) || Math.max(1, (Number(endPage) || 1) - (Number(startPage) || 1) + 1);
    const newCurrentPage = Math.min(book.totalPages, Math.max(book.currentPage, Number(endPage) || book.currentPage + pages));

    // Create reflection record
    const reflection = await prisma.bookDailyReflection.create({
      data: {
        bookId,
        pagesReadToday: pages,
        startPage: Number(startPage) || book.currentPage + 1,
        endPage: newCurrentPage,
        q1Understood: q1Understood.trim(),
        q2MainIdea: q2MainIdea.trim(),
        q3RealLifeUse: q3RealLifeUse?.trim() || null,
        q4Confused: q4Confused?.trim() || null,
        q5ChangeTomorrow: q5ChangeTomorrow?.trim() || null,
        actionItem: q3RealLifeUse ? `Apply idea: ${q3RealLifeUse.slice(0, 100)}` : null,
        xpAwarded: 35,
      },
    });

    // Update book progress
    await prisma.book.update({
      where: { id: bookId },
      data: {
        currentPage: newCurrentPage,
      },
    });

    // Award XP
    await prisma.userProfile.update({
      where: { id: 'singleton' },
      data: {
        totalXp: { increment: 35 },
      },
    });

    await recordProgressActivity(35).catch(() => {});

    // Mark today's Reading task in DailyPlan as completed
    const addisNow = getAddisNow();
    const windowInfo = workoutWindowForAddisDate(addisNow);
    const todayPlan = await prisma.dailyPlan.findFirst({
      where: { date: { gte: windowInfo.startUtc, lte: windowInfo.endUtc } },
      include: { tasks: true },
    });

    if (todayPlan) {
      const readingTask = todayPlan.tasks.find((t) => t.domainId === 'reading' || t.description.toLowerCase().includes('reading'));
      if (readingTask && !readingTask.completed) {
        await prisma.planTask.update({
          where: { id: readingTask.id },
          data: { completed: true },
        });
      }
    }

    return NextResponse.json({
      success: true,
      reflection,
      currentPage: newCurrentPage,
      totalPages: book.totalPages,
      xpEarned: 35,
      message: `✅ Reflection saved! Read ${pages} pages (+35 XP)`,
    });
  } catch (error: any) {
    console.error('Reading reflect error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
