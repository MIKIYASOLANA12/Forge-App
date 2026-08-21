"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Flame,
  Play,
  Sparkles,
  Target,
  TimerReset,
  Zap,
} from "lucide-react";

const tasks = [
  { id: 1, domain: "Workout", title: "Push session: chest, shoulders, triceps", minutes: 55, accent: "#f97316", tag: "TRAIN" },
  { id: 2, domain: "Study", title: "Solve 15 algebra problems", minutes: 40, accent: "#3b82f6", tag: "PRIORITY" },
  { id: 3, domain: "Coding", title: "Build a fetch wrapper with error states", minutes: 35, accent: "#22c55e", tag: "DEEP WORK" },
  { id: 4, domain: "Faith", title: "Read John 3 and answer the check-in", minutes: 20, accent: "#cbd5e1", tag: "REFLECT" },
];

const domains = [
  { name: "Study", minutes: 80, target: 120, accent: "#3b82f6" },
  { name: "Workout", minutes: 55, target: 60, accent: "#f97316" },
  { name: "Coding", minutes: 35, target: 60, accent: "#22c55e" },
  { name: "Faith", minutes: 20, target: 30, accent: "#cbd5e1" },
];

const habits = [
  { name: "Morning sunlight", streak: 12, accent: "#eab308" },
  { name: "No phone before study", streak: 8, accent: "#3b82f6" },
  { name: "Protein target", streak: 19, accent: "#f97316" },
];

export default function Home() {
  const [completed, setCompleted] = useState<number[]>([2]);
  const [running, setRunning] = useState(false);

  const toggleTask = (id: number) => {
    setCompleted((current) => current.includes(id) ? current.filter((taskId) => taskId !== id) : [...current, id]);
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] animate-fade-in pb-10">
      <section className="mb-6 flex flex-col justify-between gap-5 border-b border-[var(--border)] pb-6 lg:flex-row lg:items-end">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--study)]">Friday / 21 August 2026</p>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Make today count.</h1>
          <p className="mt-2 max-w-xl text-sm">Four deliberate blocks. Study carries the most weight now. Finish the important work before the easy work.</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.07)] px-4 py-3">
          <Flame size={19} className="text-[var(--xp-gold)]" />
          <div><div className="text-sm font-bold">12 day momentum</div><div className="text-xs text-[var(--text-muted)]">Best this month: 14 days</div></div>
          <ArrowUpRight size={15} className="text-[var(--xp-gold)]" />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
        <section className="card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <div><h2 className="text-lg">Today&apos;s plan</h2><p className="mt-1 text-xs">{completed.length} of {tasks.length} blocks complete · 150 min remaining</p></div>
            <button className="btn btn-ghost btn-sm"><Sparkles size={14} /> Regenerate</button>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {tasks.map((task, index) => {
              const isDone = completed.includes(task.id);
              return <div key={task.id} className={`group flex items-center gap-4 px-5 py-5 transition-colors hover:bg-[var(--bg-elevated)] ${isDone ? "opacity-55" : ""}`}>
                <button aria-label={isDone ? `Mark ${task.title} incomplete` : `Complete ${task.title}`} onClick={() => toggleTask(task.id)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all" style={{ borderColor: isDone ? task.accent : "var(--border-active)", backgroundColor: isDone ? task.accent : "transparent" }}>
                  {isDone && <Check size={15} strokeWidth={3} className="text-black" />}
                </button>
                <div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold tracking-[0.16em]" style={{ color: task.accent }}>{String(index + 1).padStart(2, "0")} / {task.tag}</span></div><div className={`text-sm font-semibold ${isDone ? "line-through" : ""}`}>{task.title}</div></div>
                <div className="hidden items-center gap-1.5 text-xs text-[var(--text-muted)] sm:flex"><Clock3 size={14} /> {task.minutes}m</div>
                <button aria-label={`Start ${task.title}`} onClick={() => setRunning(!running)} className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]"><Play size={15} fill="currentColor" /></button>
              </div>;
            })}
          </div>
          <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--bg-elevated)] px-5 py-3"><span className="text-xs text-[var(--text-muted)]">AI PLAN / GENERATED 06:42</span><button className="flex items-center gap-1 text-xs font-bold text-[var(--study)]">View full plan <ChevronRight size={14} /></button></div>
        </section>

        <div className="space-y-5">
          <section className="card border-[rgba(59,130,246,0.2)] bg-[linear-gradient(135deg,rgba(59,130,246,0.12),var(--bg-surface)_55%)]">
            <div className="mb-5 flex items-start justify-between"><div><h4 className="text-[var(--study)]">Exam countdown</h4><div className="mt-2 flex items-baseline gap-2"><span className="text-5xl font-bold tracking-tight">164</span><span className="text-sm text-[var(--text-secondary)]">days left</span></div></div><Target size={21} className="text-[var(--study)]" /></div>
            <div className="mb-2 flex justify-between text-xs"><span className="text-[var(--text-secondary)]">Study weight</span><span className="font-bold text-[var(--study)]">1.5x</span></div><div className="progress-bar"><div className="progress-fill bg-[var(--study)]" style={{ width: "42%" }} /></div><p className="mt-3 text-xs">Priority rises again in 31 days.</p>
          </section>
          <section className="card"><div className="mb-4 flex items-center justify-between"><h4>Focus timer</h4><TimerReset size={16} className="text-[var(--text-muted)]" /></div><div className="flex items-center justify-between"><div className="font-mono text-4xl font-medium tracking-tight">{running ? "24:59" : "25:00"}</div><button onClick={() => setRunning(!running)} className="btn btn-primary"><Play size={15} fill="currentColor" /> {running ? "Pause" : "Start focus"}</button></div><p className="mt-3 text-xs text-[var(--text-muted)]">Next block: Coding · 35 min</p></section>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_1fr_0.8fr]">
        <section className="card"><div className="mb-5 flex items-center justify-between"><h4>This week&apos;s allocation</h4><span className="text-xs font-bold text-[var(--success)]">78% balanced</span></div><div className="space-y-4">{domains.map((domain) => <div key={domain.name}><div className="mb-1.5 flex justify-between text-xs"><span className="font-semibold">{domain.name}</span><span className="text-[var(--text-muted)]">{domain.minutes} / {domain.target}m</span></div><div className="progress-bar"><div className="progress-fill" style={{ width: `${Math.min(domain.minutes / domain.target * 100, 100)}%`, background: domain.accent }} /></div></div>)}</div></section>
        <section className="card"><div className="mb-5 flex items-center justify-between"><h4>Active habits</h4><a href="/habits" className="text-xs font-bold text-[var(--study)]">Manage</a></div><div className="space-y-4">{habits.map((habit) => <div key={habit.name} className="flex items-center gap-3"><div className="h-2 w-2 rounded-full" style={{ backgroundColor: habit.accent }} /><span className="flex-1 text-sm font-medium">{habit.name}</span><span className="flex items-center gap-1 text-xs font-bold text-[var(--xp-gold)]"><Flame size={13} /> {habit.streak}</span></div>)}</div><div className="mt-5 border-t border-[var(--border)] pt-4 text-xs text-[var(--text-muted)]">One habit is 9 days from lock-in.</div></section>
        <section className="card flex flex-col justify-between"><div><div className="mb-4 flex items-center justify-between"><h4>Today&apos;s output</h4><Zap size={16} className="text-[var(--xp-gold)]" /></div><div className="text-4xl font-bold">+185 <span className="text-sm font-medium text-[var(--text-muted)]">XP</span></div><p className="mt-2 text-xs">Enough for 12% of level 4.</p></div><div className="mt-6"><div className="mb-1.5 flex justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]"><span>Level 3</span><span>1,420 / 1,800</span></div><div className="progress-bar"><div className="progress-fill bg-[var(--xp-gold)]" style={{ width: "79%" }} /></div></div></section>
      </div>
    </div>
  );
}
