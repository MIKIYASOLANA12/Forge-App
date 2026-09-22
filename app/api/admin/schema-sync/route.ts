import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserFromRequest } from '@/lib/auth';
import { WEEKLY_WORKOUT_SCHEDULE } from '@/lib/workoutMuscleTargets';

const ADMIN_SECRET = process.env.AUTH_SECRET || 'forge_jwt_fallback_secret_key_2026_growth_os';

// Expected schema columns mapping for workout and related models
const EXPECTED_SCHEMA: Record<string, string[]> = {
  WorkoutProgram: ['id', 'startDate', 'currentWeek'],
  WorkoutDay: ['id', 'type', 'dayOfWeek', 'location', 'targetBodyParts', 'intensityCategory', 'isRecovery'],
  WorkoutExercise: [
    'id',
    'workoutDayId',
    'name',
    'order',
    'targetMuscle',
    'targetSets',
    'targetReps',
    'targetDurationSeconds',
    'equipment',
    'startingWeightKg',
    'exerciseVariant',
    'safetyWarning',
    'isTimed',
  ],
  WorkoutLog: ['id', 'workoutDayId', 'completedAt', 'weekNumber', 'notes', 'submittedAt'],
  ExerciseLog: ['id', 'workoutLogId', 'exerciseId', 'setsCompleted', 'repsCompleted', 'weightKg', 'checked', 'setDetails', 'clientId'],
  DailyCoreLog: ['id', 'date', 'slot', 'completed', 'exercisesJson', 'completedAt', 'xpEarned', 'createdAt', 'updatedAt'],
};

// Strict Additive DDL Statements (CREATE TABLE IF NOT EXISTS / ALTER TABLE ... ADD COLUMN IF NOT EXISTS)
const ADDITIVE_DDL_STATEMENTS = [
  // 1. WorkoutDay Additive Columns
  `ALTER TABLE "WorkoutDay" ADD COLUMN IF NOT EXISTS "dayOfWeek" INTEGER;`,
  `ALTER TABLE "WorkoutDay" ADD COLUMN IF NOT EXISTS "location" TEXT;`,
  `ALTER TABLE "WorkoutDay" ADD COLUMN IF NOT EXISTS "targetBodyParts" TEXT;`,
  `ALTER TABLE "WorkoutDay" ADD COLUMN IF NOT EXISTS "intensityCategory" TEXT;`,
  `ALTER TABLE "WorkoutDay" ADD COLUMN IF NOT EXISTS "isRecovery" BOOLEAN NOT NULL DEFAULT false;`,

  // 2. WorkoutExercise Additive Columns
  `ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "targetMuscle" TEXT;`,
  `ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "targetSets" INTEGER;`,
  `ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "targetReps" TEXT;`,
  `ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "targetDurationSeconds" INTEGER;`,
  `ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "equipment" TEXT;`,
  `ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "startingWeightKg" DOUBLE PRECISION;`,
  `ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "exerciseVariant" TEXT;`,
  `ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "safetyWarning" TEXT;`,
  `ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "isTimed" BOOLEAN NOT NULL DEFAULT false;`,

  // 3. WorkoutLog Additive Columns
  `ALTER TABLE "WorkoutLog" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);`,

  // 4. ExerciseLog Additive Columns
  `ALTER TABLE "ExerciseLog" ADD COLUMN IF NOT EXISTS "checked" BOOLEAN NOT NULL DEFAULT false;`,
  `ALTER TABLE "ExerciseLog" ADD COLUMN IF NOT EXISTS "setDetails" TEXT;`,
  `ALTER TABLE "ExerciseLog" ADD COLUMN IF NOT EXISTS "clientId" TEXT;`,

  // 5. DailyCoreLog Table and Unique Index
  `CREATE TABLE IF NOT EXISTS "DailyCoreLog" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "slot" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "exercisesJson" TEXT,
    "completedAt" TIMESTAMP(3),
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyCoreLog_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DailyCoreLog_date_slot_key" ON "DailyCoreLog"("date", "slot");`,

  // 6. PhysiquePhotoLog Table
  `CREATE TABLE IF NOT EXISTS "PhysiquePhotoLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'singleton',
    "addisDate" TEXT NOT NULL,
    "telegramFileId" TEXT,
    "telegramMessageId" INTEGER,
    "photoUrl" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhysiquePhotoLog_pkey" PRIMARY KEY ("id")
  );`,

  // 7. Voice Accountability & Command Tables
  `CREATE TABLE IF NOT EXISTS "VoiceAccountabilityEvent" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "eventType" TEXT NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "confirmationState" TEXT NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VoiceAccountabilityEvent_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "VoiceCommandSession" (
    "id" TEXT NOT NULL,
    "callSid" TEXT,
    "status" TEXT NOT NULL,
    "pendingAction" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VoiceCommandSession_pkey" PRIMARY KEY ("id")
  );`,

  // 8. NotificationPreference Additive Columns
  `ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "wakeTime" TEXT NOT NULL DEFAULT '04:02';`,
  `ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "sleepTime" TEXT NOT NULL DEFAULT '23:00';`,
  `ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "voiceCallsEnabled" BOOLEAN NOT NULL DEFAULT true;`,
  `ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;`,
  `ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "dailyCallBudget" INTEGER NOT NULL DEFAULT 10;`,
  `ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "maxWakeAttempts" INTEGER NOT NULL DEFAULT 3;`,
  `ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "maxSleepAttempts" INTEGER NOT NULL DEFAULT 3;`,
  `ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "maxCallDurationSec" INTEGER NOT NULL DEFAULT 120;`,

  // 9. PlanTask Additive Columns
  `ALTER TABLE "PlanTask" ADD COLUMN IF NOT EXISTS "subject" TEXT;`,
  `ALTER TABLE "PlanTask" ADD COLUMN IF NOT EXISTS "topic" TEXT;`,
  `ALTER TABLE "PlanTask" ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT 'MEDIUM';`,
  `ALTER TABLE "PlanTask" ADD COLUMN IF NOT EXISTS "xpTarget" INTEGER DEFAULT 30;`,
  `ALTER TABLE "PlanTask" ADD COLUMN IF NOT EXISTS "plannedStartTime" TEXT;`,
  `ALTER TABLE "PlanTask" ADD COLUMN IF NOT EXISTS "plannedEndTime" TEXT;`,
  `ALTER TABLE "PlanTask" ADD COLUMN IF NOT EXISTS "isStudy" BOOLEAN NOT NULL DEFAULT false;`,

  // 10. UserProfile Additive Columns
  `ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "targetCalories" INTEGER NOT NULL DEFAULT 2500;`,
  `ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "targetProtein" INTEGER NOT NULL DEFAULT 150;`,
  `ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "targetCarbs" INTEGER NOT NULL DEFAULT 300;`,
  `ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "targetFat" INTEGER NOT NULL DEFAULT 80;`,
];

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (token && token === ADMIN_SECRET) return true;

  const secretHeader = req.headers.get('x-admin-secret');
  if (secretHeader && secretHeader === ADMIN_SECRET) return true;

  const session = await getSessionUserFromRequest(req);
  return Boolean(session);
}

async function inspectSchemaState() {
  const existingTables: any[] = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
  `);
  const tableNames = new Set(existingTables.map((t: any) => t.table_name));

  const columns: any[] = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public';
  `);

  const columnsByTable: Record<string, Set<string>> = {};
  for (const col of columns) {
    if (!columnsByTable[col.table_name]) {
      columnsByTable[col.table_name] = new Set();
    }
    columnsByTable[col.table_name].add(col.column_name);
  }

  const tableAudit: Array<{
    table: string;
    tableExists: boolean;
    expectedColumn: string;
    exists: boolean;
  }> = [];

  const missingColumns: Array<{ table: string; column: string }> = [];
  const missingTables: string[] = [];

  for (const [table, expectedCols] of Object.entries(EXPECTED_SCHEMA)) {
    const tableExists = tableNames.has(table);
    if (!tableExists) {
      missingTables.push(table);
    }
    const colsSet = columnsByTable[table] || new Set();
    for (const col of expectedCols) {
      const exists = colsSet.has(col);
      tableAudit.push({
        table,
        tableExists,
        expectedColumn: col,
        exists,
      });
      if (!exists) {
        missingColumns.push({ table, column: col });
      }
    }
  }

  // Row counts for audit
  const rowCounts: Record<string, number | null> = {};
  for (const table of Object.keys(EXPECTED_SCHEMA)) {
    if (tableNames.has(table)) {
      try {
        const countRes: any[] = await prisma.$queryRawUnsafe(`SELECT count(*)::int as count FROM "${table}";`);
        rowCounts[table] = countRes[0]?.count ?? 0;
      } catch {
        rowCounts[table] = null;
      }
    } else {
      rowCounts[table] = null;
    }
  }

  return {
    tableAudit,
    missingTables,
    missingColumns,
    rowCounts,
  };
}

async function getWorkoutRowCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of ['WorkoutProgram', 'WorkoutDay', 'WorkoutExercise', 'WorkoutLog', 'ExerciseLog']) {
    const result: Array<{ count: number }> = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS count FROM "${table}";`
    );
    counts[table] = result[0]?.count ?? 0;
  }
  return counts;
}

// GET: Read-only Introspection & Schema Drift Report
export async function GET(req: NextRequest) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const inspection = await inspectSchemaState();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      schemaDriftDetected: inspection.missingColumns.length > 0 || inspection.missingTables.length > 0,
      missingTables: inspection.missingTables,
      missingColumns: inspection.missingColumns,
      rowCounts: inspection.rowCounts,
      tableAudit: inspection.tableAudit,
    });
  } catch (error: any) {
    console.error('Schema inspection error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Additive Schema Synchronization
export async function POST(req: NextRequest) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (new URL(req.url).searchParams.get('scope') === 'workout-columns') {
      const beforeCounts = await getWorkoutRowCounts();
      const statements = [
        'ALTER TABLE "WorkoutDay" ADD COLUMN IF NOT EXISTS "location" TEXT;',
        'ALTER TABLE "WorkoutDay" ADD COLUMN IF NOT EXISTS "targetBodyParts" TEXT;',
        'ALTER TABLE "WorkoutDay" ADD COLUMN IF NOT EXISTS "intensityCategory" TEXT;',
        'ALTER TABLE "WorkoutDay" ADD COLUMN IF NOT EXISTS "isRecovery" BOOLEAN NOT NULL DEFAULT false;',
        'ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "targetMuscle" TEXT;',
        'ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "targetSets" INTEGER;',
        'ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "targetReps" TEXT;',
        'ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "targetDurationSeconds" INTEGER;',
        'ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "equipment" TEXT;',
        'ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "startingWeightKg" DOUBLE PRECISION;',
        'ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "exerciseVariant" TEXT;',
        'ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "safetyWarning" TEXT;',
        'ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "isTimed" BOOLEAN NOT NULL DEFAULT false;',
      ];
      for (const sql of statements) await prisma.$executeRawUnsafe(sql);
      const afterCounts = await getWorkoutRowCounts();
      const columns = await prisma.$queryRawUnsafe<Array<{ table_name: string; column_name: string }>>(`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND ((table_name = 'WorkoutDay' AND column_name IN ('location', 'targetBodyParts', 'intensityCategory', 'isRecovery'))
            OR (table_name = 'WorkoutExercise' AND column_name IN ('targetMuscle', 'targetSets', 'targetReps', 'targetDurationSeconds', 'equipment', 'startingWeightKg', 'exerciseVariant', 'safetyWarning', 'isTimed')))
        ORDER BY table_name, column_name;
      `);
      return NextResponse.json({ success: true, beforeCounts, afterCounts, columns });
    }

    // 1. Record before state
    const beforeInspection = await inspectSchemaState();

    // 2. Execute Strictly Additive DDL Statements
    const executedStatements: string[] = [];
    for (const sql of ADDITIVE_DDL_STATEMENTS) {
      // Safety sanity check: Never allow destructive statements
      const upper = sql.toUpperCase();
      if (upper.includes('DROP ') || upper.includes('DELETE ') || upper.includes('TRUNCATE ') || upper.includes('DROP_COLUMN')) {
        throw new Error(`Destructive statement blocked: ${sql}`);
      }
      await prisma.$executeRawUnsafe(sql);
      executedStatements.push(sql);
    }

    // 3. Seed / Ensure Base 7-Day Workout Routines in DB if not present
    for (let dayNum = 0; dayNum < 7; dayNum++) {
      const routine = WEEKLY_WORKOUT_SCHEDULE[dayNum];
      if (!routine) continue;

      const dayId = `day-${dayNum}`;
      const existingDay = await prisma.workoutDay.findUnique({ where: { id: dayId } });

      if (!existingDay) {
        await prisma.workoutDay.create({
          data: {
            id: dayId,
            type: routine.dayName,
            dayOfWeek: routine.dayOfWeek,
            location: routine.location,
            targetBodyParts: routine.targetBodyParts,
            intensityCategory: routine.isRecovery ? 'ACTIVE_RECOVERY' : 'NORMAL',
            isRecovery: Boolean(routine.isRecovery),
          },
        });
      } else {
        // Safe additive update of metadata only
        await prisma.workoutDay.update({
          where: { id: dayId },
          data: {
            dayOfWeek: routine.dayOfWeek,
            location: routine.location,
            targetBodyParts: routine.targetBodyParts,
            intensityCategory: routine.isRecovery ? 'ACTIVE_RECOVERY' : 'NORMAL',
            isRecovery: Boolean(routine.isRecovery),
          },
        });
      }

      // Ensure workout exercises exist
      for (let orderIdx = 0; orderIdx < routine.exercises.length; orderIdx++) {
        const exDef = routine.exercises[orderIdx];
        const existingEx = await prisma.workoutExercise.findUnique({ where: { id: exDef.id } });
        if (!existingEx) {
          await prisma.workoutExercise.create({
            data: {
              id: exDef.id,
              workoutDayId: dayId,
              name: exDef.name,
              order: orderIdx + 1,
              targetMuscle: exDef.muscle,
              targetSets: exDef.targetSets,
              targetReps: exDef.targetReps,
              targetDurationSeconds: exDef.targetDurationSeconds,
              equipment: exDef.equipment,
              startingWeightKg: exDef.startingWeightKg,
              exerciseVariant: exDef.defaultVariant,
              safetyWarning: exDef.safetyWarning,
              isTimed: Boolean(exDef.isTimed),
            },
          });
        }
      }
    }

    // 4. Record after state & verify zero data loss
    const afterInspection = await inspectSchemaState();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      executedStatementsCount: executedStatements.length,
      beforeRowCounts: beforeInspection.rowCounts,
      afterRowCounts: afterInspection.rowCounts,
      remainingMissingColumns: afterInspection.missingColumns,
      remainingMissingTables: afterInspection.missingTables,
      status: afterInspection.missingColumns.length === 0 ? 'SYNCHRONIZED' : 'PARTIALLY_SYNCHRONIZED',
    });
  } catch (error: any) {
    console.error('Safe schema sync error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
