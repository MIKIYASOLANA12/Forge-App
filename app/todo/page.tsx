"use client";

import { useEffect, useState } from "react";
import {
  CheckSquare,
  Square,
  Plus,
  Flame,
  Clock3,
  Calendar,
  Sparkles,
  Zap,
  Award,
  AlertTriangle,
  BookOpen,
  Dumbbell,
  Code2,
  CheckCircle2,
  LoaderCircle,
  ArrowRight,
  TrendingUp,
  Target,
  Layers,
  ChevronRight
} from "lucide-react";
import { clsx } from "clsx";

type TaskItem = {
  id: string;
  dailyPlanId: string;
  domainId: string;
  description: string;
  minutesTarget: number;
  completed: boolean;
  subject?: string | null;
  topic?: string | null;
  priority?: string | null;
  xpTarget?: number | null;
  plannedStartTime?: string | null;
  plannedEndTime?: string | null;
  isStudy?: boolean;
  domain?: {
    name: string;
    color: string;
    icon: string;
  };
};

type TodayPlanData = {
  id: string | null;
  dateFormatted: string;
  day300: {
    dayNumber: number;
    totalDays: number;
    formatted: string;
    percentage: number;
    daysRemaining: number;
  };
  tasks: TaskItem[];
};

type RoastData = {
  roast: string;
  category: string;
  missedItems: string[];
  consistencyScore: number;
  isPerfectDay: boolean;
};

export default function TodoPage() {
  const [tab, setTab] = useState<"today" | "tomorrow" | "recommendations">("today");
  const [todayData, setTodayData] = useState<TodayPlanData | null>(null);
  const [roastData, setRoastData] = useState<RoastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskDomain, setNewTaskDomain] = useState("Study");
  const [newTaskMinutes, setNewTaskMinutes] = useState(45);
  const [newTaskPriority, setNewTaskPriority] = useState("MEDIUM");
  const [addingTask, setAddingTask] = useState(false);

  // Tomorrow planning state
  const [tomorrowTasks, setTomorrowTasks] = useState<
    Array<{ description: string; domainName: string; minutesTarget: number; priority: string; isStudy?: boolean }>
  >([
    { description: "Chemistry — Topic Deep Dive (Learn & Active Recall)", domainName: "Study", minutesTarget: 60, priority: "HIGH", isStudy: true },
    { description: "JavaScript — Conditionals & Problem Practice", domainName: "Coding", minutesTarget: 60, priority: "HIGH", isStudy: true },
    { description: "Scheduled Daily Workout Session", domainName: "Workout", minutesTarget: 45, priority: "HIGH" },
  ]);
  const [savingTomorrow, setSavingTomorrow] = useState(false);
  const [tomorrowSavedMessage, setTomorrowSavedMessage] = useState("");

  const loadData = async () => {
    try {
      const [planRes, roastRes] = await Promise.all([
        fetch("/api/plan/today"),
        fetch("/api/accountability/roast"),
      ]);

      if (planRes.ok) {
        const p = await planRes.json();
        setTodayData(p);
      }
      if (roastRes.ok) {
        const r = await roastRes.json();
        setRoastData(r);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleToggleTask = async (task: TaskItem) => {
    if (task.completed) return; // already completed
    setCompletingId(task.id);

    try {
      const res = await fetch(`/api/plan/tasks/${task.id}/complete`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setTodayData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            tasks: prev.tasks.map((t) => (t.id === task.id ? { ...t, completed: true } : t)),
          };
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCompletingId(null);
    }
  };

  const handleAddTaskToday = async () => {
    if (!newTaskText.trim()) return;
    setAddingTask(true);

    try {
      const res = await fetch("/api/study/recommendation/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskText.trim(),
          targetDay: "today",
          minutes: newTaskMinutes,
          priority: newTaskPriority,
        }),
      });

      if (res.ok) {
        setNewTaskText("");
        await loadData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddingTask(false);
    }
  };

  const handleSaveTomorrowPlan = async () => {
    setSavingTomorrow(true);
    setTomorrowSavedMessage("");

    try {
      const res = await fetch("/api/plan/tomorrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: tomorrowTasks }),
      });

      if (res.ok) {
        const data = await res.json();
        setTomorrowSavedMessage(`✅ ${data.message || "Tomorrow's plan saved successfully!"}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingTomorrow(false);
    }
  };

  const completedCount = todayData?.tasks.filter((t) => t.completed).length || 0;
  const totalCount = todayData?.tasks.length || 0;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center gap-3 text-sm text-[var(--text-muted)]">
        <LoaderCircle size={20} className="animate-spin text-orange-500" />
        <span>Loading Daily Todo OS & 300-Day Journey...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] animate-fade-in pb-16 space-y-6">
      {/* ── HEADER / 300-DAY JOURNEY BANNER ─────────────────────────────────── */}
      <section className="flex flex-col justify-between gap-5 border-b border-[var(--border)] pb-6 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-orange-500/15 text-orange-400 border border-orange-500/30">
              <Flame size={14} /> {todayData?.day300.formatted || "DAY 1 / 300"}
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-slate-400 bg-slate-900 border border-slate-800">
              <Calendar size={13} /> {todayData?.dateFormatted || "Live Schedule"}
            </span>
            <span className="text-xs text-slate-500 font-mono">05:00 AM Ethiopia Day Rollover</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <CheckSquare className="text-orange-500" size={32} />
            Daily Todo & Planning OS
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--text-secondary)]">
            Execute today's scheduled tasks, earn XP, maintain consistency, and plan tomorrow's battle rhythm.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-1">
          <button
            className={`btn btn-sm ${
              tab === "today"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm font-bold"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
            onClick={() => setTab("today")}
          >
            <CheckSquare size={14} /> Today's Tasks ({completedCount}/{totalCount})
          </button>
          <button
            className={`btn btn-sm ${
              tab === "tomorrow"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm font-bold"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
            onClick={() => setTab("tomorrow")}
          >
            <Clock3 size={14} /> Plan Tomorrow
          </button>
        </div>
      </section>

      {/* ── ACCOUNTABILITY ROAST / CELEBRATION CARD ──────────────────────────── */}
      {roastData && (
        <section
          className={clsx(
            "rounded-2xl border p-5 shadow-xl transition-all",
            roastData.isPerfectDay
              ? "border-emerald-500/40 bg-gradient-to-r from-emerald-950/30 via-slate-900 to-slate-950"
              : "border-orange-500/30 bg-gradient-to-r from-orange-950/20 via-slate-900 to-slate-950"
          )}
        >
          <div className="flex items-start gap-4">
            <div
              className={clsx(
                "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border",
                roastData.isPerfectDay
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                  : "bg-orange-500/20 text-orange-400 border-orange-500/40"
              )}
            >
              {roastData.isPerfectDay ? <Award size={20} /> : <AlertTriangle size={20} />}
            </div>

            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-400">
                  {roastData.isPerfectDay ? "🔥 Flawless Execution" : "🔥 Forge Accountability Engine"}
                </span>
                <span className="text-xs text-slate-500">· Consistency: {roastData.consistencyScore}%</span>
              </div>
              <p className="text-sm font-semibold text-slate-200 leading-relaxed whitespace-pre-line">
                "{roastData.roast}"
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── TAB 1: TODAY'S TASKS ────────────────────────────────────────────── */}
      {tab === "today" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Main Task List */}
          <div className="space-y-4">
            {/* Progress Metric Bar */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-white">Daily Execution Progress</h3>
                  <p className="text-xs text-slate-400">Check boxes as you finish each task</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-orange-400">{completionPercentage}%</div>
                  <div className="text-[11px] text-slate-500 font-bold">
                    {completedCount} of {totalCount} completed
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-2.5 w-full rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>

            {/* Tasks Cards */}
            <div className="space-y-3">
              {todayData?.tasks.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-2xl">
                  No tasks scheduled for today yet. Use the form below or the Plan Tomorrow tab.
                </div>
              ) : (
                todayData?.tasks.map((task, index) => (
                  <article
                    key={task.id}
                    className={clsx(
                      "rounded-2xl border p-4 transition-all flex items-start gap-3.5",
                      task.completed
                        ? "border-emerald-500/30 bg-emerald-950/10 opacity-75"
                        : "border-[var(--border)] bg-[var(--bg-surface)] hover:border-slate-700"
                    )}
                  >
                    {/* Checkbox Button */}
                    <button
                      disabled={task.completed || completingId === task.id}
                      onClick={() => handleToggleTask(task)}
                      className={clsx(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 transition-all",
                        task.completed
                          ? "border-emerald-500 bg-emerald-500 text-black shadow-sm font-bold"
                          : "border-slate-700 hover:border-orange-500 bg-slate-950 text-slate-500"
                      )}
                      aria-label="Toggle task completion"
                    >
                      {completingId === task.id ? (
                        <LoaderCircle size={14} className="animate-spin text-orange-400" />
                      ) : task.completed ? (
                        <CheckCircle2 size={16} strokeWidth={3} />
                      ) : (
                        <Square size={14} />
                      )}
                    </button>

                    {/* Task Info */}
                    <div className="flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {task.domain && (
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border"
                            style={{
                              backgroundColor: `${task.domain.color}15`,
                              borderColor: `${task.domain.color}35`,
                              color: task.domain.color,
                            }}
                          >
                            {task.domain.name}
                          </span>
                        )}
                        {task.priority && (
                          <span
                            className={clsx(
                              "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                              task.priority === "HIGH"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : "bg-slate-800 text-slate-400"
                            )}
                          >
                            {task.priority}
                          </span>
                        )}
                        {task.plannedStartTime && (
                          <span className="text-[11px] font-mono text-slate-400">
                            🕒 {task.plannedStartTime} {task.plannedEndTime ? `- ${task.plannedEndTime}` : ""}
                          </span>
                        )}
                      </div>

                      <h4
                        className={clsx(
                          "text-sm font-bold leading-snug",
                          task.completed ? "line-through text-slate-400" : "text-white"
                        )}
                      >
                        {task.description}
                      </h4>

                      <div className="flex items-center gap-3 text-xs text-slate-400 pt-0.5">
                        <span>⏱️ {task.minutesTarget} mins</span>
                        <span>·</span>
                        <span className="text-amber-400 font-bold">+{task.xpTarget || Math.round(task.minutesTarget * 1.2)} XP</span>
                        {task.completed && (
                          <span className="text-emerald-400 font-bold text-[11px]">✓ Saved to Progress Engine</span>
                        )}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>

            {/* Fast Add Task Input */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Add Quick Task</h4>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Task description (e.g. Solve 10 Chemistry Stoichiometry problems)..."
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Mins"
                  value={newTaskMinutes}
                  onChange={(e) => setNewTaskMinutes(Number(e.target.value))}
                  className="w-20 rounded-xl border border-slate-700 bg-slate-950 px-2 py-2 text-xs font-mono text-center text-white focus:border-orange-500 focus:outline-none"
                />
                <button
                  onClick={handleAddTaskToday}
                  disabled={addingTask || !newTaskText.trim()}
                  className="btn btn-primary btn-sm rounded-xl font-bold flex items-center gap-1 shadow-md"
                >
                  <Plus size={14} /> Add Task
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar Overview */}
          <aside className="space-y-4">
            {/* 300-Day Milestone Tracker */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                  <Target size={14} /> 300-Day Journey
                </span>
                <span className="text-xs font-bold font-mono text-slate-400">
                  {todayData?.day300.percentage}% Done
                </span>
              </div>

              <div className="text-center py-2">
                <div className="text-4xl font-black text-white">{todayData?.day300.dayNumber}</div>
                <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mt-1">
                  Days Completed of 300
                </div>
                <div className="text-xs text-slate-500 mt-2 font-semibold">
                  {todayData?.day300.daysRemaining} days remaining until master transformation
                </div>
              </div>
            </div>

            {/* Protocol Rules Notice */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-2 text-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-orange-400 block">
                Daily Cutoff Policy
              </span>
              <p className="text-slate-300 leading-relaxed">
                Workouts and tasks must be logged before <strong>05:00 AM Ethiopia Time</strong>. At 05:00 AM, uncompleted items close permanently to preserve streak integrity.
              </p>
            </div>
          </aside>
        </div>
      )}

      {/* ── TAB 2: PLAN TOMORROW ────────────────────────────────────────────── */}
      {tab === "tomorrow" && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 space-y-6 shadow-xl">
          <div className="border-b border-[var(--border)] pb-4 space-y-1">
            <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
              <Clock3 className="text-orange-400" size={20} />
              Night Planning: Design Tomorrow's Targets
            </h3>
            <p className="text-xs text-slate-400">
              Set tomorrow's workout, chemistry, javascript, and study blocks before going to sleep.
            </p>
          </div>

          <div className="space-y-4">
            {tomorrowTasks.map((t, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <input
                  type="text"
                  value={t.description}
                  onChange={(e) => {
                    const copy = [...tomorrowTasks];
                    copy[idx].description = e.target.value;
                    setTomorrowTasks(copy);
                  }}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-none"
                />
                <select
                  value={t.domainName}
                  onChange={(e) => {
                    const copy = [...tomorrowTasks];
                    copy[idx].domainName = e.target.value;
                    setTomorrowTasks(copy);
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-none"
                >
                  <option value="Study">Study</option>
                  <option value="Coding">Coding</option>
                  <option value="Workout">Workout</option>
                  <option value="Reading">Reading</option>
                  <option value="Business">Business</option>
                  <option value="Faith">Faith</option>
                </select>
                <input
                  type="number"
                  value={t.minutesTarget}
                  onChange={(e) => {
                    const copy = [...tomorrowTasks];
                    copy[idx].minutesTarget = Number(e.target.value);
                    setTomorrowTasks(copy);
                  }}
                  className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-mono text-center text-white focus:border-orange-500 focus:outline-none"
                />
                <span className="text-xs text-slate-400">mins</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] pt-4">
            <button
              onClick={() =>
                setTomorrowTasks((prev) => [
                  ...prev,
                  { description: "New Focus Block", domainName: "Study", minutesTarget: 45, priority: "MEDIUM" },
                ])
              }
              className="btn btn-ghost btn-sm text-xs text-slate-300 hover:text-white flex items-center gap-1"
            >
              <Plus size={14} /> Add Another Block
            </button>

            <div className="flex items-center gap-3">
              {tomorrowSavedMessage && (
                <span className="text-xs font-bold text-emerald-400">{tomorrowSavedMessage}</span>
              )}
              <button
                onClick={handleSaveTomorrowPlan}
                disabled={savingTomorrow}
                className="btn btn-primary btn-sm font-bold shadow-lg"
              >
                {savingTomorrow ? <LoaderCircle size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Save Tomorrow's Plan
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
