import { NextRequest, NextResponse } from 'next/server';
import { handleTelegramWebhookUpdate } from '@/lib/telegramVerification';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Forge Telegram webhook endpoint is active.',
  });
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Secret Token Header if configured
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expectedSecret) {
      const headerSecret = req.headers.get('x-telegram-bot-api-secret-token');
      if (headerSecret !== expectedSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // 2. Parse Telegram Update
    const update = (await req.json()) as any;

    // 3. Process via Verification & Command Engine
    await handleTelegramWebhookUpdate(update);

    // Return 200 OK for all valid webhook deliveries so Telegram does not retry
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    // Return 200 to prevent webhook crash loops, but log error internally
    console.error('Telegram webhook handler error:', error?.message || error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal error' }, { status: 500 });
  }
}
