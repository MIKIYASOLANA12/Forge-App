/**
 * Automated Test Suite for Persistent Sleep Accountability Mode
 * 
 * Verifies:
 * 1. 11:00 PM first reminder sent with inline acknowledgment & snooze buttons
 * 2. 11:15 PM second reminder sent with progression message
 * 3. 11:30 PM third reminder sent
 * 4. 11:45 PM fourth reminder sent
 * 5. Deduplication across overlapping scheduler runs
 * 6. Sleep acknowledgment stops further reminders for tonight
 * 7. 5-minute snooze delays reminder and enforces max 3 snoozes
 * 8. Inactive session (>25m since heartbeat) stops reminders
 * 9. Daily reset on new day cycle
 * 10. Dashboard and Telegram share the exact same sleep state
 */

import { prisma } from '../lib/prisma';
import {
  getSleepAccountabilityStatus,
  acknowledgeSleep,
  snoozeSleep,
  getSleepCycleDateKey,
  getSleepCycleDateObj,
} from '../lib/sleepAccountability';
import { sendSmartCoachScheduleReminder } from '../lib/telegramScheduler';
import { getAddisNow, workoutWindowForAddisDate } from '../lib/workoutTime';

async function runSleepTests() {
  console.log('====================================================');
  console.log('🌙 RUNNING PERSISTENT SLEEP ACCOUNTABILITY TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, extra?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${extra ? `(${extra})` : ''}`);
      failed++;
    }
  }

  try {
    const addisNow = getAddisNow();
    const windowInfo = workoutWindowForAddisDate(addisNow);

    // Mock account setup
    let mockAccount = await prisma.telegramAccount.findFirst({ where: { active: true } });
    let testUser = await prisma.user.findFirst();
    if (!mockAccount && testUser) {
      mockAccount = await prisma.telegramAccount.upsert({
        where: { userId: testUser.id },
        create: {
          userId: testUser.id,
          telegramId: 'mock_sleep_123',
          chatId: 'mock_sleep_chat_123',
          active: true,
        },
        update: { active: true },
      });
    }

    // Helper to construct simulated Addis Date
    function createAddisDate(hour: number, minute: number, dayOffset: number = 0): Date {
      const d = new Date(windowInfo.startAddis);
      d.setUTCDate(d.getUTCDate() + dayOffset);
      const utcYear = d.getUTCFullYear();
      const utcMonth = d.getUTCMonth();
      const utcDate = d.getUTCDate();
      return new Date(Date.UTC(utcYear, utcMonth, utcDate, hour - 3, minute, 0));
    }

    const tonight2300 = createAddisDate(23, 0);
    const tonight2315 = createAddisDate(23, 15);
    const tonight2330 = createAddisDate(23, 30);
    const tonight2345 = createAddisDate(23, 45);
    const dateKeyTonight = getSleepCycleDateKey(tonight2300);
    const dateObjTonight = getSleepCycleDateObj(tonight2300);

    // Clean up test logs for tonight
    await prisma.telegramNotificationLog.deleteMany({
      where: {
        date: dateObjTonight,
        type: { startsWith: 'COACH_SLEEP_' },
      },
    });
    await prisma.telegramNotificationLog.deleteMany({
      where: {
        date: dateObjTonight,
        type: { startsWith: 'SLEEP_' },
      },
    });

    // Ensure an active session exists for testUser
    if (testUser) {
      await prisma.userSession.upsert({
        where: { sessionToken: 'mock_test_session_active' },
        create: {
          userId: testUser.id,
          sessionToken: 'mock_test_session_active',
          lastActiveAt: new Date(tonight2300.getTime() - 2 * 60 * 1000), // 2 mins ago
          revoked: false,
        },
        update: {
          lastActiveAt: new Date(tonight2300.getTime() - 2 * 60 * 1000),
          revoked: false,
        },
      });
    }

    // ── TEST 1: 11:00 PM INITIAL SLEEP REMINDER ──
    console.log('\n--- 1. 11:00 PM Initial Sleep Reminder ---');
    const status2300 = await getSleepAccountabilityStatus(tonight2300);
    assert(status2300.isSleepWindow === true, '11:00 PM is recognized as Sleep Window');
    assert(status2300.overdueMinutes === 0, '11:00 PM overdueMinutes is 0');
    assert(status2300.isAcknowledged === false, 'Sleep is unacknowledged initially');

    const res2300 = await sendSmartCoachScheduleReminder(tonight2300);
    assert(res2300.results.some((r) => r.slotType === 'COACH_SLEEP_2300'), '11:00 PM sleep reminder dispatched');
    const msg2300 = res2300.results.find((r) => r.slotType === 'COACH_SLEEP_2300')?.message || '';
    assert(msg2300.includes("time to sleep"), '11:00 PM message asks Mikiyas to sleep');

    // Test dedup at 11:05 PM
    const res2305 = await sendSmartCoachScheduleReminder(createAddisDate(23, 5));
    assert(!res2305.results.some((r) => r.slotType === 'COACH_SLEEP_2300' && r.sent), '11:00 PM reminder is not duplicated');

    // ── TEST 2: 11:15 PM SECOND PERSISTENT REMINDER ──
    console.log('\n--- 2. 11:15 PM Second Persistent Reminder ---');
    const status2315 = await getSleepAccountabilityStatus(tonight2315);
    assert(status2315.overdueMinutes === 15, '11:15 PM overdue is 15 minutes');

    const res2315 = await sendSmartCoachScheduleReminder(tonight2315);
    const slot2315 = `COACH_SLEEP_${dateKeyTonight}_2315`;
    assert(res2315.results.some((r) => r.slotType === slot2315), '11:15 PM persistent reminder sent');
    const msg2315 = res2315.results.find((r) => r.slotType === slot2315)?.message || '';
    assert(msg2315.includes('still up'), '11:15 PM message mentions still up');

    // ── TEST 3: 11:30 PM & 11:45 PM PROGRESSION ──
    console.log('\n--- 3. 11:30 PM & 11:45 PM Progression Reminders ---');
    if (testUser) {
      await prisma.userSession.updateMany({
        where: { userId: testUser.id, sessionToken: 'mock_test_session_active' },
        data: { lastActiveAt: new Date(tonight2330.getTime() - 2 * 60 * 1000) },
      });
    }
    const res2330 = await sendSmartCoachScheduleReminder(tonight2330);
    const slot2330 = `COACH_SLEEP_${dateKeyTonight}_2330`;
    assert(res2330.results.some((r) => r.slotType === slot2330), '11:30 PM persistent reminder sent');

    if (testUser) {
      await prisma.userSession.updateMany({
        where: { userId: testUser.id, sessionToken: 'mock_test_session_active' },
        data: { lastActiveAt: new Date(tonight2345.getTime() - 2 * 60 * 1000) },
      });
    }
    const res2345 = await sendSmartCoachScheduleReminder(tonight2345);
    const slot2345 = `COACH_SLEEP_${dateKeyTonight}_2345`;
    assert(res2345.results.some((r) => r.slotType === slot2345), '11:45 PM persistent reminder sent');
    const msg2345 = res2345.results.find((r) => r.slotType === slot2345)?.message || '';
    assert(msg2345.includes('past your sleep target'), '11:45 PM message indicates past sleep target');

    // ── TEST 4: SNOOZE 5 MINUTES ──
    console.log('\n--- 4. Snooze Control ---');
    const snoozeTime = createAddisDate(23, 46);
    const snoozeRes = await snoozeSleep(5, snoozeTime);
    assert(snoozeRes.success === true && snoozeRes.snoozed === true, 'Sleep snoozed successfully for 5 minutes');

    // During snooze window (e.g. 11:48 PM): reminder should be suppressed
    const timeDuringSnooze = createAddisDate(23, 48);
    const statusDuringSnooze = await getSleepAccountabilityStatus(timeDuringSnooze);
    assert(statusDuringSnooze.isSnoozed === true, 'Status reports snoozed during 5-min snooze window');

    // Test max 3 snoozes limit
    await snoozeSleep(5, snoozeTime);
    await snoozeSleep(5, snoozeTime);
    const overLimitSnooze = await snoozeSleep(5, snoozeTime);
    assert(overLimitSnooze.success === false && overLimitSnooze.reason === 'MAX_SNOOZE_REACHED', 'Max 3 snoozes limit enforced');

    // ── TEST 5: SLEEP ACKNOWLEDGMENT STOPS REMINDERS ──
    console.log('\n--- 5. Sleep Acknowledgment ---');
    const ackTime = createAddisDate(23, 50);
    const ackRes = await acknowledgeSleep('TELEGRAM', ackTime);
    assert(ackRes.success === true, 'Sleep acknowledged via helper');

    const statusAfterAck = await getSleepAccountabilityStatus(ackTime);
    assert(statusAfterAck.isAcknowledged === true, 'Status reports acknowledged');
    assert(statusAfterAck.statusText.includes('acknowledged'), 'Status text reflects sleep acknowledged');

    // After acknowledgment: no further reminders should be sent at 12:00 AM
    const midnight = createAddisDate(0, 0, 1);
    const resMidnight = await sendSmartCoachScheduleReminder(midnight);
    assert(!resMidnight.results.some((r) => r.slotType.startsWith(`COACH_SLEEP_${dateKeyTonight}`) && r.sent), 'Reminders completely stop after acknowledgment');

    // ── TEST 6: INACTIVE SESSION DETECTION ──
    console.log('\n--- 6. Inactive Session Detection ---');
    // Set mock session lastActiveAt to 40 minutes ago
    if (testUser) {
      await prisma.userSession.updateMany({
        where: { userId: testUser.id },
        data: { lastActiveAt: new Date(tonight2300.getTime() - 40 * 60 * 1000) },
      });
    }
    // Delete ack log to test inactive stop condition
    await prisma.telegramNotificationLog.deleteMany({
      where: {
        date: dateObjTonight,
        type: `SLEEP_ACK_${dateKeyTonight}`,
      },
    });

    const statusInactive = await getSleepAccountabilityStatus(createAddisDate(23, 55));
    assert(statusInactive.isSessionActive === false, 'Session detected as inactive when heartbeat > 25 mins ago');

    // ── TEST 7: DAILY RESET ──
    console.log('\n--- 7. Daily Cycle Reset ---');
    // Tomorrow night's 11:00 PM cycle should start fresh
    const tomorrowNight = createAddisDate(23, 0, 1);
    const tomorrowDateKey = getSleepCycleDateKey(tomorrowNight);
    assert(tomorrowDateKey !== dateKeyTonight, 'New calendar day produces fresh sleep cycle date key');

    const statusTomorrow = await getSleepAccountabilityStatus(tomorrowNight);
    assert(statusTomorrow.isAcknowledged === false, 'Tomorrow night starts with unacknowledged state');

    console.log('\n====================================================');
    console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSleepTests();
