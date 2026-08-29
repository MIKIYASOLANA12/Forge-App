import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  isAllowedEmail,
  normalizeEmail,
  createAuthToken,
  bootstrapAuthorizedUsers,
} from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalized = normalizeEmail(email);

    // Enumeration safe response: always return success message regardless
    if (isAllowedEmail(normalized)) {
      await bootstrapAuthorizedUsers();

      const user = await prisma.user.findUnique({
        where: { email: normalized },
      });

      if (user) {
        const rawToken = await createAuthToken(user.id, 'PASSWORD_RESET');
        const originUrl = req.headers.get('origin') || req.nextUrl.origin;
        const sent = await sendPasswordResetEmail(user.email, rawToken, originUrl);

        // If the provider rejected the message, surface a failure so callers
        // know the email delivery failed. This avoids returning a misleading
        // success when the external provider (Resend) rejects the request.
        if (!sent) {
          return NextResponse.json({
            success: false,
            message: 'Failed to dispatch password reset email. Please try again later.',
          }, { status: 502 });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'If the email address is authorized, a password reset link has been dispatched.',
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'An error occurred processing your request.' }, { status: 500 });
  }
}
