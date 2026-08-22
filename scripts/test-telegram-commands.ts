import * as fs from 'fs';
import * as path from 'path';

// Automatically load .env.local or .env if env vars are missing
function loadLocalEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadLocalEnv();

import {
  getTodaySummary,
  getProgressSummary,
  getWorkoutSummary,
  getPlanSummary,
  getMissedSummary,
} from '../lib/telegramCommands';

async function runTests() {
  console.log('\n========================================');
  console.log('TESTING TELEGRAM COMMANDS WITH REAL DB');
  console.log('========================================\n');

  console.log('--- 1. Testing /today ---');
  const today = await getTodaySummary();
  console.log(today);
  console.log('\n----------------------------------------\n');

  console.log('--- 2. Testing /progress ---');
  const progress = await getProgressSummary();
  console.log(progress);
  console.log('\n----------------------------------------\n');

  console.log('--- 3. Testing /workout ---');
  const workout = await getWorkoutSummary();
  console.log(workout);
  console.log('\n----------------------------------------\n');

  console.log('--- 4. Testing /plan ---');
  const plan = await getPlanSummary();
  console.log(plan);
  console.log('\n----------------------------------------\n');

  console.log('--- 5. Testing /missed ---');
  const missed = await getMissedSummary();
  console.log(missed);
  console.log('\n========================================\n');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  });
