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
} from "lucide-react";

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

export default function Home() {
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [nextWorkout, setNextWorkout] = useState<WorkoutToday | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const [planRes, workoutRes] = await Promise.all([
        fetch("/api/plan/today"),
        fetch("/api/workout/today"),
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
    };

    void loadData();
  }, []);

  const toggleTask = (id: string) => {
    setCompleted((current) =>
      current.includes(id) ? current.filter((taskId) => taskId !== id) : [...current, id]
    );
  };

  const taskBlocks = tasks.length
    ? tasks.map((task, index) => ({
        id: task.id,
        domain: task.domain?.name ?? "Personal",
        title: task.description || "Plan item",
        minutes: task.minutesTarget ?? 30,
        accent: task.domain?.color ?? "#f97316",
        tag: String(index + 1).padStart(2, "0"),
      }))
    : [
        { id: "fallback-1", domain: "Workout", title: "Push session: chest, shoulders, triceps", minutes: 55, accent: "#f97316", tag: "01" },
        { id: "fallback-2", domain: "Study", title: "Solve 15 algebra problems", minutes: 40, accent: "#3b82f6", tag: "02" },
      ];

  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const nextWorkoutText = nextWorkout?.day?.type
    ? `${nextWorkout.day.type} · ${nextWorkout.day.exercises?.length ?? 0} exercises`
    : "No workout scheduled";

  return (
    <div className="mx-auto w-full max-w-[1500px] animate-fade-in pb-10">
      <section className="mb-6 flex flex-col justify-between gap-5 border-b border-[var(--border)] pb-6 lg:flex-row lg:items-end">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--study)]">{dateLabel}</p>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Make today count.</h1>
          <p className="mt-2 max-w-xl text-sm">Your day is shaped by the next workout, the top task, and the plan that keeps you in motion.</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.07)] px-4 py-3">
          <Flame size={19} className="text-[var(--xp-gold)]" />
          <div>
            <div className="text-sm font-bold">NEXT: {nextWorkoutText}</div>
            <div className="text-xs text-[var(--text-muted)]">Week {nextWorkout?.weekNumber ?? 1}</div>
          </div>
          <ArrowUpRight size={15} className="text-[var(--xp-gold)]" />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
        <section className="card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <div>
              <h2 className="text-lg">Today&apos;s plan</h2>
              <p className="mt-1 text-xs">{completed.length} of {taskBlocks.length} blocks complete</p>
            </div>
            <button className="btn btn-ghost btn-sm"><Sparkles size={14} /> Regenerate</button>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {taskBlocks.map((task, index) => {
              const isDone = completed.includes(task.id);
              return (
                <div key={task.id} className={`group flex items-center gap-4 px-5 py-5 transition-colors hover:bg-[var(--bg-elevated)] ${isDone ? "opacity-55" : ""}`}>
                  <button
                    aria-label={isDone ? `Mark ${task.title} incomplete` : `Complete ${task.title}`}
                    onClick={() => toggleTask(task.id)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all"
                    style={{ borderColor: isDone ? task.accent : "var(--border-active)", backgroundColor: isDone ? task.accent : "transparent" }}
                  >
                    {isDone && <Check size={15} strokeWidth={3} className="text-black" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold tracking-[0.16em]" style={{ color: task.accent }}>{String(index + 1).padStart(2, "0")} / {task.domain}</span>
                    </div>
                    <div className={`text-sm font-semibold ${isDone ? "line-through" : ""}`}>{task.title}</div>
                  </div>
                  <div className="hidden items-center gap-1.5 text-xs text-[var(--text-muted)] sm:flex">
                    <Clock3 size={14} /> {task.minutes}m
                  </div>
                  <button aria-label={`Start ${task.title}`} onClick={() => setRunning(!running)} className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]">
                    <Play size={15} fill="currentColor" />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--bg-elevated)] px-5 py-3">
            <span className="text-xs text-[var(--text-muted)]">AI PLAN / ACTIVE</span>
            <button className="flex items-center gap-1 text-xs font-bold text-[var(--study)]">
              View full plan <ChevronRight size={14} />
            </button>
          </div>
        </section>

        <div className="space-y-5">
          <section className="card border-[rgba(59,130,246,0.2)] bg-[linear-gradient(135deg,rgba(59,130,246,0.12),var(--bg-surface)_55%)]">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h4 className="text-[var(--study)]">Program status</h4>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-5xl font-bold tracking-tight">{nextWorkout?.weekNumber ?? 1}</span>
                  <span className="text-sm text-[var(--text-secondary)]">/ 24</span>
                </div>
              </div>
              <Target size={21} className="text-[var(--study)]" />
            </div>
            <div className="mb-2 flex justify-between text-xs">
              <span className="text-[var(--text-secondary)]">Phase</span>
              <span className="font-bold text-[var(--study)]">{nextWorkout?.phase?.goal ?? "Foundation"}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill bg-[var(--study)]" style={{ width: "38%" }} />
            </div>
            <p className="mt-3 text-xs">{nextWorkout?.phase?.goal ? `Current block: ${nextWorkout.phase.goal}` : "Foundation block is active."}</p>
          </section>

          <section className="card">
            <div className="mb-4 flex items-center justify-between">
              <h4>Focus timer</h4>
              <TimerReset size={16} className="text-[var(--text-muted)]" />
            </div>
            <div className="flex items-center justify-between">
              <div className="font-mono text-4xl font-medium tracking-tight">{running ? "24:59" : "25:00"}</div>
              <button onClick={() => setRunning(!running)} className="btn btn-primary">
                <Play size={15} fill="currentColor" /> {running ? "Pause" : "Start focus"}
              </button>
            </div>
            <p className="mt-3 text-xs text-[var(--text-muted)]">Next block: {nextWorkout?.day?.type ?? "Workout"} · {nextWorkout?.day?.exercises?.length ?? 0} exercises</p>
          </section>
        </div>
      </div>
    </div>
  );
}
