import { NextRequest, NextResponse } from 'next/server';
import { processAccountabilityCron, sendDailyAccountabilityReminder, sendDailyCompletionReport } from '@/lib/telegramScheduler';
import { runAccountabilityRecheck } from '@/lib/accountabilityRecheck';

export async function GET(req: NextRequest) {
  try {
    // 1. Authorization check for Vercel Cron
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const url = new URL(req.url);
      const keyParam = url.searchParams.get('key');
      if (keyParam !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const force = searchParams.get('force') === 'true';

    let result;
    if (action === 'reminder') {
      result = await sendDailyAccountabilityReminder(force);
    } else if (action === 'report') {
      result = await sendDailyCompletionReport(force);
    } else if (action === 'recheck' || action === 'accountability') {
      // Reliable recheck: detect misses, verify delivery, retry/remind.
      result = await runAccountabilityRecheck({ force });
    } else {
      result = await processAccountabilityCron();
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (error: any) {
    console.error('Accountability cron error:', error);
    return NextResponse.json({ error: error.message || 'Internal cron error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
