import * as fs from 'fs';
import * as path from 'path';

// Automatically load .env.local or .env if env vars are missing
function loadLocalEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          // Remove enclosing quotes if present
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadLocalEnv();

import {
  getTelegramMe,
  getTelegramWebhookInfo,
  setTelegramWebhook,
  deleteTelegramWebhook,
} from '../lib/telegram';

async function main() {
  const command = process.argv[2] || 'set';

  console.log(`\n========================================`);
  console.log(`FORGE TELEGRAM WEBHOOK UTILITY`);
  console.log(`========================================\n`);

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('❌ Error: TELEGRAM_BOT_TOKEN is not set in environment or .env.local');
    process.exit(1);
  }

  try {
    // 1. Verify Bot
    console.log('🤖 Verifying Bot identity with Telegram...');
    const meRes = await getTelegramMe();
    if (!meRes.ok || !meRes.result) {
      console.error('❌ Failed to get bot info from Telegram:', meRes.description);
      process.exit(1);
    }
    console.log(`✅ Bot verified: @${meRes.result.username || 'unknown'} (${meRes.result.first_name})`);

    if (command === 'info' || command === 'status') {
      const info = await getTelegramWebhookInfo();
      console.log('\n--- Current Webhook Info ---');
      console.log(JSON.stringify(info.result, null, 2));
      return;
    }

    if (command === 'delete') {
      console.log('\n🗑️  Deleting webhook...');
      const del = await deleteTelegramWebhook();
      console.log('Result:', del);
      return;
    }

    // Default: 'set'
    const baseUrl =
      process.env.FORGE_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.argv[3];

    if (!baseUrl) {
      console.error(
        '❌ Error: FORGE_PUBLIC_URL or NEXT_PUBLIC_APP_URL must be defined to set the webhook.\nExample: FORGE_PUBLIC_URL=https://your-forge-app.vercel.app npm run telegram:webhook'
      );
      process.exit(1);
    }

    const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/telegram/webhook`;
    console.log(`\n🔗 Registering webhook to: ${webhookUrl}`);
    if (process.env.TELEGRAM_WEBHOOK_SECRET) {
      console.log('🔒 Secret token: [Configured]');
    } else {
      console.log('⚠️ Secret token: [Not set - optional but recommended]');
    }

    const result = await setTelegramWebhook(webhookUrl);
    if (result.ok) {
      console.log('✅ Webhook successfully registered with Telegram!');
    } else {
      console.error('❌ Webhook registration failed:', result.description);
    }

    console.log('\n--- Current Webhook Status ---');
    const info = await getTelegramWebhookInfo();
    console.log(JSON.stringify(info.result, null, 2));
  } catch (err: any) {
    console.error('❌ Execution error:', err?.message || err);
    process.exit(1);
  }
}

main();
