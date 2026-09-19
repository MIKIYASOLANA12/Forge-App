import assert from 'assert';
import {
  hashPhrase,
  verifyWakePhrase,
  verifySleepPhrase,
  normalizeSpokenPhrase,
  verifyVerbalConfirmation,
  WAKE_HASH,
  SLEEP_HASH,
} from '../lib/voice/voiceSecurity';
import {
  getVoiceProvider,
  MockVoiceProvider,
} from '../lib/voice/voiceCallProvider';
import { processVoiceCommand } from '../lib/voice/voiceCommands';

async function runVoiceTests() {
  console.log('--- RUNNING VOICE ACCOUNTABILITY AND ASSISTANT TESTS ---');

  // Test 1: Secret Phrase Normalization & Verification
  console.log('Test 1: Secret phrase normalization and verification');
  const wakeCanonical = 'Hi Mikiyas is Here I Wake up Banana Banana';
  const sleepCanonical = 'Hi Mikiyas is Here I Go to Sleep Banana Banana';

  // Exact match
  assert.strictEqual(verifyWakePhrase(wakeCanonical), true);
  assert.strictEqual(verifySleepPhrase(sleepCanonical), true);

  // Normalized variations (lowercase, punctuation, spacing)
  assert.strictEqual(verifyWakePhrase('hi mikiyas is here i wake up banana banana!'), true);
  assert.strictEqual(verifyWakePhrase('  HI MIKIYAS IS HERE I WAKE UP BANANA BANANA.  '), true);
  assert.strictEqual(verifySleepPhrase('hi, mikiyas is here i go to sleep banana banana!'), true);

  // Negative test cases
  assert.strictEqual(verifyWakePhrase('hi mikiyas is here i fell asleep'), false);
  assert.strictEqual(verifyWakePhrase('banana banana'), false);
  assert.strictEqual(verifyWakePhrase(''), false);
  assert.strictEqual(verifySleepPhrase('hi mikiyas is here i wake up banana banana'), false);
  console.log('✓ Test 1 Passed: Secret phrase normalization & verification works reliably');

  // Test 2: Salted Hash Security
  console.log('Test 2: SHA-256 salted hash generation');
  const hash1 = hashPhrase(wakeCanonical);
  const hash2 = hashPhrase(wakeCanonical);
  assert.strictEqual(hash1, hash2, 'Deterministic salted hash must match');
  assert.strictEqual(hash1.length, 64, 'SHA-256 hex string must be 64 characters');
  assert(!hash1.includes('Banana'), 'Hash must not contain plaintext secret');
  assert.strictEqual(hash1, WAKE_HASH);
  console.log('✓ Test 2 Passed: SHA-256 salted hash generated securely without plaintext leakage');

  // Test 3: Voice Call Provider Interface & Mock Provider
  console.log('Test 3: Voice Call Provider and Mock Provider');
  const mockProvider = new MockVoiceProvider();
  assert.strictEqual(mockProvider.name, 'MockVoiceProvider');

  const initiateRes = await mockProvider.placeCall({
    to: '+251911000000',
    expectedEventType: 'WAKE',
    promptText: 'Wake up Mikiyas!',
    callbackUrl: 'http://localhost:3000/api/voice/webhook',
  });
  assert(initiateRes.success, 'Mock call initiation must succeed');
  assert(initiateRes.callSid && initiateRes.callSid.startsWith('mock_call_'));
  console.log('✓ Test 3 Passed: Mock Voice Provider functions seamlessly');

  // Test 4: Verbal Confirmations for destructive actions
  console.log('Test 4: Verbal Confirmation verification');
  assert.strictEqual(verifyVerbalConfirmation('Yes please confirm delete', 'delete'), true);
  assert.strictEqual(verifyVerbalConfirmation('No cancel', 'delete'), false);
  assert.strictEqual(verifyVerbalConfirmation('Confirm move to tomorrow', 'move'), true);
  console.log('✓ Test 4 Passed: Verbal confirmation safety check verified');

  // Test 5: Voice Natural Language Command Processing
  console.log('Test 5: Voice Command Natural Language Processing');
  
  // "What is my plan today?"
  const resPlan = await processVoiceCommand('What is my plan today?');
  assert.strictEqual(resPlan.action, 'GET_TODAY_PLAN');
  assert(resPlan.spokenResponse.length > 0);

  // "What am I doing next?"
  const resNext = await processVoiceCommand('What am I doing next?');
  assert.strictEqual(resNext.action, 'GET_NEXT_TASK');

  // "What did I miss today?"
  const resMissed = await processVoiceCommand('What did I miss today?');
  assert.strictEqual(resMissed.action, 'GET_MISSED_TODAY');

  // Unknown command
  const resUnknown = await processVoiceCommand('Tell me a random story');
  assert.strictEqual(resUnknown.action, 'UNKNOWN');
  console.log('✓ Test 5 Passed: Voice command engine accurately processes plan queries, status requests, and unhandled intents');

  console.log('\n--- ALL VOICE ACCOUNTABILITY TESTS PASSED SUCCESSFULLY! ---');
}

runVoiceTests().catch((err) => {
  console.error('Voice test failed:', err);
  process.exit(1);
});
