export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

function getAppBaseUrl(): string {
  return (
    process.env.FORGE_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'FORGE OS <auth@forge.app>',
          to,
          subject,
          html,
          text,
        }),
      });

      if (res.ok) {
        return true;
      }
      console.warn('Resend email API returned error status:', res.status, await res.text());
    } catch (err) {
      console.warn('Failed to send email via Resend:', err);
    }
  }

  console.log(`\n========================================`);
  console.log(`📧 EMAIL DISPATCH`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`----------------------------------------`);
  console.log(text);
  console.log(`========================================\n`);

  return true;
}

export async function sendVerificationEmail(email: string, rawToken: string, name?: string): Promise<boolean> {
  const baseUrl = getAppBaseUrl();
  const verificationUrl = `${baseUrl}/verify-email?token=${rawToken}`;
  const firstName = name?.trim() || 'Mikiyas';

  const subject = 'Verify your Forge account';
  const text = `Hi ${firstName},

You requested access to Forge.

Click the button below to verify your email and activate your account.

${verificationUrl}

This link expires soon and can only be used once.

If you did not request this, you can ignore this email.`;

  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #09090e; color: #f1f5f9; padding: 40px 20px;">
      <div style="max-width: 520px; margin: 0 auto; background-color: #111118; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 32px;">
        <h1 style="color: #f59e0b; margin-top: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px;">FORGE</h1>
        <h2 style="font-size: 18px; margin-bottom: 16px;">Verify your Forge account</h2>
        <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
          Hi ${firstName},<br /><br />
          You requested access to Forge.
        </p>
        <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
          Click the button below to verify your email and activate your account.
        </p>
        <div style="margin: 28px 0;">
          <a href="${verificationUrl}" style="background-color: #f59e0b; color: #000000; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block;">
            Verify my email
          </a>
        </div>
        <p style="color: #475569; font-size: 12px; line-height: 1.5;">
          This link expires soon and can only be used once.<br />
          If you did not request this, you can ignore this email.
        </p>
      </div>
    </div>
  `;

  return sendEmail({ to: email, subject, text, html });
}

export async function sendActivationEmail(email: string, rawToken: string): Promise<boolean> {
  return sendVerificationEmail(email, rawToken, 'Mikiyas');
}

export async function sendPasswordResetEmail(email: string, rawToken: string): Promise<boolean> {
  const baseUrl = getAppBaseUrl();
  const resetUrl = `${baseUrl}/auth/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

  const subject = 'Reset your FORGE password';
  const text = `FORGE Password Reset Request

Click the following link to set a new password:
${resetUrl}

This link is single-use and will expire in 1 hour.

If you did not request a password reset, please ignore this email.`;

  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #09090e; color: #f1f5f9; padding: 40px 20px;">
      <div style="max-width: 500px; margin: 0 auto; background-color: #111118; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 32px;">
        <h1 style="color: #f59e0b; margin-top: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px;">FORGE</h1>
        <h2 style="font-size: 18px; margin-bottom: 16px;">Password Reset Request</h2>
        <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
          We received a request to reset your password. Click the button below to choose a new password.
        </p>
        <div style="margin: 28px 0;">
          <a href="${resetUrl}" style="background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #475569; font-size: 12px; line-height: 1.5;">
          This link is single-use and will expire in 1 hour.<br />
          If you did not request this, your account remains secure and no action is required.
        </p>
      </div>
    </div>
  `;

  return sendEmail({ to: email, subject, text, html });
}
