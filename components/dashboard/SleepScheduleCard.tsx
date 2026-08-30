"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Clock, Zap, CheckCircle2, AlertTriangle, Shield, Sparkles, LoaderCircle } from "lucide-react";
import type { SleepAccountabilityStatus } from "@/lib/sleepAccountability";

export function SleepScheduleCard() {
  const [sleepStatus, setSleepStatus] = useState<SleepAccountabilityStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/schedule/sleep/ack");
      if (res.ok) {
        const data = await res.json();
        if (data.status) setSleepStatus(data.status);
      }
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, []);

  const handleAcknowledge = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedule/sleep/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ack" }),
      });
      if (res.ok) {
        await fetchStatus();
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleSnooze = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedule/sleep/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "snooze" }),
      });
      if (res.ok) {
        await fetchStatus();
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  return (
    <section id="sleep" className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/20 via-slate-900/90 to-slate-950 p-5 sm:p-6 shadow-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-500/20 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Moon size={18} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">Persistent Sleep Accountability</h3>
            <p className="text-xs text-slate-400">Fixed target schedule & persistent 15-min accountability</p>
          </div>
        </div>

        {/* Live Status Pill */}
        {sleepStatus?.isAcknowledged ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
            <CheckCircle2 size={13} />
            <span>Sleep Acknowledged ✓</span>
          </span>
        ) : sleepStatus?.isOverdue ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 animate-pulse">
            <AlertTriangle size={13} />
            <span>Sleep Overdue by {sleepStatus.overdueMinutes}m</span>
          </span>
        ) : sleepStatus?.isSnoozed ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
            <Clock size={13} />
            <span>Snoozed ({sleepStatus.snoozeCount}/3)</span>
          </span>
        ) : (
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
            Target: 11:00 PM
          </span>
        )}
      </div>

      {/* Target Windows Grid */}
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
            <div className="text-xs text-slate-400 mt-0.5">Persistent 15-min alerts until acknowledged</div>
          </div>
        </div>
      </div>

      {/* Interactive Sleep Action Bar */}
      {sleepStatus?.isSleepWindow && !sleepStatus?.isAcknowledged && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-500/30 bg-indigo-950/40 p-3.5">
          <div className="text-xs text-indigo-200">
            <span className="font-bold text-white">Persistent Sleep Mode Active:</span> Shut down Forge and PC to preserve tomorrow’s focus.
          </div>
          <div className="flex items-center gap-2">
            {sleepStatus.snoozeCount < 3 && (
              <button
                onClick={handleSnooze}
                disabled={loading}
                className="btn btn-sm btn-outline border-amber-500/40 text-amber-300 hover:bg-amber-500/20 font-bold"
              >
                ⏰ 5 More Minutes
              </button>
            )}
            <button
              onClick={handleAcknowledge}
              disabled={loading}
              className="btn btn-sm btn-primary font-bold flex items-center gap-1.5 shadow-lg"
            >
              {loading ? <LoaderCircle size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              <span>✅ I'm Going to Sleep</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
