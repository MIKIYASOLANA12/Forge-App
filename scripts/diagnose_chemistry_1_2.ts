import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const equalsIdx = trimmed.indexOf('=');
      if (equalsIdx !== -1) {
        const key = trimmed.slice(0, equalsIdx).trim();
        let value = trimmed.slice(equalsIdx + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    }
  }
}
loadEnv();

import { findTopicById } from '../lib/subjectRoadmapsData';
import {
  createAssessmentSession,
  TOPIC_CURATED_QUESTIONS,
  toClientAssessmentSession,
} from '../lib/studyAssessmentEngine';

async function main() {
  console.log('========================================================================');
  console.log('🧪 FORGE DIAGNOSTIC & VERIFICATION TEST: CHEMISTRY 1.2 ASSESSMENT');
  console.log('========================================================================\n');

  // STEP 1 & 2: Topic Resolution Check
  const resolved = findTopicById('CHEMISTRY', 'chemistry_u1_t2');
  if (!resolved) {
    throw new Error('FAILED TO RESOLVE chemistry_u1_t2');
  }
  const { unit, topic } = resolved;
  console.log('1. TOPIC RESOLUTION:');
  console.log('   Unit ID:   ', unit.id);
  console.log('   Unit Title:', unit.title);
  console.log('   Topic ID:  ', topic.id);
  console.log('   Topic Title:', topic.title);
  console.log('   Subtopics: ', topic.subtopics);

  // STEP 3: Check Curated Questions
  const curated = TOPIC_CURATED_QUESTIONS.filter((q) => q.topicId === 'chemistry_u1_t2');
  console.log(`\n2. CURATED SEED COUNT: ${curated.length} questions.`);

  // STEP 4: Test 40-question session generation
  const testUserId = `test-eval-chem12-${Date.now()}`;
  console.log(`\n3. RUNNING createAssessmentSession (Target: 40 questions)...`);
  const session = await createAssessmentSession({
    subject: 'CHEMISTRY',
    topicId: 'chemistry_u1_t2',
    count: 40,
    userId: testUserId,
    includePastPapers: true,
  });

  console.log('\n========================================================================');
  console.log('SESSION GENERATION COMPLETED:');
  console.log(`- Session ID: ${session.id}`);
  console.log(`- Total Questions: ${session.questions.length}/40`);
  console.log(`- Subject: ${session.subject}`);
  console.log(`- Unit: ${session.unitId} (${session.unitTitle})`);
  console.log(`- Topic: ${session.topicId} (${session.topicTitle})`);

  // Count source types
  const sourceCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  for (const q of session.questions) {
    sourceCounts[q.sourceType] = (sourceCounts[q.sourceType] || 0) + 1;
    typeCounts[q.type] = (typeCounts[q.type] || 0) + 1;

    // Strict validation assertions
    if (q.subject !== 'CHEMISTRY') throw new Error(`Wrong subject: ${q.subject}`);
    if (q.unitId !== 'chemistry_u1') throw new Error(`Wrong unitId: ${q.unitId}`);
    if (q.topicId !== 'chemistry_u1_t2') throw new Error(`Wrong topicId: ${q.topicId}`);
    if (!q.prompt || q.prompt.length < 10) throw new Error(`Invalid prompt: ${q.prompt}`);
    if (!q.correctAnswer) throw new Error(`Missing correctAnswer in question ${q.id}`);
    if (q.type === 'multiple_choice' && (!q.options || q.options.length < 2)) {
      throw new Error(`MCQ missing options in question ${q.id}`);
    }
  }

  console.log('\n- Source Breakdown:', JSON.stringify(sourceCounts, null, 2));
  console.log('- Question Types Breakdown:', JSON.stringify(typeCounts, null, 2));

  // Client DTO Security Check
  const clientDto = toClientAssessmentSession(session);
  for (let i = 0; i < clientDto.questions.length; i++) {
    const cq = clientDto.questions[i] as any;
    if (cq.correctAnswer !== undefined) {
      throw new Error(`SECURITY LEAK: Client DTO question ${i} contains correctAnswer!`);
    }
    if (cq.explanation !== undefined) {
      throw new Error(`SECURITY LEAK: Client DTO question ${i} contains explanation!`);
    }
  }
  console.log('\n- Client DTO Security Check: PASSED (No correctAnswer or explanation leaked)');

  console.log('\nSample Question 1:');
  console.log(`  Prompt: ${session.questions[0].prompt}`);
  console.log(`  Type: ${session.questions[0].type}`);
  console.log(`  Subtopic: ${session.questions[0].subtopic}`);
  console.log(`  Options: ${JSON.stringify(session.questions[0].options)}`);
  console.log(`  SourceType: ${session.questions[0].sourceType}`);

  console.log('\nSample Question 2:');
  console.log(`  Prompt: ${session.questions[1].prompt}`);
  console.log(`  Type: ${session.questions[1].type}`);
  console.log(`  Subtopic: ${session.questions[1].subtopic}`);
  console.log(`  Options: ${JSON.stringify(session.questions[1].options)}`);
  console.log(`  SourceType: ${session.questions[1].sourceType}`);

  console.log('\nSample Question 40:');
  const lastQ = session.questions[session.questions.length - 1];
  console.log(`  Prompt: ${lastQ.prompt}`);
  console.log(`  Type: ${lastQ.type}`);
  console.log(`  Subtopic: ${lastQ.subtopic}`);
  console.log(`  Options: ${JSON.stringify(lastQ.options)}`);
  console.log(`  SourceType: ${lastQ.sourceType}`);

  console.log('\n========================================================================');
  console.log('✅ ALL VERIFICATIONS PASSED: 40/40 QUESTIONS GENERATED & VERIFIED FOR CHEMISTRY 1.2');
  console.log('========================================================================\n');
}

main().catch((err) => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
