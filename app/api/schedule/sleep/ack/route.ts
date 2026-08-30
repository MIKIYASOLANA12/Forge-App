import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth';
import { acknowledgeSleep, snoozeSleep, getSleepAccountabilityStatus } from '@/lib/sleepAccountability';

export const dynamic = 'force-dynamic';

// POST /api/schedule/sleep/ack
// Acknowledges sleep for the current night cycle from the web dashboard
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUserFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'ack';

    if (action === 'snooze') {
      const result = await snoozeSleep(5);
      return NextResponse.json({ success: result.success, result });
    }

    const result = await acknowledgeSleep('WEB');
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Sleep acknowledgment error:', error);
    return NextResponse.json({ error: error.message || 'Failed to acknowledge sleep' }, { status: 500 });
  }
}

// GET /api/schedule/sleep/ack
// Returns current sleep accountability status
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUserFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = await getSleepAccountabilityStatus();
    return NextResponse.json({ success: true, status });
  } catch (error: any) {
    console.error('Failed to get sleep status:', error);
    return NextResponse.json({ error: 'Failed to load sleep status' }, { status: 500 });
  }
}
