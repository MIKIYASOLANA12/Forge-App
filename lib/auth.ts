import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { prisma } from './prisma';
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  verifySessionToken,
} from './session';
import type { SessionPayload } from './session';

export { SESSION_COOKIE_NAME, createSessionToken, verifySessionToken };
export type { SessionPayload };

export const ALLOWED_EMAILS = [
  'mikiyasolana382@gmail.com',
  'mikiyasolana87@gmail.com',
] as const;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAllowedEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return ALLOWED_EMAILS.some((allowed) => allowed.toLowerCase() === normalized);
}

// ── Secure Password Hashing with scrypt ────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return resolve(false);

    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      try {
        const keyBuffer = Buffer.from(key, 'hex');
        const match = crypto.timingSafeEqual(keyBuffer, derivedKey);
        resolve(match);
      } catch {
        resolve(false);
      }
    });
  });
}

// ── Verification / Reset Token Helpers ─────────────────────────────────────────

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createAuthToken(
  userId: string,
  type: 'ACTIVATION' | 'PASSWORD_RESET'
): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);

  // Activation: 24h, Password Reset: 1h
  const ttlMs = type === 'ACTIVATION' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs);

  // Invalidate any pending tokens of same type for user
  await prisma.authToken.deleteMany({
    where: { userId, type, usedAt: null },
  });

  await prisma.authToken.create({
    data: {
      userId,
      tokenHash,
      type,
      expiresAt,
    },
  });

  return rawToken;
}

export async function verifyAndConsumeAuthToken(
  rawToken: string,
  type: 'ACTIVATION' | 'PASSWORD_RESET'
) {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.authToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record) return null;
  if (record.type !== type) return null;
  if (record.usedAt) return null;
  if (new Date() > record.expiresAt) return null;

  // Mark token as used
  await prisma.authToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return record.user;
}

// ── User Bootstrapping ────────────────────────────────────────────────────────

export async function bootstrapAuthorizedUsers(): Promise<void> {
  const defaultPassword = process.env.FORGE_INITIAL_PASSWORD || 'ForgeInitialPass2026!';

  for (const email of ALLOWED_EMAILS) {
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (!existing) {
      const passwordHash = await hashPassword(defaultPassword);
      await prisma.user.create({
        data: {
          email,
          name: 'Mikiyas Olana',
          passwordHash,
          emailVerified: false,
        },
      });
    }
  }
}

// ── Server Session Resolver Helpers ───────────────────────────────────────────

export async function getSessionUserFromCookie(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!sessionCookie?.value) return null;
    const session = await verifySessionToken(sessionCookie.value);
    if (!session) return null;

    if (session.sessionId) {
      const dbSession = await prisma.userSession.findUnique({
        where: { sessionToken: session.sessionId },
      });
      if (dbSession?.revoked) {
        return null;
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { emailVerified: true },
    });
    if (!user || !user.emailVerified) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function getSessionUserFromRequest(req: NextRequest | Request): Promise<SessionPayload | null> {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE_NAME}=([^;]*)`));
    if (!match?.[1]) return null;
    const token = decodeURIComponent(match[1]);
    const session = await verifySessionToken(token);
    if (!session) return null;

    if (session.sessionId) {
      const dbSession = await prisma.userSession.findUnique({
        where: { sessionToken: session.sessionId },
      });
      if (dbSession?.revoked) {
        return null;
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { emailVerified: true },
    });
    if (!user || !user.emailVerified) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}
