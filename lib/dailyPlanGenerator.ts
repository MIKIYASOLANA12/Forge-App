import { prisma } from './prisma';
import { getAddisNow, workoutWindowForAddisDate, getWorkoutLocationForAddisDate } from './workoutTime';
import { calculateChemistryOneMonthPlan, calculateJavaScriptPacing } from './studyRoadmaps';
import { getReadingSystemStatus } from './readingEngine';
import { parsePlanMetadata } from './planParser';
import { getSubjectRoadmap, getNextTopicInRoadmap } from './subjectRoadmapsData';

const ORDER = ['Push', 'Pull', 'LegsCore'];

export interface DemoStudySubject {
  subject: string;
  demoTask: string;
  targetMinutes: number;
  progress: string;
  isDemo: boolean;
}

export const DEMO_STUDY_SUBJECTS: DemoStudySubject[] = [
  {
    subject: 'Biology',
    demoTask: 'Cell Structure & Membrane Transport Drill',
    targetMinutes: 45,
    progress: 'Demo Structure · Pending User Topic List',
    isDemo: true,
  },
  {
    subject: 'Mathematics',
    demoTask: 'Calculus: Limits & Differential Problem Sets',
    targetMinutes: 60,
    progress: 'Demo Structure · Pending User Topic List',
    isDemo: true,
  },
  {
    subject: 'Physics',
    demoTask: 'Kinematics & Newton’s Laws Core Drills',
    targetMinutes: 50,
    progress: 'Demo Structure · Pending User Topic List',
    isDemo: true,
  },
  {
    subject: 'English',
    demoTask: 'Advanced Vocabulary & Reading Comprehension',
    targetMinutes: 30,
    progress: 'Demo Structure · Pending User Topic List',
    isDemo: true,
  },
];

export interface EnrichedTaskDomain {
  id?: string;
  name: string;
  color: string;
  icon: string;
  weight?: number;
}

export interface EnrichedPlanTask {
  id: string;
  dailyPlanId: string;
  domainId: string;
  description: string;
  minutesTarget: number;
  completed: boolean;
  googleEventId: string | null;
  subject: string | null;
  topic: string | null;
  priority: string | null;
  xpTarget: number | null;
  plannedStartTime: string | null;
  plannedEndTime: string | null;
  isStudy: boolean;
  displayTitle: string;
  subtopics: string[];
  isEntrancePriority: boolean;
  domain: EnrichedTaskDomain;
  isLocked: boolean;
  status: 'COMPLETED' | 'MISSED' | 'PENDING';
}

export interface EnrichedDailyPlan {
  planId: string;
  startAddis: Date;
  closeAddis: Date;
  closeUtc: Date;
  nextUnlockUtc: Date;
  isClosed: boolean;
  isOpen: boolean;
  tasks: EnrichedPlanTask[];
  studyProgress: {
    javascript: ReturnType<typeof calculateJavaScriptPacing>;
    chemistry: ReturnType<typeof calculateChemistryOneMonthPlan>;
  };
  readingStatus: Awaited<ReturnType<typeof getReadingSystemStatus>>;
  demoSubjects: DemoStudySubject[];
}

/**
 * Ensures today's DailyPlan is populated with the user's real scheduled tasks.
 * If a plan already exists, preserves all existing tasks and completion states.
 * Always returns a standardized, fully-enriched EnrichedDailyPlan.
 */
export async function ensureTodayDailyPlan(): Promise<EnrichedDailyPlan> {
  const addisNow = getAddisNow();
  const windowInfo = workoutWindowForAddisDate(addisNow);

  // 1. Fetch domains for task mapping
  const domains = await prisma.domain.findMany().catch(() => []);
  const domainByName = new Map(domains.map((d) => [d.name.toLowerCase(), d.id]));
  const domainMap: Record<string, EnrichedTaskDomain> = Object.fromEntries(
    domains.map((d) => [d.id, { id: d.id, name: d.name, color: d.color, icon: d.icon, weight: d.weight }])
  );
  const defaultDomainId = domains[0]?.id || 'singleton';

  // 2. Query masteries to compute roadmaps
  const masteries = await prisma.studyTopicMastery.findMany().catch(() => []);
  const masteredTopicIds = masteries.filter((m) => m.isMastered).map((m) => m.topicId);
  const chemPacing = calculateChemistryOneMonthPlan(masteredTopicIds);

  const jsMasteredIds = masteries
    .filter((m) => m.subject === 'JavaScript' && m.isMastered)
    .map((m) => m.topicId);
  const jsPacing = calculateJavaScriptPacing(jsMasteredIds);

  // 3. Reading status
  const readingStatus = await getReadingSystemStatus();
  const activeBook = readingStatus.activeBook;
  const bookChunk = activeBook?.pacing?.todayChunk || {
    startPage: 1,
    endPage: 12,
    pagesCount: 12,
    estimatedMinutes: 25,
  };

  // 4. Fetch existing DailyPlan for this Addis window
  let plan = await prisma.dailyPlan
    .findFirst({
      where: { date: { gte: windowInfo.startUtc, lte: windowInfo.endUtc } },
      include: {
        tasks: {
          orderBy: [{ isStudy: 'desc' }, { priority: 'asc' }],
        },
      },
    })
    .catch(() => null);

  // 5. If no plan exists or existing plan has 0 tasks, generate today's real plan
  if (!plan || plan.tasks.length === 0) {
    if (!plan) {
      try {
        plan = await prisma.dailyPlan.create({
          data: {
            date: windowInfo.startUtc,
            generatedByAI: false,
          },
          include: { tasks: true },
        });
      } catch {
        // In case of race condition / unique constraint, fetch existing
        plan = await prisma.dailyPlan.findFirst({
          where: { date: { gte: windowInfo.startUtc, lte: windowInfo.endUtc } },
          include: {
            tasks: {
              orderBy: [{ isStudy: 'desc' }, { priority: 'asc' }],
            },
          },
        });
      }
    }

    if (plan && plan.tasks.length === 0) {
      // Workout schedule by calendar sequence
      const lastWorkoutLog = await prisma.workoutLog
        .findFirst({
          orderBy: { completedAt: 'desc' },
          include: { workoutDay: true },
        })
        .catch(() => null);
      const lastIndex = lastWorkoutLog ? ORDER.indexOf(lastWorkoutLog.workoutDay.type) : -1;
      const targetType = ORDER[(lastIndex + 1) % ORDER.length] || 'Push';
      const isGym = getWorkoutLocationForAddisDate(windowInfo.startAddis) === 'GYM';
      const locationTag = isGym ? 'GYM' : 'HOME';

      // Authoritative Chemistry Master Roadmap Lookup
      const chemRoadmap = getSubjectRoadmap('CHEMISTRY');
      let activeChemTopic = chemRoadmap.units[0]?.topics[0];
      let activeChemUnit = chemRoadmap.units[0];

      // If user has mastered topics, find next topic in sequence
      const nextChemInfo = getNextTopicInRoadmap('CHEMISTRY', masteredTopicIds[masteredTopicIds.length - 1]);
      if (nextChemInfo) {
        activeChemUnit = nextChemInfo.unit;
        activeChemTopic = nextChemInfo.topic;
      }

      const tasksToCreate = [
        {
          domainId: domainByName.get('study') || defaultDomainId,
          description: JSON.stringify({
            title: `Chemistry — ${activeChemTopic?.title || chemPacing.currentTopic.name}`,
            subject: 'CHEMISTRY',
            unitId: activeChemUnit?.id || 'chemistry_u1',
            unitTitle: activeChemUnit?.title || 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
            topicId: activeChemTopic?.id || 'chemistry_u1_t1',
            topicTitle: activeChemTopic?.title || chemPacing.currentTopic.name,
            subtopics: activeChemTopic?.subtopics || chemPacing.currentTopic.subtopics,
            practiceTarget: chemPacing.currentTopic.practiceTarget,
            reviewTarget: chemPacing.currentTopic.reviewTarget,
            isEntrancePriority: chemPacing.currentTopic.isEntrancePriority,
            sessionBreakdown: chemPacing.currentTopic.sessionBreakdown,
            isStudy: true,
          }),
          minutesTarget: chemPacing.minutesPerDay || 75,
          subject: 'CHEMISTRY',
          topic: activeChemTopic?.title || chemPacing.currentTopic.name,
          priority: chemPacing.currentTopic.isEntrancePriority ? 'HIGH' : 'MEDIUM',
          plannedStartTime: '06:00',
          plannedEndTime: '07:30',
          isStudy: true,
          xpTarget: chemPacing.currentTopic.isEntrancePriority ? 120 : 85,
        },
        {
          domainId: domainByName.get('coding') || domainByName.get('study') || defaultDomainId,
          description: JSON.stringify({
            title: `5 Million Coders / JavaScript — ${jsPacing.currentLesson.module}: ${jsPacing.currentLesson.mainTopic}`,
            subject: 'JavaScript',
            module: jsPacing.currentLesson.module,
            mainTopic: jsPacing.currentLesson.mainTopic,
            itemRange: jsPacing.currentLesson.itemRange,
            subtopics: jsPacing.currentLesson.subtopics,
            quizzes: jsPacing.currentLesson.quizzes,
            learningTarget: jsPacing.currentLesson.learningTarget,
          }),
          minutesTarget: jsPacing.currentLesson.targetMinutes || 100,
          subject: 'JavaScript',
          topic: jsPacing.currentLesson.mainTopic,
          priority: 'HIGH',
          plannedStartTime: '08:00',
          plannedEndTime: '09:40',
          isStudy: true,
          xpTarget: 110,
        },
        {
          domainId: domainByName.get('workout') || defaultDomainId,
          description: `Daily Workout Protocol: ${targetType} (${locationTag})`,
          minutesTarget: 45,
          priority: 'HIGH',
          plannedStartTime: '17:00',
          plannedEndTime: '17:45',
          isStudy: false,
          xpTarget: 100,
        },
        {
          domainId: domainByName.get('reading') || defaultDomainId,
          description: JSON.stringify({
            title: `📚 Reading — ${activeBook?.title || 'How to Win Friends and Influence People'} (Pages ${bookChunk.startPage}–${bookChunk.endPage})`,
            subject: 'Reading',
            bookTitle: activeBook?.title || 'How to Win Friends and Influence People',
            pagesTarget: `${bookChunk.startPage}–${bookChunk.endPage}`,
            pagesCount: bookChunk.pagesCount || 11,
          }),
          minutesTarget: bookChunk.estimatedMinutes || 25,
          priority: 'MEDIUM',
          plannedStartTime: '20:30',
          plannedEndTime: '21:00',
          isStudy: false,
          xpTarget: 35,
        },
      ];

      for (const t of tasksToCreate) {
        await prisma.planTask
          .create({
            data: {
              dailyPlanId: plan.id,
              ...t,
            },
          })
          .catch(() => null);
      }

      // Re-fetch created plan with ordered tasks
      plan = await prisma.dailyPlan.findUnique({
        where: { id: plan.id },
        include: {
          tasks: {
            orderBy: [{ isStudy: 'desc' }, { priority: 'asc' }],
          },
        },
      });
    }
  }

  // 6. Enrich all tasks consistently
  const rawTasks = plan?.tasks || [];
  const tasksWithDomain: EnrichedPlanTask[] = rawTasks.map((t) => {
    const meta = parsePlanMetadata(t.description, t);
    const displayTitle = meta.displayTitle;
    const subtopics = meta.subtopics;
    const isEntrancePriority = meta.isEntrancePriority;
    const domain = domainMap[t.domainId] || {
      id: t.domainId,
      name: 'General',
      color: '#94a3b8',
      icon: 'check-circle',
    };

    return {
      id: t.id,
      dailyPlanId: t.dailyPlanId,
      domainId: t.domainId,
      description: t.description,
      minutesTarget: t.minutesTarget,
      completed: t.completed,
      googleEventId: t.googleEventId,
      subject: t.subject,
      topic: t.topic,
      priority: t.priority,
      xpTarget: t.xpTarget,
      plannedStartTime: t.plannedStartTime,
      plannedEndTime: t.plannedEndTime,
      isStudy: t.isStudy,
      displayTitle,
      subtopics,
      isEntrancePriority,
      domain,
      isLocked: windowInfo.isClosed && !t.completed,
      status: t.completed ? 'COMPLETED' : windowInfo.isClosed ? 'MISSED' : 'PENDING',
    };
  });

  return {
    planId: plan?.id || 'today-plan',
    startAddis: windowInfo.startAddis,
    closeAddis: windowInfo.closeAddis,
    closeUtc: windowInfo.closeUtc,
    nextUnlockUtc: windowInfo.nextUnlockUtc,
    isClosed: windowInfo.isClosed,
    isOpen: windowInfo.isOpen,
    tasks: tasksWithDomain,
    studyProgress: {
      javascript: jsPacing,
      chemistry: chemPacing,
    },
    readingStatus,
    demoSubjects: DEMO_STUDY_SUBJECTS,
  };
}
