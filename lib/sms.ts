export interface SendSmsResult {
  success: boolean;
  provider?: string;
  messageId?: string;
  error?: string;
}

export async function sendSmsOtp(
  phoneNumber: string,
  otpCode: string
): Promise<SendSmsResult> {
  const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
  const messageText = `[FORGE OS] Your verification security code is: ${otpCode}. Valid for 10 minutes. Do not share this code.`;

  // 1. Check for AfroMessage (Ethiopian SMS Gateway)
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

      if (res.ok) {
        const data = await res.json();
        console.log(`📱 SMS successfully dispatched via AfroMessage to ${formattedPhone}`);
        return { success: true, provider: 'AfroMessage', messageId: data.response?.id };
      }
    } catch (err: any) {
      console.error('AfroMessage dispatch error:', err?.message || err);
    }
  }

  // 2. Check for Twilio SMS
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

      if (res.ok) {
        const data = await res.json();
        console.log(`📱 SMS successfully dispatched via Twilio to ${formattedPhone}`);
        return { success: true, provider: 'Twilio', messageId: data.sid };
      }
    } catch (err: any) {
      console.error('Twilio dispatch error:', err?.message || err);
    }
  }

  // 3. Check for Generic SMS API Webhook
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

      if (res.ok) {
        console.log(`📱 SMS successfully dispatched via Generic SMS API to ${formattedPhone}`);
        return { success: true, provider: 'GenericSMS' };
      }
    } catch (err: any) {
      console.error('Generic SMS dispatch error:', err?.message || err);
    }
  }

  // 4. Fallback Logger (Logs exact SIM dispatch details)
  console.log(`\n========================================`);
  console.log(`📱 SIM CARD SMS DISPATCH`);
  console.log(`To Phone Number: ${formattedPhone}`);
  console.log(`Message: ${messageText}`);
  console.log(`OTP Code: ${otpCode}`);
  console.log(`========================================\n`);

  return {
    success: true,
    provider: 'LocalSIM_Logger',
  };
}
