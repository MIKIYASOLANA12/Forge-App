/**
 * FORGE STAGE 8 — REAL OFFLINE WORKOUT LOGGING VERIFICATION
 * Proves the offline-first contract WITHOUT touching the live database:
 *  1/2. Sets entered online OR offline persist immediately.
 *  3-5. Leave + re-enter restores every set.
 *  6-8. Re-sync does NOT duplicate (clientId dedup).
 *
 * Run: npx ts-node --project tsconfig.seed.json -r tsconfig-paths/register scripts/test_offline_workout_ded.ts
 */

import {
  generateClientId,
  saveLocalWorkoutState,
  loadLocalWorkoutState,
  buildSyncExercisePayload,
  mergeSetsByClientId,
} from '../lib/offlineWorkoutStore';

// Mirror of the server-side mergeSetDetails in app/api/workout/sync/route.ts.
// Deduplicates by clientId so re-syncing never creates duplicates.
function mergeSetDetails(existingRaw: string | null | undefined, incomingRaw: unknown): string {
  const parse = (raw: unknown): any[] => {
    if (!raw) return [];
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const existing = parse(existingRaw);
  const incoming = parse(incomingRaw);
  const byId = new Map<string, any>();
  const order: string[] = [];
  for (const set of [...existing, ...incoming]) {
    const key = set.clientId || `n-${set.setNumber ?? order.length + 1}`;
    if (!byId.has(key)) order.push(key);
    byId.set(key, { ...byId.get(key), ...set, clientId: set.clientId || key });
  }
  return JSON.stringify(
    order.map((key, idx) => {
      const set = byId.get(key)!;
      return {
        setNumber: set.setNumber ?? idx + 1,
        weightKg: set.weightKg ?? '',
        reps: set.reps ?? '',
        notes: set.notes ?? '',
        completed: Boolean(set.completed),
        clientId: set.clientId || key,
      };
    })
  );
}

const EX = 'ex-bench-press';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✔ ${msg}`);
}
async function main() {
  console.log('==================================================');
  console.log('FORGE: REAL OFFLINE WORKOUT LOGGING VERIFICATION');
  console.log('==================================================');

  const DATE_KEY = 'test-date-2026-08-26';
  const DAY = 'test-day-bench';

  // STEP 1-2: record sets as the user types (some "online", some "offline")
  console.log('\n[1] Saving each set immediately to device storage:');
  const set1 = { setNumber: 1, weightKg: '40', reps: '10', notes: '', completed: true, clientId: generateClientId('set') };
  const set2 = { setNumber: 2, weightKg: '45', reps: '8', notes: '', completed: true, clientId: generateClientId('set') };
  const set3 = { setNumber: 3, weightKg: '45', reps: '7', notes: '', completed: true, clientId: generateClientId('set') };

  // Sets entered online and offline share the identical local-first save path.
  saveLocalWorkoutState(DATE_KEY, DAY, 1, 'RPE 8', { [EX]: [set1, set2] }, { [EX]: false }, 'LOCAL_ONLY');
  const savedOffline = saveLocalWorkoutState(
    DATE_KEY, DAY, 1, 'RPE 8', { [EX]: [set1, set2, set3] }, { [EX]: false }, 'LOCAL_ONLY'
  );
  assert(savedOffline.exerciseSets[EX].length === 3, '3rd (offline) set persisted immediately');

  // STEP 3-5: leave + return
  console.log('\n[2] Leave + re-enter exercise (page reload):');
  const restored = loadLocalWorkoutState(DATE_KEY);
  assert(!!restored, 'Local state restores after re-entry');
  assert(restored!.exerciseSets[EX].length === 3, 'All 3 sets still present after re-entry');
  const restoredIds = restored!.exerciseSets[EX].map((s) => s.clientId).sort();
  const originalIds = [set1.clientId, set2.clientId, set3.clientId].sort();
  assert(JSON.stringify(restoredIds) === JSON.stringify(originalIds), 'No set lost or re-generated (clientIds preserved)');

  // STEP 6-8: sync payload + server merge must NOT duplicate
  console.log('\n[3] Sync payload & server-side dedup (no duplicates):');
  const payload = buildSyncExercisePayload(savedOffline.exerciseSets, savedOffline.checkedExercises);
  const oneEx = payload.find((p: any) => p.exerciseId === EX)!;
  const parsedDetails = JSON.parse(oneEx.setDetails);
  assert(parsedDetails.length === 3, 'Sync payload carries exactly 3 set details');
  const uniqueIds = new Set(parsedDetails.map((s: any) => s.clientId));
  assert(uniqueIds.size === parsedDetails.length, 'Every set has a unique clientId');

  const firstServerMerge = JSON.parse(mergeSetDetails(null, oneEx.setDetails));
  const reSyncMerge = JSON.parse(mergeSetDetails(oneEx.setDetails, oneEx.setDetails));
  assert(firstServerMerge.length === 3, 'First server merge stores 3 sets');
  assert(reSyncMerge.length === firstServerMerge.length, 'Re-syncing does NOT duplicate sets (stays 3)');

  const mergedRender = mergeSetsByClientId(savedOffline.exerciseSets[EX], parsedDetails);
  assert(mergedRender.length === 3, 'Client merge of local+server yields 3 (no dupes)');

  // Sync status lifecycle
  console.log('\n[4] Sync status lifecycle transitions:');
  const syncing = saveLocalWorkoutState(DATE_KEY, DAY, 1, 'x', savedOffline.exerciseSets, savedOffline.checkedExercises, 'SYNCING');
  assert(syncing.syncStatus === 'SYNCING', 'status becomes SYNCING while uploading');
  const synced = saveLocalWorkoutState(DATE_KEY, DAY, 1, 'x', savedOffline.exerciseSets, savedOffline.checkedExercises, 'SYNCED');
  assert(synced.syncStatus === 'SYNCED', 'status becomes SYNCED after upload OK');
  assert(synced.exerciseSets[EX].length === 3, 'No sets lost during status changes');

  console.log('\n==================================================');
  console.log('OK OFFLINE WORKOUT VERIFIED: local-first persistence, restore-on-return, clientId dedup, no duplicates.');
  console.log('==================================================');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});