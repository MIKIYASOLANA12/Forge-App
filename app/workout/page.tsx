"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Clock3,
  Dumbbell,
  History,
  LoaderCircle,
  RotateCcw,
  TimerReset,
  Flame,
  Lock,
  TrendingUp,
  Calendar,
  Sparkles,
  Award,
  ChevronRight,
  Unlock,
  AlertCircle
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Exercise = {
  id: string;
  name: string;
  order: number;
  lastLog: {
    setsCompleted: number;
    repsCompleted: number;
    weightKg: number | null;
  } | null;
};

type NextWorkout = {
  dateFormatted: string;
  unlockTimestamp: number;
  type: string;
  location: string;
  phase: {
    weeks: readonly number[];
    sets: number;
    reps: string;
    goal: string;
  };
  exercises: { id: string; name: string; order: number }[];
};

type TodayData = {
  currentDayName?: string;
  currentDateFormatted?: string;
  isWeekendPreLaunch?: boolean;
  launchMondayFormatted?: string;
  launchUnlockTimestamp?: number;
  completedToday: boolean;
  todayLog: {
    id: string;
    completedAt: string;
    type: string;
    notes: string | null;
  } | null;
  day: {
    id: string;
    type: string;
    location: string;
    exercises: Exercise[];
  };
  nextWorkout: NextWorkout;
  weekNumber: number;
  phase: {
    weeks: readonly number[];
    sets: number;
    reps: string;
    goal: string;
  };
  isNewPhase: boolean;
};

type HistoryLog = {
  id: string;
  completedAt: string;
  weekNumber: number;
  notes: string | null;
  workoutDay: { type: string };
  exerciseLogs: {
    id: string;
    setsCompleted: number;
    repsCompleted: number;
    weightKg: number | null;
    checked: boolean;
    exercise: { name: string };
  }[];
};

const dayLabel = (type: string) =>
  type === "LegsCore" ? "LEGS + CORE" : `${type.toUpperCase()} DAY`;

export default function WorkoutPage() {
  const [tab, setTab] = useState<"today" | "progress" | "history">("today");
  const [today, setToday] = useState<TodayData | null>(null);
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [rest, setRest] = useState(90);
  const [restRunning, setRestRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [manualOverride, setManualOverride] = useState(false);

  const loadTodayData = () => {
    fetch("/api/workout/today")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: TodayData | null) => {
        setToday(data);
        if (data && data.day?.exercises) {
          setWeights(
            Object.fromEntries(
              data.day.exercises.map((ex) => [
                ex.id,
                ex.lastLog?.weightKg?.toString() ?? "",
              ])
            )
          );
        }
      });
  };

  useEffect(() => {
    loadTodayData();
  }, []);

  useEffect(() => {
    if (tab === "history" || tab === "progress") {
      fetch("/api/workout/history")
        .then((res) => res.json())
        .then(setHistory);
    }
  }, [tab]);

  // Rest Timer
  useEffect(() => {
    if (!restRunning || rest <= 0) return;
    const timer = window.setInterval(() => setRest((v) => v - 1), 1000);
    return () => window.clearInterval(timer);
  }, [restRunning, rest]);

  useEffect(() => {
    if (rest === 0) setRestRunning(false);
  }, [rest]);

  const toggle = (id: string) => {
    setChecked((curr) => ({ ...curr, [id]: !curr[id] }));
    setRest(90);
  };

  const finishSession = async () => {
    if (!today) return;
    setSaving(true);

    const response = await fetch("/api/workout/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workoutDayId: today.day.id,
        weekNumber: today.weekNumber,
        notes,
        exerciseLogs: today.day.exercises.map((ex) => ({
          exerciseId: ex.id,
          setsCompleted: today.phase.sets,
          repsCompleted: Number(today.phase.reps.split("-")[0] || 8),
          weightKg: weights[ex.id] ? Number(weights[ex.id]) : null,
          checked: Boolean(checked[ex.id]),
        })),
      }),
    });

    const data = response.ok ? await response.json() : null;
    setSaving(false);

    if (data) {
      setMessage(`🎉 Workout Completed! +${data.xpEarned} XP`);
      setChecked({});
      setNotes("");
      loadTodayData();
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] animate-fade-in pb-16">
      {/* Real-Time Header */}
      <section className="mb-6 flex flex-col justify-between gap-5 border-b border-[var(--border)] pb-6 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <Calendar size={13} /> {today?.currentDateFormatted || "Live Schedule"}
            </span>
            {today?.day?.location && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {today.day.location.includes("GYM") ? "🏋️‍♂️ GYM PROTOCOL" : "🏠 HOME PROTOCOL"}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Workout Progression OS
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--text-secondary)]">
            24-week progressive overload protocol with phase-specific volume targets and real-time execution tracking.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-1">
          <button
            className={`btn btn-sm ${
              tab === "today"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
            onClick={() => setTab("today")}
          >
            <Dumbbell size={14} /> Today
          </button>
          <button
            className={`btn btn-sm ${
              tab === "progress"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
            onClick={() => setTab("progress")}
          >
            <TrendingUp size={14} /> Progress Chart
          </button>
          <button
            className={`btn btn-sm ${
              tab === "history"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
            onClick={() => setTab("history")}
          >
            <History size={14} /> History
          </button>
        </div>
      </section>

      {/* Tab Contents */}
      {tab === "today" && (
        <TodayWorkoutView
          today={today}
          checked={checked}
          weights={weights}
          notes={notes}
          rest={rest}
          restRunning={restRunning}
          saving={saving}
          message={message}
          manualOverride={manualOverride}
          onToggleOverride={() => setManualOverride(!manualOverride)}
          onToggle={toggle}
          onWeight={(id, val) =>
            setWeights((c) => ({ ...c, [id]: val }))
          }
          onNotes={setNotes}
          onRest={() => {
            setRest(90);
            setRestRunning(true);
          }}
          onPause={() => setRestRunning(false)}
          onFinish={() => void finishSession()}
        />
      )}

      {tab === "progress" && <WorkoutProgressView history={history} />}

      {tab === "history" && <HistoryView logs={history} />}
    </div>
  );
}

// ── Countdown Timer Component ─────────────────────────────────────────────────

function CountdownTimer({ targetTimestamp }: { targetTimestamp: number }) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const updateCountdown = () => {
      const diff = Math.max(0, targetTimestamp - Date.now());
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col items-center bg-slate-900/90 border border-orange-500/30 rounded-xl px-4 py-2.5 shadow-inner">
        <span className="font-mono text-2xl md:text-3xl font-extrabold text-orange-400">
          {String(timeLeft.hours).padStart(2, "0")}
        </span>
        <span className="text-[10px] uppercase font-bold text-slate-400">Hours</span>
      </div>
      <span className="text-xl font-bold text-orange-400/50">:</span>
      <div className="flex flex-col items-center bg-slate-900/90 border border-orange-500/30 rounded-xl px-4 py-2.5 shadow-inner">
        <span className="font-mono text-2xl md:text-3xl font-extrabold text-orange-400">
          {String(timeLeft.minutes).padStart(2, "0")}
        </span>
        <span className="text-[10px] uppercase font-bold text-slate-400">Mins</span>
      </div>
      <span className="text-xl font-bold text-orange-400/50">:</span>
      <div className="flex flex-col items-center bg-slate-900/90 border border-orange-500/30 rounded-xl px-4 py-2.5 shadow-inner">
        <span className="font-mono text-2xl md:text-3xl font-extrabold text-orange-400 animate-pulse">
          {String(timeLeft.seconds).padStart(2, "0")}
        </span>
        <span className="text-[10px] uppercase font-bold text-slate-400">Secs</span>
      </div>
    </div>
  );
}

// ── Today Workout View ────────────────────────────────────────────────────────

function TodayWorkoutView({
  today,
  checked,
  weights,
  notes,
  rest,
  restRunning,
  saving,
  message,
  manualOverride,
  onToggleOverride,
  onToggle,
  onWeight,
  onNotes,
  onRest,
  onPause,
  onFinish,
}: {
  today: TodayData | null;
  checked: Record<string, boolean>;
  weights: Record<string, string>;
  notes: string;
  rest: number;
  restRunning: boolean;
  saving: boolean;
  message: string;
  manualOverride: boolean;
  onToggleOverride: () => void;
  onToggle: (id: string) => void;
  onWeight: (id: string, value: string) => void;
  onNotes: (value: string) => void;
  onRest: () => void;
  onPause: () => void;
  onFinish: () => void;
}) {
  if (!today) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-sm text-[var(--text-muted)]">
        <LoaderCircle size={20} className="animate-spin text-orange-500" />
        <span>Loading workout schedule & data...</span>
      </div>
    );
  }

  // ── CASE 1: PRE-LAUNCH COUNTDOWN (Today is Saturday/Sunday before Monday Launch) ──
  if (today.isWeekendPreLaunch && !manualOverride) {
    const nextWk = today.nextWorkout;
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Pre-Launch Announcement Banner */}
        <section className="relative overflow-hidden rounded-2xl border border-orange-500/40 bg-gradient-to-br from-orange-950/30 via-slate-900/90 to-slate-950 p-6 md:p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-500/20 text-orange-300 border border-orange-500/40">
                  <Flame size={14} /> Official Program Kickoff
                </span>
                <span className="text-xs text-slate-400">
                  Today is <strong className="text-white">{today.currentDayName}</strong>
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white">
                Starting on Monday, {today.launchMondayFormatted?.split(",")[1]}
              </h2>
              <p className="mt-2 text-sm text-slate-300 max-w-xl">
                The FORGE 24-week progressive overload protocol officially launches on{" "}
                <strong className="text-orange-400">{today.launchMondayFormatted}</strong>. The system will unlock Day 1 (Push Day — 🏋️‍♂️ GYM) automatically on Monday morning.
              </p>
            </div>

            {/* Countdown Badge */}
            <div className="flex flex-col items-start md:items-end gap-2 bg-slate-950/80 p-5 rounded-2xl border border-orange-500/30 shadow-lg">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                <Clock3 size={14} /> Unlocks In
              </span>
              <CountdownTimer targetTimestamp={today.launchUnlockTimestamp || nextWk.unlockTimestamp} />
              <span className="text-xs text-slate-400 flex items-center gap-1 mt-1 font-semibold">
                <Calendar size={13} /> {today.launchMondayFormatted} (06:00 AM)
              </span>
            </div>
          </div>
        </section>

        {/* Upcoming Day 1 Workout Card with Blurry Effect */}
        <section className="relative rounded-2xl border border-slate-800 bg-slate-900/50 p-6 md:p-8 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
                Week 1 · Day 1 Preview · 🏋️‍♂️ GYM
              </span>
              <h3 className="text-2xl font-bold text-white mt-1">
                PUSH DAY (Chest, Shoulders & Triceps)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Phase 1 Prescription: <strong className="text-white">3 sets × 8-10 reps</strong>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold">
                <Lock size={14} /> Locked Until Monday
              </div>
              <button
                onClick={onToggleOverride}
                className="btn btn-ghost btn-xs text-slate-400 hover:text-white flex items-center gap-1"
                title="Early Preview Mode"
              >
                <Unlock size={12} /> Test Mode
              </button>
            </div>
          </div>

          {/* Frosted Glassmorphism Blur Container */}
          <div className="relative rounded-xl border border-slate-800/80 bg-slate-950/40 p-6 overflow-hidden">
            {/* Blurry Filter Backdrop */}
            <div className="filter blur-[6px] select-none pointer-events-none opacity-40">
              <div className="space-y-4">
                {nextWk.exercises.map((ex, i) => (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between py-3 border-b border-slate-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-500">
                        0{i + 1}
                      </span>
                      <span className="text-sm font-semibold text-slate-300">
                        {ex.name}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      3 sets × 8-10 reps
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Overlay Focus Badge */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm p-6 text-center">
              <div className="h-12 w-12 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 mb-3 shadow-lg">
                <Lock size={22} />
              </div>
              <h4 className="text-lg font-bold text-white">
                Dashboard Starts on Monday
              </h4>
              <p className="text-xs text-slate-300 max-w-sm mt-1 mb-4">
                Enjoy your rest weekend! Your exercises, sets, and weights for{" "}
                <strong className="text-orange-400">Push Day</strong> will unlock automatically on{" "}
                <strong className="text-white">{today.launchMondayFormatted}</strong>.
              </p>
              <div className="flex items-center gap-2 text-xs font-semibold px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
                <Sparkles size={13} className="text-orange-400" /> Countdown Active
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // ── CASE 2: TODAY'S WORKOUT COMPLETED (Live Countdown to Next Day) ────────────
  if (today.completedToday) {
    const nextWk = today.nextWorkout;
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Completed Hero Banner */}
        <section className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900/80 to-slate-950 p-6 md:p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <Check size={14} className="stroke-[3]" /> Session Completed
                </span>
                <span className="text-xs text-slate-400">
                  Today is <strong className="text-white">{today.currentDayName}</strong>
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white">
                Workout Done for Today!
              </h2>
              <p className="mt-2 text-sm text-slate-300 max-w-lg">
                Great job showing up and finishing your sets. Recovery is active. The system will unlock your next session on schedule.
              </p>
            </div>

            {/* Countdown Badge */}
            <div className="flex flex-col items-start md:items-end gap-2 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                <Flame size={14} /> Next Session Unlocks In
              </span>
              <CountdownTimer targetTimestamp={nextWk.unlockTimestamp} />
              <span className="text-xs text-slate-400 flex items-center gap-1 mt-1 font-semibold">
                <Calendar size={13} /> {nextWk.dateFormatted}
              </span>
            </div>
          </div>
        </section>

        {/* Upcoming Next Workout Card with Blurry Effect */}
        <section className="relative rounded-2xl border border-slate-800 bg-slate-900/50 p-6 md:p-8 overflow-hidden">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
                Upcoming Next Session · {nextWk.location}
              </span>
              <h3 className="text-2xl font-bold text-white mt-1">
                {dayLabel(nextWk.type)}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Scheduled for: <strong className="text-white">{nextWk.dateFormatted}</strong>
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold">
              <Lock size={14} /> Locked Until {nextWk.dateFormatted.split(",")[0]}
            </div>
          </div>

          {/* Frosted Glassmorphism Blur Container */}
          <div className="relative rounded-xl border border-slate-800/80 bg-slate-950/40 p-6 overflow-hidden">
            <div className="filter blur-[5px] select-none pointer-events-none opacity-40">
              <div className="space-y-4">
                {nextWk.exercises.map((ex, i) => (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between py-3 border-b border-slate-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-500">
                        0{i + 1}
                      </span>
                      <span className="text-sm font-semibold text-slate-300">
                        {ex.name}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {nextWk.phase.sets} sets × {nextWk.phase.reps} reps
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm p-6 text-center">
              <div className="h-12 w-12 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 mb-3 shadow-lg">
                <Lock size={22} />
              </div>
              <h4 className="text-lg font-bold text-white">
                Upcoming Workout Locked
              </h4>
              <p className="text-xs text-slate-300 max-w-sm mt-1 mb-4">
                Rest and recover today. Your exercises and weight targets for{" "}
                <strong className="text-orange-400">{dayLabel(nextWk.type)}</strong> will automatically unlock on{" "}
                <strong>{nextWk.dateFormatted}</strong>.
              </p>
              <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
                <Sparkles size={13} className="text-orange-400" /> Focus Mode Active
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // ── CASE 3: ACTIVE WORKOUT DAY ────────────────────────────────────────────────
  const completed = Object.values(checked).filter(Boolean).length;
  const total = today.day.exercises.length;
  const allChecked = total > 0 && completed === total;

  return (
    <>
      {/* Active Workout Banner */}
      <section className="card border-[rgba(249,115,22,0.25)] bg-[linear-gradient(135deg,rgba(249,115,22,0.12),var(--bg-surface)_55%)] shadow-xl">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-[var(--workout)]">
              <span>Week {today.weekNumber} of 24</span>
              <span className="text-[var(--text-muted)]">·</span>
              <span>{today.phase.goal}</span>
              <span className="text-[var(--text-muted)]">·</span>
              <span className="text-blue-400">
                {today.day.location.includes("GYM") ? "🏋️‍♂️ GYM" : "🏠 HOME"}
              </span>
            </div>
            <h2 className="text-4xl font-extrabold">{dayLabel(today.day.type)}</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Current prescription:{" "}
              <strong className="text-[var(--text-primary)]">
                {today.phase.sets} sets × {today.phase.reps} reps
              </strong>
            </p>
          </div>
          <div className="text-left md:text-right">
            <div className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
              Exercises Completed
            </div>
            <div className="mt-1 text-3xl font-extrabold text-orange-400">
              {completed}{" "}
              <span className="text-base text-[var(--text-muted)]">/ {total}</span>
            </div>
          </div>
        </div>
      </section>

      {today.isNewPhase && (
        <div className="mt-4 rounded-xl border-l-4 border-[var(--workout)] bg-[rgba(249,115,22,0.08)] px-4 py-3 text-sm">
          🔥 <strong>New phase this week</strong> — {today.phase.goal}. Sets and reps have updated!
        </div>
      )}

      {/* Main Checklist & Rest Timer Grid */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* Checklist */}
        <section className="card shadow-md">
          <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div>
              <h2 className="text-lg font-bold">Exercise Checklist</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Check each exercise as you finish your sets. Record weights below.
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-[var(--bg-elevated)] text-orange-400">
              {today.phase.sets} × {today.phase.reps}
            </span>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {today.day.exercises.map((exercise, index) => {
              const done = Boolean(checked[exercise.id]);
              return (
                <div
                  className={`flex items-center gap-3 py-4 transition-all ${
                    done ? "opacity-60 bg-emerald-950/10" : ""
                  }`}
                  key={exercise.id}
                >
                  <button
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 transition-all ${
                      done
                        ? "border-emerald-500 bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                        : "border-[var(--border-active)] hover:border-orange-500"
                    }`}
                    onClick={() => onToggle(exercise.id)}
                    aria-label={`Mark ${exercise.name} complete`}
                  >
                    {done && <Check size={18} strokeWidth={3} />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-500">
                        0{index + 1}
                      </span>
                      <div
                        className={`text-sm font-bold ${
                          done ? "line-through text-slate-400" : "text-white"
                        }`}
                      >
                        {exercise.name}
                      </div>
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {today.phase.sets} sets × {today.phase.reps} reps
                      {exercise.lastLog?.weightKg && (
                        <span className="ml-2 text-slate-400">
                          (Last: {exercise.lastLog.weightKg} kg)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      className="input w-24 px-2.5 py-1.5 text-xs font-mono rounded-lg border-slate-700 bg-slate-900 text-center"
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="kg"
                      value={weights[exercise.id] ?? ""}
                      onChange={(e) => onWeight(exercise.id, e.target.value)}
                      aria-label={`Weight for ${exercise.name}`}
                    />
                    <span className="text-xs text-slate-400">kg</span>
                  </div>
                </div>
              );
            })}
          </div>

          <textarea
            className="textarea mt-4 rounded-xl border-slate-700 bg-slate-900/60 p-3 text-xs"
            value={notes}
            onChange={(e) => onNotes(e.target.value)}
            placeholder="How did the session feel? Notes, RPE, or progression observations (optional)..."
            rows={2}
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
            {message ? (
              <span className="text-sm font-bold text-emerald-400">{message}</span>
            ) : (
              <span className="text-xs text-[var(--text-muted)]">
                {completed} of {total} exercise{total === 1 ? "" : "s"} checked
              </span>
            )}

            <button
              className={`btn ${
                allChecked ? "btn-primary shadow-lg shadow-orange-500/20" : "btn-primary"
              }`}
              disabled={!completed || saving}
              onClick={onFinish}
            >
              {saving ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Check size={15} />
              )}
              {allChecked ? "Submit & Complete Workout" : "Finish Session"}
            </button>
          </div>
        </section>

        {/* Rest Timer Sidebar */}
        <aside className="card h-fit shadow-md">
          <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-2">
            <h4 className="font-bold text-sm">Rest Interval Timer</h4>
            <TimerReset size={16} className="text-[var(--workout)]" />
          </div>
          <div className="text-center py-2">
            <div className="font-mono text-5xl font-extrabold text-white tracking-wider">
              {String(Math.floor(rest / 60)).padStart(2, "0")}:
              {String(rest % 60).padStart(2, "0")}
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">90 seconds standard rest</p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                className="btn btn-primary btn-sm rounded-lg font-bold"
                onClick={restRunning ? onPause : onRest}
              >
                {restRunning ? "Pause" : "Start / 90s"}
              </button>
              <button
                className="btn btn-ghost btn-sm rounded-lg"
                onClick={() => {
                  onPause();
                  onRest();
                }}
                title="Reset timer"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

// ── Workout Progress Graph View ───────────────────────────────────────────────

function WorkoutProgressView({ history }: { history: HistoryLog[] }) {
  const chartData = history.slice(0, 14).reverse().map((log) => {
    const totalSets = log.exerciseLogs.reduce((acc, el) => acc + el.setsCompleted, 0);
    const dateStr = new Date(log.completedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return {
      name: dateStr,
      type: log.workoutDay.type,
      sets: totalSets,
      exercises: log.exerciseLogs.filter((e) => e.checked).length,
    };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="card p-6 border-slate-800 bg-slate-900/60 shadow-xl">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-400">
              <TrendingUp size={14} /> Volume & Consistency Analytics
            </div>
            <h2 className="text-2xl font-bold text-white mt-1">
              Workout Progression Chart
            </h2>
            <p className="text-xs text-slate-400">
              Tracking completed volume and workout frequency over time.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2.5 py-1 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-semibold">
              Total Logged: {history.length} Workouts
            </span>
          </div>
        </div>

        {chartData.length > 0 ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="workoutVolGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sets"
                  stroke="#f97316"
                  strokeWidth={3}
                  fill="url(#workoutVolGrad)"
                  name="Total Sets"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-800 text-center">
            <Dumbbell size={28} className="text-slate-600" />
            <p className="text-sm font-semibold text-slate-400">
              No workout data recorded yet
            </p>
            <p className="text-xs text-slate-500 max-w-xs">
              Complete your first workout on the Today tab to start building your visual progression chart!
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

// ── History View ─────────────────────────────────────────────────────────────

function HistoryView({ logs }: { logs: HistoryLog[] }) {
  return (
    <section className="animate-fade-in">
      <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
        <div>
          <h2 className="text-xl font-bold">Workout Session History</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Past completed workouts and logged weights.
          </p>
        </div>
        <Clock3 size={18} className="text-[var(--text-muted)]" />
      </div>

      {logs.length ? (
        <div className="space-y-3">
          {logs.map((log) => (
            <article className="card shadow-sm hover:border-slate-700 transition-all" key={log.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-base text-white">{dayLabel(log.workoutDay.type)}</h3>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {new Date(log.completedAt).toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    · Week {log.weekNumber}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {log.exerciseLogs.filter((item) => item.checked).length} exercises completed
                </span>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {log.exerciseLogs.map((item) => (
                  <div
                    className="flex justify-between gap-3 border-t border-[var(--border)] pt-2 text-xs"
                    key={item.id}
                  >
                    <span className="text-[var(--text-secondary)] font-medium">
                      {item.exercise.name}
                    </span>
                    <span className="text-[var(--text-muted)] font-mono">
                      {item.weightKg !== null ? `${item.weightKg}kg · ` : ""}
                      {item.setsCompleted} × {item.repsCompleted}
                    </span>
                  </div>
                ))}
              </div>

              {log.notes && (
                <p className="mt-3 rounded-lg border-l-2 border-orange-500 bg-slate-900/60 p-2.5 text-xs italic text-slate-300">
                  "{log.notes}"
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12 text-sm text-[var(--text-muted)]">
          <Dumbbell size={28} className="mx-auto mb-2 opacity-40" />
          No workout sessions logged yet. Complete today's session to view your log.
        </div>
      )}
    </section>
  );
}
