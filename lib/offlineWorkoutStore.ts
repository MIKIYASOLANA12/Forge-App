import { getAddisNow, workoutWindowForAddisDate } from '@/lib/workoutTime';

export type SetEntry = {
  setNumber: number;
  weightKg: number | string;
  reps: number | string;
  notes?: string;
  completed: boolean;
  clientId: string;
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
  sessionSubmitted?: boolean;
};

export type CachedWorkoutProtocol = {
  dateKey: string;
  cachedAt: number;
  payload: Record<string, unknown>;
};

const STORAGE_PREFIX = 'forge_offline_workout_';
const PROTOCOL_PREFIX = 'forge_offline_workout_protocol_';
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

/** Active workout day key using Africa/Addis_Ababa 05:00 boundary. */
export function getTodayDateKey(date: Date = getAddisNow()): string {
  const windowInfo = workoutWindowForAddisDate(date);
  const d = windowInfo.startAddis;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function generateClientId(prefix = 'set'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function ensureSetClientId(exerciseId: string, set: Partial<SetEntry> & { setNumber: number }): SetEntry {
  return {
    setNumber: set.setNumber,
    weightKg: set.weightKg ?? '',
    reps: set.reps ?? '',
    notes: set.notes ?? '',
    completed: Boolean(set.completed),
    clientId: set.clientId || generateClientId(`set-${exerciseId}-${set.setNumber}`),
  };
}

export function mergeSetsByClientId(localSets: SetEntry[] = [], serverSets: SetEntry[] = []): SetEntry[] {
  const merged = new Map<string, SetEntry>();
  const order: string[] = [];

  const ingest = (sets: SetEntry[], win: boolean) => {
    for (const raw of sets) {
      const key = raw.clientId || `n-${raw.setNumber}`;
      if (!merged.has(key)) order.push(key);
      if (!merged.has(key) || win) {
        merged.set(key, ensureSetClientId('merged', { ...raw, setNumber: raw.setNumber }));
      }
    }
  };

  ingest(serverSets, false);
  ingest(localSets, true);

  return order
    .map((key) => merged.get(key)!)
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((set, idx) => ({ ...set, setNumber: idx + 1 }));
}

export function cacheTodayProtocol(dateKey: string, payload: Record<string, unknown>): void {
  const cached: CachedWorkoutProtocol = { dateKey, cachedAt: Date.now(), payload };
  try {
    setStorageItem(`${PROTOCOL_PREFIX}${dateKey}`, JSON.stringify(cached));
  } catch (err) {
    console.error('Failed to cache workout protocol:', err);
  }
}

export function loadCachedTodayProtocol(dateKey: string): Record<string, unknown> | null {
  try {
    const raw = getStorageItem(`${PROTOCOL_PREFIX}${dateKey}`);
    if (!raw) return null;
    const parsed: CachedWorkoutProtocol = JSON.parse(raw);
    if (parsed.dateKey === dateKey && parsed.payload) return parsed.payload;
  } catch (err) {
    console.error('Failed to load cached workout protocol:', err);
  }
  return null;
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
  status: OfflineSyncStatus = 'LOCAL_ONLY',
  extra?: { sessionSubmitted?: boolean; errorMessage?: string }
): OfflineWorkoutPayload {
  const previous = loadLocalWorkoutState(dateKey, workoutDayId);

  const setsWithClientIds: Record<string, SetEntry[]> = {};
  for (const [exId, sets] of Object.entries(exerciseSets)) {
    setsWithClientIds[exId] = sets.map((s) => ensureSetClientId(exId, s));
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
    lastSyncAttempt: status === 'SYNCING' || status === 'SYNCED' ? Date.now() : previous?.lastSyncAttempt,
    errorMessage: extra?.errorMessage,
    sessionSubmitted: extra?.sessionSubmitted ?? previous?.sessionSubmitted ?? false,
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
 * Does not drop sets if workoutDayId is temporarily unknown.
 */
export function loadLocalWorkoutState(dateKey: string, workoutDayId?: string): OfflineWorkoutPayload | null {
  try {
    const raw = getStorageItem(`${STORAGE_PREFIX}${dateKey}`);
    if (!raw) return null;
    const parsed: OfflineWorkoutPayload = JSON.parse(raw);
    if (!workoutDayId || !parsed.workoutDayId || parsed.workoutDayId === 'pending' || parsed.workoutDayId === workoutDayId) {
      return parsed;
    }
  } catch (err) {
    console.error('Failed to load workout from storage:', err);
  }
  return null;
}

export function buildSyncExercisePayload(
  exerciseSets: Record<string, SetEntry[]>,
  checkedExercises: Record<string, boolean>
) {
  return Object.entries(exerciseSets).map(([exerciseId, sets]) => {
    const isChecked = Boolean(checkedExercises[exerciseId]) || sets.some((s) => s.completed);
    const completedSets = sets.filter((s) => s.completed);
    const numericWeights = sets.map((s) => Number(s.weightKg)).filter((w) => !isNaN(w) && w > 0);
    const topWeight = numericWeights.length > 0 ? Math.max(...numericWeights) : null;
    const avgReps =
      sets.length > 0 ? Math.round(sets.reduce((sum, s) => sum + (Number(s.reps) || 8), 0) / sets.length) : 8;

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
}

/**
 * Synchronizes local workout sets to the backend.
 * Merges sets and deduplicates by clientId.
 */
export async function syncLocalWorkoutToServer(
  dateKey: string,
  options?: { sessionSubmitted?: boolean }
): Promise<{ success: boolean; status: OfflineSyncStatus; message?: string; xpEarned?: number }> {
  const localState = loadLocalWorkoutState(dateKey, '');
  if (!localState) {
    return { success: true, status: 'SYNCED', message: 'No unsynced local data' };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: false, status: 'LOCAL_ONLY', message: 'OFFLINE — Saved on this device' };
  }

  try {
    saveLocalWorkoutState(
      localState.dateKey,
      localState.workoutDayId,
      localState.weekNumber,
      localState.notes,
      localState.exerciseSets,
      localState.checkedExercises,
      'SYNCING',
      { sessionSubmitted: options?.sessionSubmitted ?? localState.sessionSubmitted }
    );

    const res = await fetch('/api/workout/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateKey: localState.dateKey,
        workoutDayId: localState.workoutDayId,
        weekNumber: localState.weekNumber,
        notes: localState.notes,
        sessionSubmitted: options?.sessionSubmitted ?? localState.sessionSubmitted ?? false,
        exerciseLogs: buildSyncExercisePayload(localState.exerciseSets, localState.checkedExercises),
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
        'SYNCED',
        { sessionSubmitted: options?.sessionSubmitted ?? localState.sessionSubmitted }
      );
      return { success: true, status: 'SYNCED', message: 'Synchronized with cloud', xpEarned: data.xpEarned };
    }

    const errJson = await res.json().catch(() => ({}));
    saveLocalWorkoutState(
      localState.dateKey,
      localState.workoutDayId,
      localState.weekNumber,
      localState.notes,
      localState.exerciseSets,
      localState.checkedExercises,
      'SYNC_ERROR',
      { errorMessage: errJson.error, sessionSubmitted: localState.sessionSubmitted }
    );
    return { success: false, status: 'SYNC_ERROR', message: errJson.error || 'Server error syncing' };
  } catch {
    saveLocalWorkoutState(
      localState.dateKey,
      localState.workoutDayId,
      localState.weekNumber,
      localState.notes,
      localState.exerciseSets,
      localState.checkedExercises,
      'LOCAL_ONLY',
      { sessionSubmitted: localState.sessionSubmitted }
    );
    return { success: false, status: 'LOCAL_ONLY', message: 'OFFLINE — Saved on this device' };
  }
}
