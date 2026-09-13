"use client";

import { useMemo } from "react";
import { Target, Calendar, Sparkles, AlertTriangle, CheckCircle2, ChevronRight, Flag } from "lucide-react";
import type { GoalYearStatus } from "@/lib/ethiopianCalendar";
import { getGoalYearStatus } from "@/lib/ethiopianCalendar";

interface Props {
  goalYear?: GoalYearStatus | null;
}

export function EthiopianGoalYearCard({ goalYear: initialGoalYear }: Props) {
  // Use server-provided goal status or compute synchronously on client to prevent layout pop
  const goal = useMemo(() => {
    return initialGoalYear || getGoalYearStatus();
  }, [initialGoalYear]);

  const {
    fixedGoalYearLabel,
    fixedGoalYearAmharic,
    currentEthiopianDate,
    currentEthiopianYearLabel,
    isGoalYearActive,
    hasGoalYearEnded,
    statusNotice,
    examTargetGregorian,
    examTargetEthiopian,
    examTargetEthiopianAmharic,
    examDaysRemaining,
    examCountdownStatus,
    examCountdownBadge,
    goalYearProgressPercent,
    goalYearDaysElapsed,
    goalYearTotalDays,
    goalYearStartGregorian,
    goalYearEndGregorian,
    motto,
  } = goal;

  const isExamToday = examCountdownStatus === "TODAY";
  const isExamCompleted = examCountdownStatus === "COMPLETED";

  return (
    <section className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-slate-900/90 to-slate-950 p-5 sm:p-7 shadow-2xl backdrop-blur-xl">
      {/* Decorative Ethiopian Accent Glows */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" />

      {/* ── TOP HEADER BAR ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 via-amber-500/20 to-red-500/20 border border-emerald-500/40 text-lg shadow-inner">
            🇪🇹
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                FORGE {fixedGoalYearLabel} GOAL
              </h2>
              <span className="hidden sm:inline text-xs text-emerald-400/80 font-mono">
                ({fixedGoalYearAmharic})
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>Current Date:</span>
              <span className="font-semibold text-slate-200">
                {currentEthiopianDate.formattedEnglish}
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400 font-mono text-[11px]">
                {currentEthiopianDate.formattedAmharic}
              </span>
            </p>
          </div>
        </div>

        {/* Dynamic Status Badge */}
        <div>
          {hasGoalYearEnded ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/15 text-rose-300 border border-rose-500/40 shadow-sm animate-pulse">
              <AlertTriangle size={13} />
              {statusNotice || `${fixedGoalYearLabel} GOAL YEAR HAS ENDED`}
            </span>
          ) : isGoalYearActive ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-sm">
              <Sparkles size={13} className="text-emerald-400" />
              ACTIVE GOAL YEAR
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
              TARGET YEAR: {fixedGoalYearLabel}
            </span>
          )}
        </div>
      </div>

      {/* ── CORE STATS GRID ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left Column: Fixed Target Year vs Current Ethiopian Year */}
        <div className="md:col-span-4 flex flex-col justify-between gap-3 rounded-2xl bg-slate-900/70 border border-slate-800/90 p-4 shadow-md">
          <div className="space-y-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                CURRENT ETHIOPIAN YEAR
              </div>
              <div className="text-2xl font-black text-slate-100 mt-0.5 tracking-tight flex items-baseline gap-2">
                {currentEthiopianYearLabel}
                <span className="text-xs font-normal text-slate-400">
                  ({currentEthiopianDate.monthNameEnglish} {currentEthiopianDate.ethDay})
                </span>
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-800/80">
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center justify-between">
                <span>GOAL YEAR (FIXED ANCHOR)</span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                  IMMUTABLE
                </span>
              </div>
              <div className="text-2xl font-black text-emerald-300 mt-0.5 tracking-tight">
                {fixedGoalYearLabel}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                Target anchor remains {fixedGoalYearLabel} permanently regardless of calendar transitions.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-950/60 border border-slate-800/70 p-2.5 text-[11px] text-slate-300">
            <span className="text-emerald-400 font-bold block mb-0.5">🎯 Goal Hierarchy:</span>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
              <span className="text-emerald-300 font-semibold">{fixedGoalYearLabel}</span>
              <ChevronRight size={11} className="text-slate-500" />
              <span>{examTargetEthiopian}</span>
              <ChevronRight size={11} className="text-slate-500" />
              <span className="text-blue-300 font-semibold">Exam</span>
            </div>
          </div>
        </div>

        {/* Center & Right Hero: Prominent Exam Countdown & Year Progress */}
        <div className="md:col-span-8 flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-br from-blue-950/25 via-slate-900/80 to-slate-950 border border-blue-500/30 p-5 shadow-lg">
          {/* Exam Countdown Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Target size={16} className="text-blue-400" />
                <span className="text-xs font-black uppercase tracking-widest text-blue-300">
                  🎯 EXAM COUNTDOWN
                </span>
              </div>

              {/* Big Prominent Countdown Display */}
              <div className="mt-2 flex items-baseline gap-2">
                {isExamToday ? (
                  <span className="text-3xl sm:text-4xl font-black text-amber-300 tracking-tight animate-pulse">
                    🎯 EXAM DAY
                  </span>
                ) : isExamCompleted ? (
                  <span className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight">
                    🎯 EXAM COMPLETED
                  </span>
                ) : (
                  <>
                    <span className="text-4xl sm:text-5xl font-black text-white tracking-tight font-mono">
                      {examDaysRemaining}
                    </span>
                    <span className="text-base sm:text-lg font-black text-blue-400 tracking-wider uppercase">
                      DAYS LEFT
                    </span>
                  </>
                )}
              </div>

              <div className="mt-1 space-y-0.5">
                <div className="text-sm font-bold text-slate-200">
                  {examTargetGregorian} · {examTargetEthiopian}
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  {examTargetEthiopianAmharic} (Africa/Addis_Ababa)
                </div>
              </div>
            </div>

            {/* Visual Exam Metric Capsule */}
            <div className="self-start sm:self-center px-4 py-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-center sm:min-w-[130px]">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                TARGET DATE
              </span>
              <span className="text-xs font-bold text-blue-300 block mt-0.5">
                {examTargetGregorian}
              </span>
              <span className="text-[10px] text-slate-400 font-mono block">
                {examTargetEthiopian}
              </span>
            </div>
          </div>

          {/* Goal Year Progress Bar */}
          <div className="pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <span className="text-emerald-400">🇪🇹</span> {fixedGoalYearLabel} GOAL PROGRESS
              </span>
              <span className="font-black text-emerald-400 font-mono text-sm">
                {goalYearProgressPercent}%
              </span>
            </div>

            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800/80 shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-700 shadow-md"
                style={{ width: `${goalYearProgressPercent}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 mt-2 font-mono">
              <span>
                Day {goalYearDaysElapsed} of {goalYearTotalDays} ({fixedGoalYearLabel} Leap Year)
              </span>
              <span>
                {goalYearStartGregorian} → {goalYearEndGregorian}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM MOTTO / LIFE STATEMENT ───────────────────────────────── */}
      <div className="mt-5 rounded-2xl bg-gradient-to-r from-emerald-950/30 via-slate-900/60 to-slate-950 border border-emerald-500/20 px-4 py-3 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-2 shadow-inner">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-200">
          <span className="text-amber-400">✨</span>
          <span className="italic font-medium text-emerald-100/90">
            "{motto}"
          </span>
        </div>
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
          {fixedGoalYearLabel} COMMITMENT
        </span>
      </div>
    </section>
  );
}
