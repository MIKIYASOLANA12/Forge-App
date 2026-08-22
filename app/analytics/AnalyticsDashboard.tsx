"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Flame, Target, Zap } from "lucide-react";

type Domain = { name: string; color: string };
type Habit = { id: string; name: string; streakCount: number };
type Props = {
  profile: { examDate: string | null; totalXp: number; level: number; progress: number; nextLevelXp: number };
  studyWeight: number;
  domains: Domain[];
  habits: Habit[];
};
type Weekly = { days: string[]; domains: (Domain & { minutes: number[] })[] };
type Balance = { score: number; deviations: { name: string; difference: number }[]; hasSessions: boolean };
type Heatmap = { date: string; completed: boolean }[];

const formatDifference = (value: number) => `${value > 0 ? "+" : ""}${value}%`;

export default function AnalyticsDashboard({ profile, studyWeight, domains, habits }: Props) {
  const [weekly, setWeekly] = useState<Weekly | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [heatmaps, setHeatmaps] = useState<Record<string, Heatmap>>({});

  useEffect(() => {
    const load = async () => {
      const [weeklyResponse, balanceResponse] = await Promise.all([fetch("/api/analytics/weekly"), fetch("/api/analytics/balance")]);
      if (weeklyResponse.ok) setWeekly(await weeklyResponse.json());
      if (balanceResponse.ok) setBalance(await balanceResponse.json());
      const results = await Promise.all(habits.map(async (habit) => {
        const response = await fetch(`/api/analytics/heatmap?habitId=${habit.id}`);
        return [habit.id, response.ok ? await response.json() : []] as const;
      }));
      setHeatmaps(Object.fromEntries(results));
    };
    void load();
  }, [habits]);

  const daysLeft = profile.examDate ? Math.max(0, Math.ceil((new Date(profile.examDate).getTime() - Date.now()) / 86400000)) : null;
  const examTone = daysLeft === null || daysLeft > 90 ? "var(--success)" : daysLeft >= 30 ? "var(--warning)" : "var(--danger)";
  const scoreTone = balance && balance.score >= 80 ? "var(--success)" : balance && balance.score >= 50 ? "var(--warning)" : "var(--danger)";
  const chartData = weekly ? weekly.days.map((day, index) => Object.fromEntries([["day", day], ...weekly.domains.map((domain) => [domain.name, domain.minutes[index]])])) : [];
  const over = balance?.deviations.filter((item) => item.difference > 0).sort((a, b) => b.difference - a.difference)[0];
  const under = balance?.deviations.filter((item) => item.difference < 0).sort((a, b) => a.difference - b.difference)[0];

  return <div className="mx-auto w-full max-w-[1500px] animate-fade-in pb-10">
    <section className="mb-6 flex flex-col justify-between gap-5 border-b border-[var(--border)] pb-6 md:flex-row md:items-end">
      <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--study)]">Signals / weekly review</p><h1>See the shape of your effort.</h1><p className="mt-2 max-w-xl text-sm">A clear read on where your time went, what is staying consistent, and what needs the next deliberate block.</p></div>
      <div className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: `${examTone}44`, backgroundColor: `${examTone}10` }}><Target size={19} style={{ color: examTone }} /><div><div className="text-xs font-bold uppercase tracking-wider" style={{ color: examTone }}>Exam countdown</div><div className="mt-1 text-xl font-bold">{daysLeft === null ? "Not set" : `${daysLeft} days`}</div></div></div>
    </section>

    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <section className="card"><div className="mb-4 flex items-start justify-between"><div><h4>Week balance score</h4><div className="mt-3 text-6xl font-bold" style={{ color: balance ? scoreTone : "var(--text-muted)" }}>{balance?.score ?? "--"}</div></div><div className="text-right text-xs text-[var(--text-muted)]">out of 100</div></div>{balance?.hasSessions ? <div className="space-y-2 border-t border-[var(--border)] pt-4 text-xs"><div>{over ? `${over.name}: ${formatDifference(over.difference)} over target` : "No domain is over target"}</div><div>{under ? `${under.name}: ${formatDifference(Math.abs(under.difference))} under target` : "No domain is under target"}</div></div> : <p className="border-t border-[var(--border)] pt-4 text-xs">No sessions logged this week yet.</p>}</section>
      <section className="card"><div className="mb-4 flex items-center justify-between"><div><h4>Weekly domain allocation</h4><p className="mt-1 text-xs">Minutes by day, stacked across all domains</p></div><span className="text-xs text-[var(--text-muted)]">Mon - Sun</span></div>{weekly && weekly.domains.length ? <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} /><XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} width={32} /><Tooltip contentStyle={{ background: "#1a1a28", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "#f1f5f9" }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />{weekly.domains.map((domain) => <Bar key={domain.name} dataKey={domain.name} stackId="minutes" fill={domain.color} />)}</BarChart></ResponsiveContainer></div> : <div className="flex h-64 items-center justify-center text-sm text-[var(--text-muted)]">No sessions logged this week yet.</div>}</section>
    </div>

    <section className="mt-5 card"><div className="mb-5 flex items-end justify-between"><div><h4>Habit consistency</h4><p className="mt-1 text-xs">Last 90 days of completed logs</p></div><span className="text-xs text-[var(--text-muted)]">13 weeks</span></div>{habits.length ? <div className="grid gap-6 md:grid-cols-2">{habits.map((habit) => <div key={habit.id}><div className="mb-3 flex items-center justify-between"><span className="font-semibold">{habit.name}</span><span className="flex items-center gap-1 text-xs font-bold text-[var(--xp-gold)]"><Flame size={13} /> {habit.streakCount} days</span></div><div className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto">{(heatmaps[habit.id] ?? Array.from({ length: 90 }, (_, index) => ({ date: String(index), completed: false }))).map((entry) => <div key={entry.date} title={`${entry.date}: ${entry.completed ? "completed" : "not completed"}`} className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: entry.completed ? "#22c55e" : "var(--bg-overlay)" }} />)}</div></div>)}</div> : <div className="py-6 text-sm text-[var(--text-muted)]">No active habits to visualize yet.</div>}</section>

    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.5fr]"><section className="card"><h4>Study priority</h4><div className="mt-3 text-4xl font-bold text-[var(--study)]">{studyWeight.toFixed(1)}x</div><p className="mt-2 text-xs">Current Study domain weight</p></section><section className="card"><div className="flex items-start justify-between"><div><h4>XP and level progress</h4><div className="mt-3 flex items-baseline gap-3"><span className="text-4xl font-bold">Level {profile.level}</span><span className="text-sm text-[var(--xp-gold)]"><Zap size={14} className="mr-1 inline" />{profile.totalXp.toLocaleString()} XP</span></div></div><span className="text-xs text-[var(--text-muted)]">Next: {profile.nextLevelXp.toLocaleString()} XP</span></div><div className="mt-5 progress-bar"><div className="progress-fill bg-[var(--xp-gold)]" style={{ width: `${Math.round(profile.progress * 100)}%` }} /></div></section></div>
  </div>;
}
