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
        return <Sun className="text-amber-400" size={22} />;
      case "STUDY":
        return <BookOpen className="text-blue-400" size={22} />;
      case "CODING":
        return <Code className="text-cyan-400" size={22} />;
      case "WORKOUT":
        return <Dumbbell className="text-orange-400" size={22} />;
      case "READING":
        return <BookOpen className="text-purple-400" size={22} />;
      case "CLOSE":
        return <AlertCircle className="text-rose-400" size={22} />;
      case "WIND_DOWN":
      case "SLEEP":
        return <Moon className="text-indigo-400" size={22} />;
      default:
        return <Compass className="text-amber-400" size={22} />;
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

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--border-active)] bg-gradient-to-br from-slate-900/90 via-[var(--bg-surface)] to-slate-950 p-5 sm:p-6 shadow-2xl">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.08),transparent_70%)] pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-4">
        {/* Header Label */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-[var(--xp-gold)]">
              <Compass size={16} />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
              LIVE FOCUS · WHAT SHOULD I DO NOW?
            </span>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border ${getBadgeStyle(
              schedule.currentActivityCategory
            )}`}
          >
            {schedule.currentActivityCategory}
          </span>
        </div>

        {/* Main Current Action Callout */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700/60 shadow-md">
              {getCategoryIcon(schedule.currentActivityCategory)}
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
                {schedule.currentActivityTitle}
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 max-w-xl leading-relaxed">
                {schedule.statusMessage}
              </p>
            </div>
          </div>

          {/* Action CTA */}
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

        {/* Afterward Prompt / Action Question (Spec requirement: Planned -> Current -> Afterward) */}
        {schedule.afterwardPrompt && (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs">
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

        {/* Next Upcoming Preview */}
        {schedule.upcomingNext && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 font-medium">
              <Clock size={13} className="text-slate-500" />
              <span>Next: {schedule.upcomingNext.title}</span>
            </div>
            <span className="font-mono font-semibold text-slate-300">
              {schedule.upcomingNext.timeFormatted}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
