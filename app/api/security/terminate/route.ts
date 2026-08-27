import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUserFromRequest } from '@/lib/auth';
import { revokeSession, getRequestIp, getRequestDevice } from '@/lib/security';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  sessionId: z.string().min(1).max(200),
  confirmCurrent: z.boolean().optional().default(false),
});

// POST /api/security/terminate
// Authorized: only the authenticated owner can revoke a session they own.
// Real server-side revocation: sets UserSession.revoked = true, which the
// per-request resolver in lib/auth.ts enforces on every request after this.
export async function POST(req: NextRequest) {
  const session = await getSessionUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const ip = getRequestIp(req);
  const ua = getRequestDevice(req);

  const result = await revokeSession({
    ownerUserId: session.userId,
    actorId: session.userId,
    target: body.sessionId,
    ipAddress: ip,
    userAgent: ua,
    allowSelfTerminate: body.confirmCurrent,
    currentSessionId: session.sessionId,
  });

  if (!result.ok) {
    const status = result.error === 'CONFIRM_CURRENT' ? 409 : 404;
    const message =
      result.error === 'CONFIRM_CURRENT'
        ? 'This is your current device. Confirm to terminate.'
        : 'Could not terminate this session.';
    return NextResponse.json({ error: message, code: result.error }, { status });
  }

  return NextResponse.json({
    success: true,
    alreadyRevoked: result.alreadyRevoked ?? false,
    message: 'Session terminated.',
  });
}