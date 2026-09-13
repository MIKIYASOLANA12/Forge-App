import {
  getGoalYearStatus,
  getEthiopianDate,
  gregorianToEthiopian,
  ethiopianToGregorian,
  FIXED_GOAL_YEAR_EC,
  TARGET_EXAM_GREGORIAN,
  TARGET_EXAM_ETHIOPIAN,
  TARGET_EXAM_ETHIOPIAN_AMHARIC,
} from '../lib/ethiopianCalendar';

function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING AUTHORITATIVE ETHIOPIAN GOAL & EXAM TESTS');
  console.log('====================================================\n');

  // Test 1: Today (September 14, 2026)
  const today = new Date('2026-09-14T10:00:00+03:00');
  const todayStatus = getGoalYearStatus(today);
  
  console.log('1. Current Date Evaluation (2026-09-14 in Addis Ababa):');
  console.log('   - Current Ethiopian Date:', todayStatus.currentEthiopianDate.formattedEnglish);
  console.log('   - Current Ethiopian Date (Amharic):', todayStatus.currentEthiopianDate.formattedAmharic);
  console.log('   - Current Ethiopian Year:', todayStatus.currentEthiopianYearLabel);
  console.log('   - Fixed Goal Year:', todayStatus.fixedGoalYearLabel);
  console.log('   - Exam Days Remaining:', todayStatus.examDaysRemaining, 'days');
  console.log('   - Exam Countdown Badge:', todayStatus.examCountdownBadge);
  console.log('   - 2019 E.C. Goal Progress:', todayStatus.goalYearProgressPercent + '%', `(Day ${todayStatus.goalYearDaysElapsed} of ${todayStatus.goalYearTotalDays})`);
  
  if (todayStatus.examDaysRemaining !== 280) {
    throw new Error(`Expected 280 days remaining, got ${todayStatus.examDaysRemaining}`);
  }
  if (todayStatus.currentEthiopianDate.ethMonth !== 1 || todayStatus.currentEthiopianDate.ethDay !== 4 || todayStatus.currentEthiopianDate.ethYear !== 2019) {
    throw new Error(`Expected Meskerem 4, 2019 E.C., got ${todayStatus.currentEthiopianDate.formattedEnglish}`);
  }
  console.log('   ✅ Test 1 Passed: Exact 280 days remaining and Meskerem 4, 2019 E.C.\n');

  // Test 2: Exam Day (June 21, 2027)
  const examDay = new Date('2027-06-21T08:00:00+03:00');
  const examStatus = getGoalYearStatus(examDay);
  console.log('2. Exam Day (June 21, 2027):');
  console.log('   - Ethiopian Date:', examStatus.currentEthiopianDate.formattedEnglish);
  console.log('   - Exam Countdown Badge:', examStatus.examCountdownBadge);
  console.log('   - Days Remaining:', examStatus.examDaysRemaining);
  if (examStatus.examDaysRemaining !== 0 || examStatus.examCountdownStatus !== 'TODAY') {
    throw new Error(`Expected 0 days and TODAY status, got ${examStatus.examDaysRemaining} (${examStatus.examCountdownStatus})`);
  }
  console.log('   ✅ Test 2 Passed: Exactly 0 days remaining on Exam Day.\n');

  // Test 3: Day After Exam (June 22, 2027)
  const afterExam = new Date('2027-06-22T08:00:00+03:00');
  const afterExamStatus = getGoalYearStatus(afterExam);
  console.log('3. After Exam Day (June 22, 2027):');
  console.log('   - Exam Countdown Badge:', afterExamStatus.examCountdownBadge);
  console.log('   - Days Remaining (no negative):', afterExamStatus.examDaysRemaining);
  if (afterExamStatus.examDaysRemaining !== 0 || afterExamStatus.examCountdownStatus !== 'COMPLETED') {
    throw new Error(`Expected COMPLETED and 0 days, got ${afterExamStatus.examDaysRemaining}`);
  }
  console.log('   ✅ Test 3 Passed: No negative days, status is COMPLETED.\n');

  // Test 4: When 2020 E.C. begins (e.g. September 12, 2027 / Meskerem 1, 2020 E.C.)
  const newYear2020 = new Date('2027-09-12T08:00:00+03:00');
  const year2020Status = getGoalYearStatus(newYear2020);
  console.log('4. When 2020 E.C. Begins (September 12, 2027):');
  console.log('   - Current Ethiopian Year:', year2020Status.currentEthiopianYearLabel);
  console.log('   - Fixed Goal Year (MUST STILL BE 2019 E.C.):', year2020Status.fixedGoalYearLabel);
  console.log('   - Has Goal Year Ended:', year2020Status.hasGoalYearEnded);
  console.log('   - Status Notice:', year2020Status.statusNotice);
  console.log('   - 2019 E.C. Progress:', year2020Status.goalYearProgressPercent + '%');
  
  if (year2020Status.fixedGoalYear !== 2019) {
    throw new Error(`Goal year was corrupted! Expected 2019, got ${year2020Status.fixedGoalYear}`);
  }
  if (year2020Status.currentEthiopianYear !== 2020) {
    throw new Error(`Expected current Ethiopian year 2020, got ${year2020Status.currentEthiopianYear}`);
  }
  if (!year2020Status.hasGoalYearEnded) {
    throw new Error(`Expected hasGoalYearEnded to be true`);
  }
  console.log('   ✅ Test 4 Passed: Goal Year stays 2019 E.C. even in 2020 E.C. with alert notice.\n');

  console.log('====================================================');
  console.log('🎉 ALL ETHIOPIAN GOAL & EXAM ENGINE TESTS PASSED!');
  console.log('====================================================');
}

runTests();
