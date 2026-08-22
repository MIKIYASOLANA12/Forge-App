import { prisma } from './prisma';
import { isAllowedEmail, normalizeEmail, hashPassword } from './auth';
import {
  sendTelegramMessage,
  answerTelegramCallbackQuery,
  editTelegramMessageText,
} from './telegram';
import {
  getTodaySummary,
  getProgressSummary,
  getWorkoutSummary,
  getPlanSummary,
  getMissedSummary,
} from './telegramCommands';

export const AUTHORIZED_PHONE = '+251977409986';

export function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, '');
}

export function isAuthorizedPhone(phone: string): boolean {
  const norm = normalizePhone(phone);
  return norm.endsWith('977409986');
}

function generate6DigitOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function handleTelegramWebhookUpdate(update: any): Promise<void> {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Handle Inline Keyboard Callbacks (e.g. Session Termination)
  // ──────────────────────────────────────────────────────────────────────────
  if (update.callback_query) {
    const cq = update.callback_query;
    const callbackId = cq.id;
    const data = cq.data || '';
    const chatId = cq.message?.chat?.id;
    const messageId = cq.message?.message_id;

    if (data.startsWith('term_')) {
      const sessionToken = data.replace('term_', '');
      try {
        await prisma.userSession.updateMany({
          where: { sessionToken },
          data: { revoked: true, revokedAt: new Date() },
        });

        await answerTelegramCallbackQuery(callbackId, '🛑 Web session terminated.', true);

        if (chatId && messageId) {
          await editTelegramMessageText(
            chatId,
            messageId,
            '🛑 <b>SESSION TERMINATED</b>\n\nThis web session has been forcefully closed and revoked.',
            { parse_mode: 'HTML' }
          );
        }
      } catch (err) {
        console.error('Failed to terminate session from Telegram callback:', err);
        await answerTelegramCallbackQuery(callbackId, 'Error terminating session.', true);
      }
      return;
    }

    if (data.startsWith('auth_')) {
      await answerTelegramCallbackQuery(callbackId, '✅ Session confirmed.', false);
      if (chatId && messageId) {
        await editTelegramMessageText(
          chatId,
          messageId,
          '✅ <b>SESSION CONFIRMED</b>\n\nThis web login was acknowledged and approved.',
          { parse_mode: 'HTML' }
        );
      }
      return;
    }

    await answerTelegramCallbackQuery(callbackId);
    return;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Handle Messages (Text, Contact, Commands)
  // ──────────────────────────────────────────────────────────────────────────
  const message = update.message;
  if (!message || !message.chat) return;

  const chatId = String(message.chat.id);
  const telegramId = String(message.from?.id || message.chat.id);
  const username = message.from?.username || message.from?.first_name || 'User';
  const rawText = (message.text || '').trim();
  const contact = message.contact;

  // Check if this Telegram account is already verified in DB
  const linkedAccount = await prisma.telegramAccount.findUnique({
    where: { telegramId },
    include: { user: true },
  });

  // ──────────────────────────────────────────────────────────────────────────
  // A. USER IS ALREADY VERIFIED
  // ──────────────────────────────────────────────────────────────────────────
  if (linkedAccount && linkedAccount.active) {
    const command = rawText.split(' ')[0].toLowerCase().split('@')[0];

    switch (command) {
      case '/start':
      case '/help': {
        const welcome = `⚡ <b>FORGE OS — Connected</b>\n\n` +
          `Welcome back, <b>${linkedAccount.user?.name || username}</b>!\n` +
          `Your Telegram is securely linked to <code>${linkedAccount.user?.email}</code>.\n\n` +
          `<b>Available Commands:</b>\n` +
          `• /today — Today's plan, workouts & completion\n` +
          `• /workout — Current workout program & week\n` +
          `• /progress — Level, XP & domain balance\n` +
          `• /plan — Today's scheduled tasks\n` +
          `• /missed — Missed habits & tasks\n` +
          `• /resetpassword — Reset Forge web password\n` +
          `• /unlink — Disconnect this Telegram account`;
        await sendTelegramMessage(chatId, welcome, { parse_mode: 'HTML' });
        return;
      }

      case '/today': {
        const reply = await getTodaySummary();
        await sendTelegramMessage(chatId, reply);
        return;
      }

      case '/progress': {
        const reply = await getProgressSummary();
        await sendTelegramMessage(chatId, reply);
        return;
      }

      case '/workout': {
        const reply = await getWorkoutSummary();
        await sendTelegramMessage(chatId, reply);
        return;
      }

      case '/plan': {
        const reply = await getPlanSummary();
        await sendTelegramMessage(chatId, reply);
        return;
      }

      case '/missed': {
        const reply = await getMissedSummary();
        await sendTelegramMessage(chatId, reply);
        return;
      }

      case '/resetpassword': {
        const parts = rawText.split(' ');
        if (parts.length < 2 || !parts[1].trim()) {
          await sendTelegramMessage(
            chatId,
            `🔑 <b>Reset Web Password</b>\n\n` +
            `To set a new password for your web dashboard, send:\n` +
            `<code>/resetpassword YourNewPassword123!</code>\n\n` +
            `<i>Must be at least 8 characters.</i>`,
            { parse_mode: 'HTML' }
          );
          return;
        }

        const newPassword = parts.slice(1).join(' ').trim();
        if (newPassword.length < 8) {
          await sendTelegramMessage(
            chatId,
            `❌ Password must be at least 8 characters long.`,
            { parse_mode: 'HTML' }
          );
          return;
        }

        const newHash = await hashPassword(newPassword);
        await prisma.user.update({
          where: { id: linkedAccount.userId },
          data: { passwordHash: newHash },
        });

        await sendTelegramMessage(
          chatId,
          `✅ <b>Password Reset Successfully!</b>\n\n` +
          `Your Forge web password has been updated. You can now log into the web dashboard with your new password.`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      case '/unlink': {
        await prisma.telegramAccount.delete({
          where: { telegramId },
        });
        await prisma.telegramVerification.deleteMany({
          where: { chatId },
        });
        await sendTelegramMessage(
          chatId,
          `🔓 <b>Telegram Disconnected</b>\n\n` +
          `Your Telegram account has been unlinked from FORGE. Send /start anytime to re-verify.`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      default: {
        await sendTelegramMessage(
          chatId,
          `⚡ Command not recognized. Send /help or /today to see your dashboard.`,
          { parse_mode: 'HTML' }
        );
        return;
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // B. USER IS NOT VERIFIED (Multi-Step Identity Verification Flow)
  // ──────────────────────────────────────────────────────────────────────────

  let session = await prisma.telegramVerification.findUnique({
    where: { chatId },
  });

  // If user sends /start, /reset, or session doesn't exist: restart from Step 1 (Phone)
  if (!session || rawText === '/start' || rawText === '/reset') {
    session = await prisma.telegramVerification.upsert({
      where: { chatId },
      create: {
        chatId,
        telegramId,
        step: 'AWAITING_PHONE',
        attempts: 0,
      },
      update: {
        telegramId,
        step: 'AWAITING_PHONE',
        phoneNumber: null,
        email: null,
        otpCode: null,
        otpExpiresAt: null,
        attempts: 0,
      },
    });

    const promptText =
      `🔒 <b>FORGE IDENTITY VERIFICATION</b>\n\n` +
      `Welcome to <b>FORGE OS</b>.\n` +
      `To protect your personal growth data, you must verify your identity before accessing any bot features.\n\n` +
      `👉 <b>Step 1 of 3:</b> Please share your <b>Phone Number</b> by tapping the button below or typing it directly.`;

    await sendTelegramMessage(chatId, promptText, {
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: [
          [
            {
              text: '📱 Share Phone Number',
              request_contact: true,
            },
          ],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
    return;
  }

  // ── Step 1: Process Phone Number ──────────────────────────────────────────
  if (session.step === 'AWAITING_PHONE') {
    let phone = '';
    if (contact && contact.phone_number) {
      phone = contact.phone_number;
    } else if (rawText) {
      phone = rawText.replace(/[^\d+]/g, '');
    }

    if (!phone || !isAuthorizedPhone(phone)) {
      await sendTelegramMessage(
        chatId,
        `❌ <b>Unauthorized Phone Number</b>\n\n` +
        `The phone number <code>${phone || 'Unknown'}</code> is not authorized for FORGE.\n` +
        `Only the administrator phone (<code>+251 977409986</code>) is permitted to access the system.\n\n` +
        `Please tap <b>📱 Share Phone Number</b> or enter the authorized phone number:`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            keyboard: [[{ text: '📱 Share Phone Number', request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
      return;
    }

    // Save phone and advance to Step 2 (Email)
    await prisma.telegramVerification.update({
      where: { chatId },
      data: {
        phoneNumber: phone,
        step: 'AWAITING_EMAIL',
      },
    });

    await sendTelegramMessage(
      chatId,
      `✅ <b>Phone Authorized:</b> <code>${phone}</code>\n\n` +
      `👉 <b>Step 2 of 3:</b> Select or enter your <b>Authorized Email Address</b> to link:`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [
            [{ text: 'mikiyasolana382@gmail.com' }],
            [{ text: 'mikiyasolana87@gmail.com' }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }
    );
    return;
  }

  // ── Step 2: Process Email Address ─────────────────────────────────────────
  if (session.step === 'AWAITING_EMAIL') {
    const email = normalizeEmail(rawText);

    if (!isAllowedEmail(email)) {
      await sendTelegramMessage(
        chatId,
        `❌ <b>Unauthorized Email</b>\n\n` +
        `<code>${rawText}</code> is not in the FORGE authorized allowlist.\n\n` +
        `Please enter an authorized email address (or send /start to restart):`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Generate 6-Digit OTP Code
    const otp = generate6DigitOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.telegramVerification.update({
      where: { chatId },
      data: {
        email,
        otpCode: otp,
        otpExpiresAt: expiresAt,
        step: 'AWAITING_OTP',
        attempts: 0,
      },
    });

    await sendTelegramMessage(
      chatId,
      `🔑 <b>SECURITY OTP CODE GENERATED</b>\n\n` +
      `Your 6-digit Forge Verification OTP is:\n\n` +
      `👉 <code>${otp}</code> 👈\n\n` +
      `<i>(Valid for 10 minutes)</i>\n\n` +
      `👉 <b>Step 3 of 3:</b> Please type and send this <b>6-digit code</b> below to verify:`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // ── Step 3: Process OTP Verification ──────────────────────────────────────
  if (session.step === 'AWAITING_OTP') {
    const inputOtp = rawText.replace(/\s+/g, '');

    // Check expiration
    if (!session.otpExpiresAt || new Date() > session.otpExpiresAt) {
      await sendTelegramMessage(
        chatId,
        `⌛ <b>OTP Code Expired</b>\n\nPlease send /start to restart the verification process.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    if (inputOtp !== session.otpCode) {
      const nextAttempts = session.attempts + 1;
      if (nextAttempts >= 5) {
        await prisma.telegramVerification.update({
          where: { chatId },
          data: { step: 'AWAITING_PHONE', attempts: 0 },
        });
        await sendTelegramMessage(
          chatId,
          `❌ <b>Too many incorrect attempts.</b>\nPlease send /start to begin verification again.`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      await prisma.telegramVerification.update({
        where: { chatId },
        data: { attempts: nextAttempts },
      });

      await sendTelegramMessage(
        chatId,
        `❌ <b>Incorrect OTP code.</b>\nPlease enter the correct 6-digit code (or send /start to restart):`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // OTP IS VALID! Link account to Forge user
    const targetEmail = session.email!;
    let user = await prisma.user.findUnique({
      where: { email: targetEmail },
    });

    if (!user) {
      const defaultPassword = process.env.FORGE_INITIAL_PASSWORD || 'ForgeInitialPass2026!';
      const passwordHash = await hashPassword(defaultPassword);
      user = await prisma.user.create({
        data: {
          email: targetEmail,
          name: 'Mikiyas Olana',
          passwordHash,
          emailVerified: true,
        },
      });
    }

    // Link Telegram Account in Prisma
    await prisma.telegramAccount.upsert({
      where: { telegramId },
      create: {
        userId: user.id,
        telegramId,
        chatId,
        username,
        phoneNumber: session.phoneNumber,
        verifiedAt: new Date(),
        active: true,
      },
      update: {
        userId: user.id,
        chatId,
        username,
        phoneNumber: session.phoneNumber,
        verifiedAt: new Date(),
        active: true,
      },
    });

    // Mark session as verified
    await prisma.telegramVerification.update({
      where: { chatId },
      data: { step: 'VERIFIED' },
    });

    const successMessage =
      `🎉 <b>IDENTITY VERIFIED & FORGE UNLOCKED!</b>\n\n` +
      `Welcome, <b>${user.name || 'Mikiyas'}</b>!\n` +
      `Your Telegram account is now securely linked to <code>${user.email}</code>.\n\n` +
      `<b>Available Commands:</b>\n` +
      `• /today — Today's plan, workouts & completion\n` +
      `• /workout — Current workout program & week\n` +
      `• /progress — Level, XP & domain balance\n` +
      `• /plan — Today's scheduled tasks\n` +
      `• /missed — Missed habits & tasks\n` +
      `• /resetpassword — Reset Forge web password\n\n` +
      `🔔 <b>Security Alerts Active:</b> Whenever you sign in on the web, you will receive an instant login notification here with location/device details and one-tap session termination.`;

    await sendTelegramMessage(chatId, successMessage, { parse_mode: 'HTML' });
  }
}
