import { NextRequest, NextResponse } from 'next/server';
import {
  isGoogleCalendarConnected,
  getGoogleAuthUrl,
  disconnectGoogleCalendar,
} from '@/lib/googleCalendar';

export async function GET() {
  try {
    const connected = await isGoogleCalendarConnected();
    const authUrl = !connected ? getGoogleAuthUrl() : null;

    return NextResponse.json({
      connected,
      authUrl,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to check status' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await disconnectGoogleCalendar();
    return NextResponse.json({ success: true, message: 'Google Calendar disconnected.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to disconnect' }, { status: 500 });
  }
}
