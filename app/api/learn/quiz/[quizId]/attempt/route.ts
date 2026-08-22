import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeLevel } from '@/lib/xp'

export async function POST(request: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params
  const body = await request.json()
  const answers = body.answers
  if (!Array.isArray(answers) || answers.some((answer: unknown) => !Number.isInteger(answer) || (answer as number) < 0)) return NextResponse.json({ error: 'answers must be an array of option indices' }, { status: 400 })

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, include: { questions: { orderBy: { id: 'asc' } } } })
  if (!quiz || quiz.questions.length === 0 || answers.length !== quiz.questions.length) return NextResponse.json({ error: 'Invalid quiz answers' }, { status: 400 })
  const correctAnswers = quiz.questions.map((question) => question.correctIndex)
  const correct = answers.reduce((total: number, answer: number, index: number) => total + (answer === correctAnswers[index] ? 1 : 0), 0)
  const score = Math.round((correct / quiz.questions.length) * 100)
  const passed = score >= 70
  const xpEarned = passed ? Math.round(score * 2) : 0

  await prisma.$transaction(async (transaction) => {
    await transaction.quizAttempt.create({ data: { quizId, score, passed } })
    if (xpEarned > 0) {
      const profile = await transaction.userProfile.update({ where: { id: 'singleton' }, data: { totalXp: { increment: xpEarned } } })
      const level = computeLevel(profile.totalXp)
      if (level !== profile.level) await transaction.userProfile.update({ where: { id: 'singleton' }, data: { level } })
    }
  })
  return NextResponse.json({ score, passed, xpEarned, correctAnswers })
}