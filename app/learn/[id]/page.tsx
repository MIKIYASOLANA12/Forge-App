import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LessonExperience from "./LessonExperience";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = await prisma.lesson.findUnique({ where: { id }, include: { domain: { select: { name: true, color: true } }, quiz: { include: { questions: true, attempts: { orderBy: { score: "desc" }, select: { score: true } } } } } });
  if (!lesson) notFound();
  const previous = lesson.order > 1 ? await prisma.lesson.findFirst({ where: { track: lesson.track, order: lesson.order - 1 }, include: { quiz: { include: { attempts: { select: { score: true } } } } } }) : null;
  const locked = Boolean(previous && Math.max(...(previous.quiz?.attempts.map((attempt) => attempt.score) ?? [-1])) < 70);
  if (locked) redirect("/learn");
  const next = await prisma.lesson.findFirst({ where: { track: lesson.track, order: { gt: lesson.order } }, select: { id: true } });
  const bestScore = lesson.quiz?.attempts.length ? Math.max(...lesson.quiz.attempts.map((attempt) => attempt.score)) : null;
  return <LessonExperience lesson={{ id: lesson.id, title: lesson.title, content: lesson.content, track: lesson.track, domain: lesson.domain, quiz: lesson.quiz ? { id: lesson.quiz.id, questions: lesson.quiz.questions.map((question) => ({ id: question.id, prompt: question.prompt, options: JSON.parse(question.options) as string[] })) } : null, bestScore, attempts: lesson.quiz?.attempts.length ?? 0 }} nextLessonId={next?.id ?? null} />;
}
