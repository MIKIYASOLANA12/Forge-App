"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Code2,
  Atom,
  CheckCircle2,
  ChevronRight,
  Flame,
  Award,
  Sparkles,
  Zap,
  Target,
  AlertTriangle,
  Play,
  RotateCcw,
  LoaderCircle,
  HelpCircle,
  Clock,
  ArrowRight,
  Check,
  Plus
} from "lucide-react";
import { clsx } from "clsx";

type StudyStatus = {
  day300: {
    dayNumber: number;
    totalDays: number;
    formatted: string;
    percentage: number;
  };
  chemistry: {
    totalTopics: number;
    completedCount: number;
    remainingCount: number;
    percentage: number;
    hoursPerDay: number;
    minutesPerDay: number;
    currentTopic: {
      id: string;
      name: string;
      order: number;
      stage: string;
      difficulty: string;
      keyConcepts: string[];
    };
    nextTopic: {
      id: string;
      name: string;
      order: number;
    } | null;
    recommendedStudyBlocks: Array<{ name: string; minutes: number; focus: string }>;
    roadmap: Array<{
      id: string;
      order: number;
      name: string;
      stage: string;
      difficulty: string;
      masteryLevel: number;
      isMastered: boolean;
      accuracy: number;
    }>;
  };
  javascript: {
    courseName: string;
    totalLessons: number;
    completedCount: number;
    remainingCount: number;
    percentage: number;
    currentLesson: {
      id: string;
      title: string;
      subtopics: string[];
      quizzes: string[];
    };
    nextLesson: {
      id: string;
      title: string;
    };
    todayTaskRecommendation: {
      lessonTitle: string;
      durationMinutes: number;
      breakdown: Array<{ label: string; minutes: number; description: string }>;
    };
    roadmap: Array<{
      id: string;
      order: number;
      title: string;
      subtopics: string[];
      masteryLevel: number;
      isMastered: boolean;
      accuracy: number;
    }>;
  };
  weakAreas: Array<{
    subject: string;
    topicName: string;
    topicId: string;
    accuracy: number;
    weakConcepts: string[];
  }>;
};

type Question = {
  id: string;
  subject: string;
  topicId: string;
  topicName: string;
  subtopic?: string;
  masteryLevel: number;
  difficulty: string;
  type: string;
  prompt: string;
  options: string[];
  conceptTag: string;
  xpReward: number;
};

type EvaluationResult = {
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
  xpAwarded: number;
  masteryLevel: number;
  isMastered: boolean;
  accuracy: number;
  recommendation: string | null;
  recommendedTaskTitle: string | null;
};

export default function LearnPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "chemistry" | "javascript" | "quiz">("overview");
  const [data, setData] = useState<StudyStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Quiz test runner state
  const [selectedSubject, setSelectedSubject] = useState<"Chemistry" | "JavaScript">("Chemistry");
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [addingToPlan, setAddingToPlan] = useState(false);
  const [planAddedMsg, setPlanAddedMsg] = useState("");

  const loadStatus = async () => {
    try {
      const res = await fetch("/api/study/status");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const startQuiz = async (subject: "Chemistry" | "JavaScript", topicId?: string) => {
    setSelectedSubject(subject);
    setSelectedOption(null);
    setEvaluation(null);
    setPlanAddedMsg("");
    setActiveTab("quiz");

    try {
      const url = topicId
        ? `/api/study/questions?subject=${subject}&topicId=${topicId}`
        : `/api/study/questions?subject=${subject}`;
      const res = await fetch(url);
      if (res.ok) {
        const { questions } = await res.json();
        setQuizQuestions(questions || []);
        setCurrentQIndex(0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const submitAnswer = async () => {
    if (!selectedOption || !quizQuestions[currentQIndex]) return;
    setEvaluating(true);

    try {
      const q = quizQuestions[currentQIndex];
      const res = await fetch("/api/study/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: q.id,
          userAnswer: selectedOption,
        }),
      });

      if (res.ok) {
        const result = (await res.json()) as EvaluationResult;
        setEvaluation(result);
        await loadStatus();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEvaluating(false);
    }
  };

  const acceptRecommendation = async () => {
    if (!evaluation?.recommendedTaskTitle) return;
    setAddingToPlan(true);

    try {
      const res = await fetch("/api/study/recommendation/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: evaluation.recommendedTaskTitle,
          subject: selectedSubject,
          targetDay: "tomorrow",
          minutes: 30,
          priority: "HIGH",
        }),
      });

      if (res.ok) {
        setPlanAddedMsg("✅ Added to Tomorrow's Plan!");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddingToPlan(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center gap-3 text-sm text-[var(--text-muted)]">
        <LoaderCircle size={20} className="animate-spin text-blue-500" />
        <span>Loading Study & Question Engine...</span>
      </div>
    );
  }

  const currentQ = quizQuestions[currentQIndex];

  return (
    <div className="mx-auto w-full max-w-[1280px] animate-fade-in pb-16 space-y-6">
      {/* ── HEADER BAR ──────────────────────────────────────────────────────── */}
      <section className="flex flex-col justify-between gap-5 border-b border-[var(--border)] pb-6 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/30">
              <Atom size={14} /> Study & Deliberate Practice OS
            </span>
            <span className="text-xs text-slate-400 font-semibold">
              4-Level Mastery Engine (Understand → Recall → Apply → Mastered)
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <BookOpen className="text-blue-500" size={32} />
            Chemistry & JavaScript Study Engine
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--text-secondary)]">
            Connected 21-topic Chemistry roadmap + 5 Million Coders JavaScript course with spaced repetition question testing.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-1">
          <button
            className={`btn btn-sm ${
              activeTab === "overview"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm font-bold"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
            onClick={() => setActiveTab("overview")}
          >
            <Sparkles size={14} /> Overview
          </button>
          <button
            className={`btn btn-sm ${
              activeTab === "chemistry"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm font-bold"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
            onClick={() => setActiveTab("chemistry")}
          >
            <Atom size={14} /> Chemistry (1-Mo Plan)
          </button>
          <button
            className={`btn btn-sm ${
              activeTab === "javascript"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm font-bold"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
            onClick={() => setActiveTab("javascript")}
          >
            <Code2 size={14} /> JavaScript Roadmap
          </button>
          <button
            className={`btn btn-sm ${
              activeTab === "quiz"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm font-bold"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
            onClick={() => startQuiz("Chemistry")}
          >
            <HelpCircle size={14} /> Test Me (Quiz)
          </button>
        </div>
      </section>

      {/* ── TAB 1: OVERVIEW & ACTIVE TARGETS ─────────────────────────────────── */}
      {activeTab === "overview" && data && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Chemistry Active Target Card */}
            <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-950/20 via-slate-900 to-slate-950 p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <Atom size={20} />
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold text-white">Chemistry Pacing Plan</h3>
                    <p className="text-xs text-slate-400">1-Month Entrance Mastery Cycle</p>
                  </div>
                </div>
                <span className="text-xs font-black font-mono text-blue-400">
                  {data.chemistry.percentage}% Done
                </span>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                  Current Active Topic
                </span>
                <div className="text-lg font-black text-white">
                  {data.chemistry.currentTopic.order}. {data.chemistry.currentTopic.name}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {data.chemistry.currentTopic.keyConcepts.slice(0, 3).map((c) => (
                    <span key={c} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  Daily target: <strong className="text-white">{data.chemistry.minutesPerDay} min/day</strong>
                </div>
                <button
                  onClick={() => startQuiz("Chemistry", data.chemistry.currentTopic.id)}
                  className="btn btn-primary btn-sm rounded-xl font-bold flex items-center gap-1 shadow-md"
                >
                  <Play size={13} /> Test Chemistry
                </button>
              </div>
            </div>

            {/* JavaScript Active Target Card */}
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-slate-900 to-slate-950 p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Code2 size={20} />
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold text-white">JavaScript 5 Million Coders</h3>
                    <p className="text-xs text-slate-400">Roadmap & Daily Practice</p>
                  </div>
                </div>
                <span className="text-xs font-black font-mono text-emerald-400">
                  {data.javascript.percentage}% Done
                </span>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                  Current Lesson
                </span>
                <div className="text-lg font-black text-white">
                  {data.javascript.currentLesson.title}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {data.javascript.currentLesson.subtopics.slice(0, 3).map((s) => (
                    <span key={s} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  Next: <strong className="text-white">{data.javascript.nextLesson.title}</strong>
                </div>
                <button
                  onClick={() => startQuiz("JavaScript", data.javascript.currentLesson.id)}
                  className="btn btn-primary btn-sm rounded-xl font-bold flex items-center gap-1 shadow-md bg-emerald-600 hover:bg-emerald-500"
                >
                  <Play size={13} /> Test JavaScript
                </button>
              </div>
            </div>
          </div>

          {/* Weak Area Detection Card */}
          {data.weakAreas.length > 0 && (
            <section className="rounded-2xl border border-amber-500/30 bg-slate-900/60 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-amber-400" size={18} />
                <h3 className="text-base font-extrabold text-white">Weak Area Diagnostic Tracker</h3>
              </div>
              <p className="text-xs text-slate-400">
                Concepts identified through question mistakes that need review in tomorrow's plan:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {data.weakAreas.map((w, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{w.topicName}</span>
                      <span className="text-[11px] font-bold font-mono text-rose-400">{w.accuracy}% Acc</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {w.weakConcepts.map((c) => (
                        <span key={c} className="px-2 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-300 border border-rose-500/20 font-medium">
                          ⚠️ {c.replace(/-/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── TAB 2: CHEMISTRY CONNECTED 21-TOPIC ROADMAP ──────────────────────── */}
      {activeTab === "chemistry" && data && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
            <div>
              <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Atom className="text-blue-400" size={22} />
                Chemistry 21-Topic Connected Roadmap
              </h3>
              <p className="text-xs text-slate-400">
                Paced 1-Month schedule ({data.chemistry.minutesPerDay} min/day target).
              </p>
            </div>
            <button
              onClick={() => startQuiz("Chemistry")}
              className="btn btn-primary btn-sm rounded-xl font-bold flex items-center gap-1 shadow-md self-start sm:self-auto"
            >
              <Play size={14} /> Start Chemistry Test
            </button>
          </div>

          {/* 5-Part Study Session Structure */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-950/10 p-4 space-y-2">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-blue-400 block">
              5-Part Chemistry Study Session Architecture
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-1 text-xs">
              {data.chemistry.recommendedStudyBlocks.map((b) => (
                <div key={b.name} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                  <div className="font-bold text-white flex justify-between">
                    <span>{b.name}</span>
                    <span className="text-blue-400 font-mono">{b.minutes}m</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-snug">{b.focus}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 21 Topics Connected Chain */}
          <div className="space-y-3">
            {data.chemistry.roadmap.map((topic, i) => (
              <div
                key={topic.id}
                className={clsx(
                  "p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all",
                  topic.isMastered
                    ? "border-emerald-500/30 bg-emerald-950/10"
                    : topic.id === data.chemistry.currentTopic.id
                    ? "border-blue-500/40 bg-blue-950/20 shadow-md"
                    : "border-slate-800 bg-slate-950/60 opacity-85"
                )}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-500">0{i + 1}</span>
                    <h4 className="text-sm font-bold text-white">{topic.name}</h4>
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-900 border border-slate-800 text-slate-400">
                      {topic.stage}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div className="text-right">
                    <span
                      className={clsx(
                        "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border",
                        topic.masteryLevel === 4
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                      )}
                    >
                      Level {topic.masteryLevel} {topic.isMastered ? "· Mastered" : ""}
                    </span>
                  </div>
                  <button
                    onClick={() => startQuiz("Chemistry", topic.id)}
                    className="btn btn-ghost btn-xs text-slate-300 hover:text-white border border-slate-800"
                  >
                    Test
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── TAB 3: JAVASCRIPT 5 MILLION CODERS ──────────────────────────────── */}
      {activeTab === "javascript" && data && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
            <div>
              <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Code2 className="text-emerald-400" size={22} />
                5 Million Coders / JavaScript Course
              </h3>
              <p className="text-xs text-slate-400">
                Official curriculum sequence from Conditionals to Browser Events.
              </p>
            </div>
            <button
              onClick={() => startQuiz("JavaScript")}
              className="btn btn-primary btn-sm rounded-xl font-bold flex items-center gap-1 shadow-md bg-emerald-600 hover:bg-emerald-500 self-start sm:self-auto"
            >
              <Play size={14} /> Start JS Quiz
            </button>
          </div>

          <div className="space-y-3">
            {data.javascript.roadmap.map((lesson) => (
              <div
                key={lesson.id}
                className={clsx(
                  "p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all",
                  lesson.id === data.javascript.currentLesson.id
                    ? "border-emerald-500/40 bg-emerald-950/20 shadow-md"
                    : "border-slate-800 bg-slate-950/60"
                )}
              >
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">{lesson.title}</h4>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {lesson.subtopics.slice(0, 4).map((sub) => (
                      <span key={sub} className="px-2 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-800 text-slate-400">
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <button
                    onClick={() => startQuiz("JavaScript", lesson.id)}
                    className="btn btn-ghost btn-xs text-slate-300 hover:text-white border border-slate-800"
                  >
                    Test Lesson
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── TAB 4: INTERACTIVE QUESTION TEST ENGINE ──────────────────────────── */}
      {activeTab === "quiz" && (
        <section className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 p-6 md:p-8 space-y-6 shadow-2xl">
          {quizQuestions.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 space-y-4">
              <p>No questions loaded for this topic.</p>
              <button
                onClick={() => startQuiz(selectedSubject)}
                className="btn btn-primary btn-sm font-bold"
              >
                Load {selectedSubject} Question Bank
              </button>
            </div>
          ) : currentQ ? (
            <div className="space-y-6 animate-fade-in">
              {/* Question Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    {currentQ.subject} · {currentQ.topicName}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                    Level {currentQ.masteryLevel} ({currentQ.difficulty})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                  <span>Question {currentQIndex + 1} of {quizQuestions.length}</span>
                  <span>·</span>
                  <span className="text-amber-400 font-bold">+{currentQ.xpReward} XP</span>
                </div>
              </div>

              {/* Prompt */}
              <div className="space-y-2">
                <h3 className="text-lg md:text-xl font-extrabold text-white leading-relaxed whitespace-pre-line font-mono">
                  {currentQ.prompt}
                </h3>
              </div>

              {/* Options */}
              <div className="space-y-2.5">
                {currentQ.options.map((opt, i) => (
                  <button
                    key={i}
                    disabled={evaluation !== null}
                    onClick={() => setSelectedOption(opt)}
                    className={clsx(
                      "w-full text-left p-4 rounded-xl border text-xs md:text-sm font-semibold transition-all flex items-center justify-between",
                      evaluation !== null && opt === evaluation.correctAnswer
                        ? "border-emerald-500 bg-emerald-950/30 text-emerald-300 font-bold"
                        : evaluation !== null && selectedOption === opt && !evaluation.isCorrect
                        ? "border-rose-500 bg-rose-950/30 text-rose-300"
                        : selectedOption === opt
                        ? "border-blue-500 bg-blue-950/30 text-white font-bold"
                        : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                    )}
                  >
                    <span>{opt}</span>
                    {evaluation !== null && opt === evaluation.correctAnswer && (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    )}
                  </button>
                ))}
              </div>

              {/* Evaluation Feedback Card */}
              {evaluation && (
                <div
                  className={clsx(
                    "p-5 rounded-2xl border space-y-3 animate-fade-in",
                    evaluation.isCorrect
                      ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-200"
                      : "border-rose-500/40 bg-rose-950/20 text-rose-200"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm flex items-center gap-1.5">
                      {evaluation.isCorrect ? "🎉 CORRECT!" : "❌ INCORRECT"}
                    </span>
                    {evaluation.xpAwarded > 0 && (
                      <span className="text-xs font-black text-amber-400 font-mono">
                        +{evaluation.xpAwarded} XP Awarded
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {evaluation.explanation}
                  </p>

                  {evaluation.recommendation && (
                    <div className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-[11px] text-amber-300 font-medium">
                        💡 {evaluation.recommendation}
                      </p>
                      <button
                        onClick={acceptRecommendation}
                        disabled={addingToPlan || Boolean(planAddedMsg)}
                        className="btn btn-primary btn-xs rounded-lg font-bold flex items-center gap-1 shrink-0"
                      >
                        <Plus size={12} /> {planAddedMsg || "Add to Tomorrow's Plan"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between border-t border-slate-800 pt-4">
                <button
                  onClick={() => startQuiz(selectedSubject)}
                  className="btn btn-ghost btn-sm text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <RotateCcw size={13} /> Reset Quiz
                </button>

                <div className="flex items-center gap-3">
                  {evaluation === null ? (
                    <button
                      onClick={submitAnswer}
                      disabled={!selectedOption || evaluating}
                      className="btn btn-primary btn-sm font-bold shadow-lg"
                    >
                      {evaluating ? <LoaderCircle size={14} className="animate-spin" /> : <Play size={14} />}
                      Submit Answer
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedOption(null);
                        setEvaluation(null);
                        setPlanAddedMsg("");
                        if (currentQIndex < quizQuestions.length - 1) {
                          setCurrentQIndex(currentQIndex + 1);
                        } else {
                          setActiveTab("overview");
                        }
                      }}
                      className="btn btn-primary btn-sm font-bold flex items-center gap-1 shadow-lg"
                    >
                      <span>{currentQIndex < quizQuestions.length - 1 ? "Next Question" : "Finish Test"}</span>
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
