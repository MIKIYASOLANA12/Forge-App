import { getSmartScheduleStatus } from '../lib/smartSchedule';
import { getAddisTimeComponents } from '../lib/workoutTime';
import { convertToEthiopianTraditionalTime } from '../lib/ethiopianTime';

function createAddisDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  // Addis is UTC+3 (no DST), so UTC hour = hour - 3
  return new Date(Date.UTC(year, month - 1, day, hour - 3, minute, 0, 0));
}

async function runTests() {
  console.log('==================================================');
  console.log('🇪🇹 FORGE: ETHIOPIAN CLOCK & SCHEDULE TEST SUITE');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, actual: string, expected: string) {
    if (condition) {
      console.log(`  ✔ ${name} -> ${actual}`);
      passed++;
    } else {
      console.error(`  ❌ FAILED: ${name} -> got "${actual}", expected "${expected}"`);
      failed++;
    }
  }

  console.log('[1] Testing Exact Ethiopian Traditional Clock Period Phrasing:');
  const ethTestCases = [
    { hour: 8, min: 0, expectedAmharic: 'ከጠዋቱ 2:00', label: '8:00 AM Western (Early Morning)' },
    { hour: 10, min: 0, expectedAmharic: 'ከረፋዱ 4:00', label: '10:00 AM Western (Late Morning)' },
    { hour: 11, min: 0, expectedAmharic: 'ከረፋዱ 5:00', label: '11:00 AM Western (Wake Target)' },
    { hour: 12, min: 0, expectedAmharic: 'እኩለ ቀን', label: '12:00 PM Western (Noon / Midday)' },
    { hour: 14, min: 0, expectedAmharic: 'ከሰዓት 8:00', label: '2:00 PM Western (Afternoon)' },
    { hour: 18, min: 0, expectedAmharic: 'ከምሽቱ 12:00', label: '6:00 PM Western (Sunset / Evening Start)' },
    { hour: 20, min: 0, expectedAmharic: 'ከምሽቱ 2:00', label: '8:00 PM Western (Evening)' },
    { hour: 23, min: 0, expectedAmharic: 'ከሌሊቱ 5:00', label: '11:00 PM Western (Sleep Target)' },
    { hour: 0, min: 0, expectedAmharic: 'እኩለ ሌሊት', label: '12:00 AM Western (Midnight)' },
    { hour: 2, min: 0, expectedAmharic: 'ከሌሊቱ 8:00', label: '2:00 AM Western (Deep Night)' },
    { hour: 5, min: 0, expectedAmharic: 'ከንጋቱ 11:00', label: '5:00 AM Western (Dawn)' },
  ];

  for (const tc of ethTestCases) {
    const d = createAddisDate(2026, 8, 30, tc.hour, tc.min);
    const comp = getAddisTimeComponents(d);
    assert(
      tc.label,
      comp.ethiopianTime.formattedAmharic === tc.expectedAmharic,
      comp.ethiopianTime.formattedAmharic,
      tc.expectedAmharic
    );
  }

  console.log('\n[2] Testing Schedule & Sleep Category Boundaries (Africa/Addis_Ababa):');
  const scheduleTestCases = [
    {
      hour: 10,
      min: 0,
      label: '10:00 AM (ከረፋዱ 4:00) — Morning Focus / Pre-Wake',
      mustNotSaySleep: true,
      expectedCategory: 'WAKE',
      expectedTitlePart: 'Wake-Up',
    },
    {
      hour: 11,
      min: 0,
      label: '11:00 AM (ከረፋዱ 5:00) — Fixed Wake Target',
      mustNotSaySleep: true,
      expectedCategory: 'WAKE',
      expectedTitlePart: 'Wake up',
    },
    {
      hour: 13,
      min: 0,
      label: '01:00 PM (ከሰዓት 7:00) — Afternoon Active Day',
      mustNotSaySleep: true,
      expectedNotCategory: 'SLEEP',
      expectedNotCategory2: 'WIND_DOWN',
    },
    {
      hour: 17,
      min: 0,
      label: '05:00 PM (ከሰዓት 11:00) — Late Afternoon Active Day',
      mustNotSaySleep: true,
      expectedNotCategory: 'SLEEP',
      expectedNotCategory2: 'WIND_DOWN',
    },
    {
      hour: 20,
      min: 0,
      label: '08:00 PM (ከምሽቱ 2:00) — Evening Active Day',
      mustNotSaySleep: true,
      expectedNotCategory: 'SLEEP',
      expectedNotCategory2: 'WIND_DOWN',
    },
    {
      hour: 21,
      min: 29,
      label: '09:29 PM (ከሌሊቱ 3:29) — Just Before Wind-Down',
      mustNotSaySleep: true,
      expectedNotCategory: 'SLEEP',
      expectedNotCategory2: 'WIND_DOWN',
    },
    {
      hour: 21,
      min: 30,
      label: '09:30 PM (ከሌሊቱ 3:30) — Wind-Down Start',
      mustNotSaySleep: true,
      expectedCategory: 'WIND_DOWN',
      expectedTitle: 'Start winding down.',
    },
    {
      hour: 22,
      min: 30,
      label: '10:30 PM (ከሌሊቱ 4:30) — Wind-Down Mid',
      mustNotSaySleep: true,
      expectedCategory: 'WIND_DOWN',
      expectedTitle: 'Start winding down.',
    },
    {
      hour: 23,
      min: 0,
      label: '11:00 PM (ከሌሊቱ 5:00) — Target Sleep Window',
      expectedCategory: 'SLEEP',
      expectedTitle: 'It’s time to sleep.',
    },
    {
      hour: 23,
      min: 30,
      label: '11:30 PM (ከሌሊቱ 5:30) — Late Night Sleep Window',
      expectedCategory: 'SLEEP',
      expectedTitle: 'It’s time to sleep.',
    },
  ];

  for (const tc of scheduleTestCases) {
    const d = createAddisDate(2026, 8, 30, tc.hour, tc.min);
    const status = await getSmartScheduleStatus(d);

    if (tc.mustNotSaySleep) {
      assert(
        `${tc.label} does NOT say sleep`,
        !status.currentActivityTitle.toLowerCase().includes('time to sleep'),
        `"${status.currentActivityTitle}" (Category: ${status.currentActivityCategory})`,
        'Must not contain "time to sleep"'
      );
    }

    if (tc.expectedCategory) {
      assert(
        `${tc.label} category is ${tc.expectedCategory}`,
        status.currentActivityCategory === tc.expectedCategory,
        status.currentActivityCategory,
        tc.expectedCategory
      );
    }

    if (tc.expectedTitle) {
      assert(
        `${tc.label} title matches "${tc.expectedTitle}"`,
        status.currentActivityTitle === tc.expectedTitle,
        status.currentActivityTitle,
        tc.expectedTitle
      );
    }

    if (tc.expectedTitlePart) {
      assert(
        `${tc.label} title includes "${tc.expectedTitlePart}"`,
        status.currentActivityTitle.includes(tc.expectedTitlePart),
        status.currentActivityTitle,
        `Contains "${tc.expectedTitlePart}"`
      );
    }

    if (tc.expectedNotCategory) {
      assert(
        `${tc.label} category is NOT ${tc.expectedNotCategory}`,
        status.currentActivityCategory !== tc.expectedNotCategory,
        status.currentActivityCategory,
        `NOT ${tc.expectedNotCategory}`
      );
    }
  }

  console.log('\n==================================================');
  if (failed === 0) {
    console.log(`✅ ALL ${passed} ETHIOPIAN CLOCK & SCHEDULE TESTS PASSED!`);
  } else {
    console.error(`❌ ${failed} TESTS FAILED.`);
    process.exit(1);
  }
  console.log('==================================================');
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
