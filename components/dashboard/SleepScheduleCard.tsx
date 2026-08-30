"use client";

import { Moon, Sun, Clock, Zap, Shield, Sparkles } from "lucide-react";

export function SleepScheduleCard() {
  return (
    <section className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/20 via-slate-900/90 to-slate-950 p-5 sm:p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Moon size={18} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">Daily Circadian & Sleep Consistency</h3>
            <p className="text-xs text-slate-400">Fixed target schedule for cognitive sharpness & physical recovery</p>
          </div>
        </div>
        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
          Target: 11:00 AM
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Fixed Wake Target */}
        <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 p-3.5 flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <Sun size={16} />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Fixed Wake Target</div>
            <div className="text-lg font-black text-white mt-0.5">11:00 AM</div>
            <div className="text-xs text-slate-400 mt-0.5">Every single day · Telegram reminder at 11:00 AM</div>
          </div>
        </div>

        {/* Wind-Down Target */}
        <div className="rounded-xl border border-blue-500/25 bg-blue-950/20 p-3.5 flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
            <Clock size={16} />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-400">Daily Wind-Down</div>
            <div className="text-lg font-black text-white mt-0.5">09:30 PM</div>
            <div className="text-xs text-slate-400 mt-0.5">Daily close passes at 09:28 PM · Disconnect screens</div>
          </div>
        </div>

        {/* Target Sleep */}
        <div className="rounded-xl border border-indigo-500/25 bg-indigo-950/20 p-3.5 flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
            <Moon size={16} />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">Target Sleep</div>
            <div className="text-lg font-black text-white mt-0.5">11:00 PM</div>
            <div className="text-xs text-slate-400 mt-0.5">Deep 8-hour restoration before 11:00 AM wake-up</div>
          </div>
        </div>
      </div>
    </section>
  );
}
