import { prisma } from './prisma';
import { getAddisNow, workoutWindowForAddisDate } from './workoutTime';

export type RoastCategory =
  | 'WORKOUT_MISSED'
  | 'CHEMISTRY_MISSED'
  | 'JAVASCRIPT_MISSED'
  | 'READING_MISSED'
  | 'COMBINED_MISSED'
  | 'PERFECT_DAY';

interface RoastTemplate {
  category: RoastCategory;
  intensity: number; // 1 to 4
  text: string;
}

export const ROAST_CATALOG: RoastTemplate[] = [
  // ── WORKOUT MISSED ROASTS ──
  {
    category: 'WORKOUT_MISSED',
    intensity: 1,
    text: "Your workout was scheduled, but the weights took a rest day instead. Window closed at 9:28 PM. Tomorrow we get back on track.",
  },
  {
    category: 'WORKOUT_MISSED',
    intensity: 2,
    text: "Bro had 16 hours and 28 minutes to log one workout. The dumbbells filed a missing-persons report at 9:28 PM.",
  },
  {
    category: 'WORKOUT_MISSED',
    intensity: 3,
    text: "Workout closed at 9:28 PM. You had 16 hours and 28 minutes. The checkbox remained untouched. Outstanding commitment to procrastination.",
  },
  {
    category: 'WORKOUT_MISSED',
    intensity: 4,
    text: "Workout missed at 9:28 PM cutoff. Your future six-pack has officially submitted a resignation letter with 2 weeks notice.",
  },
  {
    category: 'WORKOUT_MISSED',
    intensity: 3,
    text: "Forge waited from 05:00 AM to 09:28 PM. The workout waited. The checkbox waited. You apparently had other plans.",
  },
  {
    category: 'WORKOUT_MISSED',
    intensity: 4,
    text: "Your workout wasn't defeated by physical exhaustion. It was defeated by the refusal to tap the checkbox before 09:28 PM.",
  },

  // ── CHEMISTRY MISSED ROASTS ──
  {
    category: 'CHEMISTRY_MISSED',
    intensity: 2,
    text: "Skipped Chemistry today? Even noble gases react more than your study schedule did.",
  },
  {
    category: 'CHEMISTRY_MISSED',
    intensity: 3,
    text: "Chemistry missed today. At this rate, the only thing in dynamic equilibrium is your procrastination and your ambitions.",
  },
  {
    category: 'CHEMISTRY_MISSED',
    intensity: 4,
    text: "You avoided Chemistry today like it's a radioactive isotope. The entrance exam isn't going to lower its activation energy for you.",
  },

  // ── JAVASCRIPT MISSED ROASTS ──
  {
    category: 'JAVASCRIPT_MISSED',
    intensity: 2,
    text: "JavaScript session skipped. Your code didn't crash because you didn't even write it.",
  },
  {
    category: 'JAVASCRIPT_MISSED',
    intensity: 3,
    text: "JavaScript missed today: `Uncaught PromiseRejectedException: Study target was scheduled but coder failed to initialize.`",
  },
  {
    category: 'JAVASCRIPT_MISSED',
    intensity: 4,
    text: "You skipped JavaScript today. While 5 million coders are practicing their syntax, you're debugging your dedication.",
  },

  // ── READING MISSED ROASTS ──
  {
    category: 'READING_MISSED',
    intensity: 2,
    text: "Reading habit untouched today. The books are gathering dust while your screen time thrives.",
  },
  {
    category: 'READING_MISSED',
    intensity: 3,
    text: "You skipped your reading block. The authors spent years condensing wisdom so you could scroll for 45 minutes instead.",
  },

  // ── COMBINED MISSED ROASTS ──
  {
    category: 'COMBINED_MISSED',
    intensity: 2,
    text: "Multiple tasks missed today. Your Todo list is starting to look less like a battle plan and more like a museum exhibit.",
  },
  {
    category: 'COMBINED_MISSED',
    intensity: 3,
    text: "Bro collected unfinished tasks today like they're rare Pokémon cards. Tomorrow's mission: stop giving the checklist character development.",
  },
  {
    category: 'COMBINED_MISSED',
    intensity: 4,
    text: "You skipped multiple core targets today. At this point, your Todo list isn't a schedule — it's historical fiction.",
  },
  {
    category: 'COMBINED_MISSED',
    intensity: 4,
    text: "You skipped the workout, chemistry, JavaScript and reading. At this point your Todo list isn't unfinished. It's being actively ignored.",
  },
  {
    category: 'COMBINED_MISSED',
    intensity: 3,
    text: "Today's plan has officially entered the missing-persons registry. Let's make sure tomorrow isn't an unsolved mystery.",
  },

  // ── PERFECT DAY CELEBRATION (POSITIVE) ──
  {
    category: 'PERFECT_DAY',
    intensity: 1,
    text: "Look at you actually pressing all the checkboxes and crushing every block. Civilization may survive another day! 🚀",
  },
  {
    category: 'PERFECT_DAY',
    intensity: 2,
    text: "Flawless execution today: Workout, Study, Coding & Habits locked in. Unstoppable momentum. Keep this standard.",
  },
  {
    category: 'PERFECT_DAY',
    intensity: 3,
    text: "100% execution score achieved. No excuses made, no checkboxes spared. You're operating in the top 1% today.",
  },
];

/**
 * Hash string for anti-repeat tracking.
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return String(Math.abs(hash));
}

/**
 * Generate a contextual accountability roast with 30-day anti-repeat protection.
 */
export async function getAccountabilityRoast({
  category,
  intensity = 3,
  missedItems = [],
}: {
  category: RoastCategory;
  intensity?: number;
  missedItems?: string[];
}): Promise<{ message: string; category: RoastCategory; missedItems: string[] }> {
  // 1. Fetch recent roast hashes from DB (last 30 days) to prevent repeated messages
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentLogs = await prisma.accountabilityRoastLog.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { roastHash: true },
  });

  const recentHashes = new Set(recentLogs.map((l) => l.roastHash));

  // 2. Filter matching templates by category and intensity threshold
  let available = ROAST_CATALOG.filter(
    (t) => t.category === category && Math.abs(t.intensity - intensity) <= 1
  );

  if (available.length === 0) {
    available = ROAST_CATALOG.filter((t) => t.category === category);
  }

  // 3. Pick unrepeated template if possible
  const unrepeated = available.filter((t) => !recentHashes.has(hashString(t.text)));
  const chosenTemplate = (unrepeated.length > 0 ? unrepeated : available)[
    Math.floor(Math.random() * (unrepeated.length > 0 ? unrepeated.length : available.length))
  ] || ROAST_CATALOG[0];

  let finalMessage = chosenTemplate.text;

  // Add missed context if multiple items
  if (category === 'COMBINED_MISSED' && missedItems.length > 0) {
    finalMessage += `\n\n⚠️ Missed Targets:\n${missedItems.map((m) => `• ${m}`).join('\n')}`;
  }

  // 4. Record roast log in DB
  const addisNow = getAddisNow();
  const { startAddis } = workoutWindowForAddisDate(addisNow);
  const normalizedDate = new Date(
    Date.UTC(startAddis.getFullYear(), startAddis.getMonth(), startAddis.getDate())
  );

  const roastHash = hashString(chosenTemplate.text);

  await prisma.accountabilityRoastLog.upsert({
    where: {
      date_category: {
        date: normalizedDate,
        category,
      },
    },
    create: {
      date: normalizedDate,
      category,
      intensity,
      roastHash,
      message: finalMessage,
    },
    update: {
      message: finalMessage,
      roastHash,
    },
  }).catch(() => {});

  return {
    message: finalMessage,
    category,
    missedItems,
  };
}
