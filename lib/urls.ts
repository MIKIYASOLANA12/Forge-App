/**
 * FORGE — PRODUCTION & DEVELOPMENT URL RESOLUTION HELPER
 * Ensures Telegram callbacks, webhooks, password resets, and OAuth redirects
 * always resolve to the correct production Vercel URL in production and localhost in dev.
 */

export function getAppPublicUrl(): string {
  // 1. Explicitly configured public URL (custom domain or Vercel URL)
  if (process.env.FORGE_PUBLIC_URL) {
    return process.env.FORGE_PUBLIC_URL.replace(/\/$/, '');
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }

  // 2. Vercel System Environment Variables (Production & Preview)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/$/, '')}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`;
  }

  // 3. Fallback in production
  if (process.env.NODE_ENV === 'production') {
    return 'https://forge-app-eight-kappa.vercel.app';
  }

  // 4. Default for local development
  return 'http://localhost:3000';
}
