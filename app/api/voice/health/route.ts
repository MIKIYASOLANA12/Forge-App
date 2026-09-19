import { NextRequest, NextResponse } from 'next/server';
import { getVoiceAccountabilityHealth } from '@/lib/voice/voiceAccountability';

export async function GET(req: NextRequest) {
  try {
    const health = await getVoiceAccountabilityHealth();
    return NextResponse.json(health);
  } catch (err: any) {
    console.error('Error fetching voice health:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch voice health' }, { status: 500 });
  }
}
