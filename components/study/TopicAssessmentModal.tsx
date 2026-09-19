"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  CheckCircle2,
  XCircle,
  Award,
  Zap,
  HelpCircle,
  Loader2,
  ArrowRight,
  RotateCcw,
  Sparkles,
  FileText,
  Clock,
  Target,
  BookOpen,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { clsx } from "clsx";
import type {
  AssessmentQuestion,
  AssessmentSessionState,
  AssessmentAnswerResult,
} from "@/lib/studyAssessmentEngine";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  subjectKey?: string;
  topicId?: string;
  initialSession?: AssessmentSessionState | null;
  onAssessmentCompleted?: (result: {
    score: number;
    total: number;
    accuracy: number;
    passed: boolean;
    status: string;
    xpEarned: number;
  }) => void;
}

const STORAGE_KEY_ACTIVE_SESSION = "forge_active_assessment_session_id";

export function TopicAssessmentModal({
  isOpen,
  onClose,
  subjectKey,
  topicId,
  initialSession,
  onAssessmentCompleted,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<AssessmentSessionState | null>(null);
  const [currentInput, setCurrentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<AssessmentAnswerResult | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [finalSummary, setFinalSummary] = useState<{
    score: number;
    total: number;
    accuracy: number;
    status: string;
    xpEarned: number;
    weakConcepts: string[];
    strongConcepts: string[];
  } | null>(null);

  // Initialize or resume assessment session
  useEffect(() => {
    if (!isOpen) return;

    if (initialSession) {
      setSession(initialSession);
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVE_SESSION, initialSession.id);
      } catch {}
      setStartTime(Date.now());
      setLastResult(null);
      setFinalSummary(null);
      return;
    }

    const initSession = async () => {
      setLoading(true);
      setLastResult(null);
      setFinalSummary(null);

      // Check if there is an existing session in localStorage
      let savedSessionId: string | null = null;
      try {
        savedSessionId = localStorage.getItem(STORAGE_KEY_ACTIVE_SESSION);
      } catch {}

      try {
        if (savedSessionId) {
          const res = await fetch(`/api/study/assessment?sessionId=${savedSessionId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.session && data.session.status === "IN_PROGRESS") {
              // If matching subject/topic or generic resume
              if (!topicId || data.session.topicId === topicId) {
                setSession(data.session);
                setStartTime(Date.now());
                setLoading(false);
                return;
              }
            }
          }
        }

        // Create fresh session if not resumed
        if (subjectKey && topicId) {
          const res = await fetch("/api/study/assessment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "START",
              subject: subjectKey,
              topicId,
              count: 40,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.session) {
              setSession(data.session);
              try {
                localStorage.setItem(STORAGE_KEY_ACTIVE_SESSION, data.session.id);
              } catch {}
              setStartTime(Date.now());
            }
          }
        }
      } catch (err) {
        console.error("Failed to initialize assessment session:", err);
      } finally {
        setLoading(false);
      }
    };

    void initSession();
  }, [isOpen, subjectKey, topicId, initialSession]);

  if (!isOpen) return null;

  const currentIdx = session?.currentIndex ?? 0;
  const currentQuestion: AssessmentQuestion | undefined = session?.questions[currentIdx];
  const totalQuestions = session?.questionCount || 40;
  const progressPercent = totalQuestions > 0 ? Math.round(((currentIdx) / totalQuestions) * 100) : 0;

  const handleSubmitAnswer = async (selectedOption?: string) => {
    if (!session || !currentQuestion || submitting || lastResult) return;

    const answerToSend = (selectedOption ?? currentInput).trim();
    if (!answerToSend) return;

    setSubmitting(true);
    const timeTakenSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));

    try {
      const res = await fetch("/api/study/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ANSWER",
          sessionId: session.id,
          questionId: currentQuestion.id,
          userAnswer: answerToSend,
          timeTakenSec,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setLastResult(data.result);
        setSession(data.session);

        if (data.isSessionCompleted) {
          try {
            localStorage.removeItem(STORAGE_KEY_ACTIVE_SESSION);
          } catch {}
          setFinalSummary({
            score: data.session.score,
            total: data.session.questionCount,
            accuracy: data.session.accuracy,
            status: data.masteryUpdate?.status || "STUDIED",
            xpEarned: data.session.xpEarned,
            weakConcepts: data.session.weakConcepts || [],
            strongConcepts: data.session.strongConcepts || [],
          });
          if (onAssessmentCompleted) {
            onAssessmentCompleted({
              score: data.session.score,
              total: data.session.questionCount,
              accuracy: data.session.accuracy,
              passed: data.masteryUpdate?.passed ?? (data.session.accuracy >= 75),
              status: data.masteryUpdate?.status || "STUDIED",
              xpEarned: data.session.xpEarned,
            });
          }
        }
      }
    } catch (err) {
      console.error("Failed to submit assessment answer:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextQuestion = () => {
    setLastResult(null);
    setCurrentInput("");
    setStartTime(Date.now());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-black font-black shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  {session?.subject || subjectKey || "CHEMISTRY"}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs font-medium text-slate-400 truncate">
                  {session?.unitTitle || "Unit Assessment"}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 truncate">
                {session?.topicTitle || "Comprehensive Topic Assessment"}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Strip */}
        <div className="px-5 py-2 bg-slate-950 border-b border-slate-800/60 flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-400">
              Question {Math.min(totalQuestions, currentIdx + 1)}
            </span>
            <span>/</span>
            <span>{totalQuestions}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-32 sm:w-48 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="font-semibold text-slate-300">{progressPercent}%</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col justify-between">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
              <p className="text-sm font-medium text-slate-300">
                Generating 40 rigorous topic-specific assessment questions...
              </p>
            </div>
          ) : finalSummary ? (
            /* Final Summary View */
            <div className="flex flex-col items-center justify-center py-6 text-center gap-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-amber-500 text-black shadow-xl">
                <Award className="w-10 h-10" />
              </div>

              <div>
                <span className="text-xs font-bold tracking-widest uppercase text-emerald-400">
                  ASSESSMENT COMPLETED
                </span>
                <h3 className="text-2xl font-black text-white mt-1">
                  Topic Mastery: {finalSummary.status}
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  You scored {finalSummary.score} out of {finalSummary.total} questions ({finalSummary.accuracy}% accuracy).
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3 w-full max-w-lg">
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
                  <div className="text-xs text-slate-400">Accuracy</div>
                  <div className="text-2xl font-black text-amber-400 mt-1">{finalSummary.accuracy}%</div>
                </div>
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
                  <div className="text-xs text-slate-400">XP Earned</div>
                  <div className="text-2xl font-black text-emerald-400 mt-1">+{finalSummary.xpEarned}</div>
                </div>
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
                  <div className="text-xs text-slate-400">Status</div>
                  <div className="text-sm font-black text-cyan-400 mt-2">{finalSummary.status}</div>
                </div>
              </div>

              {/* Weak Concepts Insights */}
              {finalSummary.weakConcepts.length > 0 && (
                <div className="w-full max-w-lg text-left p-4 rounded-xl border border-rose-500/20 bg-rose-950/20">
                  <div className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" /> Targeted Reinforcement Areas:
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-slate-300 list-disc list-inside">
                    {finalSummary.weakConcepts.slice(0, 4).map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full max-w-md py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black shadow-lg transition-all transform active:scale-95"
              >
                Continue Curriculum Roadmap
              </button>
            </div>
          ) : currentQuestion ? (
            /* Question Active View */
            <div className="flex flex-col gap-5">
              {/* Badges Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border border-slate-700 bg-slate-800 text-slate-300">
                  {currentQuestion.type.replace(/_/g, " ")}
                </span>
                <span
                  className={clsx(
                    "px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border",
                    currentQuestion.difficulty === "entrance"
                      ? "border-rose-500/30 bg-rose-950/30 text-rose-400"
                      : currentQuestion.difficulty === "hard"
                      ? "border-orange-500/30 bg-orange-950/30 text-orange-400"
                      : "border-emerald-500/30 bg-emerald-950/30 text-emerald-400"
                  )}
                >
                  {currentQuestion.difficulty}
                </span>
                <span
                  className={clsx(
                    "px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border",
                    currentQuestion.sourceType === "PAST_PAPER"
                      ? "border-amber-500/30 bg-amber-950/30 text-amber-400"
                      : "border-indigo-500/30 bg-indigo-950/30 text-indigo-400"
                  )}
                >
                  {currentQuestion.sourceType === "PAST_PAPER" ? "PAST PAPER" : "AI GENERATED"}
                </span>
                {currentQuestion.subtopic && (
                  <span className="text-xs text-slate-400 truncate max-w-xs ml-auto">
                    Subtopic: {currentQuestion.subtopic}
                  </span>
                )}
              </div>

              {/* Prompt */}
              <div className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 whitespace-pre-wrap">
                {currentQuestion.prompt}
              </div>

              {/* Options or Input */}
              {currentQuestion.options && currentQuestion.options.length > 0 ? (
                <div className="grid grid-cols-1 gap-2.5">
                  {currentQuestion.options.map((option, idx) => {
                    const isSelected = currentInput === option;
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={Boolean(lastResult) || submitting}
                        onClick={() => {
                          setCurrentInput(option);
                          void handleSubmitAnswer(option);
                        }}
                        className={clsx(
                          "w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-start gap-3 text-sm font-medium",
                          lastResult
                            ? option.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase()
                              ? "border-emerald-500/60 bg-emerald-950/30 text-emerald-300 font-bold"
                              : isSelected
                              ? "border-rose-500/60 bg-rose-950/30 text-rose-300"
                              : "border-slate-800 bg-slate-950/40 opacity-40"
                            : isSelected
                            ? "border-amber-500 bg-amber-950/30 text-white shadow-md"
                            : "border-slate-800 bg-slate-900/50 text-slate-200 hover:border-slate-700 hover:bg-slate-800/60"
                        )}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-slate-300">
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="flex-1 mt-0.5">{option}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Free text / numerical calculation input */
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      disabled={Boolean(lastResult) || submitting}
                      value={currentInput}
                      onChange={(e) => setCurrentInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void handleSubmitAnswer()}
                      placeholder="Enter numerical value or formula answer..."
                      className="flex-1 px-4 py-3 rounded-xl border border-slate-700 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm font-mono"
                    />
                    <button
                      type="button"
                      disabled={!currentInput.trim() || Boolean(lastResult) || submitting}
                      onClick={() => void handleSubmitAnswer()}
                      className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold text-sm transition-all"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
                    </button>
                  </div>
                </div>
              )}

              {/* Feedback Banner on Submit */}
              {lastResult && (
                <div
                  className={clsx(
                    "p-4 rounded-xl border animate-in fade-in slide-in-from-bottom-2 duration-200",
                    lastResult.isCorrect
                      ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-300"
                      : "border-rose-500/40 bg-rose-950/30 text-rose-300"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      {lastResult.isCorrect ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <span>Correct! (+{lastResult.xpAwarded} XP)</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 text-rose-400" />
                          <span>Incorrect</span>
                        </>
                      )}
                    </div>
                    {!lastResult.isCorrect && (
                      <span className="text-xs font-mono bg-slate-900 px-2 py-1 rounded border border-slate-700 text-slate-300">
                        Correct: {lastResult.correctAnswer}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {lastResult.explanation}
                  </p>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleNextQuestion}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-xs hover:from-amber-400 hover:to-orange-400 transition-all shadow-md"
                    >
                      <span>Next Question</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400">
              No questions found for this topic.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
