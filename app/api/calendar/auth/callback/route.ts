import { NextRequest, NextResponse } from 'next/server';
import { getOAuth2Client, saveGoogleTokens, syncForgePlanToGoogleCalendar } from '@/lib/googleCalendar';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(new URL('/calendar?error=' + encodeURIComponent(error), req.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/calendar?error=No+code+provided', req.url));
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    await saveGoogleTokens(tokens);

    // Initial sync
    await syncForgePlanToGoogleCalendar().catch(() => {});

    return NextResponse.redirect(new URL('/calendar?connected=true', req.url));
  } catch (error: any) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/calendar?error=' + encodeURIComponent(error.message || 'OAuth failure'), req.url)
    );
  }
}
