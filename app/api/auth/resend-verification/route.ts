import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  bootstrapAuthorizedUsers,
  createAuthToken,
  isAllowedEmail,
  normalizeEmail,
} from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ success: true, message: 'If the email is authorized and unverified, a new verification email has been sent.' });
    }

    const normalized = normalizeEmail(email);

    if (isAllowedEmail(normalized)) {
      await bootstrapAuthorizedUsers();

      const user = await prisma.user.findUnique({
        where: { email: normalized },
      });

      if (user && !user.emailVerified) {
        const recentToken = await prisma.authToken.findFirst({
          where: { userId: user.id, type: 'ACTIVATION', usedAt: null },
          orderBy: { createdAt: 'desc' },
        });

        const rateLimitMs = 60 * 1000;
        const now = Date.now();
        const lastSentAt = recentToken ? new Date(recentToken.createdAt).getTime() : 0;

        if (!recentToken || now - lastSentAt > rateLimitMs) {
          const rawToken = await createAuthToken(user.id, 'ACTIVATION');
          await sendVerificationEmail(user.email, rawToken, user.name || undefined);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'If the email is authorized and unverified, a new verification email has been sent.',
    });
  } catch (error: any) {
    console.error('Resend verification error:', error);
    return NextResponse.json({
      success: true,
      message: 'If the email is authorized and unverified, a new verification email has been sent.',
    });
  }
}
