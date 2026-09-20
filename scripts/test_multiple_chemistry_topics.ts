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
  toClientAssessmentSession,
  TOPIC_CURATED_QUESTIONS,
} from '../lib/studyAssessmentEngine';

interface TopicTestSpec {
  topicId: string;
  expectedTitle: string;
  expectedUnit: string;
}

const TOPICS_TO_TEST: TopicTestSpec[] = [
  {
    topicId: 'chemistry_u1_t1',
    expectedTitle: '1.1 Definition and Scope of Chemistry',
    expectedUnit: 'chemistry_u1',
  },
  {
    topicId: 'chemistry_u1_t2',
    expectedTitle: '1.2 Relationship Between Chemistry and Other Natural Sciences',
    expectedUnit: 'chemistry_u1',
  },
  {
    topicId: 'chemistry_u1_t3',
    expectedTitle: '1.3 The Role Chemistry Plays in Production and in Society',
    expectedUnit: 'chemistry_u1',
  },
];

async function runTopicTest(spec: TopicTestSpec) {
  console.log(`\n========================================================================`);
  console.log(`🧪 TESTING TOPIC: ${spec.topicId} (${spec.expectedTitle})`);
  console.log(`========================================================================`);

  // 1. Topic Resolution
  const resolved = findTopicById('CHEMISTRY', spec.topicId);
  if (!resolved) {
    throw new Error(`[FAIL] Could not resolve topic: ${spec.topicId}`);
  }
  if (resolved.unit.id !== spec.expectedUnit) {
    throw new Error(`[FAIL] Expected unit ${spec.expectedUnit}, got ${resolved.unit.id}`);
  }
  console.log(`  ✓ Topic Resolution: OK (${resolved.topic.title})`);
  console.log(`    Subtopics (${resolved.topic.subtopics.length}):`, resolved.topic.subtopics);

  // 2. Curated Seeds Check
  const seeds = TOPIC_CURATED_QUESTIONS.filter((q) => q.topicId === spec.topicId);
  console.log(`  ✓ Curated Seeds in Bank: ${seeds.length} questions`);

  // 3. Generate 40-Question Session
  const testUserId = `test-user-${spec.topicId}-${Date.now()}`;
  const startTime = Date.now();
  console.log(`  -> Generating 40 questions session for ${spec.topicId}...`);
  const session = await createAssessmentSession({
    subject: 'CHEMISTRY',
    topicId: spec.topicId,
    count: 40,
    userId: testUserId,
    includePastPapers: true,
  });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`  ✓ Session Generated in ${elapsed}s: ${session.questions.length}/40 questions`);

  // 4. Assertions on Question Count and Quality
  if (session.questions.length !== 40) {
    throw new Error(`[FAIL] Expected 40 questions, got ${session.questions.length}`);
  }

  const sourceCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};

  for (let i = 0; i < session.questions.length; i++) {
    const q = session.questions[i];
    sourceCounts[q.sourceType] = (sourceCounts[q.sourceType] || 0) + 1;
    typeCounts[q.type] = (typeCounts[q.type] || 0) + 1;

    if (q.subject !== 'CHEMISTRY') {
      throw new Error(`[FAIL] Q#${i + 1} wrong subject: ${q.subject}`);
    }
    if (q.unitId !== spec.expectedUnit) {
      throw new Error(`[FAIL] Q#${i + 1} wrong unit: ${q.unitId}`);
    }
    if (q.topicId !== spec.topicId) {
      throw new Error(`[FAIL] Q#${i + 1} wrong topic: ${q.topicId}`);
    }
    if (!q.prompt || q.prompt.trim().length < 10) {
      throw new Error(`[FAIL] Q#${i + 1} empty or invalid prompt`);
    }
    if (!q.correctAnswer || q.correctAnswer.trim().length === 0) {
      throw new Error(`[FAIL] Q#${i + 1} missing correctAnswer`);
    }
  }

  console.log(`  ✓ Question Type Distribution:`, typeCounts);
  console.log(`  ✓ Question Source Distribution:`, sourceCounts);

  // 5. Answer Security DTO Check
  const clientDto = toClientAssessmentSession(session);
  for (let i = 0; i < clientDto.questions.length; i++) {
    const cq = clientDto.questions[i] as any;
    if (cq.correctAnswer !== undefined) {
      throw new Error(`[SECURITY FAIL] Client DTO leaked correctAnswer at index ${i}`);
    }
    if (cq.explanation !== undefined) {
      throw new Error(`[SECURITY FAIL] Client DTO leaked explanation at index ${i}`);
    }
  }
  console.log(`  ✓ Security Verified: Zero answer keys or explanations sent to client`);

  return {
    topicId: spec.topicId,
    title: spec.expectedTitle,
    totalQuestions: session.questions.length,
    elapsedSec: elapsed,
    sourceCounts,
    typeCounts,
  };
}

async function main() {
  console.log('========================================================================');
  console.log('🚀 MULTI-TOPIC CHEMISTRY ASSESSMENT TEST RUNNER (1.1, 1.2, 1.3)');
  console.log('========================================================================');

  const results = [];
  for (const spec of TOPICS_TO_TEST) {
    const result = await runTopicTest(spec);
    results.push(result);
  }

  console.log('\n========================================================================');
  console.log('🎉 ALL CHEMISTRY TOPIC TESTS COMPLETED SUCCESSFULLY:');
  console.log('========================================================================');
  for (const r of results) {
    console.log(`• ${r.topicId} (${r.title}): ${r.totalQuestions}/40 questions in ${r.elapsedSec}s`);
  }
}

main().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
