/**
 * FORGE — SESSION TERMINATION SECURITY FIX TEST (DB-backed, real revocation)
 *
 * Verifies against the live PostgreSQL database that clicking TERMINATE:
 *   1. Permanently revokes a second device's session (device B).
 *   2. Makes that session's existing token unusable for protected access.
 *   3. Avoids fake success — reports success only via real DB revocation.
 *   4. Protects the current device from accidental self-termination.
 *   5. Rejects terminating a session NOT owned by the caller.
 *   6. Terminates a pending login attempt so it can never be approved later.
 *   7. Writes a non-sensitive audit log.
 *
 * Run: npx ts-node --project tsconfig.seed.json -r tsconfig-paths/register scripts/test_session_termination.ts
 */
if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile('.env.local'); } catch {}
}
import { prisma } from '../lib/prisma';
import { createSessionToken, verifySessionToken } from '../lib/session';
import {
  revokeSession,
  approveLoginAttempt,
  revokeLoginAttempt,
} from '../lib/security';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✔ ${msg}`);
}

const marker = `sesterm-${Date.now()}`;

// Mirrors the revocation gate in lib/auth.ts: a signed token is only valid
// if the matching DB session is not revoked.
async function accessViaDB(token: string) {
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  if (payload.sessionId) {
    const dbSession = await prisma.userSession.findUnique({
      where: { sessionToken: payload.sessionId },
    });
    if (dbSession?.revoked) return null;
  }
  return payload;
}

async function main() {
  console.log('==================================================');
  console.log('🧪 FORGE: SESSION TERMINATION FIX — REAL BEHAVIOR TEST');
  console.log('==================================================');

  const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!user) {
    console.error('❌ No user found in DB. Aborting.');
    process.exit(1);
  }
  console.log(`\nUsing account: ${user.email}`);

  const sessionATA = `${marker}-deviceA`;
  const sessionBTB = `${marker}-deviceB`;

  // Device A (admin/current) and Device B (other/attacker).
  await prisma.userSession.create({
    data: { userId: user.id, sessionToken: sessionATA, userAgent: 'Windows (Chrome)', location: 'Addis Ababa, ET', revoked: false },
  });
  await prisma.userSession.create({
    data: { userId: user.id, sessionToken: sessionBTB, userAgent: 'Android (Firefox)', location: 'Other Location', revoked: false },
  });
  await prisma.loginActivity.create({
    data: { userId: user.id, sessionId: sessionBTB, email: user.email, userAgent: 'Android (Firefox)', location: 'Other Location', status: 'ACTIVE' },
  });

  const tokenA = await createSessionToken(user.id, user.email, user.name || undefined, sessionATA, true);
  const tokenB = await createSessionToken(user.id, user.email, user.name || undefined, sessionBTB, true);

  console.log('\n[1] Both devices are valid before termination:');
  assert((await accessViaDB(tokenA)) !== null, 'device A token grants access BEFORE termination');
  assert((await accessViaDB(tokenB)) !== null, 'device B token grants access BEFORE termination');

  console.log('\n[2] Current-device protection (no accidental self-termination):');
  const selfAttempt = await revokeSession({
    ownerUserId: user.id,
    actorId: user.id,
    target: sessionATA,
    currentSessionId: sessionATA,
    allowSelfTerminate: false,
  });
  assert(selfAttempt.ok === false && selfAttempt.error === 'CONFIRM_CURRENT', 'terminating the current device without confirmation is blocked');
  assert((await accessViaDB(tokenA)) !== null, 'device A (current) still has access after blocked self-terminate');

  console.log('\n[3] Ownership enforcement (never an arbitrary session):');
  const stranger = await revokeSession({
    ownerUserId: 'someone-elses-id',
    actorId: 'someone-elses-id',
    target: sessionBTB,
  });
  assert(stranger.ok === false && stranger.error === 'SESSION_NOT_FOUND', 'cannot terminate a session the caller does not own');

  console.log('\n[4] Admin clicks TERMINATE on device B:');
  const revokeResult = await revokeSession({
    ownerUserId: user.id,
    actorId: user.id,
    target: sessionBTB,
    currentSessionId: sessionATA,
  });
  assert(revokeResult.ok === true, 'server confirms the session was actually revoked (no false success)');

  const dbB = await prisma.userSession.findUnique({ where: { sessionToken: sessionBTB } });
  assert(dbB?.revoked === true, 'device B session row is revoked = true in DB');
  assert(dbB?.revokedAt != null, 'device B revokedAt timestamp is set');

  console.log('\n[5] Result is not just hidden in the dashboard — it is real:');
  const active = await prisma.userSession.findMany({
    where: { userId: user.id, revoked: false, sessionToken: { startsWith: marker } },
  });
  assert(!active.some((s) => s.sessionToken === sessionBTB), 'device B no longer appears in active (non-revoked) sessions');
  assert(active.some((s) => s.sessionToken === sessionATA), 'device A still appears as active');

  console.log('\n[6] Device B tries to reuse its old token (refresh / protected page / protected API):');
  assert((await accessViaDB(tokenB)) === null, 'device B old token is now REJECTED for protected access');
  assert(Boolean(await verifySessionToken(tokenB)), 'token signature still verifies, but DB revocation is the enforced gate');
  const logB = await prisma.loginActivity.findFirst({ where: { sessionId: sessionBTB } });
  assert(logB?.status === 'REVOKED', 'device B login activity feed updated to REVOKED');

  // Test actual getSessionUserFromRequest with HTTP headers
  const { getSessionUserFromRequest } = await import('../lib/auth');
  const fakeReqA = new Request('http://localhost:3000/api/plan/today', {
    headers: { cookie: `forge_session=${tokenA}` },
  });
  const fakeReqB = new Request('http://localhost:3000/api/plan/today', {
    headers: { cookie: `forge_session=${tokenB}` },
  });

  const authUserA = await getSessionUserFromRequest(fakeReqA);
  const authUserB = await getSessionUserFromRequest(fakeReqB);

  assert(authUserA !== null && authUserA.userId === user.id, 'Device A request authenticates successfully');
  assert(authUserB === null, 'Device B request is rejected with null (triggers 401 & cookie deletion)');

  console.log('\n[7] Pending login attempt can be terminated and never approved later:');
  const pending = await prisma.loginActivity.create({
    data: { userId: user.id, email: user.email, userAgent: 'Test Device', location: 'Unknown', status: 'PENDING' },
  });
  const termAttempt = await revokeLoginAttempt({ ownerUserId: user.id, actorId: user.id, targetId: pending.id });
  assert(termAttempt.ok === true, 'pending attempt terminated');
  const pendingAfter = await prisma.loginActivity.findUnique({ where: { id: pending.id } });
  assert(pendingAfter?.status === 'REVOKED', 'pending attempt marked REVOKED in DB');
  const reapprove = await approveLoginAttempt({ ownerUserId: user.id, actorId: user.id, targetId: pending.id });
  assert(reapprove.ok === false && reapprove.error === 'ALREADY_TERMINATED', 'terminated attempt CANNOT be approved later');

  console.log('\n[8] Audit log recorded (and holds no secrets):');
  const auditCount = await prisma.securityAuditLog.count({
    where: { userId: user.id, action: { in: ['TERMINATE_SESSION', 'TERMINATE_ATTEMPT'] } },
  });
  assert(auditCount >= 2, 'audit log entries recorded for sessions + attempt termination');
  const samples = await prisma.securityAuditLog.findMany({
    where: { userId: user.id, action: 'TERMINATE_SESSION' },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  const noSecrets = samples.every(
    (s) =>
      !/Bearer/i.test(s.detail || '') &&
      !/password/i.test(s.detail || '') &&
      !/forge_session/i.test(s.detail || '')
  );
  assert(noSecrets, 'audit logs contain no session token, cookie, or password');
  for (const s of samples) {
    console.log(`    · ${s.action} → ${s.result} | ${s.targetType} ${s.targetId.slice(0, 12)}… | ${new Date(s.createdAt).toISOString()}`);
  }

  // Cleanup: remove ONLY this test's rows — never touch real data.
  console.log('\n  (cleaning up test rows)');
  await prisma.userSession.deleteMany({ where: { sessionToken: { startsWith: marker } } });
  await prisma.loginActivity.deleteMany({ where: { sessionId: { startsWith: marker } } });
  await prisma.loginActivity.deleteMany({ where: { userAgent: 'Test Device', status: 'REVOKED' } });

  console.log('\n==================================================');
  console.log('✅ ALL SESSION TERMINATION TESTS PASSED');
  console.log('==================================================');
}

main()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });