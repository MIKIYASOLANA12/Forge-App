const baseUrl = process.env.WORKOUT_API_URL || 'http://localhost:3000';
const authCookie = process.env.WORKOUT_AUTH_COOKIE;

const requiredFields = [
  'currentDayName', 'currentDateFormatted', 'openTimeFormatted', 'closeTimeFormatted',
  'closeTimestamp', 'nextUnlockTimestamp', 'isOpen', 'isClosed', 'day300',
  'targetBodyParts', 'focusBadges', 'targetDescription', 'day', 'dailyCore',
  'nextWorkout', 'weekNumber', 'countdowns', 'yesterday',
] as const;

async function main() {
  const response = await fetch(`${baseUrl}/api/workout/today`, {
    headers: authCookie ? { Cookie: authCookie } : undefined,
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Expected HTTP 200, received ${response.status}: ${JSON.stringify(body)}`);
  }

  const missing = requiredFields.filter((field) => !(field in (body || {})));
  if (missing.length > 0) throw new Error(`Missing required workout fields: ${missing.join(', ')}`);
  if (!body.day?.exercises?.length) throw new Error('Workout response contains no exercises');

  console.log(`HTTP ${response.status}`);
  console.log(`Day: ${body.currentDayName}`);
  console.log(`Location: ${body.day.location}`);
  console.log(`Body parts: ${body.targetBodyParts}`);
  console.log(`Exercises: ${body.day.exercises.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
