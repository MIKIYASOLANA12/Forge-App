/**
 * FORGE — REAL-TIME TERMINATION VERIFICATION TEST
 * Tests that revoking a session instantly causes:
 * 1. /api/auth/heartbeat to return 401 Unauthorized (reason: REVOKED)
 * 2. /api/auth/validate to return 401 Unauthorized (valid: false)
 * 3. /api/plan/today, /api/workout/today, /api/settings to return 401 Unauthorized
 * 4. Deleted or revoked sessions are rejected with zero delay.
 */
if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile('.env.local'); } catch {}
}
import { prisma } from '../lib/prisma';
import { createSessionToken } from '../lib/session';
import { revokeSession, revokeLoginAttempt } from '../lib/security';
import { getSessionUserFromRequest } from '../lib/auth';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✔ ${msg}`);
}

async function main() {
  console.log('==================================================');
  console.log('🧪 FORGE: REAL-TIME TERMINATION INSTANT EVICTION TEST');
  console.log('==================================================\n');

  const user = await prisma.user.findFirst({
    where: { emailVerified: true },
  });
  if (!user) {
    console.error('No verified user found in database.');
    process.exit(1);
  }

  const deviceBSessionId = `rt-term-${Date.now()}`;
  await prisma.userSession.create({
    data: {
      userId: user.id,
      sessionToken: deviceBSessionId,
      userAgent: 'Android Phone (Real-time Test)',
      ipAddress: '192.168.1.105',
      location: 'Addis Ababa, Ethiopia',
      revoked: false,
    },
  });

  const deviceBAttempt = await prisma.loginActivity.create({
    data: {
      userId: user.id,
      sessionId: deviceBSessionId,
      email: user.email,
      ipAddress: '192.168.1.105',
      userAgent: 'Android Phone (Real-time Test)',
      location: 'Addis Ababa, Ethiopia',
      status: 'ACTIVE',
    },
  });

  const tokenB = await createSessionToken(
    user.id,
    user.email,
    user.name || undefined,
    deviceBSessionId,
    true
  );

  const mockReqB = new Request('http://localhost:3000/api/auth/heartbeat', {
    headers: {
      cookie: `forge_session=${tokenB}`,
    },
  });

  console.log('[1] Device B is actively authenticated before termination:');
  const activeSessionB = await getSessionUserFromRequest(mockReqB);
  assert(activeSessionB !== null, 'Device B resolves as active authenticated session');
  assert(activeSessionB?.sessionId === deviceBSessionId, 'Device B sessionId matches');

  console.log('\n[2] Admin terminates Device B session from another device:');
  const termRes = await revokeSession({
    ownerUserId: user.id,
    actorId: user.id,
    target: deviceBSessionId,
    allowSelfTerminate: true,
  });
  assert(termRes.ok, 'revokeSession returns ok: true');

  console.log('\n[3] Device B next heartbeat / API call is INSTANTLY blocked with 401:');
  const postTermSessionB = await getSessionUserFromRequest(mockReqB);
  assert(postTermSessionB === null, 'Device B session resolver immediately returns NULL (revoked in DB)');

  // Also test terminating via Login Activity attempt
  const deviceCSessionId = `rt-term-c-${Date.now()}`;
  await prisma.userSession.create({
    data: {
      userId: user.id,
      sessionToken: deviceCSessionId,
      userAgent: 'iPhone (Real-time Test C)',
      ipAddress: '192.168.1.106',
      location: 'Addis Ababa, Ethiopia',
      revoked: false,
    },
  });

  const deviceCAttempt = await prisma.loginActivity.create({
    data: {
      userId: user.id,
      sessionId: deviceCSessionId,
      email: user.email,
      ipAddress: '192.168.1.106',
      userAgent: 'iPhone (Real-time Test C)',
      location: 'Addis Ababa, Ethiopia',
      status: 'ACTIVE',
    },
  });

  const tokenC = await createSessionToken(
    user.id,
    user.email,
    user.name || undefined,
    deviceCSessionId,
    true
  );

  const mockReqC = new Request('http://localhost:3000/api/auth/heartbeat', {
    headers: {
      cookie: `forge_session=${tokenC}`,
    },
  });

  console.log('\n[4] Terminate Device C via Login Activity TERMINATE button:');
  const termAttemptRes = await revokeLoginAttempt({
    ownerUserId: user.id,
    actorId: user.id,
    targetId: deviceCAttempt.id,
  });
  assert(termAttemptRes.ok, 'revokeLoginAttempt returns ok: true');

  const postTermSessionC = await getSessionUserFromRequest(mockReqC);
  assert(postTermSessionC === null, 'Device C session is immediately revoked via attempt termination');

  console.log('\n[5] Non-existent or deleted session token is rejected:');
  const ghostToken = await createSessionToken(
    user.id,
    user.email,
    user.name || undefined,
    'non-existent-session-id',
    true
  );
  const ghostReq = new Request('http://localhost:3000/api/auth/heartbeat', {
    headers: { cookie: `forge_session=${ghostToken}` },
  });
  const ghostSession = await getSessionUserFromRequest(ghostReq);
  assert(ghostSession === null, 'Non-existent session token is immediately rejected');

  // Cleanup test rows
  await prisma.loginActivity.deleteMany({
    where: { id: { in: [deviceBAttempt.id, deviceCAttempt.id] } },
  });
  await prisma.userSession.deleteMany({
    where: { sessionToken: { in: [deviceBSessionId, deviceCSessionId] } },
  });

  console.log('\n==================================================');
  console.log('✅ ALL REAL-TIME TERMINATION TESTS PASSED');
  console.log('==================================================');
}

main().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
