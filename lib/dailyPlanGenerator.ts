import { prisma } from './prisma';
import { getAddisNow, workoutWindowForAddisDate, getWorkoutLocationForAddisDate } from './workoutTime';
import { calculateChemistryOneMonthPlan, calculateJavaScriptPacing } from './studyRoadmaps';

const ORDER = ['Push', 'Pull', 'LegsCore'];

/**
 * Ensures today's DailyPlan is populated with the user's real scheduled tasks.
 * If a plan already exists, preserves all existing tasks and completion states.
 */
export async function ensureTodayDailyPlan() {
  const addisNow = getAddisNow();
  const { startUtc, endUtc, startAddis, isClosed, closeUtc, nextUnlockUtc } = workoutWindowForAddisDate(addisNow);

  // 1. Fetch existing DailyPlan for this Addis window
  let plan = await prisma.dailyPlan.findFirst({
    where: { date: { gte: startUtc, lte: endUtc } },
    include: {
      tasks: {
        orderBy: [{ isStudy: 'desc' }, { priority: 'asc' }],
      },
    },
  });

  const domains = await prisma.domain.findMany();
  const domainByName = new Map(domains.map((d) => [d.name.toLowerCase(), d.id]));
  const defaultDomainId = domains[0]?.id || 'singleton';

  // If no plan exists or has 0 tasks, generate today's real plan
  if (!plan || plan.tasks.length === 0) {
    if (!plan) {
      plan = await prisma.dailyPlan.create({
        data: {
          date: startUtc,
          generatedByAI: false,
        },
        include: { tasks: true },
      });
    }

    // A. Query Chemistry roadmap progress
    const masteries = await prisma.studyTopicMastery.findMany();
    const masteredTopicIds = masteries.filter((m) => m.isMastered).map((m) => m.topicId);
    const chemPacing = calculateChemistryOneMonthPlan(masteredTopicIds);

    // B. Query JavaScript 5 Million Coders roadmap progress
    const jsMasteredIds = masteries
      .filter((m) => m.subject === 'JavaScript' && m.isMastered)
      .map((m) => m.topicId);
    const jsPacing = calculateJavaScriptPacing(jsMasteredIds);

    // C. Query Workout schedule
    const lastWorkoutLog = await prisma.workoutLog.findFirst({
      orderBy: { completedAt: 'desc' },
      include: { workoutDay: true },
    });
    const lastIndex = lastWorkoutLog ? ORDER.indexOf(lastWorkoutLog.workoutDay.type) : -1;
    const targetType = ORDER[(lastIndex + 1) % ORDER.length] || 'Push';
    const isGym = getWorkoutLocationForAddisDate(startAddis) === 'GYM';
    const locationTag = isGym ? 'GYM' : 'HOME';

    const tasksToCreate = [
      {
        domainId: domainByName.get('study') || defaultDomainId,
        description: `Chemistry — ${chemPacing.currentTopic.name} (Learn, Active Recall & Practice)`,
        minutesTarget: chemPacing.minutesPerDay || 60,
        subject: 'Chemistry',
        topic: chemPacing.currentTopic.name,
        priority: 'HIGH',
        plannedStartTime: '06:00',
        plannedEndTime: '07:30',
        isStudy: true,
        xpTarget: 75,
      },
      {
        domainId: domainByName.get('coding') || domainByName.get('study') || defaultDomainId,
        description: `5 Million Coders / JavaScript — ${jsPacing.currentLesson.title}`,
        minutesTarget: 60,
        subject: 'JavaScript',
        topic: jsPacing.currentLesson.title,
        priority: 'HIGH',
        plannedStartTime: '08:00',
        plannedEndTime: '09:00',
        isStudy: true,
        xpTarget: 70,
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
        description: 'Focused Reading & Daily Knowledge Synthesis',
        minutesTarget: 30,
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

  // Domain map for rich client representation
  const domainMap = Object.fromEntries(domains.map((d) => [d.id, d]));

  const tasksWithDomain = (plan?.tasks || []).map((t) => ({
    ...t,
    domain: domainMap[t.domainId] || { name: 'General', color: '#94a3b8', icon: 'check-circle' },
    isLocked: isClosed && !t.completed, // Locked if window is closed and task was uncompleted
    status: t.completed ? 'COMPLETED' : isClosed ? 'MISSED' : 'PENDING',
  }));

  return {
    planId: plan?.id || null,
    startAddis,
    closeAddis: workoutWindowForAddisDate(addisNow).closeAddis,
    closeUtc,
    nextUnlockUtc,
    isClosed,
    isOpen: !isClosed,
    tasks: tasksWithDomain,
  };
}
