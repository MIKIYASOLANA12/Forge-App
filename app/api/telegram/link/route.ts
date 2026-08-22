import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSessionUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendTelegramMessage } from '@/lib/telegram';

function verifyTelegramAuth(data: Record<string, any>, botToken: string): boolean {
  try {
    const { hash, ...rest } = data;
    if (!hash || !botToken) return false;

    // Check data age (must be within 24 hours)
    const authDate = Number(rest.auth_date);
    if (!authDate || Math.floor(Date.now() / 1000) - authDate > 86400) {
      return false;
    }

    // Create data-check-string (alphabetically sorted keys)
    const checkString = Object.keys(rest)
      .sort()
      .map((k) => `${k}=${rest[k]}`)
      .join('\n');

    // Secret key is SHA256 of bot token
    const secretKey = crypto.createHash('sha256').update(botToken).digest();

    // Calculate HMAC-SHA256
    const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Check Authenticated Forge Session
    const session = await getSessionUserFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: You must be logged in to Forge to link Telegram.' }, { status: 401 });
    }

    const body = await req.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN is not configured on the server.' }, { status: 500 });
    }

    // 2. Cryptographically Verify Telegram Auth Signature
    const isSignatureValid = verifyTelegramAuth(body, botToken);
    if (!isSignatureValid) {
      return NextResponse.json({ error: 'Invalid Telegram authentication signature.' }, { status: 400 });
    }

    const telegramId = String(body.id);
    const username = body.username ? String(body.username) : null;
    const providedPhone = body.phone_number ? String(body.phone_number).replace(/\D/g, '') : null;

    // 3. Server-Side Phone / Identity Authorization Check
    const authorizedPhone = process.env.TELEGRAM_AUTHORIZED_PHONE
      ? process.env.TELEGRAM_AUTHORIZED_PHONE.replace(/\D/g, '')
      : null;

    // If a phone whitelist is configured, strictly enforce matching
    if (authorizedPhone) {
      if (!providedPhone || providedPhone !== authorizedPhone) {
        // Trigger Security Alert to bot
        const userAgent = req.headers.get('user-agent') || 'Unknown Device';
        const timestamp = new Date().toISOString();
        
        try {
          // If there's an existing linked telegram account, alert them
          const existingTelegram = await prisma.telegramAccount.findFirst({
            where: { active: true, chatId: { not: null } },
          });

          if (existingTelegram?.chatId) {
            await sendTelegramMessage(
              existingTelegram.chatId,
              `🚨 SECURITY ALERT: Unauthorized Telegram linking attempt detected on Forge.
Time: ${timestamp}
Telegram ID: ${telegramId}
Device: ${userAgent.slice(0, 80)}`
            );
          }
        } catch (alertErr) {
          console.error('Failed to dispatch telegram security alert:', alertErr);
        }

        return NextResponse.json(
          { error: 'This Telegram account is not authorized for Forge.' },
          { status: 403 }
        );
      }
    }

    // 4. Link Telegram Account in Database
    const linked = await prisma.telegramAccount.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        telegramId,
        chatId: telegramId,
        username,
        phoneNumber: providedPhone,
        verifiedAt: new Date(),
        active: true,
      },
      update: {
        telegramId,
        chatId: telegramId,
        username,
        phoneNumber: providedPhone,
        verifiedAt: new Date(),
        active: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Telegram account successfully linked to Forge.',
      telegram: {
        telegramId: linked.telegramId,
        username: linked.username,
        verifiedAt: linked.verifiedAt,
      },
    });
  } catch (error: any) {
    console.error('Telegram linking error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to link Telegram account.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionUserFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.telegramAccount.deleteMany({
      where: { userId: session.userId },
    });

    return NextResponse.json({ success: true, message: 'Telegram account unlinked.' });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to unlink Telegram.' }, { status: 500 });
  }
}
