"use client";

import { useEffect, useState } from "react";
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
import Link from "next/link";

type PlanTask = {
  id: string;
  description: string;
  domain?: { name: string; color?: string } | null;
  minutesTarget?: number | null;
  completed?: boolean;
};

type WorkoutToday = {
  day?: {
    type?: string;
    exercises?: Array<{ id: string; name: string }>;
  };
  weekNumber?: number;
  phase?: { goal?: string };
};

type ProfileStats = {
  totalXp: number;
  level: number;
  examDate?: string;
};

export default function Home() {
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [nextWorkout, setNextWorkout] = useState<WorkoutToday | null>(null);
  const [profile, setProfile] = useState<ProfileStats>({ totalXp: 0, level: 1 });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [planRes, workoutRes, settingsRes] = await Promise.all([
          fetch("/api/plan/today"),
          fetch("/api/workout/today"),
          fetch("/api/settings"),
        ]);

        if (planRes.ok) {
          const plan = await planRes.json();
          const taskList = Array.isArray(plan?.tasks) ? plan.tasks : [];
          setTasks(taskList);
          setCompleted(taskList.filter((task: PlanTask) => task.completed).map((task: PlanTask) => task.id));
        }

        if (workoutRes.ok) {
          const workout = await workoutRes.json();
          setNextWorkout(workout);
        }

        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          if (settings) {
            setProfile({
              totalXp: settings.totalXp ?? 0,
              level: settings.level ?? 1,
              examDate: settings.examDate,
            });
          }
        }
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      }
    };

    void loadData();
  }, []);

  const toggleTask = async (id: string) => {
    const isNowDone = !completed.includes(id);
    setCompleted((current) =>
      isNowDone ? [...current, id] : current.filter((taskId) => taskId !== id)
    );

    try {
      await fetch(`/api/plan/tasks/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: isNowDone }),
      });
    } catch {}
  };

  const taskBlocks = tasks.map((task, index) => ({
    id: task.id,
    domain: task.domain?.name ?? "Personal",
    title: task.description || "Plan item",
    minutes: task.minutesTarget ?? 30,
    accent: task.domain?.color ?? "#f97316",
    tag: String(index + 1).padStart(2, "0"),
  }));

  const totalTasksCount = taskBlocks.length;
  const completedCount = completed.length;
  const progressPercentage = totalTasksCount > 0 ? Math.round((completedCount / totalTasksCount) * 100) : 0;

  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const nextWorkoutText = nextWorkout?.day?.type
    ? `${nextWorkout.day.type} · ${nextWorkout.day.exercises?.length ?? 0} exercises`
    : "Active Recovery";

  return (
    <div className="mx-auto w-full max-w-[1500px] animate-fade-in pb-10">
      {/* Hero / Greeting Section */}
      <section className="mb-6 flex flex-col justify-between gap-5 border-b border-[var(--border)] pb-6 lg:flex-row lg:items-end">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--study)]">{dateLabel}</p>
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--text-muted)]">WELCOME BACK,</div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl text-[var(--text-primary)] mt-0.5">
            MIKIYAS OLANA
          </h1>
          
          {/* Real Live Stats Display */}
          <div className="flex flex-wrap items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[rgba(245,158,11,0.12)] border border-[rgba(245,158,11,0.25)] text-xs font-bold text-[var(--xp-gold)]">
              <Zap size={14} />
              <span>XP: {profile.totalXp.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[rgba(59,130,246,0.12)] border border-[rgba(59,130,246,0.25)] text-xs font-bold text-[var(--study)]">
              <span>LEVEL: {profile.level}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.25)] text-xs font-bold text-[var(--success)]">
              <span>PROGRESS: {progressPercentage}%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.07)] px-4 py-3">
          <Flame size={19} className="text-[var(--xp-gold)]" />
          <div>
            <div className="text-sm font-bold">NEXT: {nextWorkoutText}</div>
            <div className="text-xs text-[var(--text-muted)]">Week {nextWorkout?.weekNumber ?? 1} of 24</div>
          </div>
          <Link href="/workout" aria-label="Open workout tracker">
            <ArrowUpRight size={15} className="text-[var(--xp-gold)] hover:scale-110 transition-transform" />
          </Link>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
        {/* Today's Real Schedule */}
        <section className="card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <div>
              <h2 className="text-lg font-bold">Today&apos;s Plan</h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {totalTasksCount > 0
                  ? `${completedCount} of ${totalTasksCount} tasks completed (${progressPercentage}%)`
                  : "No scheduled tasks generated for today yet."}
              </p>
            </div>
            <Link href="/plans" className="btn btn-ghost btn-sm">
              <Sparkles size={14} /> Plan Generator
            </Link>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {taskBlocks.length > 0 ? (
              taskBlocks.map((task, index) => {
                const isDone = completed.includes(task.id);
                return (
                  <div
                    key={task.id}
                    className={`group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--bg-elevated)] ${
                      isDone ? "opacity-55" : ""
                    }`}
                  >
                    <button
                      aria-label={isDone ? `Mark ${task.title} incomplete` : `Complete ${task.title}`}
                      onClick={() => toggleTask(task.id)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all cursor-pointer"
                      style={{
                        borderColor: isDone ? task.accent : "var(--border-active)",
                        backgroundColor: isDone ? task.accent : "transparent",
                      }}
                    >
                      {isDone && <Check size={15} strokeWidth={3} className="text-black" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span
                          className="text-[10px] font-bold tracking-[0.16em]"
                          style={{ color: task.accent }}
                        >
                          {String(index + 1).padStart(2, "0")} / {task.domain}
                        </span>
                      </div>
                      <div className={`text-sm font-semibold ${isDone ? "line-through text-[var(--text-muted)]" : "text-[var(--text-primary)]"}`}>
                        {task.title}
                      </div>
                    </div>
                    <div className="hidden items-center gap-1.5 text-xs text-[var(--text-muted)] sm:flex">
                      <Clock3 size={14} /> {task.minutes}m
                    </div>
                    <button
                      aria-label={`Start focus on ${task.title}`}
                      onClick={() => setRunning(!running)}
                      className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]"
                    >
                      <Play size={15} fill="currentColor" />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm text-[var(--text-secondary)]">
                  Your day schedule is clear. Click below to generate your daily AI plan based on your domain priorities.
                </p>
                <Link href="/plans" className="btn btn-primary btn-sm inline-flex items-center gap-1.5">
                  <Sparkles size={14} /> Generate Today&apos;s Schedule
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--bg-elevated)] px-5 py-3">
            <span className="text-xs text-[var(--text-muted)] font-mono">FORGE OS / LIVE DATABASE</span>
            <Link href="/plans" className="flex items-center gap-1 text-xs font-bold text-[var(--study)] hover:underline">
              View full plan <ChevronRight size={14} />
            </Link>
          </div>
        </section>

        {/* Sidebar Cards */}
        <div className="space-y-5">
          <section className="card border-[rgba(59,130,246,0.2)] bg-[linear-gradient(135deg,rgba(59,130,246,0.12),var(--bg-surface)_55%)]">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h4 className="text-[var(--study)] font-semibold text-xs uppercase tracking-wider">Workout Program</h4>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-5xl font-bold tracking-tight">{nextWorkout?.weekNumber ?? 1}</span>
                  <span className="text-sm text-[var(--text-secondary)]">/ 24 weeks</span>
                </div>
              </div>
              <Target size={21} className="text-[var(--study)]" />
            </div>
            <div className="mb-2 flex justify-between text-xs">
              <span className="text-[var(--text-secondary)]">Phase Target</span>
              <span className="font-bold text-[var(--study)]">{nextWorkout?.phase?.goal ?? "Learn movements"}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill bg-[var(--study)]" style={{ width: `${Math.round(((nextWorkout?.weekNumber ?? 1) / 24) * 100)}%` }} />
            </div>
            <p className="mt-3 text-xs text-[var(--text-secondary)]">
              Scheduled split: <span className="font-bold text-[var(--text-primary)]">{nextWorkout?.day?.type ?? "Push"}</span>
            </p>
          </section>

          <section className="card">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="font-semibold text-sm">Focus Timer</h4>
              <TimerReset size={16} className="text-[var(--text-muted)]" />
            </div>
            <div className="flex items-center justify-between">
              <div className="font-mono text-4xl font-medium tracking-tight">{running ? "24:59" : "25:00"}</div>
              <button onClick={() => setRunning(!running)} className="btn btn-primary">
                <Play size={15} fill="currentColor" /> {running ? "Pause" : "Start focus"}
              </button>
            </div>
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Next block: {nextWorkout?.day?.type ?? "Workout"} · {nextWorkout?.day?.exercises?.length ?? 0} exercises
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
