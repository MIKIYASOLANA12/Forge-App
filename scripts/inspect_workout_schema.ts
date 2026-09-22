import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const expectedColumns: Record<string, string[]> = {
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

const tableNames = Object.keys(expectedColumns);

async function main() {
  const columns = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (${Prisma.join(tableNames)})
    ORDER BY table_name, ordinal_position
  `;
  const existing = new Set(columns.map((column) => `${column.table_name}.${column.column_name}`));

  console.log('TABLE | COLUMN | Prisma expects | DB exists');
  for (const [table, expected] of Object.entries(expectedColumns)) {
    for (const column of expected) {
      console.log(`${table} | ${column} | YES | ${existing.has(`${table}.${column}`) ? 'YES' : 'NO'}`);
    }
  }

  console.log('\nROW COUNTS');
  for (const table of tableNames) {
    const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count FROM "${table}"`
    );
    console.log(`${table} | ${result[0]?.count.toString() ?? '0'}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
