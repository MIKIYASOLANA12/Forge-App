import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  calculateChemistryOneMonthPlan,
  calculateJavaScriptPacing,
  CHEMISTRY_ROADMAP,
  JAVASCRIPT_ROADMAP,
} from '@/lib/studyRoadmaps';
import { getAddisNow, workoutWindowForAddisDate, getDayOfJourney300 } from '@/lib/workoutTime';

export async function GET() {
  try {
    const addisNow = getAddisNow();
    const { startUtc, endUtc } = workoutWindowForAddisDate(addisNow);
    const day300Info = getDayOfJourney300(addisNow);

    // Fetch user mastery records from database
    const masteries = await prisma.studyTopicMastery.findMany();
    const masteredTopicIds = masteries.filter((m) => m.isMastered).map((m) => m.topicId);

    // Calculate roadmaps
    const chemistryData = calculateChemistryOneMonthPlan(masteredTopicIds);
    const jsMasteredIds = masteries
      .filter((m) => m.subject === 'JavaScript' && m.isMastered)
      .map((m) => m.topicId);
    const javascriptData = calculateJavaScriptPacing(jsMasteredIds);

    // Recent answer logs
    const recentAnswers = await prisma.studyAnswerLog.findMany({
      orderBy: { answeredAt: 'desc' },
      take: 10,
    });

    // Extract weak areas across subjects
    const weakAreas = masteries
      .filter((m) => m.weakConcepts && m.weakConcepts !== '[]')
      .map((m) => {
        let concepts: string[] = [];
        try {
          concepts = JSON.parse(m.weakConcepts || '[]');
        } catch {}
        return {
          subject: m.subject,
          topicName: m.topicName,
          topicId: m.topicId,
          accuracy: m.accuracy,
          weakConcepts: concepts,
        };
      });

    // Check today's study tasks from DailyPlan
    const todayPlan = await prisma.dailyPlan.findFirst({
      where: { date: { gte: startUtc, lte: endUtc } },
      include: { tasks: true },
    });

    const todayStudyTasks = todayPlan
      ? todayPlan.tasks.filter((t) => t.isStudy || t.subject || t.domainId === 'study')
      : [];

    const recommendedStudyBlocks = [
      { name: '1. LEARN', minutes: chemistryData.currentTopic.sessionBreakdown.learnMins, focus: 'First-principles breakdown' },
      { name: '2. RECALL', minutes: chemistryData.currentTopic.sessionBreakdown.activeRecallMins, focus: 'Blank page active recall' },
      { name: '3. FLASHCARDS', minutes: chemistryData.currentTopic.sessionBreakdown.flashcardsMins, focus: 'Formulas & key terms' },
      { name: '4. DRILL', minutes: chemistryData.currentTopic.sessionBreakdown.practiceMins, focus: 'Entrance problem solving' },
      { name: '5. REVIEW', minutes: chemistryData.currentTopic.sessionBreakdown.oldTopicRecallMins, focus: 'Spaced repetition review' },
    ];

    const todayTaskRecommendation = {
      lessonTitle: javascriptData.currentLesson.title,
      durationMinutes: javascriptData.currentLesson.targetMinutes,
      breakdown: [
        { label: 'Core Concepts', minutes: 40, description: 'Learn roadmap items' },
        { label: 'Live Coding', minutes: 40, description: 'Code solutions in workspace' },
        { label: 'Quizzes & Drills', minutes: 20, description: 'Complete topic quizzes' },
      ],
    };

    return NextResponse.json({
      day300: day300Info,
      chemistry: {
        ...chemistryData,
        recommendedStudyBlocks,
        roadmap: CHEMISTRY_ROADMAP.map((topic) => {
          const topicId = `chem-day-${topic.dayNumber}`;
          const m = masteries.find((rec) => rec.topicId === topicId);
          return {
            ...topic,
            id: topicId,
            name: topic.mainTopic,
            order: topic.dayNumber,
            keyConcepts: topic.smallTopics,
            stage: `Week ${topic.weekNumber}`,
            masteryLevel: m?.masteryLevel ?? 1,
            isMastered: m?.isMastered ?? false,
            accuracy: m?.accuracy ?? 0,
            attemptsCount: m?.attemptsCount ?? 0,
          };
        }),
      },
      javascript: {
        ...javascriptData,
        courseName: '5 Million Coders / JavaScript',
        todayTaskRecommendation,
        roadmap: JAVASCRIPT_ROADMAP.map((lesson) => {
          const topicId = `js-day-${lesson.dayNumber}`;
          const m = masteries.find((rec) => rec.topicId === topicId);
          return {
            ...lesson,
            id: topicId,
            order: lesson.dayNumber,
            title: `${lesson.moduleName}: ${lesson.mainTopic}`,
            subtopics: lesson.items,
            masteryLevel: m?.masteryLevel ?? 1,
            isMastered: m?.isMastered ?? false,
            accuracy: m?.accuracy ?? 0,
            attemptsCount: m?.attemptsCount ?? 0,
          };
        }),
      },
      weakAreas,
      recentAnswers,
      todayStudyTasks,
    });
  } catch (error: any) {
    console.error('Study status error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
