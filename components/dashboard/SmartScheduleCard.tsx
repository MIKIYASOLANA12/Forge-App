"use client";

import Link from "next/link";
import {
  Compass,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  BookOpen,
  Code,
  Dumbbell,
  Moon,
  Sun,
  AlertCircle,
  Calendar,
  Zap,
} from "lucide-react";
import type { SmartScheduleStatus } from "@/lib/smartSchedule";

interface Props {
  schedule: SmartScheduleStatus | null;
  onQuickCompleteTask?: (taskId: string) => void;
}

export function SmartScheduleCard({ schedule, onQuickCompleteTask }: Props) {
  if (!schedule) return null;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "WAKE":
        return <Sun className="text-amber-400" size={20} />;
      case "STUDY":
        return <BookOpen className="text-blue-400" size={20} />;
      case "CODING":
        return <Code className="text-cyan-400" size={20} />;
      case "WORKOUT":
        return <Dumbbell className="text-orange-400" size={20} />;
      case "READING":
        return <BookOpen className="text-purple-400" size={20} />;
      case "CLOSE":
        return <AlertCircle className="text-rose-400" size={20} />;
      case "WIND_DOWN":
      case "SLEEP":
        return <Moon className="text-indigo-400" size={20} />;
      default:
        return <Compass className="text-amber-400" size={20} />;
    }
  };

  const getBadgeStyle = (category: string) => {
    switch (category) {
      case "STUDY":
        return "bg-blue-500/15 text-blue-300 border-blue-500/30";
      case "CODING":
        return "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
      case "WORKOUT":
        return "bg-orange-500/15 text-orange-300 border-orange-500/30";
      case "CLOSE":
        return "bg-rose-500/15 text-rose-300 border-rose-500/30 animate-pulse";
      case "WIND_DOWN":
      case "SLEEP":
        return "bg-indigo-500/15 text-indigo-300 border-indigo-500/30";
      default:
        return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    }
  };

  const current = schedule.currentActivity;
  const next = schedule.nextActivity;
  const laterList = schedule.laterToday || [];

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--border-active)] bg-gradient-to-br from-slate-900/95 via-[var(--bg-surface)] to-slate-950 p-5 sm:p-6 shadow-2xl">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.08),transparent_70%)] pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-5">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-[var(--xp-gold)]">
              <Compass size={16} />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
              DAILY PRODUCTIVITY COACH · ADDIS ABABA ({schedule.addisTimeFormatted})
            </span>
          </div>

          <div className="flex items-center gap-2">
            {schedule.ethiopianTimeFormatted && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/25 text-amber-300">
                🇪🇹 {schedule.ethiopianTimeFormatted}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border ${getBadgeStyle(
                schedule.currentActivityCategory
              )}`}
            >
              {schedule.currentActivityCategory}
            </span>
          </div>
        </div>

        {/* ── SECTION 1: CURRENTLY ─────────────────────────────── */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-400">
              <Zap size={14} />
              <span>CURRENTLY</span>
            </div>
            {current?.minutesRemaining && !current.isCompleted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                <Clock size={12} />
                <span>{current.minutesRemaining} min remaining</span>
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 border border-slate-700/70 shadow-md">
                {getCategoryIcon(schedule.currentActivityCategory)}
              </div>

              <div>
                <h2 className="text-lg sm:text-xl font-black text-[var(--text-primary)] tracking-tight">
                  {schedule.currentActivityTitle}
                </h2>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 max-w-xl leading-relaxed">
                  {schedule.statusMessage}
                </p>
              </div>
            </div>

            {/* Quick Completion Button */}
            {schedule.suggestedAction && (
              <div className="w-full sm:w-auto shrink-0">
                {schedule.suggestedAction.taskId && onQuickCompleteTask ? (
                  <button
                    onClick={() => onQuickCompleteTask(schedule.suggestedAction!.taskId!)}
                    className="btn btn-primary w-full sm:w-auto font-bold flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] transition-transform"
                  >
                    <CheckCircle2 size={16} />
                    <span>{schedule.suggestedAction.label}</span>
                  </button>
                ) : (
                  <Link
                    href={schedule.suggestedAction.href}
                    className="btn btn-primary w-full sm:w-auto font-bold flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] transition-transform"
                  >
                    <span>{schedule.suggestedAction.label}</span>
                    <ArrowRight size={16} />
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Afterward Prompt / Finish Check-in */}
          {schedule.afterwardPrompt && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs">
              <div className="flex items-center gap-2 text-amber-200">
                <Sparkles size={14} className="text-amber-400 shrink-0" />
                <span className="font-semibold">{schedule.afterwardPrompt.question}</span>
              </div>

              {schedule.afterwardPrompt.taskId && onQuickCompleteTask ? (
                <button
                  onClick={() => onQuickCompleteTask(schedule.afterwardPrompt!.taskId!)}
                  className="btn btn-sm btn-outline border-amber-500/40 text-amber-300 hover:bg-amber-500/20 font-bold"
                >
                  Yes, Mark Complete ✓
                </button>
              ) : (
                <Link
                  href="/workout"
                  className="btn btn-sm btn-outline border-amber-500/40 text-amber-300 hover:bg-amber-500/20 font-bold"
                >
                  Log Result →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* ── SECTION 2 & 3: NEXT & LATER TODAY ─────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* NEXT ACTIVITY */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-cyan-400 mb-2">
              <ArrowRight size={14} />
              <span>NEXT ACTIVITY</span>
            </div>

            {next ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm sm:text-base font-bold text-slate-100">
                    {next.title}
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    {next.startTimeFormatted}
                  </span>
                </div>
                {next.minutesUntilStart > 0 && (
                  <p className="text-xs text-slate-400">
                    Starts in <span className="font-semibold text-slate-200">{next.minutesUntilStart} min</span>
                    {next.gapMinutes > 15 ? ` · ${next.gapMinutes} min gap window` : ""}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                You’re done with all planned tasks for today!
              </p>
            )}
          </div>

          {/* LATER TODAY */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-purple-400">
                <Calendar size={14} />
                <span>LATER TODAY</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {schedule.dayProgression.completedCount}/{schedule.dayProgression.totalCount} completed ({schedule.dayProgression.percentage}%)
              </span>
            </div>

            {laterList.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {laterList.slice(0, 3).map((item, idx) => (
                  <div key={item.id || idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/50 last:border-0">
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className="text-slate-500 font-mono text-[10px]">#{idx + 1}</span>
                      <span className={`truncate ${item.isCompleted ? "line-through text-slate-500" : "text-slate-300 font-medium"}`}>
                        {item.title}
                      </span>
                    </div>
                    <span className="font-mono text-slate-400 text-[11px] shrink-0">
                      {item.startTimeFormatted}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                No further scheduled activities remaining for today.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
