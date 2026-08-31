import { prisma } from './prisma';
import { getAddisNow, workoutWindowForAddisDate, getWorkoutLocationForAddisDate } from './workoutTime';
import { calculateChemistryOneMonthPlan, calculateJavaScriptPacing } from './studyRoadmaps';
import { getReadingSystemStatus } from './readingEngine';
import { parsePlanMetadata } from './planParser';

const ORDER = ['Push', 'Pull', 'LegsCore'];

export const DEMO_STUDY_SUBJECTS = [
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

/**
 * Ensures today's DailyPlan is populated with the user's real scheduled tasks.
 * If a plan already exists, preserves all existing tasks and completion states.
 */
export async function ensureTodayDailyPlan() {
  const addisNow = getAddisNow();
  const windowInfo = workoutWindowForAddisDate(addisNow);

  // 1. Fetch existing DailyPlan for this Addis window
  let plan = await prisma.dailyPlan.findFirst({
    where: { date: { gte: windowInfo.startUtc, lte: windowInfo.endUtc } },
    include: {
      tasks: {
        orderBy: [{ isStudy: 'desc' }, { priority: 'asc' }],
      },
    },
  });

  const domains = await prisma.domain.findMany();
  const domainByName = new Map(domains.map((d) => [d.name.toLowerCase(), d.id]));
  const defaultDomainId = domains[0]?.id || 'singleton';

  // Query masteries to compute roadmaps
  const masteries = await prisma.studyTopicMastery.findMany();
  const masteredTopicIds = masteries.filter((m) => m.isMastered).map((m) => m.topicId);
  const chemPacing = calculateChemistryOneMonthPlan(masteredTopicIds);

  const jsMasteredIds = masteries
    .filter((m) => m.subject === 'JavaScript' && m.isMastered)
    .map((m) => m.topicId);
  const jsPacing = calculateJavaScriptPacing(jsMasteredIds);

  // Reading status
  const readingStatus = await getReadingSystemStatus();
  const activeBook = readingStatus.activeBook;
  const bookChunk = activeBook?.pacing?.todayChunk || { startPage: 1, endPage: 12, pagesCount: 12, estimatedMinutes: 25 };

  // If no plan exists or has 0 tasks, generate today's real plan
  if (!plan || plan.tasks.length === 0) {
    if (!plan) {
      plan = await prisma.dailyPlan.create({
        data: {
          date: windowInfo.startUtc,
          generatedByAI: false,
        },
        include: { tasks: true },
      });
    }

    // Workout schedule by calendar sequence
    const lastWorkoutLog = await prisma.workoutLog.findFirst({
      orderBy: { completedAt: 'desc' },
      include: { workoutDay: true },
    });
    const lastIndex = lastWorkoutLog ? ORDER.indexOf(lastWorkoutLog.workoutDay.type) : -1;
    const targetType = ORDER[(lastIndex + 1) % ORDER.length] || 'Push';
    const isGym = getWorkoutLocationForAddisDate(windowInfo.startAddis) === 'GYM';
    const locationTag = isGym ? 'GYM' : 'HOME';

    const tasksToCreate = [
      {
        domainId: domainByName.get('study') || defaultDomainId,
        description: JSON.stringify({
          title: `Chemistry — ${chemPacing.currentTopic.name}`,
          subject: 'Chemistry',
          topic: chemPacing.currentTopic.name,
          subtopics: chemPacing.currentTopic.subtopics,
          practiceTarget: chemPacing.currentTopic.practiceTarget,
          reviewTarget: chemPacing.currentTopic.reviewTarget,
          isEntrancePriority: chemPacing.currentTopic.isEntrancePriority,
          sessionBreakdown: chemPacing.currentTopic.sessionBreakdown,
        }),
        minutesTarget: chemPacing.minutesPerDay || 75,
        subject: 'Chemistry',
        topic: chemPacing.currentTopic.name,
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
          title: `📚 Reading — ${activeBook?.title || 'Atomic Habits'} (Pages ${bookChunk.startPage}–${bookChunk.endPage})`,
          subject: 'Reading',
          bookTitle: activeBook?.title || 'Atomic Habits',
          pagesTarget: `${bookChunk.startPage}–${bookChunk.endPage}`,
          pagesCount: bookChunk.pagesCount,
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
      await prisma.planTask.create({
        data: {
          dailyPlanId: plan.id,
          ...t,
        },
      });
    }

    // Re-fetch created plan
    plan = await prisma.dailyPlan.findUnique({
      where: { id: plan.id },
      include: {
        tasks: {
          orderBy: [{ isStudy: 'desc' }, { priority: 'asc' }],
        },
      },
    });
  }

  // Domain map for client representation
  const domainMap = Object.fromEntries(domains.map((d) => [d.id, d]));

  const tasksWithDomain = (plan?.tasks || []).map((t) => {
    const meta = parsePlanMetadata(t.description, t);
    const displayTitle = meta.displayTitle;
    const subtopics = meta.subtopics;
    const isEntrancePriority = meta.isEntrancePriority;

    return {
      ...t,
      displayTitle,
      subtopics,
      isEntrancePriority,
      domain: domainMap[t.domainId] || { name: 'General', color: '#94a3b8', icon: 'check-circle' },
      isLocked: windowInfo.isClosed && !t.completed,
      status: t.completed ? 'COMPLETED' : windowInfo.isClosed ? 'MISSED' : 'PENDING',
    };
  });

  return {
    planId: plan?.id || null,
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
