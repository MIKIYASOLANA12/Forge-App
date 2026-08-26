export type SetEntry = {
  setNumber: number;
  weightKg: number | string;
  reps: number | string;
  completed: boolean;
  clientId?: string;
};

export type OfflineSyncStatus = 'LOCAL_ONLY' | 'SYNCING' | 'SYNCED' | 'SYNC_ERROR';

export type OfflineWorkoutPayload = {
  dateKey: string;
  workoutDayId: string;
  weekNumber: number;
  notes: string;
  exerciseSets: Record<string, SetEntry[]>;
  checkedExercises: Record<string, boolean>;
  updatedAt: number;
  syncStatus: OfflineSyncStatus;
  lastSyncAttempt?: number;
  errorMessage?: string;
};

const STORAGE_PREFIX = 'forge_offline_workout_';
const memoryStore: Record<string, string> = {};

function getStorageItem(key: string): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return localStorage.getItem(key);
    } catch {
      return memoryStore[key] || null;
    }
  }
  return memoryStore[key] || null;
}

function setStorageItem(key: string, value: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(key, value);
    } catch {
      memoryStore[key] = value;
    }
  } else {
    memoryStore[key] = value;
  }
}

export function getTodayDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function generateClientId(prefix = 'set'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Saves current workout progress immediately to local device storage.
 * Works 100% offline without network connectivity.
 */
export function saveLocalWorkoutState(
  dateKey: string,
  workoutDayId: string,
  weekNumber: number,
  notes: string,
  exerciseSets: Record<string, SetEntry[]>,
  checkedExercises: Record<string, boolean>,
  status: OfflineSyncStatus = 'LOCAL_ONLY'
): OfflineWorkoutPayload {
  // Ensure each set has a unique clientId
  const setsWithClientIds: Record<string, SetEntry[]> = {};
  for (const [exId, sets] of Object.entries(exerciseSets)) {
    setsWithClientIds[exId] = sets.map((s) => ({
      ...s,
      clientId: s.clientId || generateClientId(`set-${exId}-${s.setNumber}`),
    }));
  }

  const payload: OfflineWorkoutPayload = {
    dateKey,
    workoutDayId,
    weekNumber,
    notes,
    exerciseSets: setsWithClientIds,
    checkedExercises,
    updatedAt: Date.now(),
    syncStatus: status,
  };

  try {
    setStorageItem(`${STORAGE_PREFIX}${dateKey}`, JSON.stringify(payload));
  } catch (err) {
    console.error('Failed to save workout to storage:', err);
  }

  return payload;
}

/**
 * Loads workout state from local device storage for the given active day.
 */
export function loadLocalWorkoutState(dateKey: string, workoutDayId: string): OfflineWorkoutPayload | null {
  try {
    const raw = getStorageItem(`${STORAGE_PREFIX}${dateKey}`);
    if (!raw) return null;
    const parsed: OfflineWorkoutPayload = JSON.parse(raw);
    if (!workoutDayId || parsed.workoutDayId === workoutDayId) {
      return parsed;
    }
  } catch (err) {
    console.error('Failed to load workout from storage:', err);
  }
  return null;
}

/**
 * Synchronizes local workout sets to the backend.
 * Merges sets and deduplicates by clientId.
 */
export async function syncLocalWorkoutToServer(dateKey: string): Promise<{ success: boolean; status: OfflineSyncStatus; message?: string; xpEarned?: number }> {
  const localState = loadLocalWorkoutState(dateKey, '');
  if (!localState) {
    return { success: true, status: 'SYNCED', message: 'No unsynced local data' };
  }

  // If offline, preserve LOCAL_ONLY
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: false, status: 'LOCAL_ONLY', message: 'Offline — saved on device' };
  }

  try {
    saveLocalWorkoutState(
      localState.dateKey,
      localState.workoutDayId,
      localState.weekNumber,
      localState.notes,
      localState.exerciseSets,
      localState.checkedExercises,
      'SYNCING'
    );

    const payloadExercises = Object.entries(localState.exerciseSets).map(([exerciseId, sets]) => {
      const isChecked = Boolean(localState.checkedExercises[exerciseId]) || sets.some((s) => s.completed);
      const completedSets = sets.filter((s) => s.completed);
      const numericWeights = sets
        .map((s) => Number(s.weightKg))
        .filter((w) => !isNaN(w) && w > 0);
      const topWeight = numericWeights.length > 0 ? Math.max(...numericWeights) : null;
      const avgReps = sets.length > 0
        ? Math.round(sets.reduce((sum, s) => sum + (Number(s.reps) || 8), 0) / sets.length)
        : 8;

      return {
        exerciseId,
        setsCompleted: completedSets.length || sets.length,
        repsCompleted: avgReps,
        weightKg: topWeight,
        checked: isChecked,
        setDetails: JSON.stringify(sets),
        clientId: sets[0]?.clientId || generateClientId(`ex-${exerciseId}`),
      };
    });

    const res = await fetch('/api/workout/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateKey: localState.dateKey,
        workoutDayId: localState.workoutDayId,
        weekNumber: localState.weekNumber,
        notes: localState.notes,
        exerciseLogs: payloadExercises,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      saveLocalWorkoutState(
        localState.dateKey,
        localState.workoutDayId,
        localState.weekNumber,
        localState.notes,
        localState.exerciseSets,
        localState.checkedExercises,
        'SYNCED'
      );
      return { success: true, status: 'SYNCED', message: 'Synchronized with cloud', xpEarned: data.xpEarned };
    } else {
      const errJson = await res.json().catch(() => ({}));
      saveLocalWorkoutState(
        localState.dateKey,
        localState.workoutDayId,
        localState.weekNumber,
        localState.notes,
        localState.exerciseSets,
        localState.checkedExercises,
        'SYNC_ERROR'
      );
      return { success: false, status: 'SYNC_ERROR', message: errJson.error || 'Server error syncing' };
    }
  } catch (err: any) {
    saveLocalWorkoutState(
      localState.dateKey,
      localState.workoutDayId,
      localState.weekNumber,
      localState.notes,
      localState.exerciseSets,
      localState.checkedExercises,
      'LOCAL_ONLY'
    );
    return { success: false, status: 'LOCAL_ONLY', message: 'Offline — saved on device' };
  }
}
