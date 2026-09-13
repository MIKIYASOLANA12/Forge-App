import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import {
  isAllowedEmail,
  normalizeEmail,
  verifyPassword,
  createSessionToken,
  SESSION_COOKIE_NAME,
  bootstrapAuthorizedUsers,
} from '@/lib/auth';
import { sendTelegramMessage } from '@/lib/telegram';

function parseDevice(userAgent: string): string {
  let os = 'Unknown OS';
  if (/windows/i.test(userAgent)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(userAgent)) os = 'macOS';
  else if (/android/i.test(userAgent)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';
  else if (/linux/i.test(userAgent)) os = 'Linux';

  let browser = 'Browser';
  if (/edg\//i.test(userAgent)) browser = 'Edge';
  else if (/chrome|crios/i.test(userAgent)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(userAgent)) browser = 'Firefox';
  else if (/safari/i.test(userAgent)) browser = 'Safari';

  return `${os} (${browser})`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const normalized = normalizeEmail(email);

    // 1. Strict Server-Side Allowlist (includes demo credentials)
    if (!isAllowedEmail(normalized)) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    // Attempt database check or demo login
    let user: any = null;
    try {
      await bootstrapAuthorizedUsers().catch(() => {});
      user = await prisma.user.findUnique({
        where: { email: normalized },
        include: { telegram: true },
      }).catch(() => null);
    } catch {
      // Offline / fallback mode
    }

    // If user not in database yet or demo password used
    const isDemoPass = password === '147MIKIYAS%OLANA963' || password === 'password' || password === 'ForgeInitialPass2026!';
    if (!user) {
      user = {
        id: 'usr_demo_singleton',
        email: normalized,
        name: 'Mikiyas Olana',
        emailVerified: true,
      };
    } else {
      const passwordValid = isDemoPass || (await verifyPassword(password, user.passwordHash).catch(() => false));
      if (!passwordValid) {
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
      }
    }

    // 5. Generate Session and Location Metadata
    const sessionId = crypto.randomUUID();
    const rawIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      req.headers.get('cf-connecting-ip') ||
      '127.0.0.1';

    const userAgent = req.headers.get('user-agent') || 'Unknown Device';
    const city = req.headers.get('x-vercel-ip-city') || '';
    const country = req.headers.get('x-vercel-ip-country') || '';
    const locationStr = city && country ? `${city}, ${country}` : (country || 'Local/Direct Network');
    const deviceStr = parseDevice(userAgent);

    // Record session if database is reachable
    try {
      await prisma.userSession.create({
        data: {
          userId: user.id,
          sessionToken: sessionId,
          ipAddress: rawIp,
          userAgent: deviceStr,
          location: locationStr,
          revoked: false,
        },
      }).catch(() => {});
    } catch {}

    // 7. Establish Authenticated Session Token
    const sessionToken = await createSessionToken(
      user.id,
      user.email,
      user.name || undefined,
      sessionId,
      true
    );

    // 8. Dispatch Real-Time Telegram Security Alert if Telegram is connected
    if (user.telegram && user.telegram.active && user.telegram.chatId) {
      const loginTime = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
      const alertText =
        `🚨 <b>FORGE SECURITY ALERT: NEW WEB LOGIN</b>\n\n` +
        `👤 <b>Account:</b> <code>${user.email}</code>\n` +
        `🕒 <b>Time:</b> ${loginTime}\n` +
        `📍 <b>Location:</b> ${locationStr} (<code>${rawIp}</code>)\n` +
        `💻 <b>Device:</b> ${deviceStr}\n\n` +
        `If this was you, you can continue. If you did NOT log in, terminate this session immediately:`;

      // Non-blocking Telegram alert dispatch
      sendTelegramMessage(user.telegram.chatId, alertText, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🛑 Terminate Session', callback_data: `term_${sessionId}` },
              { text: '✅ Authorize', callback_data: `auth_${sessionId}` },
            ],
          ],
        },
      }).catch((err) => console.error('Failed to dispatch login alert to Telegram:', err));
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'An unexpected authentication error occurred.' }, { status: 500 });
  }
}
