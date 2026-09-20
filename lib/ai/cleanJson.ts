/**
 * Utility to reliably extract and parse JSON from AI model responses.
 * Handles markdown code fences (```json ... ```), preamble/postamble text,
 * and trailing commas if present.
 */
export function extractAndParseJson<T = unknown>(rawText: string): T {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Cannot parse empty or non-string AI response as JSON.');
  }

  let cleaned = rawText.trim();

  // Strip markdown code blocks
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  cleaned = cleaned.trim();

  // Try direct parse first
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Locate the first { or [ and last } or ]
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');

    let candidate = '';
    // Decide whether to slice object or array based on which comes first
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      if (lastBrace > firstBrace) {
        candidate = cleaned.slice(firstBrace, lastBrace + 1);
      }
    } else if (firstBracket !== -1) {
      if (lastBracket > firstBracket) {
        candidate = cleaned.slice(firstBracket, lastBracket + 1);
      }
    }

    if (candidate) {
      try {
        return JSON.parse(candidate) as T;
      } catch (innerErr) {
        // Fix common trailing comma issues e.g. [1, 2,] or {"a": 1,}
        const fixedCandidate = candidate
          .replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(fixedCandidate) as T;
      }
    }

    throw new Error(`Failed to extract valid JSON from AI response: ${rawText.slice(0, 200)}...`);
  }
}
