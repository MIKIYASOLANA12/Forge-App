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
  Save,
  ShieldAlert,
  Sun,
  Moon,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
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
import {
  WEEKLY_WORKOUT_SCHEDULE,
  getScheduledRoutineForDayOfWeek,
  getCoreRoutineForDayOfWeek,
  isDeloadWeek,
} from "@/lib/workoutMuscleTargets";
import {
  getAddisNow,
  workoutWindowForAddisDate,
  getDayOfJourney300,
} from "@/lib/workoutTime";
import { getCurrentWeek, getPhase } from "@/lib/workout";

type Exercise = {
  id: string;
  name: string;
  order: number;
  targetMuscle?: string;
  masterCue?: string;
  equipment?: string;
  targetSets?: number;
  targetReps?: string;
  targetDurationSeconds?: number;
  startingWeightKg?: number | null;
  startingWeightGuide?: string | null;
  variants?: string[];
  defaultVariant?: string;
  safetyWarning?: string;
  isTimed?: boolean;
  isOptional?: boolean;
  overloadSuggestion?: string | null;
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
  dayOfWeek?: number;
  type: string;
  location: string;
  targetBodyParts?: string;
  focusBadges?: string[];
  description?: string;
  isRecovery?: boolean;
  recoveryNotice?: string;
  equipmentSummary?: string;
  phase?: {
    weeks: readonly number[];
    sets: number;
    reps: string;
    goal: string;
  };
  exercises: {
    id: string;
    name: string;
    order: number;
    targetMuscle?: string;
    masterCue?: string;
    equipment?: string;
    targetSets?: number;
    targetReps?: string;
    targetDurationSeconds?: number;
    startingWeightGuide?: string | null;
    safetyWarning?: string;
    isTimed?: boolean;
  }[];
};

type DailyCoreState = {
  routine: Array<{ id: string; name: string; target: string; cue: string; targetDurationSeconds?: number; isTimed?: boolean }>;
  morning: {
    completed: boolean;
    completedAt: string | null;
    xpEarned: number;
    exercisesJson: string | null;
  };
  night: {
    completed: boolean;
    completedAt: string | null;
    xpEarned: number;
    exercisesJson: string | null;
  };
};

type TodayData = {
  currentDayName?: string;
  currentDateFormatted?: string;
  completedToday: boolean;
  targetBodyParts?: string;
  focusBadges?: string[];
  targetDescription?: string;
  isRecovery?: boolean;
  recoveryNotice?: string;
  equipmentSummary?: string;
  isDeloadWeek?: boolean;
  deloadNotice?: string | null;
  todayLog: {
    id: string;
    completedAt: string;
    type: string;
    notes: string | null;
  } | null;
  day: {
    id: string;
    dayOfWeek: number;
    type: string;
    location: string;
    targetBodyParts?: string;
    focusBadges?: string[];
    description?: string;
    isRecovery?: boolean;
    recoveryNotice?: string;
    equipmentSummary?: string;
    shortSessionExerciseIds?: string[];
    exercises: Exercise[];
    homeSubstitute?: {
      location: "HOME";
      targetBodyParts: string;
      focusBadges: string[];
      description: string;
      equipmentSummary: string;
      exercises: Exercise[];
    } | null;
  };
  dailyCore?: {
    routine: Array<{ id: string; name: string; target: string; cue: string; targetDurationSeconds?: number; isTimed?: boolean; progressionTip?: string }>;
    routineType: "CORE_A" | "CORE_B";
    routineTitle: string;
    routineDescription: string;
    morning: {
      completed: boolean;
      completedAt: string | null;
      xpEarned: number;
      exercisesJson: string | null;
    };
    night: {
      completed: boolean;
      completedAt: string | null;
      xpEarned: number;
      exercisesJson: string | null;
    };
  };
  nextWorkout: NextWorkout;
  weekNumber: number;
  phase?: {
    weeks: readonly number[];
    sets: number;
    reps: string;
    goal: string;
  };
  isNewPhase?: boolean;
  isOpen?: boolean;
  isClosed?: boolean;
  isMissed?: boolean;
  missedToday?: boolean;
  sessionInProgress?: boolean;
  closeTimestamp?: number;
  countdowns?: Array<{
    id: string;
    title: string;
    badge: string;
    badgeColor: string;
    daysRemaining: number;
    totalDays?: number;
    progressPercent: number;
    targetDateFormatted: string;
    statusText: string;
    subText: string;
  }>;
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
  workoutDay: { type: string; targetBodyParts?: string; location?: string };
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
  const [tab, setTab] = useState<"today" | "weekly" | "core" | "physique" | "history">("today");
  const [sessionMode, setSessionMode] = useState<"FULL" | "SHORT" | "HOME_SUB">("FULL");
  const [today, setToday] = useState<TodayData | null>(null);
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [exerciseSets, setExerciseSets] = useState<Record<string, SetEntry[]>>({});
  const [checkedExercises, setCheckedExercises] = useState<Record<string, boolean>>({});
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [rest, setRest] = useState(90);
  const [restRunning, setRestRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [manualOverride, setManualOverride] = useState(false);
  const [syncStatus, setSyncStatus] = useState<OfflineSyncStatus>("LOCAL_ONLY");
  const [isOnline, setIsOnline] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Error & Timeout & Cached states
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  const [isTimeout, setIsTimeout] = useState(false);
  const [cachedFallbackAvailable, setCachedFallbackAvailable] = useState(false);
  const [usingCachedProtocol, setUsingCachedProtocol] = useState(false);

  // Daily Core Local State
  const [morningCoreChecked, setMorningCoreChecked] = useState(false);
  const [nightCoreChecked, setNightCoreChecked] = useState(false);
  const [morningCoreSubmitting, setMorningCoreSubmitting] = useState(false);
  const [nightCoreSubmitting, setNightCoreSubmitting] = useState(false);

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

  const buildDefaultTodayProtocol = (dateKey: string): TodayData => {
    const addisNow = getAddisNow();
    const windowInfo = workoutWindowForAddisDate(addisNow);
    const day300 = getDayOfJourney300(addisNow);
    const week = 1;
    const phase = getPhase(week);
    const isDeload = isDeloadWeek(week);

    const todayDayOfWeek = windowInfo.startAddis.getDay();
    const todayRoutine = getScheduledRoutineForDayOfWeek(todayDayOfWeek);
    const nextDayOfWeek = (todayDayOfWeek + 1) % 7;
    const nextRoutine = getScheduledRoutineForDayOfWeek(nextDayOfWeek);
    const todayCoreRoutine = getCoreRoutineForDayOfWeek(todayDayOfWeek);

    const currentDayName = windowInfo.startAddis.toLocaleDateString("en-US", { weekday: "long" });
    const currentDateFormatted = windowInfo.startAddis.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const activeExerciseList: Exercise[] = (todayRoutine.exercises || []).map((def, idx) => ({
      id: def.id,
      name: def.name,
      order: idx + 1,
      targetMuscle: def.muscle,
      masterCue: def.cue,
      equipment: def.equipment,
      targetSets: isDeload ? Math.max(2, Math.round(def.targetSets * 0.6)) : def.targetSets,
      targetReps: def.targetReps,
      targetDurationSeconds: def.targetDurationSeconds,
      startingWeightKg: def.startingWeightKg,
      startingWeightGuide: def.startingWeightGuide,
      variants: def.variants,
      defaultVariant: def.defaultVariant,
      safetyWarning: def.safetyWarning,
      isTimed: def.isTimed,
      isOptional: def.isOptional,
      lastLog: null,
      todayLog: null,
    }));

    const homeSubList: Exercise[] = todayRoutine.homeSubstitute
      ? (todayRoutine.homeSubstitute.exercises || []).map((def, idx) => ({
          id: def.id,
          name: def.name,
          order: idx + 1,
          targetMuscle: def.muscle,
          masterCue: def.cue,
          equipment: def.equipment,
          targetSets: isDeload ? Math.max(2, Math.round(def.targetSets * 0.6)) : def.targetSets,
          targetReps: def.targetReps,
          targetDurationSeconds: def.targetDurationSeconds,
          startingWeightKg: def.startingWeightKg,
          startingWeightGuide: def.startingWeightGuide,
          variants: def.variants,
          defaultVariant: def.defaultVariant,
          safetyWarning: def.safetyWarning,
          isTimed: def.isTimed,
          isOptional: def.isOptional,
          lastLog: null,
          todayLog: null,
        }))
      : [];

    return {
      currentDayName,
      currentDateFormatted,
      completedToday: false,
      missedToday: windowInfo.isClosed,
      targetBodyParts: todayRoutine.targetBodyParts,
      focusBadges: todayRoutine.focusBadges,
      targetDescription: todayRoutine.description,
      isRecovery: Boolean(todayRoutine.isRecovery),
      recoveryNotice: todayRoutine.recoveryNotice,
      equipmentSummary: todayRoutine.equipmentSummary,
      isDeloadWeek: isDeload,
      deloadNotice: isDeload ? `DELOAD WEEK (Week ${week})` : null,
      todayLog: null,
      day: {
        id: `day-${todayRoutine.dayOfWeek}`,
        dayOfWeek: todayRoutine.dayOfWeek,
        type: todayRoutine.dayName,
        location: todayRoutine.location,
        targetBodyParts: todayRoutine.targetBodyParts,
        focusBadges: todayRoutine.focusBadges,
        description: todayRoutine.description,
        isRecovery: Boolean(todayRoutine.isRecovery),
        recoveryNotice: todayRoutine.recoveryNotice,
        equipmentSummary: todayRoutine.equipmentSummary,
        shortSessionExerciseIds: todayRoutine.shortSessionExerciseIds,
        exercises: activeExerciseList,
        homeSubstitute: todayRoutine.homeSubstitute
          ? {
              ...todayRoutine.homeSubstitute,
              exercises: homeSubList,
            }
          : null,
      },
      dailyCore: todayCoreRoutine
        ? {
            routine: todayCoreRoutine.exercises,
            routineType: todayCoreRoutine.type,
            routineTitle: todayCoreRoutine.title,
            routineDescription: todayCoreRoutine.description,
            morning: { completed: false, completedAt: null, xpEarned: 0, exercisesJson: null },
            night: { completed: false, completedAt: null, xpEarned: 0, exercisesJson: null },
          }
        : undefined,
      nextWorkout: {
        dateFormatted: windowInfo.nextUnlockAddis.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
        unlockTimestamp: windowInfo.nextUnlockUtc.getTime(),
        dayOfWeek: nextRoutine.dayOfWeek,
        type: nextRoutine.dayName,
        location: nextRoutine.location,
        targetBodyParts: nextRoutine.targetBodyParts,
        focusBadges: nextRoutine.focusBadges,
        description: nextRoutine.description,
        isRecovery: Boolean(nextRoutine.isRecovery),
        recoveryNotice: nextRoutine.recoveryNotice,
        equipmentSummary: nextRoutine.equipmentSummary,
        phase,
        exercises: (nextRoutine.exercises || []).map((e, idx) => ({
          id: e.id,
          name: e.name,
          order: idx + 1,
          targetMuscle: e.muscle,
          masterCue: e.cue,
          equipment: e.equipment,
          targetSets: e.targetSets,
          targetReps: e.targetReps,
          targetDurationSeconds: e.targetDurationSeconds,
          startingWeightGuide: e.startingWeightGuide,
          safetyWarning: e.safetyWarning,
          isTimed: e.isTimed,
        })),
      },
      weekNumber: week,
      phase,
      isNewPhase: false,
      isOpen: windowInfo.isOpen,
      isClosed: windowInfo.isClosed,
      isMissed: windowInfo.isClosed,
      sessionInProgress: false,
      closeTimestamp: windowInfo.closeUtc.getTime(),
      countdowns: [],
    };
  };

  const buildInitialSets = (data: TodayData, localSaved: ReturnType<typeof loadLocalWorkoutState>) => {
    const initialSetsState: Record<string, SetEntry[]> = { ...(localSaved?.exerciseSets || {}) };
    const initialChecked: Record<string, boolean> = { ...(localSaved?.checkedExercises || {}) };
    const initialVariants: Record<string, string> = {};

    const exercisesList = Array.isArray(data?.day?.exercises) ? data.day.exercises : [];
    const homeList = Array.isArray(data?.day?.homeSubstitute?.exercises) ? data.day.homeSubstitute.exercises : [];
    const allExercises = [...exercisesList, ...homeList];

    allExercises.forEach((ex) => {
      const serverToday = parseSetDetails(ex.todayLog?.setDetails);
      const previous = parseSetDetails(ex.lastLog?.setDetails);
      const local = initialSetsState[ex.id] || [];
      const merged = mergeSetsByClientId(local, serverToday);

      if (ex.defaultVariant) {
        initialVariants[ex.id] = ex.defaultVariant;
      }

      if (merged.length > 0) {
        initialSetsState[ex.id] = merged.map((s) => ensureSetClientId(ex.id, s));
      } else {
        const defaultSetsCount = ex.targetSets || 3;
        const defaultReps = Number(String(ex.targetReps || "10").split(/[–-]/)[0]) || 10;
        const setsArray: SetEntry[] = [];
        for (let s = 1; s <= defaultSetsCount; s++) {
          const lastSet = previous[s - 1];
          const initialWeight = lastSet?.weightKg ?? ex.startingWeightKg ?? "";
          setsArray.push(
            ensureSetClientId(ex.id, {
              setNumber: s,
              weightKg: initialWeight,
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

    setSelectedVariants((prev) => ({ ...initialVariants, ...prev }));
    return { initialSetsState, initialChecked, notes: localSaved?.notes || data?.todayLog?.notes || "" };
  };

  useEffect(() => {
    const cached = loadCachedTodayProtocol(todayDateKey) as TodayData | null;
    const localSaved = loadLocalWorkoutState(todayDateKey);
    const activeData = cached?.day?.exercises?.length ? cached : buildDefaultTodayProtocol(todayDateKey);

    setCachedFallbackAvailable(true);
    setToday(activeData);
    setUsingCachedProtocol(Boolean(cached?.day?.exercises?.length));

    if (activeData.dailyCore) {
      setMorningCoreChecked(activeData.dailyCore.morning.completed);
      setNightCoreChecked(activeData.dailyCore.night.completed);
    }

    const built = buildInitialSets(activeData, localSaved);
    setExerciseSets(built.initialSetsState);
    setCheckedExercises(built.initialChecked);
    setNotes(built.notes);
    setSyncStatus(localSaved?.syncStatus || (typeof navigator !== "undefined" && !navigator.onLine ? "LOCAL_ONLY" : "SYNCED"));

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

  const handleUseCachedWorkout = () => {
    const cached = loadCachedTodayProtocol(todayDateKey) as TodayData | null;
    const localSaved = loadLocalWorkoutState(todayDateKey);
    const targetData = cached?.day?.exercises?.length ? cached : buildDefaultTodayProtocol(todayDateKey);

    setToday(targetData);
    setUsingCachedProtocol(true);
    setWorkoutError(null);
    if (targetData.dailyCore) {
      setMorningCoreChecked(targetData.dailyCore.morning.completed);
      setNightCoreChecked(targetData.dailyCore.night.completed);
    }
    const built = buildInitialSets(targetData, localSaved);
    setExerciseSets(built.initialSetsState);
    setCheckedExercises(built.initialChecked);
    setNotes(built.notes);
    setSyncStatus("LOCAL_ONLY");
    setMessage("OFFLINE — Using cached workout protocol");
  };

  const loadTodayData = async () => {
    setWorkoutError(null);
    setIsTimeout(false);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3500);
    try {
      const response = await fetch("/api/workout/today", { signal: controller.signal });
      if (response.ok) {
        const data = (await response.json()) as TodayData;
        if (data && data.day && Array.isArray(data.day.exercises)) {
          cacheTodayProtocol(todayDateKey, data as unknown as Record<string, unknown>);
          setCachedFallbackAvailable(true);
          setToday(data);
          setUsingCachedProtocol(false);
          setWorkoutError(null);

          if (data.dailyCore) {
            setMorningCoreChecked(data.dailyCore.morning.completed);
            setNightCoreChecked(data.dailyCore.night.completed);
          }

          const localSaved = loadLocalWorkoutState(todayDateKey, data.day.id || "");
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
      } else {
        const errText = await response.text().catch(() => "Workout data could not be loaded.");
        let errMsg = "Workout data could not be loaded from server.";
        try {
          const jsonErr = JSON.parse(errText);
          if (jsonErr?.error) errMsg = jsonErr.error;
        } catch {}
        setWorkoutError(errMsg);
        const cached = loadCachedTodayProtocol(todayDateKey) as TodayData | null;
        if (cached?.day) {
          setCachedFallbackAvailable(true);
        }
      }
    } catch (err: any) {
      const isAbort = err?.name === "AbortError" || controller.signal.aborted;
      setIsTimeout(isAbort);
      setWorkoutError(
        isAbort
          ? "Request timed out connecting to workout server."
          : (err?.message || "Failed to connect to workout server.")
      );
      const cached = loadCachedTodayProtocol(todayDateKey) as TodayData | null;
      if (cached?.day) {
        setCachedFallbackAvailable(true);
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

    persistLocal(exerciseSetsRef.current, updatedChecked, notesRef.current, "LOCAL_ONLY");

    if (typeof navigator !== "undefined" && navigator.onLine) {
      void syncLocalWorkoutToServer(todayDateKey).then((res) => {
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
          reps: lastSet?.reps ?? 10,
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

    const activeList = getDisplayedExercises();
    const allChecked: Record<string, boolean> = { ...checkedExercisesRef.current };
    activeList.forEach((ex) => {
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

  const handleToggleCore = async (slot: "MORNING" | "NIGHT") => {
    const isMorning = slot === "MORNING";
    const currentVal = isMorning ? morningCoreChecked : nightCoreChecked;
    const setSubmitting = isMorning ? setMorningCoreSubmitting : setNightCoreSubmitting;
    const setVal = isMorning ? setMorningCoreChecked : setNightCoreChecked;

    setSubmitting(true);
    setVal(!currentVal);

    try {
      const res = await fetch("/api/workout/core", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot, completed: !currentVal }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage(`✅ Daily Core (${isMorning ? "Morning" : "Night"}) updated${data.xpEarned ? ` (+${data.xpEarned} XP)` : ""}`);
      }
    } catch {
      setMessage("⚠️ Saved locally — will sync with server.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!today) {
    if (workoutError) {
      return (
        <div className="mx-auto max-w-2xl p-6 my-12 rounded-2xl border border-rose-500/40 bg-rose-950/20 shadow-2xl text-center space-y-5 animate-fade-in">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
            <AlertCircle size={30} />
          </div>
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-block">
              {isTimeout ? "WORKOUT DATA TIMEOUT" : "⚠️ WORKOUT ENGINE ERROR"}
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              {isTimeout ? "Connection Timed Out" : "Workout Protocol Offline"}
            </h2>
            <p className="text-sm text-rose-200/80 max-w-md mx-auto">
              {workoutError}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => loadTodayData()}
              className="btn btn-primary btn-md rounded-xl font-black uppercase tracking-wider flex items-center gap-2"
            >
              <RotateCcw size={16} /> Retry
            </button>
            {cachedFallbackAvailable && (
              <button
                onClick={handleUseCachedWorkout}
                className="btn btn-ghost border border-slate-700 hover:bg-slate-800 text-slate-200 btn-md rounded-xl font-bold uppercase tracking-wider flex items-center gap-2"
              >
                <Layers size={16} /> Use Cached Workout
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-72 items-center justify-center gap-3 text-sm text-[var(--text-muted)]">
        <LoaderCircle size={20} className="animate-spin text-orange-500" />
        <span>{hydrated && !isOnline ? "Offline — waiting for cached workout protocol..." : "Loading 7-Day Workout Protocol & Engine..."}</span>
      </div>
    );
  }

  const physiqueCard = today.countdowns?.find((c) => c.id === "body_transformation");

  // Determine active displayed exercise list based on sessionMode
  const getDisplayedExercises = (): Exercise[] => {
    if (sessionMode === "HOME_SUB" && today.day.homeSubstitute) {
      return today.day.homeSubstitute.exercises;
    }
    if (sessionMode === "SHORT" && today.day.shortSessionExerciseIds) {
      return today.day.exercises.filter((ex) => today.day.shortSessionExerciseIds?.includes(ex.id));
    }
    return today.day.exercises;
  };

  const displayedExercises = getDisplayedExercises();
  const totalExercises = displayedExercises.length;
  const completedExercises = displayedExercises.filter((ex) => {
    const isChecked = Boolean(checkedExercises[ex.id]);
    const sets = exerciseSets[ex.id] || [];
    return isChecked || (sets.length > 0 && sets.every((s) => s.completed));
  }).length;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── WORKOUT ENGINE ERROR BANNER ─────────────────────────────────────────── */}
      {workoutError && (
        <section className="rounded-2xl border border-rose-500/40 bg-rose-950/40 p-4 shadow-xl flex flex-wrap items-center justify-between gap-3 text-rose-200 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
              <AlertCircle size={20} />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-rose-400">
                {isTimeout ? "WORKOUT DATA TIMEOUT" : "⚠️ WORKOUT ENGINE ERROR"}
              </div>
              <div className="text-sm font-semibold">{workoutError}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadTodayData()}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw size={14} /> Retry
            </button>
            {cachedFallbackAvailable && !usingCachedProtocol && (
              <button
                onClick={handleUseCachedWorkout}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
              >
                <Layers size={14} /> Use Cached Workout
              </button>
            )}
          </div>
        </section>
      )}

      {/* ── CACHED OFFLINE WARNING BANNER ───────────────────────────────────────── */}
      {usingCachedProtocol && (
        <section className="rounded-2xl border border-amber-500/40 bg-amber-950/30 p-3.5 shadow-md flex items-center gap-2.5 text-amber-300 text-xs font-bold">
          <AlertCircle size={18} className="text-amber-400 shrink-0" />
          <span>CACHED — NOT YET VERIFIED WITH SERVER (Saved locally on this device)</span>
        </section>
      )}
      {/* ── PART A: LIVE PHYSIQUE TRANSFORMATION COUNTDOWN BANNER ──────────────── */}
      {physiqueCard && (
        <section className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-slate-950 p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Flame size={12} className="text-amber-400" />
                  PHYSIQUE TRANSFORMATION
                </span>
                <span className="text-xs text-slate-400">Target: {physiqueCard.targetDateFormatted}</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-amber-300 tracking-tight">
                {physiqueCard.statusText}
              </h3>
              <p className="text-xs text-slate-300">{physiqueCard.subText}</p>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-center">
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Countdown</span>
                <span className="text-xl font-black text-white font-mono">{physiqueCard.daysRemaining} Days</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── DELOAD WEEK BANNER ─────────────────────────────────────────────────── */}
      {today.isDeloadWeek && (
        <section className="rounded-2xl border-2 border-indigo-500/50 bg-indigo-950/30 p-4 shadow-xl flex items-start gap-3">
          <Sparkles className="text-indigo-400 shrink-0 mt-0.5" size={20} />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                DELOAD WEEK ACTIVE (Week {today.weekNumber})
              </span>
            </div>
            <p className="text-xs text-indigo-200">
              {today.deloadNotice || "Total training volume is reduced by ~40% this week. Maintain movement quality and crisp technique to allow full joint and central nervous system recovery."}
            </p>
          </div>
        </section>
      )}

      {/* ── TAB SELECTOR ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 flex-wrap">
        <button
          onClick={() => setTab("today")}
          className={clsx(
            "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
            tab === "today"
              ? "bg-orange-500 text-black shadow-lg font-black"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          )}
        >
          <Dumbbell size={15} />
          Today's Routine ({today.day.type})
        </button>

        <button
          onClick={() => setTab("weekly")}
          className={clsx(
            "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
            tab === "weekly"
              ? "bg-orange-500 text-black shadow-lg font-black"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          )}
        >
          <Calendar size={15} />
          Weekly Training Plan
        </button>

        <button
          onClick={() => setTab("core")}
          className={clsx(
            "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
            tab === "core"
              ? "bg-orange-500 text-black shadow-lg font-black"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          )}
        >
          <Target size={15} />
          Progressive Core ({today.dailyCore?.routineType === "CORE_B" ? "Core B" : today.dailyCore?.routineType === "CORE_A" ? "Core A" : "Rest"})
          {(morningCoreChecked && nightCoreChecked) && <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded">2/2</span>}
        </button>

        <button
          onClick={() => setTab("physique")}
          className={clsx(
            "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
            tab === "physique"
              ? "bg-orange-500 text-black shadow-lg font-black"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          )}
        >
          <Flame size={15} />
          Muscle Group Trends
        </button>

        <button
          onClick={() => setTab("history")}
          className={clsx(
            "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
            tab === "history"
              ? "bg-orange-500 text-black shadow-lg font-black"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          )}
        >
          <History size={15} />
          Session History
        </button>
      </div>

      {/* ── OFFLINE STATUS & SYNC BAR ─────────────────────────────────────────── */}
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
                <Save size={14} /> OFFLINE — Saved on device
              </>
            )}
          </span>

          <span className="text-xs text-slate-400 hidden sm:inline">
            {isOnline ? "🌐 Online" : "📴 Offline Mode Active"}
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

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: TODAY'S WORKOUT ROUTINE                                             */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {tab === "today" && (
        <div className="space-y-6">
          {/* Active Recovery Notice (Thursday) */}
          {today.day.isRecovery && (
            <section className="rounded-2xl border-2 border-emerald-500/50 bg-emerald-950/30 p-5 text-center shadow-xl space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-500 text-black">
                <Sparkles size={14} /> ACTIVE RECOVERY
              </span>
              <h3 className="text-xl font-black text-white">LIGHT INTENSITY · RECOVERY DAY</h3>
              <p className="text-xs text-emerald-200 max-w-xl mx-auto font-medium">
                {today.day.recoveryNotice || "DO NOT TREAT THIS AS A HARD WORKOUT DAY. Focus on gentle movement, joint mobility, and blood flow."}
              </p>
            </section>
          )}

          {/* School-Time Mode & Substitution Selector */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Session Mode & Location</span>
                <p className="text-xs text-slate-300">Adapt today's prescription to available time and location:</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setSessionMode("FULL")}
                  className={clsx(
                    "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                    sessionMode === "FULL"
                      ? "bg-orange-500 text-black border-orange-400 font-black shadow-md"
                      : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
                  )}
                >
                  Full Session (60–75m)
                </button>

                <button
                  onClick={() => setSessionMode("SHORT")}
                  className={clsx(
                    "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                    sessionMode === "SHORT"
                      ? "bg-orange-500 text-black border-orange-400 font-black shadow-md"
                      : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
                  )}
                >
                  ⚡ Short Session (25–35m)
                </button>

                {today.day.homeSubstitute && (
                  <button
                    onClick={() => setSessionMode("HOME_SUB")}
                    className={clsx(
                      "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                      sessionMode === "HOME_SUB"
                        ? "bg-cyan-500 text-black border-cyan-400 font-black shadow-md"
                        : "bg-slate-900 text-cyan-400 border-cyan-900/50 hover:text-white"
                    )}
                  >
                    🏠 Home Substitute
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Day Hero Banner */}
          <section className="rounded-2xl border border-orange-500/30 bg-gradient-to-r from-[#17101a] via-[#1c1424] to-[#120e1a] p-6 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded-full flex items-center gap-1">
                    <Target size={12} />
                    {sessionMode === "HOME_SUB" ? "HOME SUBSTITUTE" : `${today.day.type} · ${today.day.location}`}
                  </span>
                  <span className="text-xs text-slate-400">{today.currentDateFormatted}</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-white">
                  {sessionMode === "HOME_SUB" && today.day.homeSubstitute ? today.day.homeSubstitute.targetBodyParts : today.day.targetBodyParts}
                </h2>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  {sessionMode === "HOME_SUB" && today.day.homeSubstitute ? today.day.homeSubstitute.description : today.day.description}
                </p>
                <p className="text-xs text-orange-400 mt-1 font-semibold">
                  Equipment: {sessionMode === "HOME_SUB" && today.day.homeSubstitute ? today.day.homeSubstitute.equipmentSummary : today.day.equipmentSummary}
                </p>
              </div>

              <div className="flex flex-col items-start md:items-end gap-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Exercises Completed</span>
                <div className="text-3xl font-extrabold text-orange-400">
                  {completedExercises} <span className="text-base text-slate-500">/ {totalExercises}</span>
                </div>
              </div>
            </div>

            {today.day.focusBadges && today.day.focusBadges.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-bold text-slate-400">Key Focus:</span>
                {today.day.focusBadges.map((badge, idx) => (
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

          {/* Rest Timer */}
          {restRunning && (
            <section className="rounded-xl border border-orange-500/40 bg-orange-950/30 p-4 flex items-center justify-between text-orange-300 animate-pulse">
              <div className="flex items-center gap-2">
                <TimerReset className="animate-spin" size={18} />
                <span className="font-bold text-sm">Active Rest Timer</span>
              </div>
              <span className="font-mono text-2xl font-black">{rest}s</span>
            </section>
          )}

          {/* ── SET-BY-SET EXERCISE LIST ──────────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Layers className="text-orange-400" size={20} />
                Prescribed Exercises & Set Logs
              </h3>
              <span className="text-xs font-bold text-slate-400">
                Window Closes at 09:28 PM Addis
              </span>
            </div>

            <div className="space-y-4">
              {displayedExercises.map((ex, index) => {
                const sets = exerciseSets[ex.id] || [];
                const isChecked = Boolean(checkedExercises[ex.id]);
                const selectedVariant = selectedVariants[ex.id] || ex.defaultVariant || ex.variants?.[0] || ex.name;

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
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-orange-400">0{index + 1}</span>
                          <h4 className="text-base font-extrabold text-white">{ex.name}</h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-900 text-orange-300 border border-slate-800">
                            {ex.targetSets} × {ex.targetReps}
                          </span>
                          {ex.equipment && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-slate-400 border border-slate-800">
                              {ex.equipment}
                            </span>
                          )}
                          {ex.isOptional && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-amber-400 border border-amber-500/30">
                              Optional
                            </span>
                          )}
                        </div>

                        {/* Safety Warning */}
                        {ex.safetyWarning && (
                          <div className="p-2.5 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-300 text-xs font-semibold flex items-start gap-2">
                            <ShieldAlert size={16} className="text-rose-400 shrink-0 mt-0.5" />
                            <span>{ex.safetyWarning}</span>
                          </div>
                        )}

                        {/* Variant Selector */}
                        {ex.variants && ex.variants.length > 0 && (
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-xs font-bold text-slate-400">Performed Variation:</span>
                            <div className="flex items-center gap-1.5">
                              {ex.variants.map((v) => (
                                <button
                                  key={v}
                                  onClick={() => setSelectedVariants((prev) => ({ ...prev, [ex.id]: v }))}
                                  className={clsx(
                                    "px-2.5 py-1 rounded-lg text-xs font-bold border transition-all",
                                    selectedVariant === v
                                      ? "bg-orange-500 text-black border-orange-400"
                                      : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
                                  )}
                                >
                                  {v}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {ex.startingWeightGuide && (
                          <p className="text-[11px] text-slate-400">
                            <span className="text-orange-400 font-bold">Starting Guide:</span> {ex.startingWeightGuide}
                          </p>
                        )}

                        {ex.masterCue && (
                          <p className="text-xs text-slate-400 italic">"{ex.masterCue}"</p>
                        )}

                        {/* Progressive Overload Suggestion */}
                        {ex.overloadSuggestion && (
                          <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-300 text-xs font-semibold">
                            {ex.overloadSuggestion}
                          </div>
                        )}
                      </div>

                      {/* Check-In Button */}
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

                    {/* Last Session Reference */}
                    {ex.lastLog && (
                      <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                        <span>
                          <strong className="text-slate-300">LAST SESSION REFERENCE:</strong>{" "}
                          {ex.lastLog.weightKg ? `${ex.lastLog.weightKg} kg × ` : ""}{ex.lastLog.repsCompleted} reps ({ex.lastLog.setsCompleted} sets logged)
                        </span>
                      </div>
                    )}

                    {/* Sets Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400">
                            <th className="pb-2 font-bold uppercase tracking-wider">Set</th>
                            <th className="pb-2 font-bold uppercase tracking-wider">
                              {ex.isTimed ? "Duration" : "Weight (KG)"}
                            </th>
                            <th className="pb-2 font-bold uppercase tracking-wider">Reps / Target</th>
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
                                {ex.isTimed ? (
                                  <span className="text-slate-400 font-semibold">{ex.targetDurationSeconds || 30}s hold</span>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      step="0.5"
                                      placeholder={ex.startingWeightKg ? String(ex.startingWeightKg) : "kg"}
                                      value={set.weightKg}
                                      onChange={(e) => handleUpdateSet(ex.id, setIdx, "weightKg", e.target.value)}
                                      className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-none font-mono"
                                    />
                                    <span className="text-slate-500 font-semibold text-[11px]">kg</span>
                                  </div>
                                )}
                              </td>

                              <td className="py-2.5">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    placeholder={ex.targetReps || "reps"}
                                    value={set.reps}
                                    onChange={(e) => handleUpdateSet(ex.id, setIdx, "reps", e.target.value)}
                                    className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white text-center focus:border-orange-500 focus:outline-none font-mono"
                                  />
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

          {/* Session Notes & Finish */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-4 shadow-xl">
            <h4 className="text-sm font-extrabold uppercase tracking-wider text-slate-300">Session Notes & Finish</h4>
            <textarea
              rows={2}
              placeholder="How did the session feel? Any progressive overload PRs or equipment notes..."
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
                Cutoff: <strong className="text-white">09:28 PM</strong> Ethiopia Time.
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
      )}

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* TAB: WEEKLY 7-DAY TRAINING SCHEDULE (HOME OR GYM)                          */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {tab === "weekly" && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-orange-500/30 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-6 shadow-xl space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-orange-500/20 text-orange-400 border border-orange-500/30">
                ACTIVE WEEKLY TRAINING ARCHITECTURE
              </span>
              <span className="text-xs text-slate-400">7-Day Split · Home & Gym Hybrid</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white">Exact Weekly Training Split</h2>
            <p className="text-xs text-slate-300 max-w-2xl">
              Strictly scheduled distribution targeting progressive hypertrophy, V-taper symmetry, arm thickness, and strategic active recovery.
            </p>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                day: "Sunday",
                dayOfWeek: 0,
                location: "HOME",
                focus: "Shoulders + Back",
                isRecovery: false,
                exercises: [
                  "Jar Lateral Raise — 3 × 12–15",
                  "Jar Shoulder Press — 3 × 10–15",
                  "Jar Bent-Over Row — 3 × 12–15",
                  "Rear-Delt Fly — 3 × 12–15",
                  "Superman Hold — 3 × 30 sec",
                ],
                core: "CORE A (Leg Raises, Slow/Weighted Crunch, Plank)",
              },
              {
                day: "Monday",
                dayOfWeek: 1,
                location: "HOME",
                focus: "Chest + Triceps",
                isRecovery: false,
                exercises: [
                  "Push-Ups — 3 sets near failure",
                  "Diamond Push-Ups — 3 × 10–15",
                  "Feet-Elevated Push-Ups — 3 × 8–15",
                  "Pike Push-Ups — 3 × 8–12",
                  "Jar Overhead Triceps Extension — 3 × 12–15",
                ],
                core: "CORE B (Reverse Crunch, Bicycle Crunch, Side Plank)",
              },
              {
                day: "Tuesday",
                dayOfWeek: 2,
                location: "HOME",
                focus: "Biceps + Back",
                isRecovery: false,
                exercises: [
                  "Jar Curls — 3 × 12–20",
                  "Hammer Curls — 3 × 12–20",
                  "Jar Rows — 3 × 12–20",
                  "Towel Rows — 3 × 8–15",
                  "Superman Rows — 3 × 12–15",
                  "Pull-Ups — 3 sets (Optional if safe bar available)",
                ],
                core: "Rest / Active Recovery (No hard core)",
              },
              {
                day: "Wednesday",
                dayOfWeek: 3,
                location: "GYM",
                focus: "Chest + Shoulders",
                isRecovery: false,
                exercises: [
                  "Bench Press — 4 × 8–10",
                  "Incline Dumbbell Press — 3 × 8–12",
                  "Lateral Raise — 4 × 12–15",
                  "Overhead Press — 3 × 8–10",
                  "Rear-Delt Exercise — 3 × 12–15",
                ],
                core: "CORE A (Leg Raises, Slow/Weighted Crunch, Plank)",
              },
              {
                day: "Thursday",
                dayOfWeek: 4,
                location: "HOME",
                focus: "Active Recovery",
                isRecovery: true,
                recoveryTag: "ACTIVE RECOVERY",
                exercises: [
                  "Push-Ups — 2 × 15",
                  "Jar Curls — 2 × 15",
                  "Plank — 2 × 45 sec",
                ],
                core: "Light Plank only (Genuinely light active recovery)",
              },
              {
                day: "Friday",
                dayOfWeek: 5,
                location: "GYM",
                focus: "Back + Biceps",
                isRecovery: false,
                exercises: [
                  "Pull-Ups OR Lat Pulldown — 4 × 8–10",
                  "Barbell Row — 4 × 8–10",
                  "Seated Cable Row — 3 × 10–12",
                  "Biceps Curl — 3 × 10–12",
                  "Hammer Curl — 3 × 10–12",
                ],
                core: "CORE B (Reverse Crunch, Bicycle Crunch, Side Plank)",
              },
              {
                day: "Saturday",
                dayOfWeek: 6,
                location: "GYM",
                focus: "Triceps + Arms + Forearms",
                isRecovery: false,
                exercises: [
                  "Dips — 3 × 8–12",
                  "Rope Pushdown — 3 × 10–15",
                  "Overhead Triceps Extension — 3 × 10–15",
                  "Wrist Curls — 3 × 12–20",
                  "Hammer Curls — 2 × 10–12",
                ],
                core: "CORE A (Leg Raises, Slow/Weighted Crunch, Plank)",
              },
            ].map((scheduleDay) => {
              const isToday = today?.day?.dayOfWeek === scheduleDay.dayOfWeek;
              return (
                <article
                  key={scheduleDay.day}
                  className={clsx(
                    "rounded-2xl border p-5 space-y-3.5 transition-all shadow-lg",
                    isToday
                      ? "border-orange-500 bg-orange-950/20 ring-1 ring-orange-500/50"
                      : scheduleDay.isRecovery
                      ? "border-emerald-500/30 bg-emerald-950/10"
                      : "border-slate-800 bg-slate-950/80 hover:border-slate-700"
                  )}
                >
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold text-white">{scheduleDay.day}</span>
                      {isToday && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-orange-500 text-black animate-pulse">
                          Today
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={clsx(
                          "px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wider border",
                          scheduleDay.location === "HOME"
                            ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                            : "bg-purple-500/15 text-purple-300 border-purple-500/30"
                        )}
                      >
                        {scheduleDay.location}
                      </span>
                      {scheduleDay.isRecovery && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Active Recovery
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Focus Area</span>
                    <h4 className="text-sm font-black text-orange-400">{scheduleDay.focus}</h4>
                  </div>

                  <div className="space-y-1.5 pt-1 border-t border-slate-900">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Prescribed Movements:</span>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {scheduleDay.exercises.map((ex, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-orange-400 font-bold shrink-0">•</span>
                          <span>{ex}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300">
                    <strong className="text-orange-300">Core Protocol:</strong> {scheduleDay.core}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: PROGRESSIVE CORE PROGRAM (A/B ROTATION & CHECK-INS)                */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {tab === "core" && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-orange-500/30 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-6 shadow-xl space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-orange-500/20 text-orange-400 border border-orange-500/30">
                PROGRESSIVE CORE PROGRAM
              </span>
              <span className="text-xs text-slate-400">4–5 Sessions / Week (A/B Alternation)</span>
            </div>
            <h2 className="text-2xl font-black text-white">{today.dailyCore?.routineTitle || "Daily Core Routine"}</h2>
            <p className="text-xs text-slate-300 max-w-xl">
              {today.dailyCore?.routineDescription || "Focus on progressive difficulty through slower tempo, pauses, and deeper range of motion rather than thousands of mindless reps."}
            </p>
          </section>

          {/* Routine Exercises Card */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Today's Prescribed Core Movements</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(today.dailyCore?.routine || []).map((core, idx) => (
                <div key={core.id} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold text-orange-400">0{idx + 1}</span>
                  <h5 className="text-sm font-black text-white">{core.name}</h5>
                  <span className="text-xs text-orange-300 font-mono block">{core.target}</span>
                  <p className="text-[11px] text-slate-400 italic">"{core.cue}"</p>
                  {core.progressionTip && (
                    <p className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-1.5">
                      💡 {core.progressionTip}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Morning & Night Check-In Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Morning Slot */}
            <article
              className={clsx(
                "rounded-2xl border p-6 space-y-4 shadow-xl transition-all",
                morningCoreChecked
                  ? "border-emerald-500/40 bg-emerald-950/15"
                  : "border-slate-800 bg-slate-950"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sun className="text-amber-400" size={20} />
                  <h3 className="text-lg font-black text-white">Morning / Wake-Up Core</h3>
                </div>
                <span
                  className={clsx(
                    "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border",
                    morningCoreChecked
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-slate-900 text-slate-400 border-slate-800"
                  )}
                >
                  {morningCoreChecked ? "✅ Completed" : "⏳ Pending"}
                </span>
              </div>

              <ul className="space-y-2 text-xs text-slate-300">
                {(today.dailyCore?.routine || []).map((core) => (
                  <li key={core.id} className="flex items-center gap-2">
                    <Check size={14} className={morningCoreChecked ? "text-emerald-400" : "text-slate-600"} />
                    {core.name} ({core.target})
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleToggleCore("MORNING")}
                disabled={morningCoreSubmitting}
                className={clsx(
                  "w-full py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-md",
                  morningCoreChecked
                    ? "bg-emerald-500 text-black"
                    : "bg-orange-500 hover:bg-orange-600 text-black"
                )}
              >
                {morningCoreSubmitting ? (
                  <LoaderCircle size={15} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                {morningCoreChecked ? "Morning Core Verified ✓" : "Mark Morning Core Complete (+25 XP)"}
              </button>
            </article>

            {/* Night Slot */}
            <article
              className={clsx(
                "rounded-2xl border p-6 space-y-4 shadow-xl transition-all",
                nightCoreChecked
                  ? "border-emerald-500/40 bg-emerald-950/15"
                  : "border-slate-800 bg-slate-950"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Moon className="text-indigo-400" size={20} />
                  <h3 className="text-lg font-black text-white">Night / Bedtime Core</h3>
                </div>
                <span
                  className={clsx(
                    "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border",
                    nightCoreChecked
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-slate-900 text-slate-400 border-slate-800"
                  )}
                >
                  {nightCoreChecked ? "✅ Completed" : "⏳ Pending"}
                </span>
              </div>

              <ul className="space-y-2 text-xs text-slate-300">
                {(today.dailyCore?.routine || []).map((core) => (
                  <li key={core.id} className="flex items-center gap-2">
                    <Check size={14} className={nightCoreChecked ? "text-emerald-400" : "text-slate-600"} />
                    {core.name} ({core.target})
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleToggleCore("NIGHT")}
                disabled={nightCoreSubmitting}
                className={clsx(
                  "w-full py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-md",
                  nightCoreChecked
                    ? "bg-emerald-500 text-black"
                    : "bg-orange-500 hover:bg-orange-600 text-black"
                )}
              >
                {nightCoreSubmitting ? (
                  <LoaderCircle size={15} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                {nightCoreChecked ? "Night Core Verified ✓" : "Mark Night Core Complete (+25 XP)"}
              </button>
            </article>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: MUSCLE GROUP TRENDS & PHYSIQUE PROGRESS                             */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {tab === "physique" && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-3 shadow-xl">
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <Flame className="text-orange-400" size={22} />
              7-Month Muscle Group Focus & Workout Performance Trends
            </h3>
            <p className="text-xs text-slate-400 max-w-2xl">
              Performance metrics derived directly from your logged workout sessions. Forge tracks training volume and strength progression across primary hypertrophy targets.
            </p>
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { name: "SHOULDERS", focus: "Side Delts & Overhead Press", exercises: ["Lateral Raise", "Overhead Press", "Pike Push-ups"] },
              { name: "CHEST", focus: "Pectoralis Major & Incline", exercises: ["Bench Press", "Incline DB Press", "Push-ups"] },
              { name: "BACK (V-TAPER)", focus: "Lats Width & Thickness", exercises: ["Pull-ups", "Barbell Row", "Seated Cable Row"] },
              { name: "BICEPS", focus: "Peak Hypertrophy & Curls", exercises: ["Biceps Curl", "Jar Curls", "Hammer Curl"] },
              { name: "TRICEPS", focus: "Horseshoe & Overhead Extension", exercises: ["Dips", "Rope Pushdown", "Diamond Push-ups"] },
              { name: "FOREARMS", focus: "Brachioradialis & Grip", exercises: ["Wrist Curl", "Hammer Curls", "Towel Rows"] },
              { name: "CORE & ABS", focus: "Lower Abs & Obliques", exercises: ["Leg Raises", "Plank", "Bicycle Crunches"] },
            ].map((muscle) => (
              <div key={muscle.name} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-400">{muscle.name}</span>
                <h4 className="text-sm font-bold text-white">{muscle.focus}</h4>
                <div className="text-[11px] text-slate-400 space-y-1 pt-1 border-t border-slate-800/80">
                  <span className="text-slate-500 font-semibold block">Key Movements:</span>
                  {muscle.exercises.map((e, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-slate-300">
                      <span className="text-orange-400">→</span>
                      <span>{e}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: WORKOUT HISTORY                                                     */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {tab === "history" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-white">Historical Workout Log</h3>
            <span className="text-xs text-slate-400">All historical sessions preserved permanently</span>
          </div>

          {history.length === 0 ? (
            <div className="p-8 text-center text-slate-500 border border-slate-800 rounded-2xl bg-slate-950">
              No historical workout sessions recorded yet.
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((h) => (
                <article key={h.id} className="p-5 rounded-2xl border border-slate-800 bg-slate-950/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                    <div>
                      <span className="text-xs font-mono font-bold text-orange-400">
                        {new Date(h.completedAt).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <h4 className="text-base font-extrabold text-white">
                        {h.workoutDay?.targetBodyParts || h.workoutDay?.type || "Workout Session"}
                      </h4>
                    </div>

                    {h.notes && (
                      <p className="text-xs text-slate-400 italic max-w-xs truncate">
                        "{h.notes}"
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {h.exerciseLogs.map((el) => {
                      const parsedSets = parseSetDetails(el.setDetails);
                      return (
                        <div key={el.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                          <span className="font-extrabold text-white block">{el.exercise?.name || "Exercise"}</span>
                          <span className="text-slate-400 mt-1 block">
                            {parsedSets.length > 0 ? (
                              parsedSets.map((s) => `${s.weightKg ? `${s.weightKg}kg×` : ""}${s.reps}`).join(", ")
                            ) : (
                              `${el.weightKg ? `${el.weightKg} kg × ` : ""}${el.repsCompleted} reps (${el.setsCompleted} sets)`
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
