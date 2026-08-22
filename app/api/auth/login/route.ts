import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  isAllowedEmail,
  normalizeEmail,
  verifyPassword,
  createSessionToken,
  createAuthToken,
  SESSION_COOKIE_NAME,
  bootstrapAuthorizedUsers,
} from '@/lib/auth';
import { sendActivationEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const normalized = normalizeEmail(email);

    // 1. Strict Server-Side Allowlist
    if (!isAllowedEmail(normalized)) {
      return NextResponse.json(
        { error: 'Access denied. This email is not authorized for FORGE.' },
        { status: 403 }
      );
    }

    // Ensure database users are initialized if this is first run
    await bootstrapAuthorizedUsers();

    // 2. Fetch User Record
    const user = await prisma.user.findUnique({
      where: { email: normalized },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // 3. Verify Password
    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // 4. Ensure email is marked verified on successful login
    if (!user.emailVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    // 5. Establish Authenticated Session
    const sessionToken = await createSessionToken(user.id, user.email, user.name || undefined);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'An unexpected authentication error occurred.' }, { status: 500 });
  }
}
