import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const lessons = await prisma.lesson.findMany({
    include: { domain: { select: { name: true, color: true } }, quiz: { include: { attempts: { select: { score: true } } } } },
    orderBy: [{ domain: { name: 'asc' } }, { track: 'asc' }, { order: 'asc' }],
  })

  const grouped = new Map<string, { name: string; color: string; tracks: Map<string, typeof lessons> }>()
  for (const lesson of lessons) {
    const domain = grouped.get(lesson.domain.name) ?? { name: lesson.domain.name, color: lesson.domain.color, tracks: new Map() }
    const track = domain.tracks.get(lesson.track) ?? []
    track.push(lesson)
    domain.tracks.set(lesson.track, track)
    grouped.set(lesson.domain.name, domain)
  }

  return NextResponse.json([...grouped.values()].map((domain) => ({
    domain: domain.name,
    color: domain.color,
    tracks: [...domain.tracks.entries()].map(([name, trackLessons]) => {
      const completed = trackLessons.map((lesson) => Math.max(...(lesson.quiz?.attempts.map((attempt) => attempt.score) ?? [-1])) >= 70)
      return {
        name,
        completed: completed.filter(Boolean).length,
        total: trackLessons.length,
        lessons: trackLessons.map((lesson, index) => ({
          id: lesson.id,
          title: lesson.title,
          order: lesson.order,
          completed: completed[index],
          locked: index > 0 && !completed[index - 1],
          bestScore: Math.max(...(lesson.quiz?.attempts.map((attempt) => attempt.score) ?? [-1])),
          previousTitle: index > 0 ? trackLessons[index - 1].title : null,
        })),
      }
    }),
  })))
}