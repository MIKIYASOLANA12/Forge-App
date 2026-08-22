import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: { domain: { select: { name: true, color: true } }, quiz: { include: { questions: true, attempts: { orderBy: { score: 'desc' }, select: { score: true } } } } },
  })
  if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

  const previous = lesson.order > 1 ? await prisma.lesson.findFirst({ where: { track: lesson.track, order: lesson.order - 1 }, include: { quiz: { include: { attempts: { select: { score: true } } } } } }) : null
  const bestScore = lesson.quiz?.attempts[0]?.score ?? null
  return NextResponse.json({
    id: lesson.id,
    title: lesson.title,
    content: lesson.content,
    track: lesson.track,
    domain: lesson.domain,
    locked: Boolean(previous && Math.max(...(previous.quiz?.attempts.map((attempt) => attempt.score) ?? [-1])) < 70),
    quiz: lesson.quiz ? { id: lesson.quiz.id, questions: lesson.quiz.questions.map((question) => ({ id: question.id, prompt: question.prompt, options: JSON.parse(question.options) })) } : null,
    bestScore,
    attempts: lesson.quiz?.attempts.length ?? 0,
  })
}