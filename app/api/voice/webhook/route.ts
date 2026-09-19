import { NextRequest, NextResponse } from 'next/server';
import { handleVoiceCallWebhook } from '@/lib/voice/voiceAccountability';

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const eventType = (url.searchParams.get('event') as 'WAKE' | 'SLEEP') || 'WAKE';

    let spokenSpeech = '';
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      spokenSpeech = body.SpeechResult || body.speech || body.transcription || body.text || '';
    } else {
      const formData = await req.formData();
      spokenSpeech = (formData.get('SpeechResult') as string) || (formData.get('speech') as string) || '';
    }

    const result = await handleVoiceCallWebhook({
      eventType,
      spokenSpeech,
    });

    // Return TwiML XML response if called from Twilio, or JSON if called from client/SDK
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">${result.spokenResponse}</Say></Response>`;
      return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error in voice webhook:', err);
    return NextResponse.json({ error: err.message || 'Voice webhook failed' }, { status: 500 });
  }
}
