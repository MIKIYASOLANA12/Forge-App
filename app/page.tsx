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
import { DailyMotivation } from "@/components/dashboard/DailyMotivation";

import { clsx } from "clsx";
import { CommandCenterGreeting } from "@/components/dashboard/CommandCenterGreeting";
import { formatTaskForDisplay } from "@/lib/planParser";
import { SmartScheduleCard } from "@/components/dashboard/SmartScheduleCard";
import { CountdownsGrid } from "@/components/dashboard/CountdownsGrid";
import { HolidayWorkoutCard } from "@/components/dashboard/HolidayWorkoutCard";
import { SleepScheduleCard } from "@/components/dashboard/SleepScheduleCard";
import type { SmartScheduleStatus } from "@/lib/smartSchedule";
import type { CountdownCard } from "@/lib/countdowns";
import type { HolidayStatus } from "@/lib/holidayWorkout";
import { PlanTaskCard } from "@/components/tasks/PlanTaskCard";

type PlanTask = {
  id: string;
  description: string;
  domain?: { name: string; color?: string } | null;
  minutesTarget?: number | null;
  completed?: boolean;
};

type AccountabilityData = {
  status: 'PENDING' | 'RESOLVED';
  addisDateKey: string;
  missedItems: string[];
  roast: string | null;
  acknowledged: boolean;
  acknowledgementText: string | null;
  acknowledgementAt: string | null;
  resolvedAt: string | null;
  reminderCount: number;
};

type YesterdayData = {
  dateFormatted: string;
  workout: { status: 'COMPLETED' | 'MISSED'; type: string };
  tasks: Array<{ id: string; description: string; completed: boolean; status: 'COMPLETED' | 'MISSED'; minutesTarget: number }>;
  completedCount: number;
  totalCount: number;
  habits?: { completed: number; total: number; missedNames: string[] };
  missedItems?: string[];
  completedItems?: string[];
  workoutMissed?: boolean;
};

type WorkoutToday = {
  day?: {
    type?: string;
    location?: string;
    targetBodyParts?: string;
    exercises?: Array<{ id: string; name: string }>;
  };
  nextWorkout?: {
    dateFormatted?: string;
    type?: string;
    location?: string;
    targetBodyParts?: string;
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
  const [accountability, setAccountability] = useState<AccountabilityData | null>(null);
  const [yesterday, setYesterday] = useState<YesterdayData | null>(null);
  const [smartSchedule, setSmartSchedule] = useState<SmartScheduleStatus | null>(null);
  const [countdowns, setCountdowns] = useState<CountdownCard[]>([]);
  const [holidayStatus, setHolidayStatus] = useState<HolidayStatus | null>(null);

  // AI Nutrition Coach State
  const [mealInput, setMealInput] = useState("");
  const [analyzingMeal, setAnalyzingMeal] = useState(false);
  const [mealAnalysis, setMealAnalysis] = useState<MealAnalysis | null>(null);
  const [savedMealSuccess, setSavedMealSuccess] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [planRes, workoutRes, settingsRes, analyticsRes, scheduleRes] = await Promise.all([
          fetch("/api/plan/today"),
          fetch("/api/workout/today"),
          fetch("/api/settings"),
          fetch("/api/analytics/weekly"),
          fetch("/api/schedule/now"),
        ]);

        if (planRes.ok) {
          const plan = await planRes.json();
          const taskList = Array.isArray(plan?.tasks) ? plan.tasks : [];
          setTasks(taskList);
          setCompleted(
            taskList.filter((task: PlanTask) => task.completed).map((task: PlanTask) => task.id)
          );
          if (plan?.accountability) setAccountability(plan.accountability);
          if (plan?.yesterday) setYesterday(plan.yesterday);
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

        if (scheduleRes.ok) {
          const schedData = await scheduleRes.json();
          if (schedData.schedule) setSmartSchedule(schedData.schedule);
          if (schedData.countdowns) setCountdowns(schedData.countdowns);
          if (schedData.holiday) setHolidayStatus(schedData.holiday);
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

  const totalTasksCount = tasks.length;
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
    ? `${nextWorkout.day.type} (${nextWorkout.day.targetBodyParts || "Chest, Shoulders & Triceps"}) · ${nextWorkout.day.location || "GYM"}`
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
      {/* ── 1. COMMAND CENTER PERSONALIZED GREETING & LIVE STATS ─────────── */}
      <CommandCenterGreeting
        greeting={smartSchedule?.greeting || "Welcome back, Mikiyas."}
        subGreeting={smartSchedule?.subGreeting || "Here is your personal command center and daily execution roadmap."}
        totalXp={profile.totalXp}
        level={profile.level}
        progressPercent={progressPercentage}
      />

      {/* ── 2. SMART 'WHAT SHOULD I DO RIGHT NOW?' COMMAND CARD ───────────── */}
      <SmartScheduleCard
        schedule={smartSchedule}
        onQuickCompleteTask={toggleTask}
      />

      {/* ── 3. CRITICAL COUNTDOWNS GRID (Exam, 7-Month Transformation, Holiday) */}
      <CountdownsGrid countdowns={countdowns} />

      {/* ── 4. 16-DAY GRANDMOTHER-HOUSE HOLIDAY WORKOUT (Aug 31 - Sep 15) ───── */}
      {holidayStatus?.isHolidayPeriod && (
        <HolidayWorkoutCard
          holiday={holidayStatus}
          workoutCompleted={Boolean(nextWorkout?.completedToday)}
        />
      )}

      {/* ── 5. FIXED 11:00 AM WAKE-UP & SLEEP CONSISTENCY CARD ─────────────── */}
      <SleepScheduleCard />

      {/* ── ACCOUNTABILITY STATUS (spec section 10) ─────────────────────────── */}
      {accountability && (
        <section
          className={clsx(
            "rounded-2xl border p-4 flex flex-col gap-2 shadow-xl",
            accountability.status === "PENDING"
              ? "border-rose-500/40 bg-rose-950/30"
              : "border-emerald-500/40 bg-emerald-950/20"
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border",
                accountability.status === "PENDING"
                  ? "bg-rose-500/15 text-rose-300 border-rose-500/40"
                  : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
              )}
            >
              {accountability.status === "PENDING" ? "🟡 Accountability pending" : "🟢 Accountability resolved"}
            </span>
            {accountability.status === "PENDING" && (
              <span className="text-xs text-rose-300/80">Reminders sent: {accountability.reminderCount}</span>
            )}
          </div>
          {accountability.status === "PENDING" ? (
            <div className="text-sm space-y-1">
              <p className="font-bold text-rose-200">
                Missed date: <span className="font-mono text-rose-300">{accountability.addisDateKey}</span>
              </p>
              <p className="text-rose-200/90">
                Missed:{" "}
                {accountability.missedItems.length > 0
                  ? accountability.missedItems.map((m) => `❌ ${formatTaskForDisplay(m)}`).join(" · ")
                  : "—"}
              </p>
              {accountability.roast && (
                <p className="italic text-rose-300/70">"{formatTaskForDisplay(accountability.roast)}"</p>
              )}
              <p className="text-rose-200/70 text-xs">
                Acknowledge by replying to Forge on Telegram: "I'm so sorry, I will not do it again".
              </p>
            </div>
          ) : (
            <p className="text-sm text-emerald-200/90">
              {accountability.acknowledged
                ? `Acknowledged ✓ — ${accountability.acknowledgementText ?? "Apology accepted"}.`
                : "No outstanding accountability holds. All closed-day misses have been acknowledged."}
            </p>
          )}
        </section>
      )}

      {/* ── YESTERDAY'S MISSED ITEMS (spec section 11) ─────────────────────────── */}
      {yesterday && yesterday.missedItems && yesterday.missedItems.length > 0 && (
        <section className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-rose-500/20 pb-2 mb-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-rose-400">
              🔴 Yesterday's Missed Items — LOCKED
            </h3>
            <span className="text-xs text-slate-400 font-mono">{yesterday.dateFormatted}</span>
          </div>
          <ul className="space-y-1.5">
            {yesterday.missedItems.map((m) => (
              <li key={m} className="flex items-center justify-between text-sm text-rose-300">
                <span className="font-semibold">🔴 {formatTaskForDisplay(m)}</span>
                <span className="text-[10px] font-bold text-rose-400 uppercase bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                  MISSED / LOCKED
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── DAILY MOTIVATION & TEACHER MENTORSHIP WIDGET ─────────────────────── */}
      <DailyMotivation />

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

          <div className="p-4 sm:p-5 space-y-4">
            {tasks.length > 0 ? (
              tasks.map((task, index) => {
                const isDone = completed.includes(task.id);
                return (
                  <PlanTaskCard
                    key={task.id}
                    task={task}
                    index={index}
                    isDone={isDone}
                    onToggle={() => toggleTask(task.id)}
                    onStartFocus={() => setRunning(!running)}
                  />
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
