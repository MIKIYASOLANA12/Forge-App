import { getSubjectMasteryOverview } from '../lib/subjectMasteryEngine';
import * as fs from 'fs';
import * as path from 'path';

async function verifyCleanState() {
  console.log('====================================================');
  console.log('REAL PRODUCTION ACCOUNT — CLEAN STATE VERIFICATION');
  console.log('====================================================\n');

  const overview = await getSubjectMasteryOverview();

  console.log('ACTIVE SUBJECT:', overview.activeSubject);
  console.log('SUBJECTS STARTED:', `${overview.overallStats.subjectsStarted} / ${overview.overallStats.totalSubjects}`);
  console.log('SUBJECTS COMPLETED:', `${overview.overallStats.subjectsCompleted}`);
  console.log('TOTAL STUDY MINUTES:', `${overview.overallStats.totalStudyMinutes} min`);
  console.log('TOTAL QUESTIONS ATTEMPTED:', `${overview.overallStats.totalQuestionsAttempted}`);
  console.log('OVERALL COMPLETION PERCENT:', `${overview.overallStats.overallCompletionPercent}%`);
  console.log('TOTAL TOPICS COMPLETED ACROSS ALL:', `${overview.overallStats.completedTopicsAcrossAll} / ${overview.overallStats.totalTopicsAcrossAll}`);

  console.log('\n--- 5 SUBJECT CARDS BREAKDOWN ---');
  for (const s of overview.allSubjects) {
    console.log(`${s.icon} ${s.name}:`);
    console.log(`   - Status: ${s.status}`);
    console.log(`   - Start Date: ${s.startDate ?? 'None (Not started)'}`);
    console.log(`   - Deadline: ${s.deadline ?? 'None (Not started)'}`);
    console.log(`   - Progress: ${s.completionPercent}% Completed, ${s.remainingPercent}% Remaining`);
    console.log(`   - Topics: ${s.completedTopics} / ${s.totalTopics}`);
    console.log(`   - Days Left: ${s.daysLeft} days`);
    console.log(`   - Real Countdown Active: ${s.status === 'ACTIVE' ? 'YES (WARNING)' : 'NO (CORRECT)'}`);
    console.log(`   - Strong Areas: ${s.strongAreas.length}`);
    console.log(`   - Weak Areas: ${s.weakAreas.length}`);
    console.log(`   - Repeated Mistakes: ${s.repeatedMistakes.length}`);
  }

  console.log('\n--- EXAM COUNTDOWN ---');
  console.log(`Target: ${overview.examCountdown.formattedDate} (${overview.examCountdown.ethiopianDate})`);
  console.log(`Days Left: ${overview.examCountdown.daysLeft} days`);

  console.log('\n====================================================');
  if (
    overview.activeSubject === 'NONE' &&
    overview.overallStats.subjectsStarted === 0 &&
    overview.overallStats.completedTopicsAcrossAll === 0 &&
    overview.overallStats.totalStudyMinutes === 0 &&
    overview.overallStats.totalQuestionsAttempted === 0 &&
    overview.allSubjects[0].status === 'READY' &&
    overview.allSubjects[1].status === 'LOCKED' &&
    overview.allSubjects[2].status === 'LOCKED' &&
    overview.allSubjects[3].status === 'LOCKED' &&
    overview.allSubjects[4].status === 'LOCKED'
  ) {
    console.log('✅ VERIFICATION RESULT: REAL PRODUCTION ACCOUNT IS 100% CLEAN & IN UNTOUCHED INITIAL STATE.');
  } else {
    console.error('❌ VERIFICATION FAILED: State is not clean!');
    process.exit(1);
  }
  console.log('====================================================');
}

verifyCleanState().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});
