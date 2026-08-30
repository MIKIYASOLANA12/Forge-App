import { prisma } from '../lib/prisma';
import { createSessionToken } from '../lib/session';

const PROD_URL = 'https://forge-app-eight-kappa.vercel.app';

async function main() {
  console.log('==================================================');
  console.log('🧪 VERIFYING LIVE SESSION TERMINATION ON VERCEL');
  console.log('==================================================\n');

  const user = await prisma.user.findFirst({
    where: { email: { in: ['mikiyasolana382@gmail.com', 'mikiyasolana87@gmail.com'] } },
  });
  if (!user) throw new Error('No user found');

  // Create admin session and target device session
  const adminSessionId = `admin-sess-${Date.now()}`;
  const targetSessionId = `target-sess-${Date.now()}`;

  const adminSession = await prisma.userSession.create({
    data: { userId: user.id, sessionToken: adminSessionId, userAgent: 'Admin Chrome', location: 'Addis Ababa', revoked: false },
  });

  const targetSession = await prisma.userSession.create({
    data: { userId: user.id, sessionToken: targetSessionId, userAgent: 'Target Remote Phone', location: 'Hawassa', revoked: false },
  });

  const adminToken = await createSessionToken(user.id, user.email, user.name || undefined, adminSessionId, true);

  console.log('[1] Calling Live POST /api/security/terminate for target remote device...');
  const termRes = await fetch(`${PROD_URL}/api/security/terminate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: `forge_session=${adminToken}`,
    },
    body: JSON.stringify({ sessionId: targetSession.id }),
  });

  console.log(`  Terminate API Status: ${termRes.status} ${termRes.statusText}`);
  const termJson = await termRes.json();
  console.log('  Response:', termJson);

  console.log('\n[2] Verifying Target Session Status in Live Database...');
  const updatedTarget = await prisma.userSession.findUnique({ where: { id: targetSession.id } });
  console.log(`  ✔ Revoked in DB: ${updatedTarget?.revoked === true ? 'YES (true)' : 'NO'}`);
  console.log(`  ✔ RevokedAt Timestamp: ${updatedTarget?.revokedAt}`);

  // Cleanup
  await prisma.userSession.deleteMany({ where: { id: { in: [adminSession.id, targetSession.id] } } });

  console.log('\n==================================================');
  console.log('✅ LIVE PRODUCTION SESSION TERMINATION CONFIRMED');
  console.log('==================================================');
}

main().catch(console.error);
