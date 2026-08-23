import { NextResponse } from 'next/server';
import { syncForgePlanToGoogleCalendar, isGoogleCalendarConnected } from '@/lib/googleCalendar';

export async function POST() {
  try {
    const connected = await isGoogleCalendarConnected();
    if (!connected) {
      return NextResponse.json(
        { error: 'Google Calendar is not connected. Please connect via OAuth first.' },
        { status: 400 }
      );
    }

    const result = await syncForgePlanToGoogleCalendar();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Google Calendar sync error:', error);
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}
