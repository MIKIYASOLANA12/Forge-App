import { prisma } from './prisma';
import { getAddisNow } from './workoutTime';

export const MAJOR_DEADLINE_2027 = new Date('2027-06-25T00:00:00.000Z');

export const PERSONAL_DEVELOPMENT_AREAS = [
  { id: 'discipline', name: 'Discipline & Habits', icon: 'zap', color: '#f59e0b', weight: 1.0 },
  { id: 'communication', name: 'Communication & Speaking', icon: 'message-circle', color: '#3b82f6', weight: 1.0 },
  { id: 'influence', name: 'Ethical Influence & Relationships', icon: 'users', color: '#8b5cf6', weight: 1.0 },
  { id: 'business', name: 'Business Fundamentals', icon: 'briefcase', color: '#10b981', weight: 1.0 },
  { id: 'startup', name: 'Startup & Product Thinking', icon: 'rocket', color: '#ec4899', weight: 1.0 },
  { id: 'personal_brand', name: 'Personal Brand & Creator Identity', icon: 'sparkles', color: '#06b6d4', weight: 1.0 },
  { id: 'money', name: 'Money Behavior & Psychology', icon: 'dollar-sign', color: '#84cc16', weight: 1.0 },
  { id: 'investing', name: 'Investing & Assets', icon: 'trending-up', color: '#14b8a6', weight: 1.0 },
  { id: 'problem_solving', name: 'Problem Solving & Clarity', icon: 'cpu', color: '#6366f1', weight: 1.0 },
  { id: 'leadership', name: 'Leadership & Vision', icon: 'award', color: '#f97316', weight: 1.0 },
  { id: 'decision_making', name: 'Decision Making & Mental Models', icon: 'compass', color: '#e11d48', weight: 1.0 },
  { id: 'content_creation', name: 'Content Creation & Presentation', icon: 'video', color: '#a855f7', weight: 1.0 },
];

export const INITIAL_CURRICULUM = [
  {
    order: 1,
    title: 'Atomic Habits',
    author: 'James Clear',
    totalPages: 320,
    deadlineDays: 28,
    category: 'discipline',
    goals: 'Build unbreakable daily systems, habit stacking, identity-based habits, and 1% compounding.',
    competencyTags: JSON.stringify(['Discipline & Habits', 'Decision Making & Mental Models']),
    actionRecommendation: 'Identify one 2-minute habit and stack it immediately after your morning coffee or workout.',
  },
  {
    order: 2,
    title: 'How to Win Friends and Influence People',
    author: 'Dale Carnegie',
    totalPages: 288,
    deadlineDays: 25,
    category: 'communication',
    goals: 'Active listening, genuine appreciation, ethical persuasion, resolving conflicts, and becoming a trusted speaker.',
    competencyTags: JSON.stringify(['Communication & Speaking', 'Ethical Influence & Relationships', 'Leadership & Vision']),
    actionRecommendation: 'Practice active listening in your next conversation: ask two questions without speaking about yourself.',
  },
  {
    order: 3,
    title: 'The Personal MBA',
    author: 'Josh Kaufman',
    totalPages: 496,
    deadlineDays: 45,
    category: 'business',
    goals: 'Master the 5 fundamental pillars of business: Value Creation, Marketing, Sales, Value Delivery, and Finance.',
    competencyTags: JSON.stringify(['Business Fundamentals', 'Decision Making & Mental Models', 'Problem Solving & Clarity']),
    actionRecommendation: 'Map one of your software project ideas across the 5 Business Pillars (Creation, Marketing, Sales, Delivery, Finance).',
  },
  {
    order: 4,
    title: 'The Lean Startup',
    author: 'Eric Ries',
    totalPages: 336,
    deadlineDays: 30,
    category: 'startup',
    goals: 'Build-Measure-Learn feedback loops, Minimum Viable Product (MVP), validated learning, and agile pivots.',
    competencyTags: JSON.stringify(['Startup & Product Thinking', 'Problem Solving & Clarity', 'Business Fundamentals']),
    actionRecommendation: 'Define the smallest possible MVP test for a feature before writing complex code.',
  },
  {
    order: 5,
    title: 'Show Your Work!',
    author: 'Austin Kleon',
    totalPages: 224,
    deadlineDays: 20,
    category: 'personal_brand',
    goals: 'Public learning, sharing the process, building a digital network, and ethical creator positioning.',
    competencyTags: JSON.stringify(['Personal Brand & Creator Identity', 'Content Creation & Presentation', 'Communication & Speaking']),
    actionRecommendation: 'Post one concise snippet of what you learned in JavaScript or Chemistry today on your public channel.',
  },
  {
    order: 6,
    title: 'The Psychology of Money',
    author: 'Morgan Housel',
    totalPages: 256,
    deadlineDays: 24,
    category: 'money',
    goals: 'Behavioral finance, the illusion of control, compounding over decades, and freedom over luxury.',
    competencyTags: JSON.stringify(['Money Behavior & Psychology', 'Investing & Assets', 'Discipline & Habits']),
    actionRecommendation: 'Define your personal "enough" metric and review your long-term savings discipline.',
  },
  {
    order: 7,
    title: 'The Intelligent Investor',
    author: 'Benjamin Graham',
    totalPages: 640,
    deadlineDays: 55,
    category: 'investing',
    goals: 'Margin of safety, defensive vs enterprising investing, Mr. Market psychology, and fundamental asset valuation.',
    competencyTags: JSON.stringify(['Investing & Assets', 'Business Fundamentals', 'Decision Making & Mental Models']),
    actionRecommendation: 'Analyze an asset purely on fundamentals (earnings power and margin of safety) rather than price noise.',
  },
];

/**
 * Calculates the countdown to Friday, June 25, 2027 from current Addis date.
 */
export function get2027DeadlineMetrics(now: Date = getAddisNow()) {
  const diffMs = MAJOR_DEADLINE_2027.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const totalJourneyDays = 303; // Base journey
  const daysPassed = Math.max(1, totalJourneyDays - daysRemaining);
  const percentage = Math.min(100, Math.max(0, Math.round((daysPassed / totalJourneyDays) * 100)));

  return {
    targetDateFormatted: 'Friday, June 25, 2027',
    targetDateIso: MAJOR_DEADLINE_2027.toISOString(),
    daysRemaining,
    daysPassed,
    totalJourneyDays,
    percentage,
    journeyFormatted: `Day ${daysPassed} / ${totalJourneyDays}`,
  };
}

/**
 * Ensures the initial sequential reading curriculum is seeded.
 */
export async function ensureReadingCurriculum() {
  const existingBooks = await prisma.book.findMany({ orderBy: { order: 'asc' } });

  if (existingBooks.length === 0) {
    for (const item of INITIAL_CURRICULUM) {
      await prisma.book.create({
        data: {
          title: item.title,
          author: item.author,
          totalPages: item.totalPages,
          startPage: 1,
          currentPage: 0,
          deadlineDays: item.deadlineDays,
          category: item.category,
          goals: item.goals,
          competencyTags: item.competencyTags,
          order: item.order,
          status: item.order === 1 ? 'reading' : 'queued',
          startDate: item.order === 1 ? new Date() : null,
          targetFinishDate: item.order === 1 ? new Date(Date.now() + item.deadlineDays * 86400000) : null,
        },
      });
    }
  }
}

/**
 * Calculates pacing metrics for a book.
 */
export function calculateBookPacing(book: {
  currentPage: number;
  totalPages: number;
  startPage: number;
  deadlineDays: number;
  startDate: Date | null;
  targetFinishDate: Date | null;
  status: string;
}) {
  const totalPages = Math.max(1, book.totalPages || 320);
  const currentPage = Math.max(0, book.currentPage || 0);
  const remainingPages = Math.max(0, totalPages - currentPage);
  const percentage = Math.min(100, Math.round((currentPage / totalPages) * 100));

  const startDate = book.startDate ? new Date(book.startDate) : new Date();
  const targetFinishDate = book.targetFinishDate
    ? new Date(book.targetFinishDate)
    : new Date(startDate.getTime() + (book.deadlineDays || 30) * 86400000);

  const now = new Date();
  const diffDays = Math.max(1, Math.ceil((targetFinishDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(1, diffDays);

  const requiredPagesPerDay = remainingPages > 0 ? Math.max(1, Math.ceil(remainingPages / daysRemaining)) : 0;
  const standardPagesPerDay = Math.max(1, Math.ceil(totalPages / (book.deadlineDays || 30)));

  const isBehind = requiredPagesPerDay > standardPagesPerDay * 1.25 && remainingPages > 0;

  // Today's reading chunk
  const todayStartPage = currentPage + 1;
  const todayEndPage = Math.min(totalPages, todayStartPage + requiredPagesPerDay - 1);
  const todayPagesCount = Math.max(0, todayEndPage - todayStartPage + 1);

  return {
    totalPages,
    currentPage,
    remainingPages,
    percentage,
    daysRemaining,
    requiredPagesPerDay,
    standardPagesPerDay,
    isBehind,
    statusText: book.status === 'finished' ? '🏆 COMPLETED' : isBehind ? '⚠️ BEHIND SCHEDULE' : '🟢 ON TRACK',
    todayChunk: {
      startPage: todayStartPage,
      endPage: todayEndPage,
      pagesCount: todayPagesCount,
      estimatedMinutes: Math.round(todayPagesCount * 2.2), // ~2.2 mins per page active reading
    },
  };
}

/**
 * Returns the complete reading system status, active book, queue, reflections, and 2027 metrics.
 */
export async function getReadingSystemStatus() {
  await ensureReadingCurriculum();

  const books = await prisma.book.findMany({
    orderBy: { order: 'asc' },
    include: {
      reflections: {
        orderBy: { date: 'desc' },
        take: 10,
      },
    },
  });

  // Current active book is the first one with status 'reading' or non-finished
  const activeBook = books.find((b) => b.status === 'reading') || books.find((b) => b.status === 'queued') || books[0];
  const queue = books.filter((b) => b.id !== activeBook?.id);
  const finishedBooks = books.filter((b) => b.status === 'finished');

  const pacing = activeBook ? calculateBookPacing(activeBook) : null;
  const deadline2027 = get2027DeadlineMetrics();

  // Competency Progress aggregation
  const totalPagesRead = books.reduce((sum, b) => sum + (b.status === 'finished' ? b.totalPages : b.currentPage), 0);
  const totalReflectionsCount = await prisma.bookDailyReflection.count();

  return {
    deadline2027,
    activeBook: activeBook
      ? {
          ...activeBook,
          pacing,
        }
      : null,
    queue: queue.map((b) => ({
      ...b,
      pacing: calculateBookPacing(b),
    })),
    finishedBooks: finishedBooks.map((b) => ({
      ...b,
      pacing: calculateBookPacing(b),
    })),
    stats: {
      booksCompletedCount: finishedBooks.length,
      totalBooksCount: books.length,
      totalPagesRead,
      totalReflectionsCount,
    },
    developmentAreas: PERSONAL_DEVELOPMENT_AREAS,
  };
}
