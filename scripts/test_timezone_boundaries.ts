import { workoutWindowForAddisDate, getAddisTimeComponents } from '../lib/workoutTime';

function testBoundary(label: string, utcIsoString: string, expectedOpen: boolean, expectedClosed: boolean, expectedCycleDate: string) {
  const date = new Date(utcIsoString);
  const addisParts = getAddisTimeComponents(date);
  const win = workoutWindowForAddisDate(date);

  const passOpen = win.isOpen === expectedOpen;
  const passClosed = win.isClosed === expectedClosed;
  const passCycle = win.dateKey === expectedCycleDate;
  const allPass = passOpen && passClosed && passCycle;

  console.log(`${allPass ? '✅ PASS' : '❌ FAIL'}: ${label}`);
  console.log(`   UTC Time: ${utcIsoString} -> Addis Time: ${addisParts.formatted24h} (Date: ${addisParts.year}-${String(addisParts.month).padStart(2, '0')}-${String(addisParts.day).padStart(2, '0')})`);
  console.log(`   Cycle Date: ${win.dateKey} (Expected: ${expectedCycleDate})`);
  console.log(`   isOpen: ${win.isOpen} (Expected: ${expectedOpen}) | isClosed: ${win.isClosed} (Expected: ${expectedClosed})`);
  if (!allPass) {
    console.error(`   MISMATCH DETECTED!`);
  }
  return allPass;
}

console.log('================================================');
console.log('FORGE — TIMEZONE & CUTOFF BOUNDARY AUDIT');
console.log('================================================\n');

let allPassed = true;

// 1. 04:59:59 AM Addis = 01:59:59 AM UTC (on 2026-09-20)
// Expected: belongs to previous day (2026-09-19) / locked
allPassed = testBoundary('1. 04:59:59 AM Addis -> Previous Day / Locked', '2026-09-20T01:59:59.000Z', false, true, '2026-09-19') && allPassed;

// 2. 05:00:00 AM Addis = 02:00:00 AM UTC (on 2026-09-20)
// Expected: opens current day (2026-09-20) / open
allPassed = testBoundary('2. 05:00:00 AM Addis -> Current Day OPEN', '2026-09-20T02:00:00.000Z', true, false, '2026-09-20') && allPassed;

// 3. 05:00:01 AM Addis = 02:00:01 AM UTC (on 2026-09-20)
// Expected: current day (2026-09-20) / open
allPassed = testBoundary('3. 05:00:01 AM Addis -> Current Day OPEN', '2026-09-20T02:00:01.000Z', true, false, '2026-09-20') && allPassed;

// 4. 21:27:59 PM Addis = 18:27:59 PM UTC (on 2026-09-20)
// Expected: current day (2026-09-20) / open
allPassed = testBoundary('4. 21:27:59 PM Addis -> Current Day OPEN (1s before cutoff)', '2026-09-20T18:27:59.000Z', true, false, '2026-09-20') && allPassed;

// 5. 21:28:00 PM Addis = 18:28:00 PM UTC (on 2026-09-20)
// Expected: current day (2026-09-20) / CLOSED at exact cutoff
allPassed = testBoundary('5. 21:28:00 PM Addis -> EXACT CUTOFF CLOSED', '2026-09-20T18:28:00.000Z', false, true, '2026-09-20') && allPassed;

// 6. 21:28:01 PM Addis = 18:28:01 PM UTC (on 2026-09-20)
// Expected: current day (2026-09-20) / CLOSED
allPassed = testBoundary('6. 21:28:01 PM Addis -> CLOSED', '2026-09-20T18:28:01.000Z', false, true, '2026-09-20') && allPassed;

// 7. 23:59:00 PM Addis = 20:59:00 PM UTC (on 2026-09-20)
// Expected: current day (2026-09-20) / CLOSED
allPassed = testBoundary('7. 23:59:00 PM Addis -> Late Night CLOSED', '2026-09-20T20:59:00.000Z', false, true, '2026-09-20') && allPassed;

// 8. 00:01:00 AM Addis (next calendar day: 2026-09-21) = 21:01:00 PM UTC (on 2026-09-20)
// Expected: still belongs to 2026-09-20 execution cycle and CLOSED
allPassed = testBoundary('8. 00:01:00 AM Addis -> Still 2026-09-20 cycle and CLOSED', '2026-09-20T21:01:00.000Z', false, true, '2026-09-20') && allPassed;

// 9. 04:59:00 AM Addis (2026-09-21) = 01:59:00 AM UTC (on 2026-09-21)
// Expected: still belongs to 2026-09-20 execution cycle and CLOSED
allPassed = testBoundary('9. 04:59:00 AM Addis -> Still 2026-09-20 cycle and CLOSED', '2026-09-21T01:59:00.000Z', false, true, '2026-09-20') && allPassed;

// 10. 05:00:00 AM Addis (2026-09-21) = 02:00:00 AM UTC (on 2026-09-21)
// Expected: new cycle 2026-09-21 OPEN
allPassed = testBoundary('10. 05:00:00 AM Addis Next Day -> New Cycle 2026-09-21 OPEN', '2026-09-21T02:00:00.000Z', true, false, '2026-09-21') && allPassed;

console.log('\n================================================');
if (allPassed) {
  console.log('🎉 ALL 10 BOUNDARY TESTS PASSED PERFECTLY!');
} else {
  console.error('❌ SOME TESTS FAILED');
  process.exit(1);
}
