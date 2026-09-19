import { NextRequest, NextResponse } from 'next/server';
import { processVoiceCommand } from '@/lib/voice/voiceCommands';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { input, callSid, confirmed } = body;

    if (!input || typeof input !== 'string') {
      return NextResponse.json({ error: 'input command string is required' }, { status: 400 });
    }

    const result = await processVoiceCommand(input, callSid, Boolean(confirmed));
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error processing voice command:', err);
    return NextResponse.json({ error: err.message || 'Failed to process voice command' }, { status: 500 });
  }
}
