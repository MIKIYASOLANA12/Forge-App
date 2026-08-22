"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, ArrowRight, Check, CircleX, LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";

type Question = { id: string; prompt: string; options: string[] };
type Lesson = { id: string; title: string; content: string; track: string; domain: { name: string; color: string }; quiz: { id: string; questions: Question[] } | null; bestScore: number | null; attempts: number };
type Result = { score: number; passed: boolean; xpEarned: number; correctAnswers: number[] };

export default function LessonExperience({ lesson, nextLessonId }: { lesson: Lesson; nextLessonId: string | null }) {
  const [mode, setMode] = useState<"reading" | "quiz">("reading");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const questions = lesson.quiz?.questions ?? [];
  const submit = async (nextAnswers: number[]) => {
    setSubmitting(true);
    const response = await fetch(`/api/learn/quiz/${lesson.quiz?.id}/attempt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: nextAnswers }) });
    if (response.ok) setResult(await response.json());
    setSubmitting(false);
  };
  const answer = (choice: number) => {
    const nextAnswers = [...answers, choice];
    setAnswers(nextAnswers);
    if (nextAnswers.length === questions.length) void submit(nextAnswers); else setQuestionIndex(questionIndex + 1);
  };
  const startQuiz = () => { setMode("quiz"); setQuestionIndex(0); setAnswers([]); setResult(null); };
  return <div className="mx-auto w-full max-w-[900px] animate-fade-in pb-10"><Link href="/learn" className="mb-7 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)]"><ArrowLeft size={14} /> All lessons</Link><div className="mb-8 border-b border-[var(--border)] pb-6"><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: lesson.domain.color }}>{lesson.domain.name} / {lesson.track}</p><h1>{lesson.title}</h1>{lesson.bestScore !== null && <p className="mt-3 text-sm">Best score: <strong className="text-[var(--success)]">{lesson.bestScore}%</strong> · {lesson.attempts} attempt{lesson.attempts === 1 ? "" : "s"}</p>}</div>{mode === "reading" ? <article className="card prose prose-invert max-w-none prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-secondary)] prose-strong:text-[var(--text-primary)] prose-a:text-[var(--study)] prose-code:text-[var(--coding)]"><ReactMarkdown>{lesson.content}</ReactMarkdown><div className="mt-8 border-t border-[var(--border)] pt-6">{lesson.quiz ? <button className="btn btn-primary" onClick={startQuiz}>{lesson.bestScore !== null && lesson.bestScore >= 70 ? "Retake quiz" : "Take quiz"} <ArrowRight size={15} /></button> : <p className="text-sm text-[var(--text-muted)]">No quiz attached to this lesson.</p>}</div></article> : <section className="card">{result ? <div className="text-center"><div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${result.passed ? "bg-[rgba(34,197,94,0.14)] text-[var(--success)]" : "bg-[rgba(239,68,68,0.14)] text-[var(--danger)]"}`}>{result.passed ? <Check size={30} /> : <CircleX size={30} />}</div><h2 className="mt-5">{result.score}% · {result.passed ? "Passed" : "Keep working"}</h2><p className="mt-2 text-sm">{result.passed ? `You earned ${result.xpEarned} XP.` : "Review the lesson and try again."}</p>{result.passed && <Sparkles className="mx-auto mt-3 animate-pulse text-[var(--xp-gold)]" size={20} />}<div className="mt-7 space-y-3 text-left">{questions.map((question, index) => <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-sm" key={question.id}><div className="font-semibold">{index + 1}. {question.prompt}</div><div className="mt-1 text-xs text-[var(--success)]">Correct answer: {question.options[result.correctAnswers[index]]}</div><div className={`mt-1 text-xs ${answers[index] === result.correctAnswers[index] ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{answers[index] === result.correctAnswers[index] ? "Your answer was correct" : `Your answer: ${question.options[answers[index]]}`}</div></div>)}</div><div className="mt-7 flex justify-center gap-3">{!result.passed && <button className="btn btn-ghost" onClick={startQuiz}><RotateCcw size={15} /> Try again</button>}{result.passed && nextLessonId && <Link className="btn btn-primary" href={`/learn/${nextLessonId}`}>Next lesson <ArrowRight size={15} /></Link>}{result.passed && !nextLessonId && <Link className="btn btn-ghost" href="/learn">Back to lessons</Link>}</div></div> : <div><div className="mb-6 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Question {questionIndex + 1} of {questions.length}</span><span className="text-xs text-[var(--study)]">{Math.round(questionIndex / questions.length * 100)}% complete</span></div><h2 className="text-2xl">{questions[questionIndex]?.prompt}</h2><div className="mt-7 space-y-3">{questions[questionIndex]?.options.map((option, index) => <button key={option} className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-left text-sm transition-colors hover:border-[var(--study)] hover:bg-[rgba(59,130,246,0.08)]" onClick={() => answer(index)} disabled={submitting}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--border-active)] text-xs font-bold">{String.fromCharCode(65 + index)}</span>{option}</button>)}</div>{submitting && <div className="mt-5 flex items-center gap-2 text-xs text-[var(--text-muted)]"><LoaderCircle size={14} className="animate-spin" /> Grading your answers...</div>}</div>}</section>}</div>;
}
