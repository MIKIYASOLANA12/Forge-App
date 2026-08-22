const TELEGRAM_API_BASE = 'https://api.telegram.org';

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not defined in environment variables');
  }
  return token;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  allowed_updates?: string[];
}

export interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options?: {
    parse_mode?: 'HTML' | 'MarkdownV2' | 'Markdown';
    reply_markup?: any;
  }
): Promise<TelegramApiResponse<any>> {
  const token = getBotToken();
  const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;

  const payload: Record<string, any> = {
    chat_id: chatId,
    text: text,
  };

  if (options?.parse_mode) {
    payload.parse_mode = options.parse_mode;
  }
  if (options?.reply_markup) {
    payload.reply_markup = options.reply_markup;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return res.json();
}

export async function getTelegramMe(): Promise<TelegramApiResponse<TelegramUser>> {
  const token = getBotToken();
  const url = `${TELEGRAM_API_BASE}/bot${token}/getMe`;

  const res = await fetch(url, {
    method: 'GET',
  });

  return res.json();
}

export async function getTelegramWebhookInfo(): Promise<TelegramApiResponse<TelegramWebhookInfo>> {
  const token = getBotToken();
  const url = `${TELEGRAM_API_BASE}/bot${token}/getWebhookInfo`;

  const res = await fetch(url, {
    method: 'GET',
  });

  return res.json();
}

export async function setTelegramWebhook(
  webhookUrl?: string,
  secretToken?: string
): Promise<TelegramApiResponse<boolean>> {
  const token = getBotToken();
  const baseAppUrl = process.env.FORGE_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || '';
  const targetUrl = webhookUrl || (baseAppUrl ? `${baseAppUrl.replace(/\/$/, '')}/api/telegram/webhook` : '');

  if (!targetUrl) {
    throw new Error('FORGE_PUBLIC_URL or NEXT_PUBLIC_APP_URL is required to register webhook');
  }

  const secret = secretToken || process.env.TELEGRAM_WEBHOOK_SECRET;

  const url = `${TELEGRAM_API_BASE}/bot${token}/setWebhook`;
  const body: Record<string, any> = {
    url: targetUrl,
    allowed_updates: ['message', 'callback_query'],
  };

  if (secret) {
    body.secret_token = secret;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return res.json();
}

export async function deleteTelegramWebhook(): Promise<TelegramApiResponse<boolean>> {
  const token = getBotToken();
  const url = `${TELEGRAM_API_BASE}/bot${token}/deleteWebhook`;

  const res = await fetch(url, {
    method: 'POST',
  });

  return res.json();
}
