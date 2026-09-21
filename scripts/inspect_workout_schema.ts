import { prisma } from '../lib/prisma';

async function main() {
  console.log('=== READ-ONLY DATABASE SCHEMA INSPECTION ===\n');

  const tablesToCheck = [
    'WorkoutProgram',
    'WorkoutDay',
    'WorkoutExercise',
    'WorkoutLog',
    'ExerciseLog',
    'DailyCoreLog'
  ];

  // 1. Check existing tables in public schema
  const existingTables: any[] = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
  `);
  const tableNames = new Set(existingTables.map((t: any) => t.table_name));
  console.log('Existing public tables count:', tableNames.size);

  // 2. For each table, inspect columns and row count
  for (const tableName of tablesToCheck) {
    const exists = tableNames.has(tableName);
    console.log(`\n-----------------------------------------`);
    console.log(`Table: "${tableName}" | Exists: ${exists}`);
    
    if (exists) {
      const countResult: any[] = await prisma.$queryRawUnsafe(`SELECT count(*)::int as count FROM "${tableName}";`);
      console.log(`Row count: ${countResult[0]?.count ?? 0}`);

      const columns: any[] = await prisma.$queryRawUnsafe(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = '${tableName}'
        ORDER BY ordinal_position;
      `);
      console.log(`Columns in DB (${columns.length}):`);
      for (const col of columns) {
        console.log(`  - ${col.column_name} (${col.data_type}, nullable=${col.is_nullable}, default=${col.column_default})`);
      }
    } else {
      console.log(`  Table does not exist in database!`);
    }
  }

  // 3. Also check if there are any other workout/exercise/core related tables with different casing
  const allTables = Array.from(tableNames);
  const workoutRelated = allTables.filter((t: string) => 
    t.toLowerCase().includes('workout') || 
    t.toLowerCase().includes('exercise') || 
    t.toLowerCase().includes('core')
  );
  console.log('\nAll workout/exercise/core matching tables:', workoutRelated);
}

main()
  .catch((e) => {
    console.error('Inspection failed:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
