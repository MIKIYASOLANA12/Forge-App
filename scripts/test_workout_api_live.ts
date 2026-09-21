import { createSessionToken } from '../lib/session';

const BASE_URL = process.env.LIVE_URL || 'https://forge-app-eight-kappa.vercel.app';
const TEST_EMAIL = 'mikiyasolana382@gmail.com';
const TEST_USER_ID = 'singleton';

async function main() {
  console.log('===============================================================');
  console.log('🧪 FORGE — PRODUCTION DATABASE SCHEMA & WORKOUT API VERIFICATION');
  console.log(`Target Base URL: ${BASE_URL}`);
  console.log('===============================================================\n');

  // 1. Generate Auth Token
  const token = await createSessionToken(TEST_USER_ID, TEST_EMAIL, 'Mikiyas Olana', `verify-${Date.now()}`, true);
  const authHeaders = {
    'Content-Type': 'application/json',
    'Cookie': `forge_session=${token}`,
    'Authorization': `Bearer forge_jwt_fallback_secret_key_2026_growth_os`,
    'x-admin-secret': 'forge_jwt_fallback_secret_key_2026_growth_os',
  };

  // 2. Read-only Schema Introspection
  console.log('[STEP 1] Performing Read-Only Schema Introspection...');
  const introspectRes = await fetch(`${BASE_URL}/api/admin/schema-sync`, {
    method: 'GET',
    headers: authHeaders,
  });

  if (!introspectRes.ok) {
    console.error(`Introspection endpoint returned HTTP ${introspectRes.status}: ${await introspectRes.text()}`);
  } else {
    const introspectData = await introspectRes.json();
    console.log(`✔ Introspection successful! Drift detected: ${introspectData.schemaDriftDetected}`);
    console.log('\n--- LIVE TABLE & COLUMN AUDIT ---');
    console.log('TABLE'.padEnd(20) + ' | ' + 'EXPECTED COLUMN'.padEnd(24) + ' | ' + 'EXISTS?');
    console.log('-'.repeat(60));
    for (const item of introspectData.tableAudit || []) {
      console.log(
        `${item.table.padEnd(20)} | ${item.expectedColumn.padEnd(24)} | ${item.exists ? '✅ YES' : '❌ NO (MISSING)'}`
      );
    }
    console.log('\n--- BEFORE ROW COUNTS ---');
    for (const [table, count] of Object.entries(introspectData.rowCounts || {})) {
      console.log(`  ${table}: ${count} rows`);
    }
  }

  // 3. Apply Additive Schema Synchronization
  console.log('\n[STEP 2] Applying Additive Schema Synchronization (CREATE TABLE / ADD COLUMN IF NOT EXISTS)...');
  const syncRes = await fetch(`${BASE_URL}/api/admin/schema-sync`, {
    method: 'POST',
    headers: authHeaders,
  });

  if (!syncRes.ok) {
    console.error(`Schema sync endpoint returned HTTP ${syncRes.status}: ${await syncRes.text()}`);
  } else {
    const syncData = await syncRes.json();
    console.log(`✔ Schema sync executed! Status: ${syncData.status}`);
    console.log(`  Executed Additive DDL Statements: ${syncData.executedStatementsCount}`);
    console.log('\n--- BEFORE VS AFTER ROW COUNTS (ZERO LOSS AUDIT) ---');
    const beforeCounts = syncData.beforeRowCounts || {};
    const afterCounts = syncData.afterRowCounts || {};
    for (const table of Object.keys({ ...beforeCounts, ...afterCounts })) {
      const b = beforeCounts[table] ?? 0;
      const a = afterCounts[table] ?? 0;
      const safe = a >= b;
      console.log(`  ${table.padEnd(20)}: Before=${b} -> After=${a} [${safe ? '✅ SAFE / PRESERVED' : '❌ LOSS DETECTED'}]`);
    }
  }

  // 4. Verify GET /api/workout/today
  console.log('\n[STEP 3] Verifying GET /api/workout/today...');
  const workoutTodayRes = await fetch(`${BASE_URL}/api/workout/today`, {
    headers: authHeaders,
  });

  console.log(`  Status: ${workoutTodayRes.status} ${workoutTodayRes.statusText}`);
  if (!workoutTodayRes.ok) {
    console.error(`  ❌ Failed: ${await workoutTodayRes.text()}`);
  } else {
    const workoutData = await workoutTodayRes.json();
    console.log('  ✔ HTTP 200 Received');
    
    // Check all required keys
    const requiredKeys = [
      'currentDayName',
      'currentDateFormatted',
      'openTimeFormatted',
      'closeTimeFormatted',
      'closeTimestamp',
      'nextUnlockTimestamp',
      'isOpen',
      'isClosed',
      'day300',
      'targetBodyParts',
      'focusBadges',
      'targetDescription',
      'day',
      'dailyCore',
      'nextWorkout',
      'weekNumber',
      'countdowns',
      'yesterday',
    ];

    const missingKeys = requiredKeys.filter((k) => workoutData[k] === undefined);
    if (missingKeys.length > 0) {
      console.error(`  ❌ Missing required top-level keys: ${missingKeys.join(', ')}`);
    } else {
      console.log(`  ✔ All 18 required top-level fields present!`);
    }

    console.log(`\n  --- TODAY WORKOUT DETAILS ---`);
    console.log(`  Day Name: ${workoutData.currentDayName}`);
    console.log(`  Date Formatted: ${workoutData.currentDateFormatted}`);
    console.log(`  Location: ${workoutData.day?.location}`);
    console.log(`  Target Body Parts: ${workoutData.targetBodyParts}`);
    console.log(`  Open Window: ${workoutData.openTimeFormatted} - ${workoutData.closeTimeFormatted}`);
    console.log(`  IsOpen: ${workoutData.isOpen} | IsClosed: ${workoutData.isClosed}`);
    console.log(`  Day of Journey 300: Day ${workoutData.day300}`);
    console.log(`  Exercises Count: ${workoutData.day?.exercises?.length}`);
    for (const ex of workoutData.day?.exercises || []) {
      console.log(`    · [${ex.order}] ${ex.name} (${ex.targetMuscle || 'General'}) — ${ex.targetSets} sets x ${ex.targetReps} [Equipment: ${ex.equipment || 'N/A'}]`);
    }
    console.log(`  Daily Core Routine: ${workoutData.dailyCore?.routineTitle} (${workoutData.dailyCore?.routine?.length} exercises)`);
    console.log(`  Next Workout: ${workoutData.nextWorkout?.type} (${workoutData.nextWorkout?.targetBodyParts}) on ${workoutData.nextWorkout?.dateFormatted}`);
  }

  // 5. Verify GET /api/plan/today
  console.log('\n[STEP 4] Verifying GET /api/plan/today (Todo API)...');
  const planRes = await fetch(`${BASE_URL}/api/plan/today`, {
    headers: authHeaders,
  });
  console.log(`  Status: ${planRes.status} ${planRes.statusText}`);
  if (planRes.ok) {
    const planData = await planRes.json();
    console.log(`  ✔ Plan retrieved successfully!`);
    console.log(`  ✔ Addis Date: ${planData.dateFormatted || planData.date}`);
    console.log(`  ✔ Tasks Count: ${planData.tasks?.length}`);
    for (const t of planData.tasks || []) {
      console.log(`    · [${t.domain || t.subject || 'Task'}] ${t.description} (${t.minutesTarget} min)`);
    }
  } else {
    console.error(`  ❌ Plan API error: ${await planRes.text()}`);
  }

  // 6. Verify GET /api/workout/core
  console.log('\n[STEP 5] Verifying GET /api/workout/core (Core API)...');
  const coreRes = await fetch(`${BASE_URL}/api/workout/core`, {
    headers: authHeaders,
  });
  console.log(`  Status: ${coreRes.status} ${coreRes.statusText}`);
  if (coreRes.ok) {
    const coreData = await coreRes.json();
    console.log(`  ✔ Core API returned success!`);
    console.log(`  ✔ Routine: ${coreData.routine?.length || 0} exercises scheduled`);
  } else {
    console.error(`  ❌ Core API error: ${await coreRes.text()}`);
  }

  console.log('\n===============================================================');
  console.log('✅ LIVE VERIFICATION SCRIPT FINISHED');
  console.log('===============================================================');
}

main().catch(console.error);
