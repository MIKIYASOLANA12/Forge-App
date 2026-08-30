"use client";

import Link from "next/link";
import { Home, Dumbbell, ArrowRight, CheckCircle2, Flame, ShieldAlert } from "lucide-react";
import type { HolidayStatus } from "@/lib/holidayWorkout";

interface Props {
  holiday: HolidayStatus | null;
  workoutCompleted?: boolean;
}

export function HolidayWorkoutCard({ holiday, workoutCompleted }: Props) {
  if (!holiday || !holiday.isHolidayPeriod || !holiday.todayRoutine) return null;

  const routine = holiday.todayRoutine;

  return (
    <section className="rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-950/25 via-slate-900/90 to-slate-950 p-5 sm:p-6 shadow-2xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-500/20 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <Home size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-rose-400">
                GRANDMOTHER-HOUSE HOME WORKOUT
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30">
                DAY {holiday.currentDayNumber} OF 16
              </span>
            </div>
            <h2 className="text-lg font-black text-white mt-0.5">{routine.title}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {workoutCompleted ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-400">
              <CheckCircle2 size={14} />
              Session Logged ✓
            </span>
          ) : (
            <Link
              href="/workout"
              className="btn btn-sm btn-primary rounded-lg font-bold flex items-center gap-1.5 shadow-md"
            >
              <Dumbbell size={14} />
              <span>Log Home Session</span>
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>

      {/* Routine Focus Badges & Description */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {routine.focusBadges.map((badge) => (
            <span
              key={badge}
              className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300"
            >
              {badge}
            </span>
          ))}
          <span className="text-xs text-rose-300/80 font-medium">
            {holiday.remainingDays} days remaining in holiday protocol
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">{routine.description}</p>
      </div>

      {/* Exercise List Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
        {routine.exercises.map((ex, idx) => (
          <div
            key={`${ex.name}-${idx}`}
            className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                <span>{ex.name}</span>
                <span className="text-[11px] font-mono text-rose-400">{ex.sets} sets</span>
              </div>
              <div className="text-xs font-mono text-slate-400 mt-1">{ex.reps}</div>
            </div>
            {ex.notes && <div className="text-[11px] text-slate-500 mt-2 italic">{ex.notes}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
