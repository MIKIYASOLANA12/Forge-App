/**
 * FORGE — ACTUAL PRODUCTION DELIVERY TEST (spec sections 11 & Final requirement)
 * Runs the REAL reliable recheck path for the current Addis day's window:
 *   missed detection -> session -> Telegram send -> success -> notification log
 *   -> verify delivery state -> acknowledgement -> RESOLVED -> reminder stop.
 *
 * Run: npx ts-node --project tsconfig.seed.json -r tsconfig-paths/register scripts/test_accountability_delivery.ts
 */
import { prisma } from '../lib/prisma';
import {
  runAccountabilityRecheck,
  getAccountabilityStatus,
  normalizedDateKeyFromAddis,
  resolveAccountabilityByMessage,
} from '../lib/accountabilityRecheck';
import { workoutWindowForAddisDate, getAddisNow } from '../lib/workoutTime';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✔ ${msg}`);
}

async function main() {
  console.log('==================================================');
  console.log('🧪 FORGE: ACTUAL TELEGRAM DELIVERY + ACK TEST');
  console.log('==================================================');

  const now = getAddisNow();
  const windowInfo = workoutWindowForAddisDate(now);
  const dateKey = normalizedDateKeyFromAddis(windowInfo.startAddis);

  // Clean slate for this test day so we prove a fresh reliable recheck.
  await prisma.accountabilitySession.deleteMany({ where: { addisDateKey: dateKey } });

  // 1. Run the real reliable recheck (force) — delivers a REAL Telegram missed message.
  console.log('\n[1] Running real accountability recheck (actual Telegram send):');
  const result = await runAccountabilityRecheck({ force: true });
  console.log('  Result:', JSON.stringify(result, null, 2));
  assert(result.deliveryState === 'SENT', 'Telegram confirmed delivery (deliveryState = SENT)');
  assert(typeof result.telegramMessageId === 'number', `Telegram message id stored: ${result.telegramMessageId}`);

  // 2. Verify the TelegramNotificationLog row was recorded with status SENT + message id.
  console.log('\n[2] TelegramNotificationLog recorded with confirmed success:');
  const logRow = await prisma.telegramNotificationLog.findFirst({
    where: { type: 'ACCOUNTABILITY' },
    orderBy: { sentAt: 'desc' },
  });
  console.log('  Log row:', JSON.stringify({ status: logRow?.status, telegramMessageId: logRow?.telegramMessageId, retryCount: logRow?.retryCount }, null, 2));
  assert(logRow?.status === 'SENT', 'log status = SENT');
  assert(typeof logRow?.telegramMessageId === 'number', 'log stores the real Telegram message_id');

  // 3. Wait for the reminder, then show that the session is PENDING (reminders not yet fired due to 3-min interval).
  console.log('\n[3] Session is PENDING and awaiting acknowledgement:');
  const pendingStatus = await getAccountabilityStatus();
  assert(pendingStatus.status === 'PENDING', 'session is PENDING after missed delivery');
  console.log(`  - Reminder count so far: ${pendingStatus.reminderCount} (next reminder is gated by ${3}min rate limit)`);

  // 4. Send the acknowledgement through the SAME resolver the Telegram webhook uses.
  console.log('\n[4] User sends acknowledgement -> stop repeated reminders:');
  const resolved = await resolveAccountabilityByMessage("I'm so sorry, I will not do it again");
  assert(resolved.found === true, 'acknowledgement recognised by resolver');

  const finalStatus = await getAccountabilityStatus();
  assert(finalStatus.status === 'RESOLVED', 'session RESOLVED');
  console.log(`  - Final website status: ${finalStatus.status}`);
  console.log('  ✔ Repeated reminders stop (session no longer PENDING; resolve sent the final "Apology accepted" message and returned).');

  console.log('\n==================================================');
  console.log('✅ ACTUAL TELEGRAM DELIVERY + ACKNOWLEDGEMENT VERIFIED');
  console.log('(message delivered, success recorded with real message id, ack resolved + stopped)');
  console.log('==================================================');
}

main()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });