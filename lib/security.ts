import { prisma } from './prisma';

/**
 * Centralized, authorization-aware security actions used by the in-app
 * Security dashboard AND the Telegram inline buttons.
 *
 * Every revoke/approve helper:
 *  - validates that the target belongs to the authenticated user (no
 *    arbitrary userId/sessionId from the browser is ever trusted)
 *  - performs a real server-side DB mutation (revoked = true) so the
 *    existing per-request validation in lib/auth.ts denies access
 *  - records a non-sensitive audit entry
 */

export function getRequestIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    '127.0.0.1'
  );
}

export function getRequestDevice(req: Request): string {
  return req.headers.get('user-agent') || 'Unknown Device';
}

type AuditInput = {
  userId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  result: 'SUCCESS' | 'FAILED';
  detail?: string;
  ipAddress?: string;
  userAgent?: string;
};

async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    const userExists = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });
    if (!userExists) return;

    await prisma.securityAuditLog.create({
      data: {
        userId: input.userId,
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        result: input.result,
        detail: input.detail,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  } catch (err) {
    // Audit must never break the security action itself.
    console.error('Failed to write security audit log:', err);
  }
}

/**
 * Resolve a target identifier (a UserSession `sessionToken` or a
 * UserSession DB `id`) into the UserSession row, guaranteeing the row
 * belongs to `ownerUserId`.
 */
async function resolveOwnedSession(target: string, ownerUserId: string) {
  const byToken = await prisma.userSession.findUnique({
    where: { sessionToken: target },
  });
  if (byToken && byToken.userId === ownerUserId) return byToken;

  const byId = await prisma.userSession.findFirst({
    where: { id: target, userId: ownerUserId },
  });
  if (byId) return byId;

  return null;
}
/**
 * Permanently revoke an active session for the authenticated owner.
 */
export async function revokeSession(opts: {
  ownerUserId: string;
  actorId: string;
  target: string;
  ipAddress?: string;
  userAgent?: string;
  allowSelfTerminate?: boolean;
  currentSessionId?: string;
}) {
  const {
    ownerUserId,
    actorId,
    target,
    ipAddress,
    userAgent,
    allowSelfTerminate = false,
    currentSessionId,
  } = opts;

  const session = await resolveOwnedSession(target, ownerUserId);
  if (!session) {
    await writeAuditLog({
      userId: ownerUserId,
      actorId,
      action: 'TERMINATE_SESSION',
      targetType: 'SESSION',
      targetId: target,
      result: 'FAILED',
      detail: 'Target not found or not owned by caller',
      ipAddress,
      userAgent,
    });
    return { ok: false, error: 'SESSION_NOT_FOUND' as const };
  }

  // Guard: never silently terminate the caller's own current session.
  const isCurrent = currentSessionId != null && session.sessionToken === currentSessionId;
  if (isCurrent && !allowSelfTerminate) {
    await writeAuditLog({
      userId: ownerUserId,
      actorId,
      action: 'TERMINATE_SESSION',
      targetType: 'SESSION',
      targetId: target,
      result: 'FAILED',
      detail: 'Blocked self-termination without confirmation',
      ipAddress,
      userAgent,
    });
    return { ok: false, error: 'CONFIRM_CURRENT' as const };
  }

  if (session.revoked) {
    return { ok: true, alreadyRevoked: true, session };
  }

  await prisma.userSession.update({
    where: { id: session.id },
    data: { revoked: true, revokedAt: new Date() },
  });

  // Mirror the login activity feed for the same session.
  if (session.sessionToken) {
    await prisma.loginActivity.updateMany({
      where: { sessionId: session.sessionToken },
      data: { status: 'REVOKED', updatedAt: new Date() },
    });
  }

  await writeAuditLog({
    userId: ownerUserId,
    actorId,
    action: 'TERMINATE_SESSION',
    targetType: 'SESSION',
    targetId: session.sessionToken || session.id,
    result: 'SUCCESS',
    detail: isCurrent ? 'Current device terminated (confirmed)' : 'Remote session revoked',
    ipAddress,
    userAgent,
  });

  return { ok: true, alreadyRevoked: false, session };
}

/**
 * Approve/ALLOW a login attempt. Only works for a non-terminated attempt;
 * a revoked/blocked attempt can never be approved again.
 */
export async function approveLoginAttempt(opts: {
  ownerUserId: string;
  actorId: string;
  targetId: string; // LoginActivity id
  ipAddress?: string;
  userAgent?: string;
}) {
  const { ownerUserId, actorId, targetId, ipAddress, userAgent } = opts;

  const attempt = await prisma.loginActivity.findFirst({
    where: { id: targetId, userId: ownerUserId },
  });
  if (!attempt) {
    await writeAuditLog({
      userId: ownerUserId,
      actorId,
      action: 'APPROVE_ATTEMPT',
      targetType: 'LOGIN_ATTEMPT',
      targetId,
      result: 'FAILED',
      detail: 'Attempt not found or not owned',
      ipAddress,
      userAgent,
    });
    return { ok: false, error: 'ATTEMPT_NOT_FOUND' as const };
  }

  // A terminated attempt is permanently blocked.
  if (attempt.status === 'REVOKED') {
    await writeAuditLog({
      userId: ownerUserId,
      actorId,
      action: 'APPROVE_ATTEMPT',
      targetType: 'LOGIN_ATTEMPT',
      targetId,
      result: 'FAILED',
      detail: 'Attempt already terminated - cannot re-approve',
      ipAddress,
      userAgent,
    });
    return { ok: false, error: 'ALREADY_TERMINATED' as const };
  }

  await prisma.loginActivity.update({
    where: { id: attempt.id },
    data: { status: 'APPROVED', approvedAt: new Date(), updatedAt: new Date() },
  });

  // If a session exists behind this attempt, keep it granted.
  if (attempt.sessionId) {
    const session = await prisma.userSession.findUnique({
      where: { sessionToken: attempt.sessionId },
    });
    if (session && session.revoked) {
      await prisma.userSession.update({
        where: { id: session.id },
        data: { revoked: false, revokedAt: null },
      });
    }
  }

  await writeAuditLog({
    userId: ownerUserId,
    actorId,
    action: 'APPROVE_ATTEMPT',
    targetType: 'LOGIN_ATTEMPT',
    targetId,
    result: 'SUCCESS',
    detail: 'Login attempt approved',
    ipAddress,
    userAgent,
  });

  return { ok: true, attemptId: attempt.id };
}

/**
 * Terminate a pending/active login attempt. A revoked attempt can never
 * later be approved (the approve path rejects REVOKED status).
 */
export async function revokeLoginAttempt(opts: {
  ownerUserId: string;
  actorId: string;
  targetId: string; // LoginActivity id
  ipAddress?: string;
  userAgent?: string;
}) {
  const { ownerUserId, actorId, targetId, ipAddress, userAgent } = opts;

  const attempt = await prisma.loginActivity.findFirst({
    where: { id: targetId, userId: ownerUserId },
  });
  if (!attempt) {
    return { ok: false, error: 'ATTEMPT_NOT_FOUND' as const };
  }

  await prisma.loginActivity.update({
    where: { id: attempt.id },
    data: { status: 'REVOKED', updatedAt: new Date() },
  });

  // Revoke the linked session too, if one exists.
  if (attempt.sessionId) {
    await prisma.userSession.updateMany({
      where: { sessionToken: attempt.sessionId, userId: ownerUserId },
      data: { revoked: true, revokedAt: new Date() },
    });
  }

  await writeAuditLog({
    userId: ownerUserId,
    actorId,
    action: 'TERMINATE_ATTEMPT',
    targetType: 'LOGIN_ATTEMPT',
    targetId,
    result: 'SUCCESS',
    detail: 'Login attempt terminated',
    ipAddress,
    userAgent,
  });

  return { ok: true, attemptId: attempt.id };
}