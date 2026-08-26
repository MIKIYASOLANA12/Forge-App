import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const books = await prisma.book.findMany({
      orderBy: { order: 'asc' },
      include: {
        reflections: {
          orderBy: { date: 'desc' },
          take: 5,
        },
      },
    });
    return NextResponse.json(books);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      author,
      totalPages,
      startPage,
      deadlineDays,
      category,
      goals,
      competencyTags,
    } = body;

    if (!title || !totalPages) {
      return NextResponse.json({ error: 'Book title and totalPages are required' }, { status: 400 });
    }

    const lastBook = await prisma.book.findFirst({ orderBy: { order: 'desc' } });
    const nextOrder = (lastBook?.order ?? 0) + 1;

    const total = Math.max(1, Number(totalPages));
    const start = Math.max(1, Number(startPage) || 1);
    const deadline = Math.max(1, Number(deadlineDays) || 30);

    const hasActiveBook = await prisma.book.findFirst({ where: { status: 'reading' } });
    const status = hasActiveBook ? 'queued' : 'reading';

    const book = await prisma.book.create({
      data: {
        title: title.trim(),
        author: author?.trim() || 'Unknown Author',
        totalPages: total,
        startPage: start,
        currentPage: start - 1,
        deadlineDays: deadline,
        category: category || 'discipline',
        goals: goals?.trim() || null,
        competencyTags: competencyTags ? JSON.stringify(competencyTags) : JSON.stringify(['Discipline & Habits']),
        order: nextOrder,
        status,
        startDate: status === 'reading' ? new Date() : null,
        targetFinishDate: status === 'reading' ? new Date(Date.now() + deadline * 86400000) : null,
      },
    });

    return NextResponse.json(book, { status: 201 });
  } catch (error: any) {
    console.error('Error creating book:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
