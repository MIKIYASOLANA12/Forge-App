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
} from "lucide-react";
import type { QuizQuestionItem } from "@/lib/subjectQuizEngine";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  subjectKey: string;
  topicId: string;
  onQuizCompleted?: () => void;
}

export function TopicQuizModal({
  isOpen,
  onClose,
  subjectKey,
  topicId,
  onQuizCompleted,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [unitTitle, setUnitTitle] = useState("");
  const [topicTitle, setTopicTitle] = useState("");
  const [subtopics, setSubtopics] = useState<string[]>([]);
  const [questions, setQuestions] = useState<QuizQuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<{
    score: number;
    total: number;
    accuracy: number;
    passed: boolean;
    xpEarned: number;
  } | null>(null);

  useEffect(() => {
    if (!isOpen || !subjectKey || !topicId) return;

    const fetchQuiz = async () => {
      setLoading(true);
      setCurrentIndex(0);
      setSelectedAnswers({});
      setIsSubmitted(false);
      setQuizResult(null);

      try {
        const res = await fetch("/api/subjects/quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "GENERATE",
            subject: subjectKey,
            topicId,
            count: 5,
          }),
        });
        const data = await res.json();
        if (data.questions) {
          setQuestions(data.questions);
          setUnitTitle(data.unitTitle || "");
          setTopicTitle(data.topicTitle || "");
          setSubtopics(data.subtopics || []);
        }
      } catch (err) {
        console.error("Failed to load topic quiz:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [isOpen, subjectKey, topicId]);

  if (!isOpen) return null;

  const currentQuestion = questions[currentIndex];
  const allAnswered = questions.length > 0 && Object.keys(selectedAnswers).length === questions.length;

  const handleSelectOption = (option: string) => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentIndex]: option,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!allAnswered || submitting) return;

    setSubmitting(true);
    const answersPayload = questions.map((q, idx) => {
      const userAns = selectedAnswers[idx] || "";
      const isCorrect = userAns.trim() === q.correctAnswer.trim();
      return {
        prompt: q.prompt,
        userAnswer: userAns,
        correctAnswer: q.correctAnswer,
        isCorrect,
        difficulty: q.difficulty,
      };
    });

    try {
      const res = await fetch("/api/subjects/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SUBMIT",
          subject: subjectKey,
          topicId,
          answers: answersPayload,
        }),
      });
      const result = await res.json();
      setQuizResult(result);
      setIsSubmitted(true);

      // Auto-advance topic progress if passed
      if (result.passed) {
        await fetch("/api/subjects/topic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: subjectKey,
            topicId,
            status: "MASTERED",
            accuracy: result.accuracy,
          }),
        });
      } else {
        await fetch("/api/subjects/topic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: subjectKey,
            topicId,
            status: "WEAK",
            accuracy: result.accuracy,
          }),
        });
      }

      if (onQuizCompleted) {
        onQuizCompleted();
      }
    } catch (err) {
      console.error("Error submitting quiz:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Zap size={18} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                {subjectKey} UNDERSTANDING TEST
              </span>
              <h3 className="text-base font-bold text-white leading-snug">
                {topicTitle || "Subject Topic Quiz"}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 size={32} className="text-cyan-400 animate-spin" />
              <p className="text-xs text-slate-400">Generating targeted curriculum questions with AI router...</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No questions generated. Please try again.
            </div>
          ) : (
            <div>
              {/* Question Stepper Indicator */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5">
                  {questions.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentIndex(i)}
                      className={`h-2.5 rounded-full transition-all ${
                        currentIndex === i
                          ? "w-8 bg-cyan-400"
                          : selectedAnswers[i]
                          ? "w-3 bg-emerald-500"
                          : "w-3 bg-slate-700"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Question {currentIndex + 1} of {questions.length}
                </span>
              </div>

              {/* Current Question */}
              {currentQuestion && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-4">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 inline-block mb-2">
                      Difficulty: {currentQuestion.difficulty}
                    </span>
                    <p className="text-sm font-semibold text-white leading-relaxed">
                      {currentQuestion.prompt}
                    </p>
                  </div>

                  {/* Options List */}
                  <div className="space-y-2">
                    {currentQuestion.options.map((opt, idx) => {
                      const isSelected = selectedAnswers[currentIndex] === opt;
                      const isCorrect = opt.trim() === currentQuestion.correctAnswer.trim();

                      let optionStyle =
                        "border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700 hover:bg-slate-900";
                      if (isSelected) {
                        optionStyle =
                          "border-cyan-500 bg-cyan-950/30 text-cyan-200 shadow-inner";
                      }
                      if (isSubmitted) {
                        if (isCorrect) {
                          optionStyle =
                            "border-emerald-500 bg-emerald-950/40 text-emerald-200";
                        } else if (isSelected && !isCorrect) {
                          optionStyle =
                            "border-rose-500 bg-rose-950/40 text-rose-200";
                        }
                      }

                      return (
                        <button
                          key={idx}
                          onClick={() => handleSelectOption(opt)}
                          disabled={isSubmitted}
                          className={`w-full text-left p-3.5 rounded-xl border text-xs font-medium transition flex items-center justify-between ${optionStyle}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-800 border border-slate-700 text-[11px] font-bold">
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span>{opt}</span>
                          </div>
                          {isSubmitted && isCorrect && (
                            <CheckCircle2 size={16} className="text-emerald-400" />
                          )}
                          {isSubmitted && isSelected && !isCorrect && (
                            <XCircle size={16} className="text-rose-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation if submitted */}
                  {isSubmitted && (
                    <div className="mt-4 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-cyan-300 mb-1">
                        <HelpCircle size={14} />
                        Explanation:
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        {currentQuestion.explanation}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Result Banner if submitted */}
              {isSubmitted && quizResult && (
                <div className="mt-4 p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-center">
                  <div className="text-lg font-black text-white flex items-center justify-center gap-2">
                    <Award className="text-emerald-400" size={22} />
                    <span>Score: {quizResult.score} / {quizResult.total} ({quizResult.accuracy}%)</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    {quizResult.passed
                      ? "🎉 Topic Mastered! + " + quizResult.xpEarned + " XP awarded."
                      : "Topic marked as Weak. Review recommended."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Navigation */}
        {!loading && questions.length > 0 && (
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="py-2 px-3 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold disabled:opacity-40"
            >
              Previous
            </button>

            <div className="flex items-center gap-2">
              {currentIndex < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  className="flex items-center gap-1.5 py-2 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition"
                >
                  <span>Next</span>
                  <ArrowRight size={14} />
                </button>
              ) : !isSubmitted ? (
                <button
                  onClick={handleSubmitQuiz}
                  disabled={!allAnswered || submitting}
                  className="flex items-center gap-1.5 py-2 px-4 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-black tracking-wider uppercase transition shadow-md disabled:opacity-40"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>SUBMIT QUIZ</span>
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="py-2 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
