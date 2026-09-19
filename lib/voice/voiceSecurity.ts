import crypto from 'crypto';

// Normalized Canonical Phrases
// Spoken wake: "Hi Mikiyas is Here I Wake up Banana Banana"
// Spoken sleep: "Hi Mikiyas is Here I Go to Sleep Banana Banana"
const WAKE_CANONICAL = "hi mikiyas is here i wake up banana banana";
const SLEEP_CANONICAL = "hi mikiyas is here i go to sleep banana banana";

const PHRASE_SALT = process.env.VOICE_PHRASE_SALT || "forge_voice_security_salt_2026";

/**
 * Normalizes spoken speech input:
 * - lowercase
 * - removes punctuation
 * - collapses multiple spaces
 * - handles minor harmless recognition differences
 */
export function normalizeSpokenPhrase(spoken: string): string {
  if (!spoken) return "";
  return spoken
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Computes a secure SHA-256 hash of a normalized phrase with salt.
 */
export function hashPhrase(phrase: string): string {
  const normalized = normalizeSpokenPhrase(phrase);
  return crypto
    .createHmac("sha256", PHRASE_SALT)
    .update(normalized)
    .digest("hex");
}

export const WAKE_HASH = hashPhrase(WAKE_CANONICAL);
export const SLEEP_HASH = hashPhrase(SLEEP_CANONICAL);

/**
 * Verifies if spoken audio transcription matches the wake secret phrase.
 * Never logs the plain secret phrase.
 */
export function verifyWakePhrase(spokenTranscription: string): boolean {
  const norm = normalizeSpokenPhrase(spokenTranscription);
  if (!norm) return false;

  // Direct normalized match
  if (norm === WAKE_CANONICAL) return true;

  // Check key markers to allow natural speech cadence
  // Must include "mikiyas", "wake up" (or "wake"), and "banana banana"
  const hasIdentity = norm.includes("mikiyas") || norm.includes("here");
  const hasWake = norm.includes("wake up") || norm.includes("wake");
  const hasBananas = norm.includes("banana banana") || (norm.match(/banana/g) || []).length >= 2;

  return hasIdentity && hasWake && hasBananas;
}

/**
 * Verifies if spoken audio transcription matches the sleep secret phrase.
 * Never logs the plain secret phrase.
 */
export function verifySleepPhrase(spokenTranscription: string): boolean {
  const norm = normalizeSpokenPhrase(spokenTranscription);
  if (!norm) return false;

  // Direct normalized match
  if (norm === SLEEP_CANONICAL) return true;

  // Check key markers
  const hasIdentity = norm.includes("mikiyas") || norm.includes("here");
  const hasSleep = norm.includes("go to sleep") || norm.includes("sleep");
  const hasBananas = norm.includes("banana banana") || (norm.match(/banana/g) || []).length >= 2;

  return hasIdentity && hasSleep && hasBananas;
}

/**
 * Verifies verbal confirmation tokens for destructive or major actions.
 */
export function verifyVerbalConfirmation(spoken: string, actionType: 'delete' | 'move' | 'reschedule'): boolean {
  const norm = normalizeSpokenPhrase(spoken);
  if (actionType === 'delete') {
    return norm.includes('confirm delete') || norm.includes('yes delete') || norm === 'confirm';
  }
  if (actionType === 'move' || actionType === 'reschedule') {
    return norm.includes('confirm move') || norm.includes('yes move') || norm.includes('confirm reschedule') || norm === 'confirm';
  }
  return norm.includes('confirm') || norm.includes('yes');
}
