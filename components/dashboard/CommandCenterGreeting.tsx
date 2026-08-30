"use client";

import { useEffect, useState } from "react";
import { Zap, Award, TrendingUp, ShieldCheck, Clock } from "lucide-react";

interface Props {
  greeting: string;
  subGreeting: string;
  totalXp: number;
  level: number;
  progressPercent: number;
}

export function CommandCenterGreeting({
  greeting,
  subGreeting,
  totalXp,
  level,
  progressPercent,
}: Props) {
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format to Africa/Addis_Ababa
      const addisTime = now.toLocaleTimeString("en-US", {
        timeZone: "Africa/Addis_Ababa",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      setTimeStr(addisTime);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="flex flex-col justify-between gap-5 border-b border-[var(--border)] pb-6 lg:flex-row lg:items-end">
      <div>
        <div className="flex items-center gap-2 mb-1.5 text-xs font-bold uppercase tracking-[0.2em] text-[var(--study)]">
          <Clock size={13} className="text-[var(--study)]" />
          <span>{timeStr ? `${timeStr} · Addis Ababa` : "Addis Ababa Local Time"}</span>
        </div>

        <h1 className="text-3xl font-black tracking-tight md:text-4xl text-[var(--text-primary)]">
          {greeting || "Welcome back, Mikiyas."}
        </h1>

        <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-2xl leading-relaxed">
          {subGreeting || "Here is your personal command center and daily execution roadmap."}
        </p>

        {/* Live Metrics Badges */}
        <div className="flex flex-wrap items-center gap-2.5 mt-3.5">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[rgba(245,158,11,0.12)] border border-[rgba(245,158,11,0.25)] text-xs font-bold text-[var(--xp-gold)]">
            <Zap size={14} />
            <span>XP: {totalXp.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[rgba(59,130,246,0.12)] border border-[rgba(59,130,246,0.25)] text-xs font-bold text-[var(--study)]">
            <Award size={14} />
            <span>LEVEL: {level}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.25)] text-xs font-bold text-[var(--success)]">
            <TrendingUp size={14} />
            <span>TODAY: {progressPercent}%</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400">
            <ShieldCheck size={14} />
            <span>SECURITY: ACTIVE</span>
          </div>
        </div>
      </div>
    </section>
  );
}
