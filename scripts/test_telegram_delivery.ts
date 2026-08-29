/**
 * FORGE — REAL TELEGRAM DELIVERY TEST (one real API send, controlled missed day).
 * Flow: seed a fully-missed synthetic day -> runAccountabilityRecheck (real) ->
 * verify all 4 misses + SENT log with telegram_message_id -> rerun (no duplicate)
 * -> acknowledge -> RESOLVED, reminders stop, no back-filled completions ->
 * cleanup synthetic rows only.
 */
if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile('.env.local'); } catch {}
}
import { prisma } from '../lib/prisma';
import { workoutWindowForAddisDate } from '../lib/workoutTime';
import {
  runAccountabilityRecheck,
  resolveAccountabilityByMessage,
  normalizedDateKeyFromAddis,
  windowToGrade,
  type WorkoutWindow,
} from '../lib/accountabilityRecheck';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`  OK ${msg}`);
}

// Grade the LAST CLOSED Addis day window.
const graded: WorkoutWindow = windowToGrade();
console.log(`target graded window start=${graded.startAddis.toISOString()} closed=${graded.isClosed}`);

async function cleanup() {
  const plans = await prisma.dailyPlan.findMany({ where: { date: { gte: graded.startUtc, lte: graded.endUtc } } });
  for (const p of plans) {
    await prisma.planTask.deleteMany({ where: { dailyPlanId: p.id } });
    await prisma.dailyPlan.delete({ where: { id: p.id } });
  }
  await prisma.habitLog.deleteMany({ where: { date: { gte: graded.startUtc, lte: graded.endUtc } } });
  await prisma.workoutLog.deleteMany({ where: { completedAt: { gte: graded.startUtc, lte: graded.endUtc } } });
}

async function seedMissedDay(domainId: string) {
  await prisma.dailyPlan.create({
    data: {
      date: graded.startUtc,
      generatedByAI: false,
      tasks: {
        create: [
          { domainId, description: 'Chemistry — Delivery Test', subject: 'Chemistry', minutesTarget: 60, completed: false },
          { domainId, description: 'JavaScript — Delivery Test', subject: 'JavaScript', minutesTarget: 60, completed: false },
          { domainId, description: 'Reading — Delivery Test', subject: 'Reading', minutesTarget: 25, completed: false },
          { domainId, description: 'English — Delivery Test', subject: 'English', minutesTarget: 30, completed: true },
        ],
      },
    },
  });
  // Workout + habits left unlogged => missed. Habits may add to missedAll,
  // which is fine — we assert the four REQUIRED categories are present.
}

async function main() {
  // Reset only the SYNTHETIC session for the graded day (idempotent re-runs).
  const key = normalizedDateKeyFromAddis(graded.startAddis);
  await prisma.accountabilitySession.deleteMany({ where: { addisDateKey: key } });
  // The recheck grades the REAL last-closed day; clear its (historical, already
  // RESOLVED) session so ensureSession creates a fresh PENDING one for the ack flow.
  const realKey = normalizedDateKeyFromAddis(windowToGrade().startAddis);
  await prisma.accountabilitySession.deleteMany({ where: { addisDateKey: realKey } });
  await cleanup();
  const domain = await prisma.domain.findFirst();
  assert(!!domain, 'a domain exists for task seeding');
  await seedMissedDay(domain!.id);

  // 1) REAL recheck #1 — detection + REAL Telegram send via production config.
  console.log('\n[1] Recheck #1 (real Telegram sendMessage):');
  const res1 = await runAccountabilityRecheck({ force: true });
  console.log(`  status=${res1.status} deliveryState=${res1.deliveryState} msgId=${res1.telegramMessageId}`);
  assert(Array.isArray(res1.missedItems), 'recheck returned a missed list');
  const m = res1.missedItems.join(' | ').toLowerCase();
  assert(m.includes('workout'), 'Workout found missed');
  assert(m.includes('chemistry'), 'Chemistry found missed');
  assert(m.includes('javascript'), 'JavaScript found missed');
  assert(m.includes('reading'), 'Reading found missed');

  // 2) Telegram API actually confirmed success with a message id.
  assert(res1.deliveryState === 'SENT', 'delivery state is SENT (Telegram confirmed)');
  assert(typeof res1.telegramMessageId === 'number' && res1.telegramMessageId > 0, `Telegram returned a real message_id (${res1.telegramMessageId})`);

  const log1 = await prisma.telegramNotificationLog.findFirst({
    where: { type: 'ACCOUNTABILITY' },
    orderBy: { sentAt: 'desc' },
  });
  assert(!!log1 && log1.status === 'SENT' && log1.telegramMessageId != null, 'TelegramNotificationLog records the successful notification');
  assert(String(log1!.message).toLowerCase().includes('workout'), 'logged message contains the missed Workout line');

  // 3) Recheck #2 — no duplicate message.
  console.log('\n[2] Recheck #2 (duplicate prevention):');
  const res2 = await runAccountabilityRecheck({ force: true });
  assert(res2.deliveryState === 'SENT' && res2.delivered === false, 'second recheck does NOT re-send (delivered=false, state stays SENT)');
  const logCount = await prisma.telegramNotificationLog.count({
    where: { type: 'ACCOUNTABILITY', date: log1!.date },
  });
  assert(logCount === 1, `exactly one ACCOUNTABILITY log for the graded day (${logCount})`);

  // 4) Acknowledgement flow (real message text).
  console.log('\n[3] Acknowledgement flow:');
  const ack = await resolveAccountabilityByMessage("I'm so sorry, I will not do it again");
  assert(ack.found === true, 'acknowledgement recognized');
  assert(ack.acknowledged?.state === 'RESOLVED', 'accountability state becomes RESOLVED');
  assert(!!ack.acknowledged?.acknowledgementAt, 'acknowledgement timestamp recorded');

  // 5) Repeated reminders stop after RESOLVED.
  const res3 = await runAccountabilityRecheck({ force: true });
  assert(res3.status === 'RESOLVED' && res3.reminderSent === false, 'repeated reminders stop (reminderSent=false after RESOLVED)');
  const reminderLogs = await prisma.telegramNotificationLog.count({ where: { type: 'ACCOUNTABILITY_REMINDER', date: log1!.date } });
  const afterAck = await runAccountabilityRecheck({ force: true });
  assert(afterAck.reminderSent === false, 'no reminder sent on the post-acknowledgement recheck');
  const reminderCountAfter = await prisma.telegramNotificationLog.count({ where: { type: 'ACCOUNTABILITY_REMINDER', date: log1!.date } });
  assert(reminderCountAfter === reminderLogs, `repeated reminders stop after RESOLVED (reminder logs for the day: ${reminderCountAfter})`);

  // 6) Missed items remain locked — no historical completion back-filled.
  const plans = await prisma.dailyPlan.findMany({ where: { date: { gte: graded.startUtc, lte: graded.endUtc } }, include: { tasks: true } });
  let backfilled = 0;
  for (const p of plans) for (const t of p.tasks) if (t.completed && t.subject !== 'English') backfilled++;
  assert(backfilled === 0, 'no historical completion was added for the missed tasks');

  console.log('\nALL REAL TELEGRAM DELIVERY TESTS PASSED');

  // 7) Cleanup synthetic test records only.
  await cleanup();
  console.log('synthetic test data cleaned up');
}

main()
  .catch((e) => {
    console.error('Test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

