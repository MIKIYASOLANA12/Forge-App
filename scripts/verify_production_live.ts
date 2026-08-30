/**
 * Live Production Verification Script
 * Authenticates against https://forge-app-eight-kappa.vercel.app
 * and verifies that the live Vercel deployment is serving the latest features.
 */
if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile('.env.local'); } catch {}
}

import { prisma } from '../lib/prisma';
import { createSessionToken } from '../lib/session';

const PROD_URL = 'https://forge-app-eight-kappa.vercel.app';

async function main() {
  console.log('==================================================');
  console.log('🌐 VERIFYING LIVE VERCEL PRODUCTION DEPLOYMENT');
  console.log(`Target: ${PROD_URL}`);
  console.log('==================================================\n');

  const user = await prisma.user.findFirst({
    where: { email: { in: ['mikiyasolana382@gmail.com', 'mikiyasolana87@gmail.com'] } },
  });
  if (!user) {
    console.error('No user found in DB');
    process.exit(1);
  }

  const testSessionId = `prod-verify-${Date.now()}`;
  await prisma.userSession.create({
    data: {
      userId: user.id,
      sessionToken: testSessionId,
      userAgent: 'Verification Agent (Vercel Test)',
      location: 'Addis Ababa, ET',
      revoked: false,
    },
  });

  const token = await createSessionToken(user.id, user.email, user.name || undefined, testSessionId, true);
  const cookieHeader = `forge_session=${token}`;
  console.log(`[1] Created authorized session token for ${user.email}`);

  console.log('\n[2] Testing Live /api/schedule/now (Command Center & Countdowns)...');
  const schedRes = await fetch(`${PROD_URL}/api/schedule/now`, {
    headers: { cookie: cookieHeader },
  });
  console.log(`  Status: ${schedRes.status} ${schedRes.statusText}`);
  if (schedRes.ok) {
    const schedData = await schedRes.json();
    console.log(`  ✔ Target Wake Time: ${schedData.schedule?.targetWakeTime}`);
    console.log(`  ✔ Greeting: ${schedData.schedule?.greeting}`);
    console.log(`  ✔ Countdowns count: ${schedData.countdowns?.length}`);
    for (const c of schedData.countdowns || []) {
      console.log(`    · ${c.title}: ${c.statusText} (${c.daysRemaining} days remaining)`);
    }
    console.log(`  ✔ Holiday Status: ${schedData.holiday?.isHolidayPeriod ? 'Active (Day ' + schedData.holiday.currentDayNumber + ')' : 'Pre-Holiday (Starts in ' + schedData.holiday.daysUntilStart + ' days)'}`);
  } else {
    console.log(`  Response: ${await schedRes.text()}`);
  }

  console.log('\n[3] Testing Live /api/security/sessions (Active Sessions API)...');
  const sessRes = await fetch(`${PROD_URL}/api/security/sessions`, {
    headers: { cookie: cookieHeader },
  });
  console.log(`  Status: ${sessRes.status} ${sessRes.statusText}`);
  if (sessRes.ok) {
    const sessData = await sessRes.json();
    console.log(`  ✔ Active Sessions Returned: ${sessData.sessions?.length}`);
    for (const s of sessData.sessions || []) {
      console.log(`    · Device: ${s.device} | Location: ${s.location} | Current: ${s.isCurrent}`);
    }
  } else {
    console.log(`  Response: ${await sessRes.text()}`);
  }

  console.log('\n[4] Testing Live Protected Settings Page...');
  const settingsRes = await fetch(`${PROD_URL}/settings`, {
    headers: { cookie: cookieHeader },
  });
  console.log(`  Status: ${settingsRes.status} ${settingsRes.statusText}`);

  // Cleanup test session
  await prisma.userSession.deleteMany({ where: { sessionToken: testSessionId } });

  console.log('\n==================================================');
  console.log('✅ PRODUCTION LIVE VERIFICATION COMPLETE');
  console.log('==================================================');
}

main().catch(console.error);
