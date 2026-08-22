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
  Utensils,
  TrendingUp,
  ShieldCheck,
  Send,
  LoaderCircle,
  Dumbbell,
  BookOpen,
  Calendar as CalendarIcon,
  Award
} from "lucide-react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from "recharts";

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
    location?: string;
    exercises?: Array<{ id: string; name: string }>;
  };
  nextWorkout?: {
    dateFormatted?: string;
    type?: string;
    location?: string;
  };
  weekNumber?: number;
  phase?: { goal?: string };
  completedToday?: boolean;
};

type ProfileStats = {
  totalXp: number;
  level: number;
  examDate?: string;
};

type MealAnalysis = {
  label: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  items: Array<{
    name: string;
    quantity: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
  coachFeedback: string;
};

export default function Home() {
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [nextWorkout, setNextWorkout] = useState<WorkoutToday | null>(null);
  const [profile, setProfile] = useState<ProfileStats>({ totalXp: 0, level: 1 });
  const [weeklyBalance, setWeeklyBalance] = useState<any>(null);

  // AI Nutrition Coach State
  const [mealInput, setMealInput] = useState("");
  const [analyzingMeal, setAnalyzingMeal] = useState(false);
  const [mealAnalysis, setMealAnalysis] = useState<MealAnalysis | null>(null);
  const [savedMealSuccess, setSavedMealSuccess] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [planRes, workoutRes, settingsRes, analyticsRes] = await Promise.all([
          fetch("/api/plan/today"),
          fetch("/api/workout/today"),
          fetch("/api/settings"),
          fetch("/api/analytics/weekly"),
        ]);

        if (planRes.ok) {
          const plan = await planRes.json();
          const taskList = Array.isArray(plan?.tasks) ? plan.tasks : [];
          setTasks(taskList);
          setCompleted(
            taskList.filter((task: PlanTask) => task.completed).map((task: PlanTask) => task.id)
          );
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

        if (analyticsRes.ok) {
          const analytics = await analyticsRes.json();
          if (analytics) {
            setWeeklyBalance(analytics);
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

  const analyzeMealPlan = async () => {
    if (!mealInput.trim()) return;
    setAnalyzingMeal(true);
    setSavedMealSuccess(false);

    try {
      const res = await fetch("/api/nutrition/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealDescription: mealInput, saveDirectly: false }),
      });

      if (res.ok) {
        const data = await res.json();
        setMealAnalysis(data.analysis);
      }
    } catch (err) {
      console.error("Nutrition coach error:", err);
    } finally {
      setAnalyzingMeal(false);
    }
  };

  const saveMealLog = async () => {
    if (!mealAnalysis) return;
    try {
      const res = await fetch("/api/nutrition/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealDescription: mealInput, saveDirectly: true }),
      });
      if (res.ok) {
        setSavedMealSuccess(true);
      }
    } catch (err) {
      console.error("Save meal error:", err);
    }
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
  const progressPercentage =
    totalTasksCount > 0 ? Math.round((completedCount / totalTasksCount) * 100) : 0;

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const nextWorkoutText = nextWorkout?.day?.type
    ? `${nextWorkout.day.type} (${nextWorkout.day.location || "GYM"}) · ${nextWorkout.day.exercises?.length ?? 0} exercises`
    : "Active Recovery";

  // Real-time weekly analytics from database
  const domainChartData = (weeklyBalance?.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']).map((dayName: string, idx: number) => {
    const item: Record<string, any> = { name: dayName, focusMinutes: 0 };
    if (weeklyBalance?.domains && Array.isArray(weeklyBalance.domains)) {
      weeklyBalance.domains.forEach((dom: any) => {
        const mins = Number(dom.minutes?.[idx]) || 0;
        item[dom.name] = mins;
        item.focusMinutes += mins;
      });
    }
    return item;
  });

  return (
    <div className="mx-auto w-full max-w-[1500px] animate-fade-in pb-16 space-y-6">
      {/* Hero / Greeting Section */}
      <section className="flex flex-col justify-between gap-5 border-b border-[var(--border)] pb-6 lg:flex-row lg:items-end">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--study)]">
            {dateLabel}
          </p>
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--text-muted)]">
            WELCOME BACK,
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl text-[var(--text-primary)] mt-0.5">
            MIKIYAS OLANA
          </h1>

          {/* Real Live Stats Display */}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[rgba(245,158,11,0.12)] border border-[rgba(245,158,11,0.25)] text-xs font-bold text-[var(--xp-gold)]">
              <Zap size={14} />
              <span>XP: {profile.totalXp.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[rgba(59,130,246,0.12)] border border-[rgba(59,130,246,0.25)] text-xs font-bold text-[var(--study)]">
              <Award size={14} />
              <span>LEVEL: {profile.level}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.25)] text-xs font-bold text-[var(--success)]">
              <TrendingUp size={14} />
              <span>PROGRESS: {progressPercentage}%</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400">
              <ShieldCheck size={14} />
              <span>SECURITY: ACTIVE</span>
            </div>
          </div>
        </div>

        {/* Workout Quick Jump */}
        <div className="flex items-center gap-3 rounded-xl border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.07)] px-4 py-3 shadow-sm">
          <Flame size={20} className="text-[var(--xp-gold)]" />
          <div>
            <div className="text-sm font-bold">{nextWorkoutText}</div>
            <div className="text-xs text-[var(--text-muted)]">
              Week {nextWorkout?.weekNumber ?? 1} of 24
            </div>
          </div>
          <Link href="/workout" aria-label="Open workout tracker">
            <ArrowUpRight
              size={16}
              className="text-[var(--xp-gold)] hover:scale-110 transition-transform ml-2"
            />
          </Link>
        </div>
      </section>

      {/* ── AI NUTRITION & FOOD COACH WIDGET ─────────────────────────────────── */}
      <section className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-950/20 via-slate-900/80 to-slate-950 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <Utensils size={18} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">
                What do you plan to eat today?
              </h2>
              <p className="text-xs text-slate-400">
                AI Nutritionist & Coach Trainer Macro Analysis
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400">
            Coach Mode
          </span>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <textarea
              className="w-full rounded-xl border border-slate-700 bg-slate-950/70 p-3.5 text-xs text-slate-100 placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-all"
              placeholder="e.g. 3 whole eggs with oatmeal, a banana, and whey protein. Lunch: 200g grilled chicken breast with white rice and steamed broccoli..."
              rows={2}
              value={mealInput}
              onChange={(e) => setMealInput(e.target.value)}
            />
            <button
              onClick={analyzeMealPlan}
              disabled={analyzingMeal || !mealInput.trim()}
              className="absolute bottom-3 right-3 btn btn-primary btn-sm rounded-lg flex items-center gap-1.5 font-bold shadow-md"
            >
              {analyzingMeal ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              {analyzingMeal ? "Analyzing..." : "Analyze Meal"}
            </button>
          </div>

          {/* AI Coach Analysis Results */}
          {mealAnalysis && (
            <div className="rounded-xl border border-slate-700 bg-slate-900/90 p-4 space-y-4 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
                    {mealAnalysis.label}
                  </span>
                  <div className="text-xl font-bold text-white mt-0.5">
                    {mealAnalysis.totalCalories} kcal
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-center px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block font-semibold">PROTEIN</span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      {mealAnalysis.totalProtein}g
                    </span>
                  </div>
                  <div className="text-center px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block font-semibold">CARBS</span>
                    <span className="text-xs font-bold text-blue-400 font-mono">
                      {mealAnalysis.totalCarbs}g
                    </span>
                  </div>
                  <div className="text-center px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block font-semibold">FATS</span>
                    <span className="text-xs font-bold text-amber-400 font-mono">
                      {mealAnalysis.totalFat}g
                    </span>
                  </div>
                </div>
              </div>

              {/* Coach Feedback Box */}
              <div className="rounded-lg border-l-4 border-orange-500 bg-orange-950/20 p-3 text-xs text-slate-200">
                <span className="font-bold text-orange-400 block mb-1">
                  🏋️ Coach Trainer Insight:
                </span>
                {mealAnalysis.coachFeedback}
              </div>

              {/* Items Breakdown & Save Button */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap gap-2">
                  {mealAnalysis.items.map((item, i) => (
                    <span
                      key={i}
                      className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono"
                    >
                      {item.name} ({item.quantity}) · {item.calories} cal
                    </span>
                  ))}
                </div>

                <button
                  onClick={saveMealLog}
                  disabled={savedMealSuccess}
                  className={`btn btn-sm ${
                    savedMealSuccess ? "btn-ghost text-emerald-400" : "btn-primary"
                  } rounded-lg font-bold`}
                >
                  {savedMealSuccess ? (
                    <>
                      <Check size={14} /> Saved to Daily Nutrition!
                    </>
                  ) : (
                    "Save to Today's Food Log"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Main Grid: Plan Tasks & Charts */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]">
        {/* Today's Schedule */}
        <section className="card overflow-hidden p-0 shadow-lg">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <div>
              <h2 className="text-lg font-bold">Today&apos;s Scheduled Priorities</h2>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
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
                      aria-label={
                        isDone ? `Mark ${task.title} incomplete` : `Complete ${task.title}`
                      }
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
                      <div
                        className={`text-sm font-semibold ${
                          isDone
                            ? "line-through text-[var(--text-muted)]"
                            : "text-[var(--text-primary)]"
                        }`}
                      >
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
                  Your day schedule is clear. Generate your AI-optimized schedule based on your domain priorities.
                </p>
                <Link
                  href="/plans"
                  className="btn btn-primary btn-sm inline-flex items-center gap-1.5"
                >
                  <Sparkles size={14} /> Generate Today&apos;s Schedule
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--bg-elevated)] px-5 py-3">
            <span className="text-xs text-[var(--text-muted)] font-mono">
              FORGE OS / REAL-TIME DATABASE
            </span>
            <Link
              href="/plans"
              className="flex items-center gap-1 text-xs font-bold text-[var(--study)] hover:underline"
            >
              View full plan <ChevronRight size={14} />
            </Link>
          </div>
        </section>

        {/* Sidebar: Progress Chart & Focus Timer */}
        <div className="space-y-5">
          {/* Progress Analytics Chart */}
          <section className="card p-5 border-slate-800 bg-slate-900/60 shadow-lg">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                <TrendingUp size={14} /> Weekly Progression
              </h4>
              <span className="text-[10px] text-slate-400">Past 7 Days</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={domainChartData}
                  margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="progXpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "10px",
                      fontSize: "11px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="focusMinutes"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#progXpGrad)"
                    name="Focus Minutes"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Focus Timer */}
          <section className="card shadow-md">
            <div className="mb-3 flex items-center justify-between border-b border-[var(--border)] pb-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">
                Focus Timer
              </h4>
              <TimerReset size={15} className="text-[var(--text-muted)]" />
            </div>
            <div className="flex items-center justify-between">
              <div className="font-mono text-4xl font-bold tracking-tight text-white">
                {running ? "24:59" : "25:00"}
              </div>
              <button
                onClick={() => setRunning(!running)}
                className="btn btn-primary btn-sm rounded-lg font-bold"
              >
                <Play size={14} fill="currentColor" /> {running ? "Pause" : "Start"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
