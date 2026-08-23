export interface SendSmsResult {
  success: boolean;
  provider?: string;
  messageId?: string;
  error?: string;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '***';

  if (digits.startsWith('251')) {
    return `+251${'*'.repeat(Math.max(digits.length - 3, 3))}`;
  }

  return `+${'*'.repeat(Math.max(digits.length, 3))}`;
}

function sanitizeProviderResponse(raw: string | null): string {
  if (!raw) return 'No provider response body.';

  const compact = raw.replace(/\s+/g, ' ').trim();

  try {
    const parsed = JSON.parse(compact);
    const errors = parsed?.response?.errors;
    if (Array.isArray(errors) && errors.length) {
      return String(errors[0]);
    }
    if (parsed?.response?.message) return String(parsed.response.message);
    if (parsed?.message) return String(parsed.message);
    if (parsed?.error) return String(parsed.error);
    if (typeof parsed?.acknowledge === 'string') {
      return String(parsed.acknowledge);
    }
  } catch {
    // Fall through to simple text sanitization.
  }

  return compact.length > 200 ? `${compact.slice(0, 197)}...` : compact;
}

export async function sendSmsOtp(
  phoneNumber: string,
  otpCode: string,
  options?: { rawFormatType?: 'Telegram contact' | 'typed input' }
): Promise<SendSmsResult> {
  const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
  const messageText = `[FORGE OS] Your verification security code is: ${otpCode}. Valid for 10 minutes. Do not share this code.`;
  const rawFormatType = options?.rawFormatType || 'typed input';
  const safePhone = maskPhone(formattedPhone);

  const logDiagnostic = (
    provider: string,
    requestAttempted: boolean,
    httpStatus: number | null,
    providerResponse: string | null
  ) => {
    console.warn('[SMS diagnostic]', {
      rawFormatType,
      normalizedPhone: safePhone,
      provider,
      requestAttempted,
      httpStatus,
      providerResponse: providerResponse ? providerResponse.slice(0, 200) : null,
    });
  };

  const afroKey = process.env.AFROMESSAGE_API_KEY;
  if (afroKey) {
    try {
      const res = await fetch('https://api.afromessage.com/api/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${afroKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: formattedPhone,
          message: messageText,
          sender: process.env.AFROMESSAGE_SENDER_ID || 'FORGE',
        }),
      });

      const bodyText = await res.text();
      const parsedBody = bodyText ? JSON.parse(bodyText) : {};
      const sanitizedResponse = sanitizeProviderResponse(bodyText);
      logDiagnostic('AfroMessage', true, res.status, sanitizedResponse);

      const providerRejected = parsedBody?.acknowledge === 'error' || (Array.isArray(parsedBody?.response?.errors) && parsedBody.response.errors.length > 0);
      if (providerRejected) {
        return { success: false, provider: 'AfroMessage', error: sanitizedResponse };
      }

      if (res.ok) {
        const data = parsedBody;
        console.log('📱 SMS successfully dispatched via AfroMessage');
        return { success: true, provider: 'AfroMessage', messageId: data.response?.id };
      }

      return { success: false, provider: 'AfroMessage', error: sanitizedResponse };
    } catch (err: any) {
      const errorText = err?.message || 'Unknown AfroMessage request error';
      logDiagnostic('AfroMessage', true, null, errorText);
      return { success: false, provider: 'AfroMessage', error: errorText };
    }
  }

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

  if (twilioSid && twilioAuth && twilioFrom) {
    try {
      const authHeader = `Basic ${Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64')}`;
      const params = new URLSearchParams();
      params.append('To', formattedPhone);
      params.append('From', twilioFrom);
      params.append('Body', messageText);

      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        }
      );

      const bodyText = await res.text();
      const sanitizedResponse = sanitizeProviderResponse(bodyText);
      logDiagnostic('Twilio', true, res.status, sanitizedResponse);

      if (res.ok) {
        const data = JSON.parse(bodyText || '{}');
        console.log('📱 SMS successfully dispatched via Twilio');
        return { success: true, provider: 'Twilio', messageId: data.sid };
      }

      return { success: false, provider: 'Twilio', error: sanitizedResponse };
    } catch (err: any) {
      const errorText = err?.message || 'Unknown Twilio request error';
      logDiagnostic('Twilio', true, null, errorText);
      return { success: false, provider: 'Twilio', error: errorText };
    }
  }

  const genericSmsUrl = process.env.SMS_API_URL;
  const genericSmsKey = process.env.SMS_API_KEY;

  if (genericSmsUrl) {
    try {
      const res = await fetch(genericSmsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(genericSmsKey ? { Authorization: `Bearer ${genericSmsKey}` } : {}),
        },
        body: JSON.stringify({
          to: formattedPhone,
          text: messageText,
          code: otpCode,
        }),
      });

      const bodyText = await res.text();
      const sanitizedResponse = sanitizeProviderResponse(bodyText);
      logDiagnostic('GenericSMS', true, res.status, sanitizedResponse);

      if (res.ok) {
        console.log('📱 SMS successfully dispatched via Generic SMS API');
        return { success: true, provider: 'GenericSMS' };
      }

      return { success: false, provider: 'GenericSMS', error: sanitizedResponse };
    } catch (err: any) {
      const errorText = err?.message || 'Unknown Generic SMS request error';
      logDiagnostic('GenericSMS', true, null, errorText);
      return { success: false, provider: 'GenericSMS', error: errorText };
    }
  }

  logDiagnostic('LocalSIM_Logger', false, null, 'No configured SMS provider - local logger used');

  return {
    success: true,
    provider: 'LocalSIM_Logger',
  };
}
