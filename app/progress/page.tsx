"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp, Calendar, Zap, Award, Flame, Star, Trophy,
  ChevronLeft, ChevronRight, RefreshCw, FileText, CheckCircle2,
  XCircle, AlertCircle, BarChart3, Dumbbell, BookOpen, Code,
  UtensilsCrossed, Target, Shield, ArrowUpRight, Clock
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { clsx } from "clsx";

interface DayBreakdown {
  dateIso: string;
  formattedDate: string;
  dayOfWeek: string;
  consistencyScore: number;
  color: 'GREEN' | 'BLUE' | 'YELLOW' | 'RED' | 'GRAY';
  xpEarned: number;
  workout: {
    completed: boolean;
    type?: string;
    exercisesLogged: number;
    score: number;
  };
  tasks: {
    completed: number;
    total: number;
    percentage: number;
  };
  study: {
    minutes: number;
    targetMinutes: number;
    score: number;
  };
  coding: {
    minutes: number;
    targetMinutes: number;
    score: number;
  };
  reading: {
    minutes: number;
    targetMinutes: number;
    score: number;
  };
  habits: {
    completed: number;
    total: number;
    score: number;
  };
  nutrition: {
    calories: number;
    targetCalories: number;
    protein: number;
    targetProtein: number;
    score: number;
  };
  strongestArea: string;
  weakestArea: string;
  whatImproved: string;
  whatNeedsAttentionTomorrow: string;
  missedActivities: string[];
}

interface Achievement {
  code: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

interface ProgressData {
  overview: {
    totalXp: number;
    level: number;
    currentLevelXp: number;
    nextLevelXp: number;
    progress: number;
    activeStreak: number;
    unlockedAchievementsCount: number;
    totalAchievementsCount: number;
  };
  today: DayBreakdown;
  history: DayBreakdown[];
  calendar: {
    year: number;
    month: number;
    days: DayBreakdown[];
  };
  achievements: Achievement[];
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; label: string }> = {
  GREEN: {
    bg: "bg-emerald-500/20",
    text: "text-emerald-400",
    border: "border-emerald-500/40",
    label: "Excellent (≥80%)"
  },
  BLUE: {
    bg: "bg-blue-500/20",
    text: "text-blue-400",
    border: "border-blue-500/40",
    label: "Good (60-79%)"
  },
  YELLOW: {
    bg: "bg-amber-500/20",
    text: "text-amber-400",
    border: "border-amber-500/40",
    label: "Partial (40-59%)"
  },
  RED: {
    bg: "bg-rose-500/20",
    text: "text-rose-400",
    border: "border-rose-500/40",
    label: "Missed/Weak (<40%)"
  },
  GRAY: {
    bg: "bg-slate-800/40",
    text: "text-slate-500",
    border: "border-slate-800",
    label: "No Activity"
  },
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function ProgressDashboard() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<number>(30); // 7, 30, 90, 180, 365
  const [graphMetric, setGraphMetric] = useState<string>("consistency"); // consistency, xp, workout, tasks, study, coding, reading, nutrition
  const [selectedDay, setSelectedDay] = useState<DayBreakdown | null>(null);
  const [calYear, setCalYear] = useState<number>(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState<number>(new Date().getMonth() + 1);
  const [achievementCategory, setAchievementCategory] = useState<string>("all");

  const loadProgress = async (days = timeRange, yr = calYear, m = calMonth) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/progress?days=${days}&year=${yr}&month=${m}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (!selectedDay && json.today) {
          setSelectedDay(json.today);
        }
      }
    } catch (err) {
      console.error("Failed to load progress data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgress(timeRange, calYear, calMonth);
  }, [timeRange, calYear, calMonth]);

  const handleRecalculate = async () => {
    try {
      setRefreshing(true);
      await fetch("/api/progress", { method: "POST" });
      await loadProgress(timeRange, calYear, calMonth);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  const handlePrevMonth = () => {
    if (calMonth === 1) {
      setCalYear(calYear - 1);
      setCalMonth(12);
    } else {
      setCalMonth(calMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 12) {
      setCalYear(calYear + 1);
      setCalMonth(1);
    } else {
      setCalMonth(calMonth + 1);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="animate-spin text-orange-500" size={32} />
          <p className="text-sm text-[var(--text-muted)] font-medium">Calculating real personal progress...</p>
        </div>
      </div>
    );
  }

  const overview = data?.overview;
  const today = data?.today;
  const history = data?.history || [];
  const calendarDays = data?.calendar?.days || [];
  const achievements = data?.achievements || [];

  // Graph dataset preparation
  const chartData = history.map((d) => ({
    date: d.formattedDate,
    dayOfWeek: d.dayOfWeek,
    consistency: d.consistencyScore,
    xp: d.xpEarned,
    workout: d.workout.score,
    tasks: d.tasks.percentage,
    study: d.study.score,
    coding: d.coding.score,
    reading: d.reading.score,
    nutrition: d.nutrition.score,
    color: d.color,
  }));

  const filteredAchievements = achievements.filter((a) =>
    achievementCategory === "all" ? true : a.category === achievementCategory
  );

  return (
    <div className="space-y-8 pb-16">
      {/* Header & Overview Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/30 rounded-full">
              Real-Time OS Engine
            </span>
            <span className="text-xs text-[var(--text-muted)]">Timezone: Africa/Addis_Ababa (05:00)</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <TrendingUp className="text-orange-500" size={32} />
            Personal Progress Dashboard
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Transparent database-recorded performance, consistency scoring, streaks, and achievements.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleRecalculate}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border)] transition-all shadow-sm"
          >
            <RefreshCw size={14} className={clsx(refreshing && "animate-spin text-orange-400")} />
            <span>{refreshing ? "Recalculating..." : "Recalculate"}</span>
          </button>

          <Link
            href="/progress/reports"
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-md transition-all"
          >
            <FileText size={14} />
            <span>Monthly Reports & PDF</span>
          </Link>
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Level & XP */}
        <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Character Status</span>
            <Zap size={16} className="text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">Level {overview?.level ?? 1}</span>
            <span className="text-xs font-semibold text-amber-400">({overview?.totalXp.toLocaleString()} XP)</span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-[var(--text-muted)] mb-1">
              <span>Progress</span>
              <span>{Math.round((overview?.progress ?? 0) * 100)}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((overview?.progress ?? 0) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Today's Consistency Score */}
        <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Today's Score</span>
            <Target size={16} className="text-blue-400" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black text-white">{today?.consistencyScore ?? 0}%</span>
            <span className={clsx(
              "px-2 py-0.5 text-xs font-bold rounded-md border",
              COLOR_MAP[today?.color || 'GRAY'].bg,
              COLOR_MAP[today?.color || 'GRAY'].text,
              COLOR_MAP[today?.color || 'GRAY'].border
            )}>
              {today?.color || 'GRAY'}
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2 line-clamp-1">
            Strongest: <span className="text-[var(--text-primary)] font-medium">{today?.strongestArea}</span>
          </p>
        </div>

        {/* Active Streak */}
        <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Consistency Streak</span>
            <Flame size={16} className="text-orange-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{overview?.activeStreak ?? 0}</span>
            <span className="text-xs font-semibold text-[var(--text-muted)]">consecutive days (≥60%)</span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            {overview?.activeStreak ? "Streak locked in and active" : "Log activities to build momentum"}
          </p>
        </div>

        {/* Achievements Unlocked */}
        <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Achievements</span>
            <Trophy size={16} className="text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{overview?.unlockedAchievementsCount ?? 0}</span>
            <span className="text-xs font-semibold text-[var(--text-muted)]">of {overview?.totalAchievementsCount ?? 10} Unlocked</span>
          </div>
          <div className="flex items-center gap-1 mt-2">
            {Array.from({ length: overview?.totalAchievementsCount ?? 10 }).map((_, i) => (
              <div
                key={i}
                className={clsx(
                  "h-1.5 flex-1 rounded-full",
                  i < (overview?.unlockedAchievementsCount ?? 0) ? "bg-emerald-400" : "bg-slate-800"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Large Responsive Real-Time Progress Graph */}
      <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <BarChart3 className="text-blue-400" size={20} />
              Real-Time Progress Metrics
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Dynamic database timeline across all personal growth vectors
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Metric Selector */}
            <div className="flex items-center bg-[var(--bg-elevated)] p-1 rounded-lg border border-[var(--border)] text-xs">
              {[
                { id: "consistency", label: "Consistency" },
                { id: "workout", label: "Workout" },
                { id: "tasks", label: "Tasks" },
                { id: "study", label: "Study" },
                { id: "coding", label: "Coding" },
                { id: "reading", label: "Reading" },
                { id: "nutrition", label: "Nutrition" },
                { id: "xp", label: "XP" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setGraphMetric(m.id)}
                  className={clsx(
                    "px-2.5 py-1 rounded-md font-semibold transition-all",
                    graphMetric === m.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-[var(--text-muted)] hover:text-white"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Time Range Selector */}
            <div className="flex items-center bg-[var(--bg-elevated)] p-1 rounded-lg border border-[var(--border)] text-xs">
              {[
                { days: 7, label: "7D" },
                { days: 30, label: "30D" },
                { days: 90, label: "3M" },
                { days: 180, label: "6M" },
                { days: 365, label: "1Y" },
              ].map((r) => (
                <button
                  key={r.days}
                  onClick={() => setTimeRange(r.days)}
                  className={clsx(
                    "px-2.5 py-1 rounded-md font-semibold transition-all",
                    timeRange === r.days
                      ? "bg-orange-500 text-white shadow-sm"
                      : "text-[var(--text-muted)] hover:text-white"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart Area */}
        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="metricGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={graphMetric === "xp" ? "#f59e0b" : "#3b82f6"} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={graphMetric === "xp" ? "#f59e0b" : "#3b82f6"} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis
                domain={graphMetric === "xp" ? ['auto', 'auto'] : [0, 100]}
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                unit={graphMetric === "xp" ? "" : "%"}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#334155",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#f8fafc",
                }}
                formatter={(value: any) => [
                  graphMetric === "xp" ? `${value} XP` : `${value}%`,
                  graphMetric.toUpperCase(),
                ]}
              />
              <Area
                type="monotone"
                dataKey={graphMetric}
                stroke={graphMetric === "xp" ? "#f59e0b" : "#3b82f6"}
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#metricGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2-Column Section: Progress Calendar (Left) & Daily Performance Detail Drawer (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Progress Calendar */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="text-orange-400" size={20} />
                Consistency Calendar
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Click any day to inspect detailed activity breakdowns
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">
                {MONTH_NAMES[calMonth - 1]} {calYear}
              </span>
              <div className="flex items-center gap-1 bg-[var(--bg-elevated)] p-1 rounded-lg border border-[var(--border)]">
                <button
                  onClick={handlePrevMonth}
                  className="p-1 rounded hover:bg-slate-700 text-[var(--text-muted)] hover:text-white"
                  title="Previous Month"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-1 rounded hover:bg-slate-700 text-[var(--text-muted)] hover:text-white"
                  title="Next Month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Color Legend */}
          <div className="flex items-center gap-3 flex-wrap py-2 border-y border-[var(--border)] text-[11px]">
            {Object.entries(COLOR_MAP).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={clsx("w-3 h-3 rounded border", cfg.bg, cfg.border)} />
                <span className="text-[var(--text-muted)] font-medium">{cfg.label}</span>
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2 pt-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-center text-[11px] font-bold text-[var(--text-muted)] uppercase py-1">
                {d}
              </div>
            ))}

            {calendarDays.map((day, idx) => {
              const dayNum = idx + 1;
              const isSelected = selectedDay?.dateIso === day.dateIso;
              const colorCfg = COLOR_MAP[day.color];

              return (
                <button
                  key={day.dateIso}
                  onClick={() => setSelectedDay(day)}
                  className={clsx(
                    "p-2.5 rounded-xl border flex flex-col items-center justify-between min-h-[64px] transition-all text-left",
                    colorCfg.bg,
                    colorCfg.border,
                    isSelected ? "ring-2 ring-orange-500 shadow-md scale-105" : "hover:brightness-125"
                  )}
                >
                  <div className="w-full flex justify-between items-center text-xs font-bold text-white">
                    <span>{dayNum}</span>
                    {day.workout.completed && (
                      <Dumbbell size={11} className="text-orange-400" />
                    )}
                  </div>

                  <div className={clsx("text-xs font-extrabold mt-1", colorCfg.text)}>
                    {day.color === 'GRAY' ? '—' : `${day.consistencyScore}%`}
                  </div>

                  {day.xpEarned > 0 && (
                    <span className="text-[9px] text-amber-400 font-semibold">
                      +{day.xpEarned} XP
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right 1 Col: Daily Performance Breakdown Drawer */}
        <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-sm space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
                {selectedDay?.dayOfWeek}
              </span>
              <span className={clsx(
                "px-2 py-0.5 text-xs font-bold rounded border",
                selectedDay ? COLOR_MAP[selectedDay.color].bg : "",
                selectedDay ? COLOR_MAP[selectedDay.color].text : "",
                selectedDay ? COLOR_MAP[selectedDay.color].border : ""
              )}>
                {selectedDay?.consistencyScore ?? 0}% Consistency
              </span>
            </div>
            <h3 className="text-lg font-bold text-white mt-1">
              {selectedDay?.formattedDate || "Select a Day"}
            </h3>
          </div>

          {selectedDay ? (
            <div className="space-y-4 text-xs">
              {/* Category Breakdown list */}
              <div className="space-y-2.5">
                {/* Workout */}
                <div className="p-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Dumbbell size={15} className="text-orange-400" />
                    <span className="font-semibold text-white">Workout</span>
                  </div>
                  <span className={clsx("font-bold", selectedDay.workout.completed ? "text-emerald-400" : "text-slate-500")}>
                    {selectedDay.workout.completed ? `Completed (${selectedDay.workout.type || 'Session'})` : "Not Completed"}
                  </span>
                </div>

                {/* Tasks */}
                <div className="p-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-blue-400" />
                    <span className="font-semibold text-white">Daily Tasks</span>
                  </div>
                  <span className="font-bold text-white">
                    {selectedDay.tasks.completed}/{selectedDay.tasks.total} ({selectedDay.tasks.percentage}%)
                  </span>
                </div>

                {/* Study Focus */}
                <div className="p-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen size={15} className="text-sky-400" />
                    <span className="font-semibold text-white">Study Focus</span>
                  </div>
                  <span className="font-bold text-white">{selectedDay.study.minutes} mins</span>
                </div>

                {/* Coding Focus */}
                <div className="p-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code size={15} className="text-emerald-400" />
                    <span className="font-semibold text-white">Coding Sessions</span>
                  </div>
                  <span className="font-bold text-white">{selectedDay.coding.minutes} mins</span>
                </div>

                {/* Reading & Books */}
                <div className="p-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen size={15} className="text-purple-400" />
                    <span className="font-semibold text-white">Reading & Scripture</span>
                  </div>
                  <span className="font-bold text-white">{selectedDay.reading.minutes} mins</span>
                </div>

                {/* Habits */}
                <div className="p-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target size={15} className="text-amber-400" />
                    <span className="font-semibold text-white">Habits Adherence</span>
                  </div>
                  <span className="font-bold text-white">
                    {selectedDay.habits.completed}/{selectedDay.habits.total}
                  </span>
                </div>

                {/* Nutrition */}
                <div className="p-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed size={15} className="text-rose-400" />
                    <span className="font-semibold text-white">Nutrition</span>
                  </div>
                  <span className="font-bold text-white">
                    {selectedDay.nutrition.calories} kcal / {selectedDay.nutrition.protein}g protein
                  </span>
                </div>
              </div>

              {/* Performance Analysis Box */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-[var(--border)] space-y-2">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Shield size={14} className="text-orange-400" />
                  Performance Analysis
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Strongest: </span>
                  <span className="text-emerald-400 font-semibold">{selectedDay.strongestArea}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Weakest: </span>
                  <span className="text-rose-400 font-semibold">{selectedDay.weakestArea}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Insight: </span>
                  <span className="text-[var(--text-secondary)]">{selectedDay.whatImproved}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Tomorrow: </span>
                  <span className="text-amber-400 font-semibold">{selectedDay.whatNeedsAttentionTomorrow}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">Select a date from the calendar to inspect performance.</p>
          )}
        </div>
      </div>

      {/* Real Achievements Shelf */}
      <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Trophy className="text-amber-400" size={20} />
              Achievements & Milestones
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Real milestones unlocked through verified database records
            </p>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1 bg-[var(--bg-elevated)] p-1 rounded-lg border border-[var(--border)] text-xs">
            {['all', 'workout', 'streak', 'xp', 'mastery'].map((cat) => (
              <button
                key={cat}
                onClick={() => setAchievementCategory(cat)}
                className={clsx(
                  "px-2.5 py-1 rounded-md font-semibold capitalize transition-all",
                  achievementCategory === cat
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-[var(--text-muted)] hover:text-white"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {filteredAchievements.map((ach) => (
            <div
              key={ach.code}
              className={clsx(
                "p-3.5 rounded-xl border flex items-start gap-3 transition-all",
                ach.unlocked
                  ? "bg-slate-900/80 border-amber-500/40 shadow-sm"
                  : "bg-slate-950/40 border-slate-800 opacity-60"
              )}
            >
              <div className={clsx(
                "p-2.5 rounded-lg",
                ach.unlocked ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-600"
              )}>
                <Award size={20} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className={clsx("text-sm font-bold", ach.unlocked ? "text-white" : "text-slate-400")}>
                    {ach.title}
                  </h4>
                  {ach.unlocked && (
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      UNLOCKED
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{ach.description}</p>
                {ach.unlockedAt && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Earned: {new Date(ach.unlockedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
