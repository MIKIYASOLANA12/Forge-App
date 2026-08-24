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
  AlertCircle,
  Plus,
  Minus,
  CheckCircle2,
  Layers,
  Target
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { clsx } from "clsx";

export type SetEntry = {
  setNumber: number;
  weightKg: number | string;
  reps: number | string;
  completed: boolean;
};

type Exercise = {
  id: string;
  name: string;
  order: number;
  targetMuscle?: string;
  masterCue?: string;
  lastLog: {
    setsCompleted: number;
    repsCompleted: number;
    weightKg: number | null;
    setDetails?: string | null;
  } | null;
};

type NextWorkout = {
  dateFormatted: string;
  unlockTimestamp: number;
  type: string;
  location: string;
  targetBodyParts?: string;
  focusBadges?: string[];
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
  targetBodyParts?: string;
  focusBadges?: string[];
  targetDescription?: string;
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
    targetBodyParts?: string;
    focusBadges?: string[];
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
    setDetails?: string | null;
    exercise: { name: string };
  }[];
};

export default function WorkoutPage() {
  const [tab, setTab] = useState<"today" | "progress" | "history">("today");
  const [today, setToday] = useState<TodayData | null>(null);
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [exerciseSets, setExerciseSets] = useState<Record<string, SetEntry[]>>({});
  const [notes, setNotes] = useState("");
  const [rest, setRest] = useState(90);
  const [restRunning, setRestRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [manualOverride, setManualOverride] = useState(false);

  const loadTodayData = async () => {
    try {
      const response = await fetch("/api/workout/today");
      if (response.ok) {
        const data = (await response.json()) as TodayData;
        setToday(data);

        // Initialize set-by-set entries for each exercise
        if (data?.day?.exercises) {
          const defaultSetsCount = data.phase?.sets || 3;
          const defaultReps = Number(String(data.phase?.reps || "8-10").split("-")[0]) || 8;
          const initialSetsState: Record<string, SetEntry[]> = {};

          data.day.exercises.forEach((ex) => {
            let lastDetails: SetEntry[] = [];
            if (ex.lastLog?.setDetails) {
              try {
                lastDetails = JSON.parse(ex.lastLog.setDetails);
              } catch {}
            }

            const setsArray: SetEntry[] = [];
            for (let s = 1; s <= defaultSetsCount; s++) {
              const lastSet = lastDetails[s - 1];
              setsArray.push({
                setNumber: s,
                weightKg: lastSet?.weightKg ?? (ex.lastLog?.weightKg ?? ""),
                reps: lastSet?.reps ?? defaultReps,
                completed: false,
              });
            }
            initialSetsState[ex.id] = setsArray;
          });

          setExerciseSets(initialSetsState);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await fetch("/api/workout/history");
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    void loadTodayData();
    void loadHistory();
  }, []);

  // Rest Timer
  useEffect(() => {
    if (!restRunning || rest <= 0) return;
    const timer = window.setInterval(() => setRest((v) => v - 1), 1000);
    return () => window.clearInterval(timer);
  }, [restRunning, rest]);

  useEffect(() => {
    if (rest === 0) setRestRunning(false);
  }, [rest]);

  // Set-by-Set Management Handlers
  const handleUpdateSet = (exerciseId: string, setIndex: number, field: keyof SetEntry, value: any) => {
    setExerciseSets((prev) => {
      const currentSets = prev[exerciseId] ? [...prev[exerciseId]] : [];
      if (currentSets[setIndex]) {
        currentSets[setIndex] = { ...currentSets[setIndex], [field]: value };
      }
      return { ...prev, [exerciseId]: currentSets };
    });
  };

  const handleToggleSetComplete = (exerciseId: string, setIndex: number) => {
    setExerciseSets((prev) => {
      const currentSets = prev[exerciseId] ? [...prev[exerciseId]] : [];
      if (currentSets[setIndex]) {
        const isNowDone = !currentSets[setIndex].completed;
        currentSets[setIndex] = { ...currentSets[setIndex], completed: isNowDone };
        if (isNowDone) {
          setRest(90);
          setRestRunning(true);
        }
      }
      return { ...prev, [exerciseId]: currentSets };
    });
  };

  const handleAddSet = (exerciseId: string) => {
    setExerciseSets((prev) => {
      const currentSets = prev[exerciseId] ? [...prev[exerciseId]] : [];
      const nextSetNum = currentSets.length + 1;
      const lastSet = currentSets[currentSets.length - 1];
      currentSets.push({
        setNumber: nextSetNum,
        weightKg: lastSet?.weightKg ?? "",
        reps: lastSet?.reps ?? 8,
        completed: false,
      });
      return { ...prev, [exerciseId]: currentSets };
    });
  };

  const handleRemoveSet = (exerciseId: string) => {
    setExerciseSets((prev) => {
      const currentSets = prev[exerciseId] ? [...prev[exerciseId]] : [];
      if (currentSets.length > 1) {
        currentSets.pop();
      }
      return { ...prev, [exerciseId]: currentSets };
    });
  };

  const finishSession = async () => {
    if (!today) return;
    setSaving(true);

    const payloadExercises = today.day.exercises.map((ex) => {
      const sets = exerciseSets[ex.id] || [];
      const completedSets = sets.filter((s) => s.completed);
      const isChecked = completedSets.length > 0;
      
      // Calculate max/top weight used in sets
      const numericWeights = sets
        .map((s) => Number(s.weightKg))
        .filter((w) => !isNaN(w) && w > 0);
      const topWeight = numericWeights.length > 0 ? Math.max(...numericWeights) : null;
      const avgReps = sets.length > 0
        ? Math.round(sets.reduce((sum, s) => sum + (Number(s.reps) || 8), 0) / sets.length)
        : Number(today.phase.reps.split("-")[0] || 8);

      return {
        exerciseId: ex.id,
        setsCompleted: completedSets.length || sets.length,
        repsCompleted: avgReps,
        weightKg: topWeight,
        checked: isChecked,
        setDetails: JSON.stringify(sets),
      };
    });

    try {
      const response = await fetch("/api/workout/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workoutDayId: today.day.id,
          weekNumber: today.weekNumber,
          notes,
          exerciseLogs: payloadExercises,
        }),
      });

      const data = response.ok ? await response.json() : null;
      if (data) {
        setMessage(`🎉 Workout Completed! +${data.xpEarned} XP`);
        setNotes("");
        await loadTodayData();
        await loadHistory();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] animate-fade-in pb-16 space-y-6">
      {/* Header Bar */}
      <section className="flex flex-col justify-between gap-5 border-b border-[var(--border)] pb-6 md:flex-row md:items-end">
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
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Dumbbell className="text-orange-500" size={32} />
            Workout & Progressive Overload OS
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--text-secondary)]">
            Set-by-set progressive overload tracking (Pyramid/Reverse Pyramid) with targeted body parts and anatomy cues.
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
            <Dumbbell size={14} /> Today's Session
          </button>
          <button
            className={`btn btn-sm ${
              tab === "progress"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm font-bold"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
            onClick={() => setTab("progress")}
          >
            <TrendingUp size={14} /> Progress Chart
          </button>
          <button
            className={`btn btn-sm ${
              tab === "history"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm font-bold"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
            onClick={() => setTab("history")}
          >
            <History size={14} /> History
          </button>
        </div>
      </section>

      {/* ── TAB 1: TODAY'S ACTIVE WORKOUT ───────────────────────────────────── */}
      {tab === "today" && (
        <TodayWorkoutTab
          today={today}
          exerciseSets={exerciseSets}
          notes={notes}
          rest={rest}
          restRunning={restRunning}
          saving={saving}
          message={message}
          manualOverride={manualOverride}
          onToggleOverride={() => setManualOverride(!manualOverride)}
          onUpdateSet={handleUpdateSet}
          onToggleSetComplete={handleToggleSetComplete}
          onAddSet={handleAddSet}
          onRemoveSet={handleRemoveSet}
          onNotes={setNotes}
          onRest={() => {
            setRest(90);
            setRestRunning(true);
          }}
          onPause={() => setRestRunning(false)}
          onFinish={finishSession}
        />
      )}

      {/* ── TAB 2: PROGRESS CHART ───────────────────────────────────────────── */}
      {tab === "progress" && <ProgressTab />}

      {/* ── TAB 3: HISTORY ──────────────────────────────────────────────────── */}
      {tab === "history" && <HistoryTab history={history} />}
    </div>
  );
}

function TodayWorkoutTab({
  today,
  exerciseSets,
  notes,
  rest,
  restRunning,
  saving,
  message,
  manualOverride,
  onToggleOverride,
  onUpdateSet,
  onToggleSetComplete,
  onAddSet,
  onRemoveSet,
  onNotes,
  onRest,
  onPause,
  onFinish,
}: {
  today: TodayData | null;
  exerciseSets: Record<string, SetEntry[]>;
  notes: string;
  rest: number;
  restRunning: boolean;
  saving: boolean;
  message: string;
  manualOverride: boolean;
  onToggleOverride: () => void;
  onUpdateSet: (exerciseId: string, setIndex: number, field: keyof SetEntry, value: any) => void;
  onToggleSetComplete: (exerciseId: string, setIndex: number) => void;
  onAddSet: (exerciseId: string) => void;
  onRemoveSet: (exerciseId: string) => void;
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

  // Pre-launch case
  if (today.isWeekendPreLaunch && !manualOverride) {
    const nextWk = today.nextWorkout;
    return (
      <div className="space-y-6 animate-fade-in">
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
                <strong className="text-orange-400">{today.launchMondayFormatted}</strong>.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onToggleOverride}
                className="btn btn-primary btn-sm flex items-center gap-1 font-bold shadow-lg"
              >
                <Unlock size={14} /> Open Live Workout (Test Mode)
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Calculate exercises completed (an exercise is completed if all its sets are completed)
  const totalExercises = today.day.exercises.length;
  const completedExercises = today.day.exercises.filter((ex) => {
    const sets = exerciseSets[ex.id] || [];
    return sets.length > 0 && sets.every((s) => s.completed);
  }).length;

  const allDone = totalExercises > 0 && completedExercises === totalExercises;

  return (
    <div className="space-y-6">
      {/* ── TARGET BODY PARTS HERO BANNER ───────────────────────────────────── */}
      <section className="rounded-2xl border border-orange-500/30 bg-gradient-to-r from-[#17101a] via-[#1c1424] to-[#120e1a] p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded-full flex items-center gap-1">
                <Target size={12} />
                Target Muscles Worked Today
              </span>
              <span className="text-xs text-slate-400">Week {today.weekNumber} · {today.phase.goal}</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">
              {today.day.targetBodyParts || `${today.day.type} Day (Chest, Shoulders & Triceps)`}
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              {today.targetDescription || "Execute progressive overload set-by-set. Record each set's KG and reps below."}
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Exercises Done</span>
            <div className="text-3xl font-extrabold text-orange-400">
              {completedExercises} <span className="text-base text-slate-500">/ {totalExercises}</span>
            </div>
          </div>
        </div>

        {/* Muscle group badges */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-bold text-slate-400 mr-1">Primary Targets:</span>
          {(today.day.focusBadges || ["Chest (Upper/Mid)", "Front & Side Delts", "Triceps Horseshoe"]).map((badge) => (
            <span
              key={badge}
              className="px-3 py-1 rounded-lg bg-orange-500/10 border border-orange-500/25 text-xs font-extrabold text-orange-300"
            >
              🎯 {badge}
            </span>
          ))}
        </div>
      </section>

      {/* ── SET-BY-SET EXERCISE LIST & REST TIMER ─────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Exercises Checklist with Sets Matrix */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Layers size={16} className="text-orange-400" />
              Set-by-Set Weight & Overload Tracker
            </h3>
            <span className="text-xs text-slate-400 font-semibold">
              Standard Target: {today.phase.sets} sets × {today.phase.reps} reps
            </span>
          </div>

          <div className="space-y-4">
            {today.day.exercises.map((exercise, index) => {
              const sets = exerciseSets[exercise.id] || [];
              const isExerciseFullyDone = sets.length > 0 && sets.every((s) => s.completed);

              return (
                <article
                  key={exercise.id}
                  className={clsx(
                    "rounded-2xl border p-5 transition-all space-y-4",
                    isExerciseFullyDone
                      ? "border-emerald-500/40 bg-emerald-950/10"
                      : "border-[var(--border)] bg-[var(--bg-surface)] hover:border-slate-700"
                  )}
                >
                  {/* Exercise Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="h-6 w-6 rounded-md bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center justify-center text-xs font-mono font-bold">
                          0{index + 1}
                        </span>
                        <h4 className="text-base font-extrabold text-white">{exercise.name}</h4>
                      </div>
                      {exercise.targetMuscle && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                            {exercise.targetMuscle}
                          </span>
                          {exercise.masterCue && (
                            <span className="text-slate-400 text-[11px] italic line-clamp-1">
                              "{exercise.masterCue}"
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Add / Remove Set buttons */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <button
                        onClick={() => onAddSet(exercise.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
                        title="Add Another Set"
                      >
                        <Plus size={12} />
                        <span>Add Set</span>
                      </button>
                      {sets.length > 1 && (
                        <button
                          onClick={() => onRemoveSet(exercise.id)}
                          className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Remove Last Set"
                        >
                          <Minus size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sets Matrix Table */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 px-2">
                      <span className="col-span-2">Set</span>
                      <span className="col-span-4 text-center">Weight (KG)</span>
                      <span className="col-span-3 text-center">Reps</span>
                      <span className="col-span-3 text-right">Status</span>
                    </div>

                    {sets.map((set, sIdx) => (
                      <div
                        key={set.setNumber}
                        className={clsx(
                          "grid grid-cols-12 gap-2 items-center p-2 rounded-xl border transition-all",
                          set.completed
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                            : "bg-[var(--bg-elevated)] border-slate-800/80"
                        )}
                      >
                        {/* Set Tag */}
                        <div className="col-span-2 flex items-center gap-1.5">
                          <span className="text-xs font-mono font-bold text-slate-300">
                            #{set.setNumber}
                          </span>
                          {sIdx === 0 && (
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-orange-400 bg-orange-500/15 px-1 rounded">
                              Top
                            </span>
                          )}
                        </div>

                        {/* Weight (KG) Input */}
                        <div className="col-span-4 flex items-center justify-center gap-1">
                          <input
                            type="number"
                            step="0.5"
                            placeholder="kg"
                            value={set.weightKg}
                            onChange={(e) =>
                              onUpdateSet(exercise.id, sIdx, "weightKg", e.target.value)
                            }
                            className="w-20 px-2 py-1 text-xs font-mono font-bold text-center rounded-lg border border-slate-700 bg-slate-950 text-white focus:border-orange-500 focus:outline-none"
                          />
                          <span className="text-[11px] text-slate-400 font-bold">kg</span>
                        </div>

                        {/* Reps Input */}
                        <div className="col-span-3 flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={set.reps}
                            onChange={(e) =>
                              onUpdateSet(exercise.id, sIdx, "reps", e.target.value)
                            }
                            className="w-16 px-2 py-1 text-xs font-mono font-bold text-center rounded-lg border border-slate-700 bg-slate-950 text-white focus:border-orange-500 focus:outline-none"
                          />
                          <span className="text-[11px] text-slate-400 font-bold">reps</span>
                        </div>

                        {/* Checkmark Complete Button */}
                        <div className="col-span-3 flex justify-end">
                          <button
                            onClick={() => onToggleSetComplete(exercise.id, sIdx)}
                            className={clsx(
                              "flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all",
                              set.completed
                                ? "bg-emerald-500 text-black shadow-sm font-extrabold"
                                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:border-orange-500"
                            )}
                          >
                            {set.completed ? (
                              <>
                                <Check size={12} strokeWidth={3} />
                                <span>Done</span>
                              </>
                            ) : (
                              <span>Check</span>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Previous session memory hint */}
                  {exercise.lastLog && (
                    <div className="text-[11px] text-slate-400 pt-1 flex items-center gap-1.5 border-t border-slate-800/50">
                      <Sparkles size={12} className="text-orange-400" />
                      <span>
                        Previous best: {exercise.lastLog.setsCompleted} sets × {exercise.lastLog.repsCompleted} reps
                        {exercise.lastLog.weightKg ? ` @ ${exercise.lastLog.weightKg} kg` : ""}
                      </span>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {/* Notes & Finish Session Card */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-4">
            <textarea
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
              value={notes}
              onChange={(e) => onNotes(e.target.value)}
              placeholder="Session notes, progressive overload felt, pump quality (optional)..."
              rows={2}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
              {message ? (
                <span className="text-sm font-bold text-emerald-400">{message}</span>
              ) : (
                <span className="text-xs text-slate-400">
                  {completedExercises} of {totalExercises} exercises completed
                </span>
              )}

              <button
                onClick={onFinish}
                disabled={saving || completedExercises === 0}
                className={clsx(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50",
                  allDone
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-emerald-500/20"
                    : "bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-orange-500/20"
                )}
              >
                {saving ? (
                  <LoaderCircle size={15} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                <span>{allDone ? "Submit & Complete Workout" : "Finish Active Session"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Rest Interval Timer Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-lg space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Rest Timer</span>
              <TimerReset size={16} className="text-orange-400" />
            </div>

            <div className="font-mono text-5xl font-extrabold text-white tracking-wider py-1">
              {String(Math.floor(rest / 60)).padStart(2, "0")}:{String(rest % 60).padStart(2, "0")}
            </div>

            <p className="text-[11px] text-slate-400">90s standard recovery between working sets</p>

            <div className="flex justify-center gap-2 pt-1">
              <button
                className="btn btn-primary btn-sm rounded-lg font-bold"
                onClick={restRunning ? onPause : onRest}
              >
                {restRunning ? "Pause" : "Start 90s"}
              </button>
              <button
                className="btn btn-ghost btn-sm rounded-lg border border-slate-800"
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

          {/* Overload Protocol Summary */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-2 text-xs">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-orange-400 block">
              Progressive Overload Rule
            </span>
            <p className="text-slate-300 leading-relaxed">
              If you hit all target reps on your top set, add <strong>+2.5 kg</strong> next week.
              For Reverse Pyramid, make Set 1 heaviest, then drop 10% weight for higher reps on Set 2 and Set 3.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ProgressTab() {
  const [data, setData] = useState<{ weekNumber: number; volume: number; date: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/workout/progress")
      .then((res) => (res.ok ? res.json() : []))
      .then((d) => setData(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="card shadow-lg p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <div>
          <h2 className="text-lg font-bold text-white">Training Volume & Progression</h2>
          <p className="text-xs text-[var(--text-muted)]">Historical workout volume over 24-week cycle</p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-xs text-slate-400">Loading progress...</div>
      ) : data.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
          No workout volume logs recorded yet. Complete your first session to view graph.
        </div>
      ) : (
        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px" }} />
              <Area type="monotone" dataKey="volume" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#volGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function HistoryTab({ history }: { history: HistoryLog[] }) {
  return (
    <section className="card shadow-lg p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <div>
          <h2 className="text-lg font-bold text-white">Workout Session History</h2>
          <p className="text-xs text-[var(--text-muted)]">Detailed set-by-set logs from past completed workouts</p>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
          No workout history logs yet.
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((log) => (
            <div key={log.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-xs font-extrabold uppercase text-orange-400">
                  {log.workoutDay.type} Session · Week {log.weekNumber}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {new Date(log.completedAt).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {log.exerciseLogs.map((ex) => {
                  let setList: SetEntry[] = [];
                  if (ex.setDetails) {
                    try {
                      setList = JSON.parse(ex.setDetails);
                    } catch {}
                  }

                  return (
                    <div key={ex.id} className="rounded-lg bg-slate-950 p-2.5 border border-slate-800 text-xs">
                      <div className="font-bold text-white mb-1 truncate">{ex.exercise.name}</div>
                      {setList.length > 0 ? (
                        <div className="space-y-0.5 text-[11px] text-slate-300 font-mono">
                          {setList.map((s) => (
                            <div key={s.setNumber} className="flex justify-between">
                              <span className="text-slate-500">Set {s.setNumber}:</span>
                              <span>{s.weightKg ? `${s.weightKg} kg` : "BW"} × {s.reps} reps</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-slate-400 text-[11px]">
                          {ex.setsCompleted} sets × {ex.repsCompleted} reps {ex.weightKg ? `@ ${ex.weightKg} kg` : ""}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {log.notes && (
                <p className="text-xs text-slate-400 italic bg-slate-950/40 p-2 rounded border border-slate-800/50">
                  "{log.notes}"
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
