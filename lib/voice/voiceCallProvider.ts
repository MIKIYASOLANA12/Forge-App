import { VoiceCallProvider, VoiceEventType } from './types';

export class TwilioVoiceProvider implements VoiceCallProvider {
  name = 'TwilioVoiceProvider';
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '+10000000000';
  }

  async placeCall(params: {
    to: string;
    from?: string;
    promptText: string;
    expectedEventType: VoiceEventType;
    callbackUrl: string;
  }): Promise<{ success: boolean; callSid?: string; error?: string }> {
    if (!this.accountSid || !this.authToken) {
      console.warn('[TwilioVoiceProvider] Twilio credentials not configured, falling back to mock.');
      return new MockVoiceProvider().placeCall(params);
    }

    try {
      // Build Twiml URL or pass TwiML instructions
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls.json`;
      const from = params.from || this.fromNumber;
      
      const twiml = `<Response><Say voice="alice">${escapeXml(params.promptText)}</Say><Gather input="speech" timeout="5" action="${params.callbackUrl}"><Say>Please speak now.</Say></Gather></Response>`;

      const body = new URLSearchParams();
      body.append('To', params.to);
      body.append('From', from);
      body.append('Twiml', twiml);

      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const resJson = await response.json();
      if (response.ok && resJson.sid) {
        return { success: true, callSid: resJson.sid };
      } else {
        return { success: false, error: resJson.message || 'Twilio call failed' };
      }
    } catch (err: any) {
      console.error('[TwilioVoiceProvider] Call dispatch error:', err);
      return { success: false, error: err.message || 'Twilio network error' };
    }
  }
}

export class MockVoiceProvider implements VoiceCallProvider {
  name = 'MockVoiceProvider';

  async placeCall(params: {
    to: string;
    from?: string;
    promptText: string;
    expectedEventType: VoiceEventType;
    callbackUrl: string;
  }): Promise<{ success: boolean; callSid?: string; error?: string }> {
    const mockSid = `mock_call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[MockVoiceProvider] Dispatched mock voice call to ${params.to}: "${params.promptText}" (SID: ${mockSid})`);
    return { success: true, callSid: mockSid };
  }
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export function getVoiceProvider(): VoiceCallProvider {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    return new TwilioVoiceProvider();
  }
  return new MockVoiceProvider();
}
