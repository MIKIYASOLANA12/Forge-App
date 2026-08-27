import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUserFromRequest } from '@/lib/auth';
import { approveLoginAttempt, revokeLoginAttempt, getRequestIp, getRequestDevice } from '@/lib/security';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  activityId: z.string().min(1).max(200),
  action: z.enum(['ALLOW', 'TERMINATE']),
});

// POST /api/security/authorize
// Handles the Login Notification actions for a login attempt.
// ALLOW -> marks attempt APPROVED (and re-grants its session if it was
//          mid-revocation); a terminated (REVOKED) attempt is rejected.
// TERMINATE -> marks the attempt REVOKED and revokes any linked session.
//              A revoked attempt can never be approved again.
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

  if (body.action === 'TERMINATE') {
    const result = await revokeLoginAttempt({
      ownerUserId: session.userId,
      actorId: session.userId,
      targetId: body.activityId,
      ipAddress: ip,
      userAgent: ua,
    });
    if (!result.ok) {
      return NextResponse.json({ error: 'Could not terminate this attempt.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Attempt terminated.' });
  }

  // ALLOW
  const result = await approveLoginAttempt({
    ownerUserId: session.userId,
    actorId: session.userId,
    targetId: body.activityId,
    ipAddress: ip,
    userAgent: ua,
  });
  if (!result.ok) {
    const status = result.error === 'ALREADY_TERMINATED' ? 409 : 404;
    const message =
      result.error === 'ALREADY_TERMINATED'
        ? 'This attempt was already terminated and cannot be approved.'
        : 'Could not approve this attempt.';
    return NextResponse.json({ error: message, code: result.error }, { status });
  }
  return NextResponse.json({ success: true, message: 'Attempt approved.' });
}