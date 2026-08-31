"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Check,
  Clock3,
  Play,
  CheckCircle2,
  Lock,
  ArrowRight,
  BookOpen,
  Code2,
  Dumbbell,
  FlaskConical,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Target,
  Flame,
  Award
} from "lucide-react";
import { clsx } from "clsx";
import { parsePlanMetadata, PlanMetadata } from "@/lib/planParser";

export interface PlanTaskCardProps {
  task: {
    id: string;
    description?: string;
    domain?: { name: string; color?: string; icon?: string } | null;
    minutesTarget?: number | null;
    completed?: boolean;
    priority?: string | null;
    xpTarget?: number | null;
    isEntrancePriority?: boolean;
    isLocked?: boolean;
    subtopics?: string[];
  };
  index?: number;
  isDone?: boolean;
  onToggle?: (id: string) => void;
  onStartFocus?: (task: any) => void;
  compact?: boolean;
}

export function PlanTaskCard({
  task,
  index,
  isDone = false,
  onToggle,
  onStartFocus,
  compact = false,
}: PlanTaskCardProps) {
  const [expanded, setExpanded] = useState(true);
  const meta: PlanMetadata = parsePlanMetadata(task.description, task);

  const accentColor = task.domain?.color || (
    meta.category === 'CODING' ? '#06b6d4' :
    meta.category === 'CHEMISTRY' ? '#3b82f6' :
    meta.category === 'WORKOUT' ? '#f97316' :
    meta.category === 'READING' ? '#a855f7' : '#eab308'
  );

  const xpAmount = task.xpTarget || meta.xpTarget || Math.round((task.minutesTarget || meta.targetMinutes || 30) * 1.2);

  return (
    <article
      className={clsx(
        "group relative rounded-2xl border transition-all overflow-hidden",
        isDone
          ? "border-emerald-500/30 bg-emerald-950/10 opacity-75"
          : task.isLocked
          ? "border-rose-500/25 bg-rose-950/10 opacity-80"
          : "border-[var(--border)] bg-gradient-to-b from-[var(--bg-surface)] to-[var(--bg-elevated)] hover:border-slate-700 shadow-md"
      )}
    >
      {/* Top Accent Stripe */}
      <div
        className="h-1 w-full"
        style={{
          backgroundColor: isDone ? "#10b981" : accentColor,
        }}
      />

      <div className="p-4 sm:p-5 flex flex-col gap-4">
        {/* Header Bar */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {/* Checkbox */}
            <button
              type="button"
              aria-label={isDone ? `Mark incomplete: ${meta.displayTitle}` : `Complete: ${meta.displayTitle}`}
              disabled={task.isLocked}
              onClick={() => onToggle && onToggle(task.id)}
              className={clsx(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 transition-all cursor-pointer",
                isDone
                  ? "border-emerald-500 bg-emerald-500 text-black shadow-sm font-bold"
                  : task.isLocked
                  ? "border-rose-500/40 bg-rose-950/40 text-rose-500 cursor-not-allowed"
                  : "border-slate-600 hover:border-orange-500 bg-slate-900 text-transparent"
              )}
            >
              {isDone ? (
                <Check size={16} strokeWidth={3.5} className="text-black" />
              ) : task.isLocked ? (
                <Lock size={12} className="text-rose-400" />
              ) : (
                <Check size={14} className="group-hover:text-slate-500" />
              )}
            </button>

            {/* Category / Card Title Header */}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {typeof index === "number" && (
                  <span className="font-mono text-xs font-bold text-slate-500">
                    {String(index + 1).padStart(2, "0")} /
                  </span>
                )}
                <span
                  className="text-xs font-black tracking-wider uppercase"
                  style={{ color: isDone ? "#34d399" : accentColor }}
                >
                  {meta.headerTitle}
                </span>

                {meta.isEntrancePriority && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    🎯 Entrance Priority
                  </span>
                )}

                {task.priority && (
                  <span
                    className={clsx(
                      "px-2 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider",
                      task.priority === "HIGH"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-slate-800 text-slate-400"
                    )}
                  >
                    {task.priority}
                  </span>
                )}
              </div>

              <h3
                className={clsx(
                  "mt-1 text-base font-bold leading-snug",
                  isDone
                    ? "line-through text-slate-400"
                    : "text-white"
                )}
              >
                {meta.displayTitle}
              </h3>
            </div>
          </div>

          {/* Quick Actions & Minutes Badge */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800/90 border border-slate-700 text-slate-300">
              <Clock3 size={13} className="text-slate-400" />
              <span>{task.minutesTarget || meta.targetMinutes} min</span>
            </span>

            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-amber-500/10 border border-amber-500/25 text-amber-300">
              <Award size={12} />
              <span>+{xpAmount} XP</span>
            </span>

            {onStartFocus && !isDone && (
              <button
                type="button"
                aria-label={`Start focus session for ${meta.displayTitle}`}
                onClick={() => onStartFocus(task)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-orange-400 transition-colors"
                title="Start Focus Timer"
              >
                <Play size={14} fill="currentColor" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              title={expanded ? "Collapse details" : "Expand details"}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* ── CARD CONTENT BODY (Structured by Category) ── */}
        {expanded && (
          <div className="space-y-3.5 pt-1 text-xs border-t border-slate-800/60">
            {/* 1. CODING CARD SPECIFICATION */}
            {meta.category === "CODING" && (
              <div className="space-y-3">
                {meta.module && (
                  <div>
                    <span className="font-extrabold uppercase tracking-wider text-slate-400 block text-[11px]">
                      Module:
                    </span>
                    <span className="text-slate-200 font-semibold text-sm">
                      {meta.module}
                    </span>
                  </div>
                )}

                {meta.mainTopic && (
                  <div>
                    <span className="font-extrabold uppercase tracking-wider text-slate-400 block text-[11px]">
                      Main topic:
                    </span>
                    <span className="text-cyan-300 font-bold text-sm">
                      {meta.mainTopic}
                    </span>
                  </div>
                )}

                {meta.subtopics && meta.subtopics.length > 0 && (
                  <div>
                    <span className="font-extrabold uppercase tracking-wider text-slate-400 block text-[11px] mb-1.5">
                      Today&apos;s topics:
                    </span>
                    <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-3">
                      <ul className="space-y-1.5">
                        {meta.subtopics.map((st, idx) => {
                          const isQuiz = st.toLowerCase().includes("quiz:");
                          return (
                            <li key={idx} className="flex items-start gap-2 text-slate-300">
                              <span className={isQuiz ? "text-amber-400 font-bold" : "text-cyan-400 font-bold"}>
                                •
                              </span>
                              <span className={isQuiz ? "text-amber-200 font-medium" : "text-slate-300"}>
                                {st}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                )}

                {meta.learningTarget && (
                  <div className="rounded-xl bg-cyan-950/20 border border-cyan-500/25 p-3">
                    <span className="font-black uppercase tracking-wider text-cyan-400 block text-[10px] mb-1">
                      Learning target:
                    </span>
                    <p className="text-slate-200 leading-relaxed font-medium">
                      {meta.learningTarget}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <div className="text-slate-400">
                    <span className="font-bold text-slate-300">Target:</span> {task.minutesTarget || meta.targetMinutes} min
                  </div>
                  <Link
                    href="/todo"
                    className="text-cyan-400 hover:text-cyan-300 font-bold inline-flex items-center gap-1 underline text-xs"
                  >
                    Open Coding Syllabus <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            )}

            {/* 2. CHEMISTRY CARD SPECIFICATION */}
            {meta.category === "CHEMISTRY" && (
              <div className="space-y-3">
                {meta.topic && (
                  <div>
                    <span className="font-extrabold uppercase tracking-wider text-slate-400 block text-[11px]">
                      Topic:
                    </span>
                    <span className="text-blue-300 font-bold text-sm">
                      {meta.topic}
                    </span>
                  </div>
                )}

                {meta.subtopics && meta.subtopics.length > 0 && (
                  <div>
                    <span className="font-extrabold uppercase tracking-wider text-slate-400 block text-[11px] mb-1.5">
                      Today&apos;s topics:
                    </span>
                    <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-3">
                      <ul className="space-y-1.5">
                        {meta.subtopics.map((st, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-slate-300">
                            <span className="text-blue-400 font-bold">•</span>
                            <span>{st}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {meta.practiceTarget && (
                  <div>
                    <span className="font-extrabold uppercase tracking-wider text-slate-400 block text-[11px]">
                      Practice:
                    </span>
                    <span className="text-slate-200 font-medium">
                      {meta.practiceTarget}
                    </span>
                  </div>
                )}

                {meta.reviewTarget && (
                  <div>
                    <span className="font-extrabold uppercase tracking-wider text-slate-400 block text-[11px]">
                      Review:
                    </span>
                    <span className="text-slate-200 font-medium">
                      {meta.reviewTarget}
                    </span>
                  </div>
                )}

                {meta.sessionBreakdown && (
                  <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 space-y-1.5">
                    <span className="font-black uppercase tracking-wider text-blue-400 block text-[10px] mb-1">
                      Study session:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-300">
                      {meta.sessionBreakdown.learnMins ? (
                        <div>Learn: <span className="font-bold text-white">{meta.sessionBreakdown.learnMins} min</span></div>
                      ) : null}
                      {meta.sessionBreakdown.activeRecallMins ? (
                        <div>Active Recall: <span className="font-bold text-white">{meta.sessionBreakdown.activeRecallMins} min</span></div>
                      ) : null}
                      {meta.sessionBreakdown.flashcardsMins ? (
                        <div>Flashcards: <span className="font-bold text-white">{meta.sessionBreakdown.flashcardsMins} min</span></div>
                      ) : null}
                      {meta.sessionBreakdown.practiceMins ? (
                        <div>Practice: <span className="font-bold text-white">{meta.sessionBreakdown.practiceMins} min</span></div>
                      ) : null}
                      {meta.sessionBreakdown.oldTopicRecallMins ? (
                        <div>Old Topic Recall: <span className="font-bold text-white">{meta.sessionBreakdown.oldTopicRecallMins} min</span></div>
                      ) : null}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <div className="text-slate-400">
                    <span className="font-bold text-slate-300">Total:</span> {task.minutesTarget || meta.targetMinutes} min
                  </div>
                  <Link
                    href="/learn"
                    className="text-blue-400 hover:text-blue-300 font-bold inline-flex items-center gap-1 underline text-xs"
                  >
                    Open Chemistry Roadmap <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            )}

            {/* 3. WORKOUT CARD SPECIFICATION */}
            {meta.category === "WORKOUT" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-extrabold uppercase tracking-wider text-slate-400 block text-[11px]">
                      Daily Workout Protocol:
                    </span>
                    <span className="text-orange-400 font-extrabold text-sm">
                      {meta.workoutType || "Pull"}
                    </span>
                  </div>

                  <div>
                    <span className="font-extrabold uppercase tracking-wider text-slate-400 block text-[11px]">
                      Location:
                    </span>
                    <span className="text-slate-200 font-bold text-sm">
                      {meta.workoutLocation || "GYM"}
                    </span>
                  </div>
                </div>

                {meta.workoutExercises && meta.workoutExercises.length > 0 && (
                  <div>
                    <span className="font-extrabold uppercase tracking-wider text-slate-400 block text-[11px] mb-1.5">
                      Today&apos;s exercises:
                    </span>
                    <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-3">
                      <ul className="space-y-1.5">
                        {meta.workoutExercises.map((ex, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-slate-300">
                            <span className="text-orange-400 font-bold">•</span>
                            <span>{ex}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <div className="text-slate-400">
                    <span className="font-bold text-slate-300">Target:</span> {task.minutesTarget || meta.targetMinutes} min
                  </div>
                  <Link
                    href="/workout"
                    className="text-orange-400 hover:text-orange-300 font-bold inline-flex items-center gap-1 underline text-xs"
                  >
                    Open Live Workout Tracker <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            )}

            {/* 4. READING CARD SPECIFICATION */}
            {meta.category === "READING" && (
              <div className="space-y-3">
                <div>
                  <span className="font-extrabold uppercase tracking-wider text-slate-400 block text-[11px]">
                    Book:
                  </span>
                  <span className="text-purple-300 font-bold text-sm">
                    {meta.bookTitle || "How to Win Friends and Influence People"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-extrabold uppercase tracking-wider text-slate-400 block text-[11px]">
                      Today&apos;s pages:
                    </span>
                    <span className="text-slate-200 font-bold text-sm">
                      {meta.pagesTarget || "1–11"}
                    </span>
                  </div>

                  <div>
                    <span className="font-extrabold uppercase tracking-wider text-slate-400 block text-[11px]">
                      Target:
                    </span>
                    <span className="text-purple-300 font-bold text-sm">
                      {meta.pagesCount ? `${meta.pagesCount} pages` : "11 pages"} ({task.minutesTarget || meta.targetMinutes} min)
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-slate-400 text-xs">
                    Tick the box above once you finish today&apos;s reading pages.
                  </div>
                  <Link
                    href="/reading"
                    className="text-purple-400 hover:text-purple-300 font-bold inline-flex items-center gap-1 underline text-xs"
                  >
                    Reading OS & Reflections <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            )}

            {/* 5. GENERAL / OTHER STUDY TASKS */}
            {meta.category !== "CODING" && meta.category !== "CHEMISTRY" && meta.category !== "WORKOUT" && meta.category !== "READING" && (
              <div className="space-y-2">
                {meta.topic && meta.topic !== meta.displayTitle && (
                  <div>
                    <span className="font-extrabold uppercase tracking-wider text-slate-400 block text-[11px]">
                      Topic:
                    </span>
                    <span className="text-slate-200 font-medium">
                      {meta.topic}
                    </span>
                  </div>
                )}

                {meta.subtopics && meta.subtopics.length > 0 && (
                  <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-3">
                    <ul className="space-y-1">
                      {meta.subtopics.map((st, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-slate-300">
                          <span className="text-yellow-400 font-bold">•</span>
                          <span>{st}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <div className="text-slate-400">
                    <span className="font-bold text-slate-300">Target:</span> {task.minutesTarget || meta.targetMinutes} min
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
