export interface DailyQuote {
  id: number;
  quote: string;
  author: string;
  role: string;
  category: 'Discipline' | 'Mastery' | 'Resilience' | 'Focus' | 'Wisdom' | 'Vision';
  lesson: string;
}

export const DAILY_QUOTES: DailyQuote[] = [
  {
    id: 1,
    quote: "We don't rise to the level of our expectations, we fall to the level of our training.",
    author: "Archilochus",
    role: "Ancient Philosopher & Warrior",
    category: "Discipline",
    lesson: "When pressure mounts today, your habits and daily preparation are your only real shield.",
  },
  {
    id: 2,
    quote: "You have power over your mind - not outside events. Realize this, and you will find strength.",
    author: "Marcus Aurelius",
    role: "Stoic Emperor & Thinker",
    category: "Resilience",
    lesson: "Separate what is in your control from what is not. Pour 100% of your energy into your actions.",
  },
  {
    id: 3,
    quote: "I fear not the man who has practiced 10,000 kicks once, but I fear the man who has practiced one kick 10,000 times.",
    author: "Bruce Lee",
    role: "Martial Artist & Philosopher",
    category: "Mastery",
    lesson: "Repetition is the mother of skill. Master the fundamentals today and execute them without compromise.",
  },
  {
    id: 4,
    quote: "The secret of getting ahead is getting started. The secret of getting started is breaking your complex overwhelming tasks into small manageable tasks, and starting on the first one.",
    author: "Mark Twain",
    role: "Author & Essayist",
    category: "Focus",
    lesson: "Do not gaze at the entire mountain today. Pick the first 30-minute block and execute it now.",
  },
  {
    id: 5,
    quote: "A teacher can open the door, but you must enter by yourself.",
    author: "Ancient Proverb",
    role: "Master Mentor",
    category: "Wisdom",
    lesson: "Knowledge without execution is merely entertainment. Step through the door with decisive action.",
  },
  {
    id: 6,
    quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    author: "Winston Churchill",
    role: "Statesman & Leader",
    category: "Resilience",
    lesson: "Whether yesterday was a victory or a setback, today reset the scoreboard to zero and forge ahead.",
  },
  {
    id: 7,
    quote: "Simplicity is the ultimate sophistication.",
    author: "Leonardo da Vinci",
    role: "Polymath & Visionary",
    category: "Vision",
    lesson: "Eliminate low-value noise and distraction today. Focus deeply on the 20% that creates 80% of your results.",
  },
  {
    id: 8,
    quote: "Discipline is choosing between what you want now and what you want most.",
    author: "Abraham Lincoln",
    role: "Statesman & Leader",
    category: "Discipline",
    lesson: "Short-term discomfort is the price of long-term greatness. Pay the price gladly today.",
  },
  {
    id: 9,
    quote: "He who has a why to live can bear almost any how.",
    author: "Friedrich Nietzsche",
    role: "Philosopher",
    category: "Wisdom",
    lesson: "Remind yourself why you started this journey. Purpose turns hard work into unstoppable momentum.",
  },
  {
    id: 10,
    quote: "Great things are done by a series of small things brought together.",
    author: "Vincent van Gogh",
    role: "Master Artist",
    category: "Mastery",
    lesson: "One clean set, one completed coding block, one good meal. Stack small wins relentlessly today.",
  },
  {
    id: 11,
    quote: "The impediment to action advances action. What stands in the way becomes the way.",
    author: "Marcus Aurelius",
    role: "Stoic Emperor",
    category: "Resilience",
    lesson: "Every obstacle you encounter today is not a road block — it is the exact training ground you need.",
  },
  {
    id: 12,
    quote: "Do not wait; the time will never be 'just right.' Start where you stand, and work with whatever tools you may have at your command.",
    author: "Napoleon Hill",
    role: "Author & Mentor",
    category: "Focus",
    lesson: "Conditions are never perfect. Perfectionism is just fear in disguise. Execute with what you have.",
  },
  {
    id: 13,
    quote: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    author: "Aristotle",
    role: "Philosopher & Teacher",
    category: "Discipline",
    lesson: "Identity follows behavior. Show up as the master you aspire to be across every single habit today.",
  },
  {
    id: 14,
    quote: "Rest at the end, not in the middle.",
    author: "Kobe Bryant",
    role: "Mamba Mentality Pioneer",
    category: "Focus",
    lesson: "When fatigue whispers excuses, tighten your focus. Finish today's scheduled commitments before relaxing.",
  },
  {
    id: 15,
    quote: "The only limit to our realization of tomorrow will be our doubts of today.",
    author: "Franklin D. Roosevelt",
    role: "Statesman & Leader",
    category: "Vision",
    lesson: "Doubt creates friction. Trust your preparation and move with absolute conviction throughout the day.",
  },
];

/**
 * Deterministically returns the quote of the day based on the calendar day.
 * Respects Africa/Addis_Ababa timezone day rollover.
 */
export function getDailyQuote(customDate?: Date): DailyQuote {
  const now = customDate || new Date();
  // Get day of year (0 - 365)
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - startOfYear.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);

  const index = Math.abs(dayOfYear) % DAILY_QUOTES.length;
  return DAILY_QUOTES[index];
}

export function getRandomQuote(): DailyQuote {
  const randomIndex = Math.floor(Math.random() * DAILY_QUOTES.length);
  return DAILY_QUOTES[randomIndex];
}
