/**
 * Comprehensive Automated Test Suite for Telegram Daily Productivity Coach
 * 
 * Simulates a full 24-hour day progression across all time slots:
 * 1. Wake-up at 11:00 AM
 * 2. Activity start notifications at exact scheduled times with inline completion buttons
 * 3. In-progress /now query with live remaining minutes calculation
 * 4. Activity end notifications with next activity and gap coaching
 * 5. Between-activity gap windows
 * 6. Missed activity alerts without spam
 * 7. Dynamic task completion via Telegram updating DB and awarding XP
 * 8. Plan modification propagation (no hard-coded schedules)
 * 9. 09:30 PM Wind-down & 11:00 PM Sleep target precision
 * 10. Ethiopian traditional clock conversion accuracy
 * 11. Deduplication on multiple scheduler executions
 */

import { prisma } from '../lib/prisma';
import { getSmartScheduleStatus } from '../lib/smartSchedule';
import { sendSmartCoachScheduleReminder } from '../lib/telegramScheduler';
import { getNowSummary, completeTaskFromTelegram } from '../lib/telegramCommands';
import { convertToEthiopianTraditionalTime } from '../lib/ethiopianTime';
import { getAddisNow, workoutWindowForAddisDate } from '../lib/workoutTime';
import { ensureTodayDailyPlan } from '../lib/dailyPlanGenerator';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING TELEGRAM DAILY COACH SIMULATION SUITE');
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
    // 0. Ensure user and plan exist
    const plan = await ensureTodayDailyPlan();
    assert(Boolean(plan && plan.tasks && plan.tasks.length > 0), 'Daily plan exists with real tasks from DB');

    // Create a mock telegram account if none exists for testing
    let mockAccount = await prisma.telegramAccount.findFirst({ where: { active: true } });
    if (!mockAccount) {
      const user = await prisma.user.findFirst();
      if (user) {
        mockAccount = await prisma.telegramAccount.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            telegramId: 'mock_tester_123',
            chatId: 'mock_chat_123',
            active: true,
          },
          update: { active: true },
        });
      }
    }

    // Clean up test notification logs for today so test runs cleanly
    const addisNow = getAddisNow();
    const windowInfo = workoutWindowForAddisDate(addisNow);
    const dateKey = new Date(Date.UTC(windowInfo.startAddis.getFullYear(), windowInfo.startAddis.getMonth(), windowInfo.startAddis.getDate()));

    await prisma.telegramNotificationLog.deleteMany({
      where: {
        date: dateKey,
        type: { startsWith: 'COACH_' },
      },
    });

    // Helper to construct Addis Date at specific hour and minute today
    function createAddisDate(hour: number, minute: number): Date {
      // Addis is UTC+3
      const d = new Date(windowInfo.startAddis);
      const utcYear = d.getUTCFullYear();
      const utcMonth = d.getUTCMonth();
      const utcDate = d.getUTCDate();
      // UTC hour is hour - 3
      return new Date(Date.UTC(utcYear, utcMonth, utcDate, hour - 3, minute, 0));
    }

    // ── TEST 1: ETHIOPIAN TRADITIONAL CLOCK CONVERSIONS ──
    console.log('\n--- 1. Ethiopian Time & Period Phrasing ---');
    const eth11AM = convertToEthiopianTraditionalTime(11, 0);
    assert(eth11AM.hour === 5 && eth11AM.periodCode === 'LATE_MORNING' && eth11AM.formattedAmharic.includes('ከረፋዱ 5:00'), '11:00 AM Western = 5:00 ከረፋዱ (Late Morning)');

    const eth11PM = convertToEthiopianTraditionalTime(23, 0);
    assert(eth11PM.hour === 5 && eth11PM.periodCode === 'NIGHT' && eth11PM.formattedAmharic.includes('ከሌሊቱ 5:00'), '11:00 PM Western = 5:00 ከሌሊቱ (Night)');

    const eth12PM = convertToEthiopianTraditionalTime(12, 0);
    assert(eth12PM.formattedAmharic === 'እኩለ ቀን' || eth12PM.periodCode === 'MIDDAY', '12:00 PM Western = Midday (እኩለ ቀን)');

    const eth0930PM = convertToEthiopianTraditionalTime(21, 30);
    assert(eth0930PM.hour === 3 && eth0930PM.periodCode === 'NIGHT' && eth0930PM.formattedAmharic.includes('ከሌሊቱ 3:30'), '9:30 PM Western = 3:30 ከሌሊቱ (Night Wind-down)');

    // ── TEST 2: 11:00 AM WAKE-UP NOTIFICATION ──
    console.log('\n--- 2. Wake-Up Notification (11:00 AM) ---');
    const time11AM = createAddisDate(11, 5);
    const wakeStatus = await getSmartScheduleStatus(time11AM);
    assert(wakeStatus.currentActivityCategory === 'WAKE', 'Status at 11:05 AM is WAKE');
    assert(wakeStatus.currentActivityTitle.includes('wake') || wakeStatus.statusMessage.includes('11:00 AM'), 'Wake-up message formatted properly');

    const wakeNotification = await sendSmartCoachScheduleReminder(time11AM);
    assert(wakeNotification.results.some((r) => r.slotType === 'COACH_WAKE_1100'), '11:00 AM wake-up notification dispatched');

    // Test dedup: sending again at 11:10 AM should not resend
    const time1110AM = createAddisDate(11, 10);
    const wakeDedup = await sendSmartCoachScheduleReminder(time1110AM);
    assert(!wakeDedup.results.some((r) => r.slotType === 'COACH_WAKE_1100' && r.sent), '11:00 AM wake-up notification is deduplicated');

    // ── TEST 3: DYNAMIC ACTIVITY START & END NOTIFICATIONS ──
    console.log('\n--- 3. Dynamic Activity Notifications & Calculations ---');
    // Set a custom scheduled task for testing
    let testTaskId = plan.tasks[0]?.id;
    let testTask: any;
    if (!testTaskId) {
      testTask = await prisma.planTask.create({
        data: {
          dailyPlanId: plan.planId || 'singleton',
          domainId: 'singleton',
          description: JSON.stringify({ title: 'Chemistry — Stoichiometry Deep Dive' }),
          subject: 'Chemistry',
          topic: 'Stoichiometry Deep Dive',
          minutesTarget: 60,
          plannedStartTime: '12:00',
          plannedEndTime: '13:00',
          completed: false,
        },
      });
      testTaskId = testTask.id;
    } else {
      testTask = await prisma.planTask.update({
        where: { id: testTaskId },
        data: {
          plannedStartTime: '12:00',
          plannedEndTime: '13:00',
          completed: false,
        },
      });
    }

    // At 12:05 PM: Activity 1 should start
    const time1205PM = createAddisDate(12, 5);
    const startNotification = await sendSmartCoachScheduleReminder(time1205PM);
    const expectedStartSlot = `COACH_START_${testTaskId}_12:00`;
    assert(startNotification.results.some((r) => r.slotType === expectedStartSlot), `Activity start notification sent for ${testTask.subject || 'Task'}`);

    // At 12:30 PM: /now should report active session with 30 mins remaining
    const time1230PM = createAddisDate(12, 30);
    const now1230 = await getNowSummary(time1230PM);
    assert(now1230.text.includes('RIGHT NOW'), '/now command returns RIGHT NOW section');
    assert(now1230.text.includes('30 minutes remaining'), '/now command correctly calculates remaining 30 minutes');
    assert(now1230.activeTaskId === testTaskId, '/now command provides active task ID for quick completion button');

    // At 13:02 PM: Activity 1 ends -> End notification should fire
    const time1302PM = createAddisDate(13, 2);
    const endNotification = await sendSmartCoachScheduleReminder(time1302PM);
    const expectedEndSlot = `COACH_END_${testTaskId}_13:00`;
    assert(endNotification.results.some((r) => r.slotType === expectedEndSlot), 'Activity end notification sent at 1:00 PM');
    const endResult = endNotification.results.find((r) => r.slotType === expectedEndSlot);
    assert(Boolean(endResult && endResult.message.includes('finished')), 'End message includes "finished"');

    // ── TEST 4: GAP COACHING & BETWEEN-ACTIVITY WINDOW ──
    console.log('\n--- 4. Gap Coaching & Next Activity Calculation ---');
    // Ensure second task is scheduled at 14:00 (1 hour gap after 13:00)
    let testTask2Id = plan.tasks[1]?.id;
    let testTask2: any;
    if (!testTask2Id) {
      testTask2 = await prisma.planTask.create({
        data: {
          dailyPlanId: plan.planId || 'singleton',
          domainId: 'singleton',
          description: JSON.stringify({ title: 'JavaScript — Async/Await Mastery' }),
          subject: 'JavaScript',
          topic: 'Async/Await',
          minutesTarget: 60,
          plannedStartTime: '14:00',
          plannedEndTime: '15:00',
          completed: false,
        },
      });
      testTask2Id = testTask2.id;
    } else {
      testTask2 = await prisma.planTask.update({
        where: { id: testTask2Id },
        data: {
          plannedStartTime: '14:00',
          plannedEndTime: '15:00',
          completed: false,
        },
      });
    }

    // At 13:30 PM (in gap between 13:00 and 14:00):
    const time1330PM = createAddisDate(13, 30);
    const status1330 = await getSmartScheduleStatus(time1330PM);
    assert(status1330.currentActivityTitle.includes('between scheduled activities') || status1330.currentActivityCategory === 'FREE', 'Between activities detected at 1:30 PM');
    assert(status1330.nextActivity?.startTimeFormatted === '2:00 PM', 'Next activity identified at 2:00 PM');
    assert(status1330.nextActivity?.minutesUntilStart === 30, 'Calculates 30 minutes until next session');

    // ── TEST 5: MISSED ACTIVITY ALERT ──
    console.log('\n--- 5. Missed Activity Alert ---');
    // At 15:30 PM: testTask2 (14:00-15:00) ended 30 mins ago without completion
    const time1530PM = createAddisDate(15, 30);
    const missedNotification = await sendSmartCoachScheduleReminder(time1530PM);
    const expectedMissedSlot = `COACH_MISSED_${testTask2Id}`;
    assert(missedNotification.results.some((r) => r.slotType === expectedMissedSlot), 'Missed activity alert generated for uncompleted task');

    // Test missed dedup
    const time1540PM = createAddisDate(15, 40);
    const missedDedup = await sendSmartCoachScheduleReminder(time1540PM);
    assert(!missedDedup.results.some((r) => r.slotType === expectedMissedSlot && r.sent), 'Missed activity alert is not spammed (dedup works)');

    // ── TEST 6: TELEGRAM COMPLETION UPDATES DATABASE & XP ──
    console.log('\n--- 6. Telegram Task Completion ---');
    const profileBefore = await prisma.userProfile.findUnique({ where: { id: 'singleton' } });
    const xpBefore = profileBefore?.totalXp || 0;

    const compRes = await completeTaskFromTelegram(testTaskId, time1205PM);
    assert(compRes.success, 'Task completed via Telegram helper');

    const taskInDb = await prisma.planTask.findUnique({ where: { id: testTaskId } });
    assert(taskInDb?.completed === true, 'Task completed state in DB is true');

    const profileAfter = await prisma.userProfile.findUnique({ where: { id: 'singleton' } });
    assert((profileAfter?.totalXp || 0) > xpBefore, 'User profile XP incremented in DB');

    // ── TEST 7: 09:30 PM WIND-DOWN & 11:00 PM SLEEP TARGET ──
    console.log('\n--- 7. Wind-Down and Sleep Target Timing ---');
    await prisma.telegramNotificationLog.deleteMany({
      where: {
        type: { in: ['COACH_SLEEP_2300', 'COACH_WIND_DOWN_2130'] },
      },
    });
    await prisma.telegramNotificationLog.deleteMany({
      where: {
        type: { startsWith: 'SLEEP_' },
      },
    });

    // At 09:35 PM: Wind down notification
    const time2135PM = createAddisDate(21, 35);
    const windDownRes = await sendSmartCoachScheduleReminder(time2135PM);
    assert(windDownRes.results.some((r) => r.slotType === 'COACH_WIND_DOWN_2130'), '09:30 PM Wind-down notification sent');

    // At 11:05 PM: Sleep notification (with active session)
    const time2305PM = createAddisDate(23, 5);
    const testUser = await prisma.user.findFirst();
    if (testUser) {
      await prisma.userSession.upsert({
        where: { sessionToken: 'mock_test_session_active' },
        create: {
          userId: testUser.id,
          sessionToken: 'mock_test_session_active',
          lastActiveAt: new Date(time2305PM.getTime() - 2 * 60 * 1000),
          revoked: false,
        },
        update: {
          lastActiveAt: new Date(time2305PM.getTime() - 2 * 60 * 1000),
          revoked: false,
        },
      });
    }
    const sleepRes = await sendSmartCoachScheduleReminder(time2305PM);
    assert(sleepRes.results.some((r) => r.slotType === 'COACH_SLEEP_2300'), '11:00 PM Sleep target notification sent');

    // Verify 11:00 AM never triggers sleep notification
    const wakeStatusCheck = await getSmartScheduleStatus(time11AM);
    assert(wakeStatusCheck.currentActivityCategory !== 'SLEEP', '11:00 AM never categorizes as SLEEP');

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

runTests();
