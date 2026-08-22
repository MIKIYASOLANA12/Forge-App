import * as fs from 'fs';
import * as path from 'path';

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

import { prisma } from '../lib/prisma';
import { bootstrapAuthorizedUsers } from '../lib/auth';

async function main() {
  console.log('\n========================================');
  console.log('FORGE: INITIALIZING ZERO PROGRESS & USERS');
  console.log('========================================\n');

  // 1. Bootstrap authorized users
  console.log('👥 Bootstrapping authorized email accounts...');
  await bootstrapAuthorizedUsers();
  console.log('✅ Authorized users ready (mikiyasolana382@gmail.com, mikiyasolana87@gmail.com)');

  // 2. Set UserProfile to 0 XP and Level 1
  console.log('⚡ Initializing UserProfile to XP = 0, Level = 1...');
  await prisma.userProfile.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      totalXp: 0,
      level: 1,
      examDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      planStartDate: new Date(),
      calorieTarget: 2500,
      proteinTarget: 180,
      carbTarget: 300,
      fatTarget: 70,
    },
    update: {
      totalXp: 0,
      level: 1,
    },
  });

  // 3. Reset habit streaks to 0
  console.log('🎯 Resetting habit streak counts to 0...');
  await prisma.habit.updateMany({
    data: {
      streakCount: 0,
      streakStartedAt: null,
      lastCompletedAt: null,
    },
  });

  console.log('\n✨ Zero starting progress initialized successfully!');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Initialization error:', err);
    process.exit(1);
  });
