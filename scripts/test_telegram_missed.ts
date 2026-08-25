import { sendDailyAccountabilityReminder } from '../lib/telegramScheduler';
import { prisma } from '../lib/prisma';

async function main() {
  console.log('--- 1. Testing Live Telegram Missed-Day Notification Delivery ---');
  const result1 = await sendDailyAccountabilityReminder(true);
  console.log('Result 1 (Forced execution):', result1);

  console.log('\n--- 2. Testing Duplicate Prevention ---');
  const result2 = await sendDailyAccountabilityReminder(false);
  console.log('Result 2 (Normal run - should detect duplicate and skip):', result2);

  console.log('\n--- 3. Verifying TelegramNotificationLog in Database ---');
  const logs = await prisma.telegramNotificationLog.findMany({
    orderBy: { sentAt: 'desc' },
    take: 3,
  });
  console.log('Recent Telegram Notification Logs:', logs);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
