import { prisma } from './prisma';
import { revokeSession, approveLoginAttempt } from './security';
import { isAllowedEmail, normalizeEmail } from './auth';
import {
  sendTelegramMessage,
  answerTelegramCallbackQuery,
  editTelegramMessageText,
} from './telegram';
import { resolveAccountabilityByMessage } from './accountabilityRecheck';
import {
  getTodaySummary,
  getProgressSummary,
  getWorkoutSummary,
  getPlanSummary,
  getMissedSummary,
  getReportSummary,
  getNutritionSummary,
  getCalendarSummary,
  getPhysiqueSummary,
  getNowSummary,
  completeTaskFromTelegram,
} from './telegramCommands';
import {
  acknowledgeSleep,
  snoozeSleep,
  getSleepAccountabilityStatus,
} from './sleepAccountability';

export const AUTHORIZED_PHONE = '+251977409986';

export function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, '');
}

export function isAuthorizedPhone(phone: string): boolean {
  const norm = normalizePhone(phone);
  return norm.endsWith('977409986');
}

export async function handleTelegramWebhookUpdate(update: any): Promise<void> {
  // 1. Handle Inline Keyboard Callbacks
  if (update.callback_query) {
    const cq = update.callback_query;
    const callbackId = cq.id;
    const data = cq.data || '';
    const chatId = cq.message?.chat?.id;
    const messageId = cq.message?.message_id;

    if (data.startsWith('sleep_ack_')) {
      try {
        const res = await acknowledgeSleep('TELEGRAM');
        await answerTelegramCallbackQuery(callbackId, '✅ Sleep acknowledged. Good night, Mikiyas!');
        if (chatId && messageId) {
          await editTelegramMessageText(chatId, messageId, `✅ Sleep Acknowledged\n\nGood night, Mikiyas! Rest deeply for an energized 11:00 AM wake-up tomorrow.`);
        }
      } catch (err: any) {
        await answerTelegramCallbackQuery(callbackId, 'Error acknowledging sleep.');
        console.error('Telegram sleep ack error:', err);
      }
      return;
    }

    if (data.startsWith('sleep_snooze_')) {
      try {
        const res = await snoozeSleep(5);
        await answerTelegramCallbackQuery(callbackId, res.message, !res.success);
        if (res.success && chatId && messageId) {
          await editTelegramMessageText(chatId, messageId, `⏰ Sleep Reminder Snoozed (5 mins)\n\n${res.message}`);
        }
      } catch (err: any) {
        await answerTelegramCallbackQuery(callbackId, 'Error snoozing sleep.');
        console.error('Telegram sleep snooze error:', err);
      }
      return;
    }

    if (data.startsWith('comp_task_')) {
      const taskId = data.replace(/^comp_task_/, '');
      try {
        const res = await completeTaskFromTelegram(taskId);
        await answerTelegramCallbackQuery(callbackId, res.success ? '✅ Task marked complete in Forge!' : res.message, !res.success);
        if (res.success && chatId && messageId) {
          await editTelegramMessageText(chatId, messageId, `✅ Marked Complete!\n\n${res.message}`);
        }
      } catch (err: any) {
        await answerTelegramCallbackQuery(callbackId, 'Error completing task.');
        console.error('Telegram task completion error:', err);
      }
      return;
    }

    if (data.startsWith('term_') || data.startsWith('auth_')) {
      const sessionToken = data.replace(/^(term|auth)_/, '');
      try {
        // Resolve the session so we act on the correct owning account only.
        const dbSession = await prisma.userSession.findUnique({
          where: { sessionToken },
        });

        if (!dbSession) {
          await answerTelegramCallbackQuery(callbackId, 'Session not found.');
          return;
        }

        if (data.startsWith('term_')) {
          const result = await revokeSession({
            ownerUserId: dbSession.userId,
            actorId: dbSession.userId,
            target: dbSession.sessionToken,
            currentSessionId: dbSession.sessionToken,
            allowSelfTerminate: true,
          });
          if (result.ok) {
            await answerTelegramCallbackQuery(callbackId, 'Session successfully terminated.');
            if (chatId && messageId) {
              await editTelegramMessageText(chatId, messageId, '🛑 Session terminated immediately upon your request.');
            }
          } else {
            await answerTelegramCallbackQuery(callbackId, 'Could not terminate session.');
          }
        } else {
          // ALLOW: approve the matching login attempt. A revoked attempt is
          // permanently blocked by approveLoginAttempt.
          const attempt = await prisma.loginActivity.findFirst({
            where: { sessionId: dbSession.sessionToken, userId: dbSession.userId },
          });
          if (attempt) {
            const result = await approveLoginAttempt({
              ownerUserId: dbSession.userId,
              actorId: dbSession.userId,
              targetId: attempt.id,
            });
            if (result.ok) {
              await answerTelegramCallbackQuery(callbackId, 'Login approved.');
            } else if (result.error === 'ALREADY_TERMINATED') {
              await answerTelegramCallbackQuery(callbackId, 'Already terminated - cannot approve.');
            } else {
              await answerTelegramCallbackQuery(callbackId, 'Could not approve.');
            }
          } else {
            await answerTelegramCallbackQuery(callbackId, 'Login approved.');
          }
        }
      } catch (err: any) {
        await answerTelegramCallbackQuery(callbackId, 'Error processing request.');
        console.error('Telegram security callback error:', err);
      }
      return;
    }
  }

  const message = update.message;
  if (!message) return;

  const chatId = String(message.chat.id);
  const telegramId = String(message.from.id);
  const username = message.from.username || null;
  const text = (message.text || '').trim();

  // 2. Check if user is already verified
  const linkedAccount = await prisma.telegramAccount.findUnique({
    where: { telegramId },
  });

  if (linkedAccount && linkedAccount.active) {
    // 2a. Handle explicit accountability acknowledgement (spec section 5/7).
    // Command messages (starting with "/") are never acknowledgement text.
    if (!text.startsWith('/')) {
      const ack = await resolveAccountabilityByMessage(text);
      if (ack.found) return;
    }

    // Verified user commands
    const cmd = text.split(' ')[0].toLowerCase();

    if (cmd === '/start' || cmd === '/help') {
      const helpMsg = `🛡️ FORGE TELEGRAM COMMANDS:

/now — What should I do right now? (Current activity, remaining time, next session)
/sleep — Acknowledge sleep or check sleep accountability status
/today — Full daily overview (workout, tasks, focus, score)
/plan — Today's AI-generated daily schedule & time targets
/complete [task] — Mark an activity complete in Forge (e.g. /complete chemistry)
/workout — Detailed workout tracker, phase, exercises & next unlock
/progress — Real-time progress engine metrics, XP, streak & level
/missed — Incomplete tasks, pending habits & learning gaps
/report — Daily performance analysis & monthly summary
/nutrition — Daily calories, protein intake & meal logs
/calendar — 7-day consistency calendar with colors
/physique — 7-month upper body progression & 5-pose stand instructions
/resetpassword — Generate an instant secure password reset link`;
      await sendTelegramMessage(chatId, helpMsg);
      return;
    }

    if (cmd === '/sleep') {
      const status = await getSleepAccountabilityStatus();
      if (!status.isSleepWindow) {
        await sendTelegramMessage(
          chatId,
          `🌙 FORGE SLEEP TARGET SCHEDULE:\n• Wind-down: 09:30 PM (ከሌሊቱ 3:30)\n• Target Sleep: 11:00 PM (ከሌሊቱ 5:00)\n• Target Wake-up: 11:00 AM (ከረፋዱ 5:00)\n\nPersistent sleep reminders activate at 11:00 PM.`
        );
        return;
      }
      if (status.isAcknowledged) {
        await sendTelegramMessage(chatId, `✅ Sleep already acknowledged for tonight! Rest deeply, Mikiyas.`);
        return;
      }
      await acknowledgeSleep('TELEGRAM');
      await sendTelegramMessage(chatId, `✅ Sleep acknowledged. Good night, Mikiyas! Rest well.`);
      return;
    }

    if (cmd === '/now' || cmd === '/current' || cmd === '/coach' || cmd === '/whatnext') {
      const { text: nowMsg, activeTaskId, activeTaskTitle } = await getNowSummary();
      const markup = activeTaskId
        ? {
            inline_keyboard: [
              [
                {
                  text: `✅ Mark "${activeTaskTitle || 'Task'}" Complete`,
                  callback_data: `comp_task_${activeTaskId}`,
                },
              ],
            ],
          }
        : undefined;
      await sendTelegramMessage(chatId, nowMsg, { reply_markup: markup });
      return;
    }

    if (cmd === '/complete' || cmd === '/done') {
      const query = text.substring(cmd.length).trim();
      const res = await completeTaskFromTelegram(query);
      await sendTelegramMessage(chatId, res.message);
      return;
    }

    if (cmd === '/today') {
      const msg = await getTodaySummary();
      await sendTelegramMessage(chatId, msg);
      return;
    }

    if (cmd === '/workout') {
      const msg = await getWorkoutSummary();
      await sendTelegramMessage(chatId, msg);
      return;
    }

    if (cmd === '/progress') {
      const msg = await getProgressSummary();
      await sendTelegramMessage(chatId, msg);
      return;
    }

    if (cmd === '/plan') {
      const msg = await getPlanSummary();
      await sendTelegramMessage(chatId, msg);
      return;
    }

    if (cmd === '/missed') {
      const msg = await getMissedSummary();
      await sendTelegramMessage(chatId, msg);
      return;
    }

    if (cmd === '/report') {
      const msg = await getReportSummary();
      await sendTelegramMessage(chatId, msg);
      return;
    }

    if (cmd === '/nutrition') {
      const msg = await getNutritionSummary();
      await sendTelegramMessage(chatId, msg);
      return;
    }

    if (cmd === '/calendar') {
      const msg = await getCalendarSummary();
      await sendTelegramMessage(chatId, msg);
      return;
    }

    if (cmd === '/physique') {
      const msg = await getPhysiqueSummary();
      await sendTelegramMessage(chatId, msg);
      return;
    }

    if (cmd === '/resetpassword' || cmd === '/reset') {
      const user = await prisma.user.findUnique({
        where: { id: linkedAccount.userId },
      });

      if (!user) {
        await sendTelegramMessage(chatId, '⚠️ User account not found.');
        return;
      }

      const { createAuthToken } = await import('./auth');
      const rawToken = await createAuthToken(user.id, 'PASSWORD_RESET');
      const baseUrl = (process.env.FORGE_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://forge-app-eight-kappa.vercel.app').replace(/\/$/, '');
      const resetUrl = `${baseUrl}/auth/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

      const resetMsg = `🔑 FORGE PASSWORD RESET

Click the secure link below to set your new password:
${resetUrl}

⏱️ This link is single-use and expires in 1 hour.`;

      await sendTelegramMessage(chatId, resetMsg);
      return;
    }

    // Default unknown command response
    await sendTelegramMessage(
      chatId,
      `Unknown command: ${text}\nType /help to view available commands.`
    );
    return;
  }

  // 3. Unverified User Flow (Phone share + verified email)
  let verif = await prisma.telegramVerification.findUnique({
    where: { chatId },
  });

  if (!verif) {
    verif = await prisma.telegramVerification.create({
      data: {
        chatId,
        telegramId,
        step: 'AWAITING_PHONE',
      },
    });
  }

  // Handle Contact Sharing
  if (message.contact) {
    const rawPhone = message.contact.phone_number;
    if (!isAuthorizedPhone(rawPhone)) {
      await sendTelegramMessage(
        chatId,
        '⛔ Access Denied: This phone number is not authorized for Forge administrative access.'
      );
      return;
    }

    await prisma.telegramVerification.update({
      where: { chatId },
      data: {
        phoneNumber: rawPhone,
        step: 'AWAITING_EMAIL',
      },
    });

    await sendTelegramMessage(
      chatId,
      '✅ Phone verified. Please send your registered Forge email address to link your account.'
    );
    return;
  }

  // Handle Email Input
  if (verif.step === 'AWAITING_EMAIL' || (verif.phoneNumber && !linkedAccount)) {
    const emailCandidate = normalizeEmail(text);
    if (!isAllowedEmail(emailCandidate)) {
      await sendTelegramMessage(
        chatId,
        '⛔ Access Denied: Email address is not authorized.'
      );
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: emailCandidate },
    });

    if (!user || !user.emailVerified) {
      await sendTelegramMessage(
        chatId,
        '⚠️ Your Forge account exists but email is not verified yet. Please verify your email via the link sent to your inbox first.'
      );
      return;
    }

    // Link Telegram Account
    await prisma.telegramAccount.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        telegramId,
        chatId,
        username,
        phoneNumber: verif.phoneNumber || AUTHORIZED_PHONE,
        verifiedAt: new Date(),
        active: true,
      },
      update: {
        telegramId,
        chatId,
        username,
        active: true,
      },
    });

    await prisma.telegramVerification.update({
      where: { chatId },
      data: { step: 'VERIFIED' },
    });

    await sendTelegramMessage(
      chatId,
      `🎉 Forge Telegram Account Linked Successfully!

Welcome, ${user.name || 'Mikiyas'}! You will now receive daily accountability reminders and completion reports directly here.

Type /help to view all available commands.`
    );
    return;
  }

  // Initial prompt
  await sendTelegramMessage(
    chatId,
    '🔒 Forge Security: Please share your contact or send /start to authenticate your Telegram account.',
    {
      reply_markup: {
        keyboard: [[{ text: '📱 Share Contact to Verify', request_contact: true }]],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    }
  );
}
