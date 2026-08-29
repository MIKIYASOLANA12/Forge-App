"use client";

import { useEffect, useRef, useState } from "react";
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
  Target,
  Wifi,
  WifiOff,
  CloudUpload,
  Save
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
import {
  SetEntry,
  OfflineSyncStatus,
  getTodayDateKey,
  saveLocalWorkoutState,
  loadLocalWorkoutState,
  syncLocalWorkoutToServer,
  generateClientId,
  cacheTodayProtocol,
  loadCachedTodayProtocol,
  mergeSetsByClientId,
  ensureSetClientId,
} from "@/lib/offlineWorkoutStore";

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
  todayLog?: {
    setsCompleted: number;
    repsCompleted: number;
    weightKg: number | null;
    checked: boolean;
    setDetails?: string | null;
    clientId?: string | null;
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
  exercises: { id: string; name: string; order: number; targetMuscle?: string; masterCue?: string }[];
};

type TodayData = {
  currentDayName?: string;
  currentDateFormatted?: string;
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
  isOpen?: boolean;
  isClosed?: boolean;
  isMissed?: boolean;
  missedToday?: boolean;
  sessionInProgress?: boolean;
  closeTimestamp?: number;
  yesterday?: {
    dateFormatted: string;
    missedItems: string[];
    completedItems: string[];
    workoutMissed: boolean;
  };
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

function CountdownTimer({ targetTimestamp }: { targetTimestamp: number }) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, targetTimestamp - Date.now());
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ hours, minutes, seconds });
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [targetTimestamp]);

  return (
    <div className="flex items-center gap-2 font-mono text-2xl md:text-3xl font-extrabold text-white">
      <div className="flex flex-col items-center bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 shadow-inner">
        <span>{String(timeLeft.hours).padStart(2, "0")}</span>
        <span className="text-[9px] font-sans text-slate-500 uppercase tracking-widest">Hrs</span>
      </div>
      <span className="text-orange-400 font-bold mb-3">:</span>
      <div className="flex flex-col items-center bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 shadow-inner">
        <span>{String(timeLeft.minutes).padStart(2, "0")}</span>
        <span className="text-[9px] font-sans text-slate-500 uppercase tracking-widest">Min</span>
      </div>
      <span className="text-orange-400 font-bold mb-3">:</span>
      <div className="flex flex-col items-center bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 shadow-inner">
        <span className="text-orange-400">{String(timeLeft.seconds).padStart(2, "0")}</span>
        <span className="text-[9px] font-sans text-slate-500 uppercase tracking-widest">Sec</span>
      </div>
    </div>
  );
}

export default function WorkoutPage() {
  const [tab, setTab] = useState<"today" | "progress" | "history">("today");
  const [today, setToday] = useState<TodayData | null>(null);
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [exerciseSets, setExerciseSets] = useState<Record<string, SetEntry[]>>({});
  const [checkedExercises, setCheckedExercises] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [rest, setRest] = useState(90);
  const [restRunning, setRestRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [manualOverride, setManualOverride] = useState(false);
  const [syncStatus, setSyncStatus] = useState<OfflineSyncStatus>("LOCAL_ONLY");
  const [isOnline, setIsOnline] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const todayDateKey = getTodayDateKey();
  const todayRef = useRef<TodayData | null>(null);
  const exerciseSetsRef = useRef<Record<string, SetEntry[]>>({});
  const checkedExercisesRef = useRef<Record<string, boolean>>({});
  const notesRef = useRef("");

  todayRef.current = today;
  exerciseSetsRef.current = exerciseSets;
  checkedExercisesRef.current = checkedExercises;
  notesRef.current = notes;

  const persistLocal = (
    nextSets: Record<string, SetEntry[]>,
    nextChecked: Record<string, boolean>,
    nextNotes: string,
    status: OfflineSyncStatus = "LOCAL_ONLY"
  ) => {
    const dayId = todayRef.current?.day?.id || "pending";
    const weekNumber = todayRef.current?.weekNumber || 1;
    saveLocalWorkoutState(todayDateKey, dayId, weekNumber, nextNotes, nextSets, nextChecked, status);
    setSyncStatus(status);
  };

  const parseSetDetails = (raw?: string | null): SetEntry[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const buildInitialSets = (data: TodayData, localSaved: ReturnType<typeof loadLocalWorkoutState>) => {
    const defaultSetsCount = data.phase?.sets || 3;
    const defaultReps = Number(String(data.phase?.reps || "8-10").split("-")[0]) || 8;
    const initialSetsState: Record<string, SetEntry[]> = { ...(localSaved?.exerciseSets || {}) };
    const initialChecked: Record<string, boolean> = { ...(localSaved?.checkedExercises || {}) };

    data.day.exercises.forEach((ex) => {
      const serverToday = parseSetDetails(ex.todayLog?.setDetails);
      const previous = parseSetDetails(ex.lastLog?.setDetails);
      const local = initialSetsState[ex.id] || [];
      const merged = mergeSetsByClientId(local, serverToday);

      if (merged.length > 0) {
        initialSetsState[ex.id] = merged.map((s) => ensureSetClientId(ex.id, s));
      } else {
        const setsArray: SetEntry[] = [];
        for (let s = 1; s <= defaultSetsCount; s++) {
          const lastSet = previous[s - 1];
          setsArray.push(
            ensureSetClientId(ex.id, {
              setNumber: s,
              weightKg: lastSet?.weightKg ?? ex.lastLog?.weightKg ?? "",
              reps: lastSet?.reps ?? defaultReps,
              notes: lastSet?.notes ?? "",
              completed: false,
            })
          );
        }
        initialSetsState[ex.id] = setsArray;
      }

      initialChecked[ex.id] = Boolean(initialChecked[ex.id] || ex.todayLog?.checked);
    });

    return { initialSetsState, initialChecked, notes: localSaved?.notes || data.todayLog?.notes || "" };
  };

  // Restore locally saved sets BEFORE any network so leaving/re-entering never blanks the form.
  useEffect(() => {
    const cached = loadCachedTodayProtocol(todayDateKey) as TodayData | null;
    const localSaved = loadLocalWorkoutState(todayDateKey);
    if (cached?.day) {
      setToday(cached);
      const built = buildInitialSets(cached, localSaved);
      setExerciseSets(built.initialSetsState);
      setCheckedExercises(built.initialChecked);
      setNotes(built.notes);
      setSyncStatus(localSaved?.syncStatus || (typeof navigator !== "undefined" && !navigator.onLine ? "LOCAL_ONLY" : "SYNCED"));
    } else if (localSaved) {
      setExerciseSets(localSaved.exerciseSets);
      setCheckedExercises(localSaved.checkedExercises || {});
      setNotes(localSaved.notes || "");
      setSyncStatus(localSaved.syncStatus || "LOCAL_ONLY");
    }
    if (typeof navigator !== "undefined") setIsOnline(navigator.onLine);
    setHydrated(true);
  }, [todayDateKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = async () => {
      setIsOnline(true);
      setSyncStatus("SYNCING");
      const res = await syncLocalWorkoutToServer(todayDateKey);
      setSyncStatus(res.status);
      setMessage(res.message || (res.success ? "Synchronized with cloud" : "OFFLINE — Saved on this device"));
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus("LOCAL_ONLY");
      setMessage("OFFLINE — Saved on this device");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [todayDateKey]);

  const loadTodayData = async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch("/api/workout/today", { signal: controller.signal });
      if (response.ok) {
        const data = (await response.json()) as TodayData;
        cacheTodayProtocol(todayDateKey, data as unknown as Record<string, unknown>);
        setToday(data);

        const localSaved = loadLocalWorkoutState(todayDateKey, data.day?.id || "");
        const built = buildInitialSets(data, localSaved);
        setExerciseSets(built.initialSetsState);
        setCheckedExercises(built.initialChecked);
        setNotes(built.notes);
        saveLocalWorkoutState(
          todayDateKey,
          data.day.id,
          data.weekNumber || 1,
          built.notes,
          built.initialSetsState,
          built.initialChecked,
          localSaved?.syncStatus === "LOCAL_ONLY" || localSaved?.syncStatus === "SYNC_ERROR"
            ? localSaved.syncStatus
            : typeof navigator !== "undefined" && navigator.onLine
            ? "SYNCED"
            : "LOCAL_ONLY"
        );

        if (typeof navigator !== "undefined" && navigator.onLine && localSaved && localSaved.syncStatus !== "SYNCED") {
          const res = await syncLocalWorkoutToServer(todayDateKey);
          setSyncStatus(res.status);
        }
      }
    } catch {
      const cached = loadCachedTodayProtocol(todayDateKey) as TodayData | null;
      const localSaved = loadLocalWorkoutState(todayDateKey);
      if (cached?.day) setToday(cached);
      if (localSaved) {
        setExerciseSets(localSaved.exerciseSets);
        setCheckedExercises(localSaved.checkedExercises || {});
        setNotes(localSaved.notes || "");
        setSyncStatus("LOCAL_ONLY");
        setMessage("OFFLINE — Saved on this device");
      }
    } finally {
      window.clearTimeout(timeout);
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

  // Set-by-Set Management Handlers with Immediate Offline Persistence
  const loggingLocked = Boolean((today?.isClosed || today?.isMissed || today?.missedToday) && !manualOverride);

  const handleUpdateSet = (exerciseId: string, setIndex: number, field: keyof SetEntry, value: any) => {
    if (loggingLocked) return;
    setExerciseSets((prev) => {
      const currentSets = prev[exerciseId] ? [...prev[exerciseId]] : [];
      if (currentSets[setIndex]) {
        currentSets[setIndex] = { ...currentSets[setIndex], [field]: value };
      }
      const updated = { ...prev, [exerciseId]: currentSets };
      persistLocal(updated, checkedExercisesRef.current, notesRef.current, "LOCAL_ONLY");
      return updated;
    });
  };

  const handleToggleSetComplete = (exerciseId: string, setIndex: number) => {
    if (loggingLocked) return;
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
      const updated = { ...prev, [exerciseId]: currentSets };
      persistLocal(updated, checkedExercisesRef.current, notesRef.current, "LOCAL_ONLY");
      return updated;
    });
  };

  const handleToggleCheckIn = (exerciseId: string) => {
    if (loggingLocked) return;
    const isNowChecked = !checkedExercisesRef.current[exerciseId];
    const updatedChecked = { ...checkedExercisesRef.current, [exerciseId]: isNowChecked };
    setCheckedExercises(updatedChecked);

    const currentSets = exerciseSetsRef.current[exerciseId] || [];
    persistLocal(exerciseSetsRef.current, updatedChecked, notesRef.current, "LOCAL_ONLY");

    if (typeof navigator !== "undefined" && navigator.onLine) {
      const allChecked =
        (todayRef.current?.day.exercises || []).length > 0 &&
        (todayRef.current?.day.exercises || []).every((ex) => Boolean(updatedChecked[ex.id]));
      void syncLocalWorkoutToServer(todayDateKey, { sessionSubmitted: allChecked }).then((res) => {
        setSyncStatus(res.status);
        if (res.message) setMessage(res.message);
      });
    }
  };

  const handleAddSet = (exerciseId: string) => {
    if (loggingLocked) return;
    setExerciseSets((prev) => {
      const currentSets = prev[exerciseId] ? [...prev[exerciseId]] : [];
      const nextSetNum = currentSets.length + 1;
      const lastSet = currentSets[currentSets.length - 1];
      currentSets.push(
        ensureSetClientId(exerciseId, {
          setNumber: nextSetNum,
          weightKg: lastSet?.weightKg ?? "",
          reps: lastSet?.reps ?? 8,
          notes: "",
          completed: false,
        })
      );
      const updated = { ...prev, [exerciseId]: currentSets };
      persistLocal(updated, checkedExercisesRef.current, notesRef.current, "LOCAL_ONLY");
      return updated;
    });
  };

  const handleRemoveSet = (exerciseId: string) => {
    if (loggingLocked) return;
    setExerciseSets((prev) => {
      const currentSets = prev[exerciseId] ? [...prev[exerciseId]] : [];
      if (currentSets.length > 1) {
        currentSets.pop();
      }
      const updated = { ...prev, [exerciseId]: currentSets };
      persistLocal(updated, checkedExercisesRef.current, notesRef.current, "LOCAL_ONLY");
      return updated;
    });
  };

  const triggerManualSync = async () => {
    setSyncStatus("SYNCING");
    const res = await syncLocalWorkoutToServer(todayDateKey);
    setSyncStatus(res.status);
    if (res.success) {
      setMessage(`✅ ${res.message || "Synchronized with cloud"}`);
    } else if (res.status === "SYNC_ERROR") {
      setMessage(`⚠️ ${res.message || "Sync error — sets remain on this device"}`);
    } else {
      setMessage(`📴 OFFLINE — Saved on this device`);
    }
  };

  const finishSession = async () => {
    if (!today || loggingLocked) return;
    setSaving(true);

    const allChecked: Record<string, boolean> = { ...checkedExercisesRef.current };
    today.day.exercises.forEach((ex) => {
      allChecked[ex.id] = true;
    });
    setCheckedExercises(allChecked);
    persistLocal(exerciseSetsRef.current, allChecked, notesRef.current, "SYNCING");
    saveLocalWorkoutState(
      todayDateKey,
      today.day.id,
      today.weekNumber || 1,
      notesRef.current,
      exerciseSetsRef.current,
      allChecked,
      "SYNCING",
      { sessionSubmitted: true }
    );

    try {
      const res = await syncLocalWorkoutToServer(todayDateKey, { sessionSubmitted: true });
      setSyncStatus(res.status);
      if (res.success) {
        setMessage(`🎉 Workout submitted & synced${res.xpEarned ? ` (+${res.xpEarned} XP)` : ""}`);
        await loadTodayData();
        await loadHistory();
      } else if (res.status === "LOCAL_ONLY") {
        setMessage("📴 OFFLINE — Saved on this device. Will sync when internet returns.");
      } else {
        setMessage(`⚠️ ${res.message || "Saved on this device"}`);
      }
    } catch {
      setSyncStatus("LOCAL_ONLY");
      setMessage("📴 OFFLINE — Saved on this device");
    } finally {
      setSaving(false);
    }
  };

  const onToggleOverride = () => setManualOverride((prev) => !prev);

  if (!today) {
    return (
      <div className="flex h-72 items-center justify-center gap-3 text-sm text-[var(--text-muted)]">
        <LoaderCircle size={20} className="animate-spin text-orange-500" />
        <span>{hydrated && !isOnline ? "Offline — waiting for cached workout protocol..." : "Loading Workout Protocol & Offline Sync Engine..."}</span>
      </div>
    );
  }

  const missedLocked = Boolean((today.isMissed || today.missedToday || (today.isClosed && !today.completedToday)) && !manualOverride);

  // ── CASE 1: WORKOUT MISSED TODAY (LOCKED AT 09:28 PM) ────────────────────────
  if (missedLocked) {
    const nextWk = today.nextWorkout;
    return (
      <div className="space-y-6 animate-fade-in">
        {today.yesterday && today.yesterday.missedItems && today.yesterday.missedItems.length > 0 && (
          <section className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-rose-500/20 pb-2 mb-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-rose-400">
                🔴 Yesterday's Missed Items — LOCKED
              </h3>
              <span className="text-xs text-slate-400 font-mono">{today.yesterday.dateFormatted}</span>
            </div>
            <ul className="space-y-1.5">
              {today.yesterday.missedItems.map((m) => (
                <li key={m} className="flex items-center justify-between text-sm text-rose-300">
                  <span className="font-semibold">🔴 {m}</span>
                  <span className="text-[10px] font-bold text-rose-400 uppercase bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    MISSED / LOCKED
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="relative overflow-hidden rounded-2xl border border-rose-500/40 bg-gradient-to-br from-rose-950/30 via-slate-900/90 to-slate-950 p-6 md:p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  <Lock size={14} /> 🔴 WORKOUT MISSED & LOCKED
                </span>
                <span className="text-xs text-slate-400">
                  Window Closed at <strong className="text-white">09:28 PM</strong> Ethiopia Time
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white">
                Daily Workout Locked as MISSED
              </h2>
              <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
                You had 16 hours and 28 minutes (05:00 AM – 09:28 PM) to log today's session.
                Because the cutoff passed without submission, this workout is permanently locked and cannot be backdated or submitted.
                The protocol advances tomorrow at <strong className="text-orange-400">05:00 AM</strong> with a fresh scheduled session.
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2 bg-slate-950/90 p-5 rounded-2xl border border-rose-500/30 shadow-xl">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <Clock3 size={14} /> Next Session Unlocks In
              </span>
              <CountdownTimer targetTimestamp={nextWk.unlockTimestamp} />
              <span className="text-xs text-slate-400 flex items-center gap-1 mt-1 font-semibold">
                Tomorrow ({nextWk.dateFormatted.split(",")[0]}) at 05:00 AM
              </span>
            </div>
          </div>
        </section>

        <section className="relative rounded-2xl border border-slate-800 bg-slate-900/50 p-6 md:p-8 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
                Tomorrow's Scheduled Protocol · {nextWk.location}
              </span>
              <h3 className="text-2xl font-bold text-white mt-1">
                {nextWk.type} Day ({nextWk.targetBodyParts || "Target Hypertrophy"})
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Phase Prescription: <strong className="text-white">{nextWk.phase.sets} sets × {nextWk.phase.reps} reps</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold">
              <Lock size={14} /> Unlocks at 05:00 AM
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {nextWk.exercises.map((ex, i) => (
              <div
                key={ex.id || i}
                className="p-3 rounded-xl border border-slate-800/80 bg-slate-950/60 flex flex-col justify-between space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-500">0{i + 1}</span>
                  <span className="text-xs font-bold text-slate-200 truncate">{ex.name}</span>
                </div>
                {ex.targetMuscle && (
                  <span className="text-[10px] text-orange-400 font-medium">🎯 {ex.targetMuscle}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // ── CASE 2: WORKOUT COMPLETED TODAY ─────────────────────────────────────────
  if (today.completedToday && !manualOverride) {
    const nextWk = today.nextWorkout;
    return (
      <div className="space-y-6 animate-fade-in">
        {today.yesterday && today.yesterday.missedItems && today.yesterday.missedItems.length > 0 && (
          <section className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-rose-500/20 pb-2 mb-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-rose-400">
                🔴 Yesterday's Missed Items — LOCKED
              </h3>
              <span className="text-xs text-slate-400 font-mono">{today.yesterday.dateFormatted}</span>
            </div>
            <ul className="space-y-1.5">
              {today.yesterday.missedItems.map((m) => (
                <li key={m} className="flex items-center justify-between text-sm text-rose-300">
                  <span className="font-semibold">🔴 {m}</span>
                  <span className="text-[10px] font-bold text-rose-400 uppercase bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    MISSED / LOCKED
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/30 via-slate-900/90 to-slate-950 p-6 md:p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <CheckCircle2 size={14} /> TODAY'S WORKOUT COMPLETED
                </span>
                <span className="text-xs text-slate-400">
                  Recovery Active for <strong className="text-white">{today.currentDayName}</strong>
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white">
                Great Work! Session Locked for Recovery.
              </h2>
              <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
                You have completed and logged today's workout. Your muscles are in active synthesis.
                The system has locked the checklist and will automatically unlock your next session at{" "}
                <strong className="text-orange-400">05:00 AM Ethiopia Time</strong>.
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2 bg-slate-950/90 p-5 rounded-2xl border border-emerald-500/30 shadow-xl">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                <Flame size={14} /> Next Session Unlocks In
              </span>
              <CountdownTimer targetTimestamp={nextWk.unlockTimestamp} />
              <span className="text-xs text-slate-400 flex items-center gap-1 mt-1 font-semibold">
                <Clock3 size={13} /> Tomorrow ({nextWk.dateFormatted.split(",")[0]}) at 05:00 AM
              </span>
            </div>
          </div>
        </section>

        <section className="relative rounded-2xl border border-slate-800 bg-slate-900/50 p-6 md:p-8 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
                Tomorrow's Scheduled Protocol · {nextWk.location}
              </span>
              <h3 className="text-2xl font-bold text-white mt-1">
                {nextWk.type} Day ({nextWk.targetBodyParts || "Target Hypertrophy"})
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Phase Prescription: <strong className="text-white">{nextWk.phase.sets} sets × {nextWk.phase.reps} reps</strong>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold">
                <Lock size={14} /> Unlocks at 05:00 AM
              </div>
              <button
                onClick={onToggleOverride}
                className="btn btn-ghost btn-xs text-slate-400 hover:text-white flex items-center gap-1"
                title="Preview or Edit Today's Completed Session"
              >
                <Unlock size={12} /> Edit / Review Today
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {nextWk.exercises.map((ex, i) => (
              <div
                key={ex.id || i}
                className="p-3 rounded-xl border border-slate-800/80 bg-slate-950/60 flex flex-col justify-between space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-500">0{i + 1}</span>
                  <span className="text-xs font-bold text-slate-200 truncate">{ex.name}</span>
                </div>
                {ex.targetMuscle && (
                  <span className="text-[10px] text-orange-400 font-medium">🎯 {ex.targetMuscle}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // ── CASE 3: ACTIVE WORKOUT SESSION (READY TO LOG OFFLINE/ONLINE) ────────────
  const totalExercises = today.day.exercises.length;
  const completedExercises = today.day.exercises.filter((ex) => {
    const isChecked = Boolean(checkedExercises[ex.id]);
    const sets = exerciseSets[ex.id] || [];
    return isChecked || (sets.length > 0 && sets.every((s) => s.completed));
  }).length;

  const allDone = totalExercises > 0 && completedExercises === totalExercises;

  return (
    <div className="space-y-6">
      {today.yesterday && today.yesterday.missedItems && today.yesterday.missedItems.length > 0 && (
        <section className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-rose-500/20 pb-2 mb-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-rose-400">
              🔴 Yesterday's Missed Items — LOCKED
            </h3>
            <span className="text-xs text-slate-400 font-mono">{today.yesterday.dateFormatted}</span>
          </div>
          <ul className="space-y-1.5">
            {today.yesterday.missedItems.map((m) => (
              <li key={m} className="flex items-center justify-between text-sm text-rose-300">
                <span className="font-semibold">🔴 {m}</span>
                <span className="text-[10px] font-bold text-rose-400 uppercase bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                  MISSED / LOCKED
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── OFFLINE STATUS & SYNC CONTROL BAR ─────────────────────────────────── */}
      <section className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <span
            className={clsx(
              "px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border",
              syncStatus === "SYNCED"
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : syncStatus === "SYNCING"
                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                : "bg-blue-500/15 text-blue-400 border-blue-500/30"
            )}
          >
            {syncStatus === "SYNCED" ? (
              <>
                <CloudUpload size={14} /> SYNCED (Cloud Updated)
              </>
            ) : syncStatus === "SYNCING" ? (
              <>
                <LoaderCircle size={14} className="animate-spin" /> SYNCING...
              </>
            ) : (
              <>
                <Save size={14} /> OFFLINE — Saved on this device (LOCAL_ONLY)
              </>
            )}
          </span>

          <span className="text-xs text-slate-400 hidden sm:inline">
            {isOnline ? "🌐 Online" : "📴 Offline Mode (Gym data safe)"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={triggerManualSync}
            disabled={syncStatus === "SYNCING"}
            className="btn btn-ghost btn-xs text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1"
          >
            <RotateCcw size={12} className={clsx(syncStatus === "SYNCING" && "animate-spin")} />
            Sync Now
          </button>
        </div>
      </section>

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
              {today.targetDescription || "Execute progressive overload set-by-set. Record each set's KG and reps below. Saved immediately on your device."}
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Exercises Done</span>
            <div className="text-3xl font-extrabold text-orange-400">
              {completedExercises} <span className="text-base text-slate-500">/ {totalExercises}</span>
            </div>
          </div>
        </div>

        {today.focusBadges && today.focusBadges.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-bold text-slate-400">Primary Targets:</span>
            {today.focusBadges.map((badge, idx) => (
              <span
                key={idx}
                className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-900/80 border border-orange-500/20 text-orange-300 shadow-sm flex items-center gap-1.5"
              >
                🎯 {badge}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Rest Timer Float Header */}
      {restRunning && (
        <section className="rounded-xl border border-orange-500/40 bg-orange-950/30 p-4 flex items-center justify-between text-orange-300">
          <div className="flex items-center gap-2">
            <TimerReset className="animate-spin" size={18} />
            <span className="font-bold text-sm">Active Rest Timer</span>
          </div>
          <span className="font-mono text-2xl font-black">{rest}s</span>
        </section>
      )}

      {/* ── SET-BY-SET EXERCISE LIST ────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <Layers className="text-orange-400" size={20} />
            Set-by-Set Weight & Overload Tracker
          </h3>
          <span className="text-xs font-bold text-slate-400">
            Standard Target: {today.phase.sets} sets × {today.phase.reps} reps
          </span>
        </div>

        <div className="space-y-4">
          {today.day.exercises.map((ex, index) => {
            const sets = exerciseSets[ex.id] || [];
            const isChecked = Boolean(checkedExercises[ex.id]);

            return (
              <article
                key={ex.id}
                className={clsx(
                  "rounded-2xl border p-5 shadow-lg space-y-4 transition-all",
                  isChecked
                    ? "border-emerald-500/40 bg-emerald-950/10"
                    : "border-slate-800 bg-slate-950/80"
                )}
              >
                {/* Exercise Header & Cue */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-orange-400">0{index + 1}</span>
                      <h4 className="text-base font-extrabold text-white">{ex.name}</h4>
                      {ex.targetMuscle && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-900 text-slate-400 border border-slate-800">
                          {ex.targetMuscle}
                        </span>
                      )}
                    </div>
                    {ex.masterCue && (
                      <p className="text-xs text-slate-400 italic">"{ex.masterCue}"</p>
                    )}
                  </div>

                  {/* Exercise Check In Toggle Button */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleToggleCheckIn(ex.id)}
                      className={clsx(
                        "px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-sm border",
                        isChecked
                          ? "bg-emerald-500 text-black border-emerald-400"
                          : "bg-slate-900 text-slate-300 border-slate-700 hover:border-orange-500"
                      )}
                    >
                      <CheckCircle2 size={15} />
                      {isChecked ? "Checked In" : "Check In"}
                    </button>
                    <button
                      onClick={() => handleAddSet(ex.id)}
                      className="btn btn-ghost btn-xs text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
                    >
                      <Plus size={13} /> Add Set
                    </button>
                  </div>
                </div>

                {/* Sets Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-2 font-bold uppercase tracking-wider">Set</th>
                        <th className="pb-2 font-bold uppercase tracking-wider">Weight (KG)</th>
                        <th className="pb-2 font-bold uppercase tracking-wider">Reps</th>
                        <th className="pb-2 font-bold uppercase tracking-wider text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {sets.map((set, setIdx) => (
                        <tr key={setIdx} className="hover:bg-slate-900/30">
                          <td className="py-2.5 font-bold font-mono text-slate-300">
                            #{set.setNumber} {setIdx === 0 && <span className="text-[10px] text-orange-400 font-sans ml-1">Top</span>}
                          </td>
                          <td className="py-2.5">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.5"
                                placeholder="kg"
                                value={set.weightKg}
                                onChange={(e) => handleUpdateSet(ex.id, setIdx, "weightKg", e.target.value)}
                                className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-none"
                              />
                              <span className="text-slate-500 font-semibold text-[11px]">kg</span>
                            </div>
                          </td>
                          <td className="py-2.5">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                placeholder="reps"
                                value={set.reps}
                                onChange={(e) => handleUpdateSet(ex.id, setIdx, "reps", e.target.value)}
                                className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white text-center focus:border-orange-500 focus:outline-none"
                              />
                              <span className="text-slate-500 font-semibold text-[11px]">reps</span>
                            </div>
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              onClick={() => handleToggleSetComplete(ex.id, setIdx)}
                              className={clsx(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1",
                                set.completed
                                  ? "bg-emerald-500 text-black font-extrabold shadow-sm"
                                  : "bg-slate-900 text-slate-400 border border-slate-700 hover:border-orange-500 hover:text-white"
                              )}
                            >
                              <Check size={13} />
                              {set.completed ? "Done" : "Check"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {sets.length > 1 && (
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => handleRemoveSet(ex.id)}
                      className="text-[11px] text-slate-500 hover:text-rose-400 flex items-center gap-1"
                    >
                      <Minus size={12} /> Remove Last Set
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* ── SESSION FINISH & SUBMISSION CARD ─────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-4 shadow-xl">
        <h4 className="text-sm font-extrabold uppercase tracking-wider text-slate-300">Session Notes & Finish</h4>
        <textarea
          rows={2}
          placeholder="How did the lifts feel? Any joint tightness or progressive overload PRs..."
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            if (today?.day?.id) {
              saveLocalWorkoutState(
                todayDateKey,
                today.day.id,
                today.weekNumber || 1,
                e.target.value,
                exerciseSets,
                checkedExercises,
                "LOCAL_ONLY"
              );
            }
          }}
          className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
        />

        {message && (
          <div className="p-3 rounded-xl bg-orange-950/40 border border-orange-500/30 text-xs font-bold text-orange-300">
            {message}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="text-xs text-slate-400">
            Window closes at <strong className="text-white">09:28 PM</strong> Ethiopia Time.
          </div>

          <button
            onClick={finishSession}
            disabled={saving}
            className="btn btn-primary font-extrabold px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-xl"
          >
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Award size={16} />}
            Complete & Finish Session
          </button>
        </div>
      </section>
    </div>
  );
}
