export const SESSION_COOKIE_NAME = 'forge_session';

export interface SessionPayload {
  userId: string;
  email: string;
  name?: string;
  sessionId?: string;
  exp: number; // Unix epoch seconds
}

function getAuthSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'forge_jwt_fallback_secret_key_2026_growth_os'
  );
}

// ── Web Crypto (Edge & Node Compatible) HMAC-SHA256 ───────────────────────────

async function getCryptoKey(secret: string): Promise<any> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64UrlEncode(binary);
}

function base64UrlToUint8Array(str: string): Uint8Array {
  const binary = base64UrlDecode(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function createSessionToken(
  userId: string,
  email: string,
  name?: string,
  sessionId?: string
): Promise<string> {
  const secret = getAuthSecret();
  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days
  const payload: SessionPayload = {
    userId,
    email: email.trim().toLowerCase(),
    name: name || 'Mikiyas Olana',
    sessionId,
    exp,
  };

  const payloadStr = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(payloadStr);

  const key = await getCryptoKey(secret);
  const enc = new TextEncoder();
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
  const signature = bufferToBase64Url(sigBuffer);

  return `${payloadB64}.${signature}`;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;

    const secret = getAuthSecret();
    const key = await getCryptoKey(secret);
    const enc = new TextEncoder();

    const sigBytes = base64UrlToUint8Array(signature);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes as unknown as BufferSource,
      enc.encode(payloadB64)
    );

    if (!valid) return null;

    const payloadJson = base64UrlDecode(payloadB64);
    const payload: SessionPayload = JSON.parse(payloadJson);

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
