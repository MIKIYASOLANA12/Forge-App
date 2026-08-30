"use client";

import { GraduationCap, Flame, Home, Clock, CalendarDays } from "lucide-react";
import type { CountdownCard } from "@/lib/countdowns";

interface Props {
  countdowns: CountdownCard[];
}

export function CountdownsGrid({ countdowns }: Props) {
  if (!countdowns || countdowns.length === 0) return null;

  const getCardIcon = (id: string) => {
    switch (id) {
      case "entrance_exam":
        return <GraduationCap className="text-blue-400" size={20} />;
      case "body_transformation":
        return <Flame className="text-amber-400" size={20} />;
      case "holiday_workout":
        return <Home className="text-rose-400" size={20} />;
      default:
        return <CalendarDays className="text-slate-400" size={20} />;
    }
  };

  const getAccentBorder = (id: string) => {
    switch (id) {
      case "entrance_exam":
        return "border-blue-500/30 hover:border-blue-500/50 bg-gradient-to-b from-blue-950/20 to-slate-900/60";
      case "body_transformation":
        return "border-amber-500/30 hover:border-amber-500/50 bg-gradient-to-b from-amber-950/20 to-slate-900/60";
      case "holiday_workout":
        return "border-rose-500/30 hover:border-rose-500/50 bg-gradient-to-b from-rose-950/20 to-slate-900/60";
      default:
        return "border-slate-800 bg-slate-900/40";
    }
  };

  const getProgressBarColor = (id: string) => {
    switch (id) {
      case "entrance_exam":
        return "bg-gradient-to-r from-blue-600 to-cyan-400";
      case "body_transformation":
        return "bg-gradient-to-r from-amber-600 via-orange-500 to-yellow-400";
      case "holiday_workout":
        return "bg-gradient-to-r from-rose-600 to-pink-400";
      default:
        return "bg-slate-500";
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-[var(--xp-gold)]" />
          <h2 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
            CRITICAL COUNTDOWNS & CHALLENGES
          </h2>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">Timezone: Africa/Addis_Ababa</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {countdowns.map((card) => (
          <div
            key={card.id}
            className={`rounded-2xl border p-5 transition-all shadow-lg flex flex-col justify-between ${getAccentBorder(
              card.id
            )}`}
          >
            <div>
              {/* Header Badge */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/80 border border-slate-700/50">
                    {getCardIcon(card.id)}
                  </div>
                  <span className="text-xs font-bold text-slate-300">{card.title}</span>
                </div>

                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    card.id === "entrance_exam"
                      ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                      : card.id === "body_transformation"
                      ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                      : "bg-rose-500/10 text-rose-300 border-rose-500/30"
                  }`}
                >
                  {card.badge}
                </span>
              </div>

              {/* Big Days Remaining Number */}
              <div className="my-2">
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {card.statusText}
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{card.subText}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4 pt-3 border-t border-slate-800/60">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
                <span>Progress</span>
                <span className="font-bold text-slate-200">{card.progressPercent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(
                    card.id
                  )}`}
                  style={{ width: `${card.progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
