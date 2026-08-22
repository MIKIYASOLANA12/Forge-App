import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  verifyAndConsumeAuthToken,
  createSessionToken,
  SESSION_COOKIE_NAME,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const user = await verifyAndConsumeAuthToken(token, 'ACTIVATION');
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired activation link. Please log in to request a new link.' },
        { status: 400 }
      );
    }

    // Activate the user in the database
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    // Create session and set cookie
    const sessionToken = await createSessionToken(user.id, user.email, user.name || undefined);

    const response = NextResponse.json({
      success: true,
      message: 'Account successfully activated.',
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
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    console.error('Activation verification error:', error);
    return NextResponse.json({ error: 'Failed to verify activation token.' }, { status: 500 });
  }
}
