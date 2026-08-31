/**
 * Plan Metadata Parser and Formatter for Forge OS.
 * 
 * Safely parses plan task descriptions (which may be JSON strings, objects,
 * plain text, null, undefined, or malformed JSON) and formats them into
 * human-readable UI cards for Coding, Chemistry, Workout, Reading, and General tasks.
 */

export interface PlanTaskSessionBreakdown {
  learnMins?: number;
  activeRecallMins?: number;
  flashcardsMins?: number;
  practiceMins?: number;
  oldTopicRecallMins?: number;
}

export type PlanTaskCategory = 'CODING' | 'CHEMISTRY' | 'STUDY' | 'WORKOUT' | 'READING' | 'GENERAL';

export interface PlanMetadata {
  category: PlanTaskCategory;
  headerTitle: string; // e.g. "💻 5 MILLION CODERS — JAVASCRIPT", "🧪 CHEMISTRY", "🏋️ WORKOUT", "📚 READING"
  displayTitle: string; // Human-readable one-line summary
  subject?: string;
  module?: string;
  mainTopic?: string;
  topic?: string;
  itemRange?: string;
  subtopics: string[];
  quizzes: string[];
  learningTarget?: string;
  practiceTarget?: string;
  reviewTarget?: string;
  isEntrancePriority: boolean;
  sessionBreakdown: PlanTaskSessionBreakdown | null;
  bookTitle?: string;
  pagesTarget?: string;
  pagesCount?: number;
  workoutType?: string;
  workoutLocation?: string;
  workoutExercises?: string[];
  targetMinutes: number;
  xpTarget?: number;
  rawTitle: string;
}

/**
 * Standard protocol exercises fallback if not attached to task.
 */
const DEFAULT_WORKOUT_EXERCISES: Record<string, Record<string, string[]>> = {
  Push: {
    GYM: [
      'Barbell Bench Press',
      'Dumbbell Shoulder Press',
      'Cable Lateral Raises',
      'Pec Deck Machine',
      'Cable Tricep Pushdown',
    ],
    HOME: [
      'Push-Ups (Standard / Incline)',
      'Pike Push-Ups',
      'Diamond Push-Ups',
      'Chair / Bench Dips',
    ],
  },
  Pull: {
    GYM: [
      'Lat Pulldown (Wide Grip)',
      'Seated Cable Row',
      'Single-Arm Dumbbell Row',
      'Face Pulls (Rope)',
      'Barbell / Dumbbell Bicep Curls',
      'Hammer Curls',
    ],
    HOME: [
      'Doorframe / Table Inverted Rows',
      'Backpack Bent-Over Rows',
      'Towel Isometric Bicep Curls',
      'Prone Cobras / Supermans',
    ],
  },
  LegsCore: {
    GYM: [
      'Barbell Back Squats',
      'Leg Press',
      'Romanian Deadlifts (Dumbbells)',
      'Standing Calf Raises',
      'Hanging Knee / Leg Raises',
      'Plank Holds',
    ],
    HOME: [
      'Bodyweight Squats / Jump Squats',
      'Walking Lunges',
      'Bulgarian Split Squats',
      'Single-Leg Calf Raises',
      'Lying Leg Raises & Planks',
    ],
  },
};

/**
 * Safely parses any task description or metadata object.
 * Guaranteed never to throw or return raw JSON.
 */
export function parsePlanMetadata(rawInput: any, fallbackTask?: any): PlanMetadata {
  let obj: Record<string, any> = {};
  let rawStr = '';

  if (rawInput && typeof rawInput === 'object') {
    obj = rawInput;
    rawStr = typeof obj.description === 'string' ? obj.description : (obj.title || '');
  } else if (typeof rawInput === 'string') {
    rawStr = rawInput.trim();
    if (rawStr.startsWith('{') && rawStr.endsWith('}')) {
      try {
        const parsed = JSON.parse(rawStr);
        if (parsed && typeof parsed === 'object') {
          obj = parsed;
        }
      } catch {
        // Not valid JSON, keep as raw string
        obj = {};
      }
    }
  }

  // Also check if fallbackTask has a json string description
  if (Object.keys(obj).length === 0 && fallbackTask) {
    if (typeof fallbackTask.description === 'string' && fallbackTask.description.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(fallbackTask.description.trim());
        if (parsed && typeof parsed === 'object') {
          obj = parsed;
        }
      } catch {}
    }
  }

  const subjectStr = String(obj.subject || fallbackTask?.subject || fallbackTask?.domain?.name || '').trim();
  const rawTitle = String(obj.title || obj.name || fallbackTask?.title || rawStr || 'Focus Task');

  // Determine category
  let category: PlanTaskCategory = 'GENERAL';
  const combinedText = `${subjectStr} ${rawTitle} ${rawStr} ${obj.module || ''} ${obj.topic || ''} ${obj.mainTopic || ''}`.toLowerCase();

  if (
    subjectStr.toLowerCase() === 'javascript' ||
    combinedText.includes('5 million coders') ||
    combinedText.includes('javascript') ||
    obj.module ||
    obj.learningTarget ||
    (Array.isArray(obj.quizzes) && obj.quizzes.length > 0)
  ) {
    category = 'CODING';
  } else if (
    subjectStr.toLowerCase() === 'chemistry' ||
    combinedText.includes('chemistry') ||
    obj.practiceTarget ||
    obj.reviewTarget ||
    obj.sessionBreakdown
  ) {
    category = 'CHEMISTRY';
  } else if (
    subjectStr.toLowerCase() === 'reading' ||
    combinedText.includes('reading') ||
    obj.bookTitle ||
    obj.pagesTarget ||
    combinedText.includes('pages ') ||
    combinedText.includes('atomic habits') ||
    combinedText.includes('win friends')
  ) {
    category = 'READING';
  } else if (
    combinedText.includes('workout') ||
    combinedText.includes('protocol:') ||
    combinedText.includes('push') ||
    combinedText.includes('pull') ||
    combinedText.includes('legscore') ||
    fallbackTask?.domain?.name?.toLowerCase() === 'workout'
  ) {
    category = 'WORKOUT';
  } else if (
    fallbackTask?.isStudy ||
    ['biology', 'physics', 'mathematics', 'math', 'english', 'study'].includes(subjectStr.toLowerCase())
  ) {
    category = 'STUDY';
  }

  // 1. Coding Card Extraction
  if (category === 'CODING') {
    const moduleName = obj.module || 'Module 4 — Loops';
    const mainTopic = obj.mainTopic || obj.topic || 'While Loops & Counter Fundamentals';
    const subtopics = Array.isArray(obj.subtopics) && obj.subtopics.length > 0
      ? obj.subtopics
      : [
          'intro to loops',
          'while Loops',
          'Parts of a while Loop',
          'Quiz: JuliaJames',
          'Quiz: 99 Bottles of Juice',
          'Quiz: Countdown, Liftoff!',
          'for Loops',
          'parts of a for Loop',
          'Nested Loops',
          'Operators',
          'Quiz: Changing the Loop',
        ];
    const quizzes = Array.isArray(obj.quizzes) ? obj.quizzes : [];
    const learningTarget = obj.learningTarget || 'Master loop initialization, conditional checks, loop increments, and nested loop patterns.';
    const targetMinutes = Number(obj.minutesTarget || fallbackTask?.minutesTarget || 100);

    const displayTitle = obj.title && !obj.title.startsWith('{')
      ? obj.title
      : `5 Million Coders / JavaScript — ${moduleName}: ${mainTopic}`;

    return {
      category: 'CODING',
      headerTitle: '💻 5 MILLION CODERS — JAVASCRIPT',
      displayTitle,
      subject: 'JavaScript',
      module: moduleName,
      mainTopic,
      topic: mainTopic,
      itemRange: obj.itemRange || 'Items 1–11',
      subtopics,
      quizzes,
      learningTarget,
      isEntrancePriority: false,
      sessionBreakdown: null,
      targetMinutes,
      rawTitle: displayTitle,
    };
  }

  // 2. Chemistry Card Extraction
  if (category === 'CHEMISTRY') {
    const topic = obj.topic || obj.mainTopic || 'Chemistry Basics & Classification of Matter';
    const subtopics = Array.isArray(obj.subtopics) && obj.subtopics.length > 0
      ? obj.subtopics
      : [
          'Chemistry and Its Importance',
          'States of Matter',
          'Physical vs Chemical Properties',
          'Pure Substances vs Mixtures',
          'Separation Techniques',
        ];
    const practiceTarget = obj.practiceTarget || '15 Classification & Separation Problems';
    const reviewTarget = obj.reviewTarget || 'Phase diagram definitions & homogeneous vs heterogeneous mixtures';
    const sessionBreakdown: PlanTaskSessionBreakdown = obj.sessionBreakdown || {
      learnMins: 35,
      activeRecallMins: 10,
      flashcardsMins: 10,
      practiceMins: 15,
      oldTopicRecallMins: 5,
    };
    const isEntrancePriority = Boolean(obj.isEntrancePriority);
    const targetMinutes = Number(obj.minutesTarget || fallbackTask?.minutesTarget || 75);

    const displayTitle = obj.title && !obj.title.startsWith('{')
      ? obj.title
      : `Chemistry — ${topic}`;

    return {
      category: 'CHEMISTRY',
      headerTitle: '🧪 CHEMISTRY',
      displayTitle,
      subject: 'Chemistry',
      topic,
      mainTopic: topic,
      subtopics,
      quizzes: [],
      practiceTarget,
      reviewTarget,
      isEntrancePriority,
      sessionBreakdown,
      targetMinutes,
      rawTitle: displayTitle,
    };
  }

  // 3. Workout Card Extraction
  if (category === 'WORKOUT') {
    let workoutType = obj.type || obj.workoutType || '';
    let workoutLocation = obj.location || obj.workoutLocation || '';

    // If not directly in obj, parse from string like "Daily Workout Protocol: Pull (GYM)"
    if (!workoutType) {
      const match = rawStr.match(/Protocol:\s*([A-Za-z0-9]+)(?:\s*\(([^)]+)\))?/i);
      if (match) {
        workoutType = match[1];
        if (match[2]) workoutLocation = match[2].toUpperCase();
      } else {
        const typeMatch = rawStr.match(/\b(Push|Pull|LegsCore|ArmsShoulders)\b/i);
        workoutType = typeMatch ? typeMatch[1] : 'Pull';
      }
    }
    if (!workoutLocation) {
      workoutLocation = rawStr.toUpperCase().includes('HOME') ? 'HOME' : 'GYM';
    }

    const targetMinutes = Number(obj.minutesTarget || fallbackTask?.minutesTarget || 45);
    const workoutExercises = DEFAULT_WORKOUT_EXERCISES[workoutType]?.[workoutLocation] || DEFAULT_WORKOUT_EXERCISES['Pull']['GYM'];
    const displayTitle = `Daily Workout Protocol: ${workoutType} (${workoutLocation})`;

    return {
      category: 'WORKOUT',
      headerTitle: '🏋️ WORKOUT',
      displayTitle,
      subject: 'Workout',
      workoutType,
      workoutLocation,
      workoutExercises,
      subtopics: workoutExercises,
      quizzes: [],
      isEntrancePriority: false,
      sessionBreakdown: null,
      targetMinutes,
      rawTitle: displayTitle,
    };
  }

  // 4. Reading Card Extraction
  if (category === 'READING') {
    let bookTitle = obj.bookTitle || '';
    let pagesTarget = obj.pagesTarget || '';
    let pagesCount = obj.pagesCount ? Number(obj.pagesCount) : 0;

    // Parse from raw string if not structured
    if (!bookTitle) {
      const match = rawStr.match(/Reading\s*[—–-]\s*(.+?)(?:\s*\(Pages\s*([\d–-]+)\))?$/i);
      if (match) {
        bookTitle = match[1].trim();
        pagesTarget = match[2] ? match[2].trim() : '1–11';
      } else {
        bookTitle = 'How to Win Friends and Influence People';
        pagesTarget = '1–11';
      }
    }
    if (!pagesTarget) pagesTarget = '1–11';

    if (!pagesCount && pagesTarget) {
      const pMatch = pagesTarget.match(/(\d+)\s*[–-]\s*(\d+)/);
      if (pMatch) {
        pagesCount = Math.max(1, parseInt(pMatch[2], 10) - parseInt(pMatch[1], 10) + 1);
      } else {
        pagesCount = 11;
      }
    }

    const targetMinutes = Number(obj.minutesTarget || fallbackTask?.minutesTarget || 25);
    const displayTitle = obj.title && !obj.title.startsWith('{')
      ? obj.title
      : `📚 Reading — ${bookTitle} (Pages ${pagesTarget})`;

    return {
      category: 'READING',
      headerTitle: '📚 READING',
      displayTitle,
      subject: 'Reading',
      bookTitle,
      pagesTarget,
      pagesCount: pagesCount || 11,
      subtopics: [`Pages ${pagesTarget}`, `Target: ${pagesCount || 11} pages`],
      quizzes: [],
      isEntrancePriority: false,
      sessionBreakdown: null,
      targetMinutes,
      rawTitle: displayTitle,
    };
  }

  // 5. General / Other Study Task Extraction
  const cleanTitle = obj.title && !obj.title.startsWith('{')
    ? String(obj.title)
    : (fallbackTask?.title || rawStr.replace(/^[{\[].*[}\]]$/, '').trim() || (typeof fallbackTask?.description === 'string' && !fallbackTask.description.startsWith('{') ? fallbackTask.description : '') || fallbackTask?.domain?.name || 'Scheduled Priority');

  const subtopics = Array.isArray(obj.subtopics) ? obj.subtopics : [];
  const targetMinutes = Number(obj.minutesTarget || fallbackTask?.minutesTarget || 30);
  const header = category === 'STUDY'
    ? `📖 ${(subjectStr || 'STUDY').toUpperCase()}`
    : `⚡ ${(fallbackTask?.domain?.name || 'PRIORITY').toUpperCase()}`;

  return {
    category,
    headerTitle: header,
    displayTitle: cleanTitle,
    subject: subjectStr || undefined,
    topic: obj.topic || cleanTitle,
    mainTopic: obj.mainTopic || cleanTitle,
    subtopics,
    quizzes: Array.isArray(obj.quizzes) ? obj.quizzes : [],
    learningTarget: obj.learningTarget || undefined,
    practiceTarget: obj.practiceTarget || undefined,
    reviewTarget: obj.reviewTarget || undefined,
    isEntrancePriority: Boolean(obj.isEntrancePriority),
    sessionBreakdown: obj.sessionBreakdown || null,
    targetMinutes,
    rawTitle: cleanTitle,
  };
}

/**
 * Returns a clean, human-readable one-line title from any task description or object.
 * Ideal for notifications, simple lists, or logs.
 */
export function formatPlanTaskTitle(rawInput: any, fallbackTask?: any): string {
  const meta = parsePlanMetadata(rawInput, fallbackTask);
  return meta.displayTitle;
}
