import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

// GET /api/auth/session-stream
// Real-time Server-Sent Events (SSE) stream for instant remote session revocation.
// Pushes a "revoked" event the moment an admin or remote device terminates this session.
export async function GET(req: NextRequest) {
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = await verifySessionToken(sessionCookie);
  if (!payload || !payload.sessionId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const sessionId = payload.sessionId;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const checkInterval = setInterval(async () => {
        if (isClosed) return;
        try {
          const dbSession = await prisma.userSession.findUnique({
            where: { sessionToken: sessionId },
            select: { revoked: true },
          });

          // If session does not exist or has been revoked in DB:
          if (!dbSession || dbSession.revoked) {
            controller.enqueue(
              encoder.encode(`event: session_revoked\ndata: {"status":"REVOKED"}\n\n`)
            );
            clearInterval(checkInterval);
            isClosed = true;
            controller.close();
            return;
          }

          // Heartbeat ping to keep connection open
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          // On DB error, don't crash stream
        }
      }, 1000); // 1-second real-time check

      req.signal.addEventListener('abort', () => {
        isClosed = true;
        clearInterval(checkInterval);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
