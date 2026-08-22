import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/telegram';
import {
  getTodaySummary,
  getProgressSummary,
  getWorkoutSummary,
  getPlanSummary,
  getMissedSummary,
} from '@/lib/telegramCommands';

const START_REPLY = `Welcome to FORGE, Mikiyas.

Your personal growth assistant is ready.

Commands:

/today
/progress
/workout
/plan
/missed

Connect Telegram from:

Forge → Settings → Connect Telegram`;

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

    // 3. Process Message
    const message = update?.message;
    if (message && message.chat && message.text) {
      const chatId = message.chat.id;
      const text = message.text.trim();
      const command = text.split(' ')[0].toLowerCase().split('@')[0];

      switch (command) {
        case '/start':
          await sendTelegramMessage(chatId, START_REPLY);
          break;
        case '/today': {
          const reply = await getTodaySummary();
          await sendTelegramMessage(chatId, reply);
          break;
        }
        case '/progress': {
          const reply = await getProgressSummary();
          await sendTelegramMessage(chatId, reply);
          break;
        }
        case '/workout': {
          const reply = await getWorkoutSummary();
          await sendTelegramMessage(chatId, reply);
          break;
        }
        case '/plan': {
          const reply = await getPlanSummary();
          await sendTelegramMessage(chatId, reply);
          break;
        }
        case '/missed': {
          const reply = await getMissedSummary();
          await sendTelegramMessage(chatId, reply);
          break;
        }
      }
    }

    // Return 200 OK for all valid webhook deliveries so Telegram does not retry
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    // Return 200 to prevent webhook crash loops, but log error internally
    console.error('Telegram webhook handler error:', error?.message || error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal error' }, { status: 500 });
  }
}
