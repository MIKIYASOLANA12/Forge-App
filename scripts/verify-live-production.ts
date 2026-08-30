import { getTelegramWebhookInfo, setTelegramWebhook } from '../lib/telegram';

async function verifyLive() {
  console.log('====================================================');
  console.log('🌐 VERIFYING LIVE PRODUCTION DEPLOYMENT');
  console.log('====================================================\n');

  const prodUrl = 'https://forge-app-eight-kappa.vercel.app';

  // 1. Check HTTP response from Live App
  try {
    const res = await fetch(prodUrl, { method: 'GET' });
    console.log(`[1] Production Homepage (${prodUrl}): Status ${res.status} ${res.statusText}`);
  } catch (err: any) {
    console.error('[1] Failed to fetch production homepage:', err.message);
  }

  // 2. Check Telegram Webhook Configuration
  try {
    const hookInfo = await getTelegramWebhookInfo();
    console.log('\n[2] Telegram Bot Webhook Info:');
    console.log(`    Webhook URL: ${hookInfo.result?.url || 'None'}`);
    console.log(`    Pending update count: ${hookInfo.result?.pending_update_count ?? 0}`);
    console.log(`    Last error: ${hookInfo.result?.last_error_message || 'None'}`);

    const expectedWebhook = `${prodUrl}/api/telegram/webhook`;
    if (hookInfo.result?.url !== expectedWebhook) {
      console.log(`\n[3] Updating Telegram Webhook to Production URL: ${expectedWebhook}...`);
      const setRes = await setTelegramWebhook(expectedWebhook);
      console.log(`    Webhook update result: ${setRes.ok ? 'SUCCESS' : 'FAILED'} (${setRes.description || ''})`);
    } else {
      console.log(`\n[3] Telegram Webhook is correctly registered to production URL: ${expectedWebhook}`);
    }
  } catch (err: any) {
    console.error('[2] Failed to verify/update Telegram webhook:', err.message);
  }

  console.log('\n====================================================');
  console.log('🏁 LIVE PRODUCTION VERIFICATION COMPLETE');
  console.log('====================================================');
}

verifyLive();
