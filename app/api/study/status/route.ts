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

    return NextResponse.json({
      day300: day300Info,
      chemistry: {
        ...chemistryData,
        roadmap: CHEMISTRY_ROADMAP.map((topic) => {
          const m = masteries.find((rec) => rec.topicId === topic.id);
          return {
            ...topic,
            masteryLevel: m?.masteryLevel ?? 1,
            isMastered: m?.isMastered ?? false,
            accuracy: m?.accuracy ?? 0,
            attemptsCount: m?.attemptsCount ?? 0,
          };
        }),
      },
      javascript: {
        ...javascriptData,
        roadmap: JAVASCRIPT_ROADMAP.map((lesson) => {
          const m = masteries.find((rec) => rec.topicId === lesson.id);
          return {
            ...lesson,
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
      masterySummary: {
        totalMastered: masteredTopicIds.length,
        totalTopics: CHEMISTRY_ROADMAP.length + JAVASCRIPT_ROADMAP.length,
      },
    });
  } catch (error: any) {
    console.error('Study status error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load study status' }, { status: 500 });
  }
}
