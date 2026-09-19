import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeXp, computeLevel } from '@/lib/xp';
import { getStudyWeight } from '@/lib/taperCurve';
import { recordProgressActivity } from '@/lib/progressEngine';
import { getAddisNow, workoutWindowForAddisDate } from '@/lib/workoutTime';
import { parsePlanMetadata } from '@/lib/planParser';
import {
  createAssessmentSession,
  getActiveSessionForTopic,
  toClientAssessmentSession,
} from '@/lib/studyAssessmentEngine';
import { getSubjectRoadmap, findTopicById, SubjectKey } from '@/lib/subjectRoadmapsData';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Hard 09:28 PM Cutoff Check
    const addisNow = getAddisNow();
    const { isClosed } = workoutWindowForAddisDate(addisNow);
    if (isClosed) {
      return NextResponse.json(
        {
          error: 'Daily execution window closed at 09:28 PM. Tasks cannot be completed or submitted after cutoff.',
          locked: true,
        },
        { status: 403 }
      );
    }

    const task = await prisma.planTask.findUnique({ where: { id } });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    if (task.completed) return NextResponse.json({ error: 'Already completed' }, { status: 409 });

    // Check if task is a study task
    const meta = parsePlanMetadata(task.description, task);
    const isStudyTask =
      task.isStudy ||
      meta.category === 'CHEMISTRY' ||
      meta.category === 'STUDY' ||
      meta.category === 'CODING' ||
      ['CHEMISTRY', 'BIOLOGY', 'PHYSICS', 'MATHEMATICS', 'ENGLISH', 'JAVASCRIPT'].includes(
        (meta.subject || task.subject || '').toUpperCase()
      );

    let assessmentSession = null;

    // Part 2: Exact Topic Resolution & Atomic Assessment Creation
    if (isStudyTask) {
      const subject = (meta.subject || task.subject || 'CHEMISTRY').toUpperCase();
      let topicId = meta.topicId || task.topic;

      // Validate exact topic against master roadmap
      if (['CHEMISTRY', 'BIOLOGY', 'PHYSICS', 'MATHEMATICS', 'ENGLISH'].includes(subject)) {
        const roadmap = getSubjectRoadmap(subject as SubjectKey);
        let resolvedTopic = null;

        if (topicId) {
          resolvedTopic = roadmap.units.flatMap((u) => u.topics).find(
            (t) => t.id === topicId || t.title.toLowerCase() === (meta.topicTitle || meta.topic || '').toLowerCase()
          );
        }

        if (!resolvedTopic && (meta.topicTitle || meta.topic)) {
          const searchTitle = (meta.topicTitle || meta.topic || '').toLowerCase();
          resolvedTopic = roadmap.units.flatMap((u) => u.topics).find(
            (t) => t.title.toLowerCase().includes(searchTitle) || searchTitle.includes(t.title.toLowerCase())
          );
        }

        // If exact topic cannot be resolved: STOP. DO NOT guess, DO NOT use first topic fallback!
        if (!resolvedTopic) {
          return NextResponse.json(
            {
              error: `Exact curriculum topic could not be resolved for subject "${subject}". Fallback topic guessing is prohibited.`,
              subject,
              topicId,
            },
            { status: 422 }
          );
        }

        topicId = resolvedTopic.id;
      }

      if (!topicId) {
        return NextResponse.json(
          {
            error: `Exact topic ID is required for study task completion.`,
          },
          { status: 422 }
        );
      }

      // Create or resume assessment session BEFORE marking task complete
      try {
        const existing = await getActiveSessionForTopic(subject, topicId);
        if (existing) {
          assessmentSession = existing;
        } else {
          assessmentSession = await createAssessmentSession({
            subject,
            topicId,
            count: 40,
          });
        }
      } catch (err: any) {
        console.error('Failed to create topic assessment session on task completion:', err);
        return NextResponse.json(
          {
            error:
              'Forge could not build a verified assessment for this exact topic yet. Your study task was not falsely marked as mastered.',
            details: err.message,
          },
          { status: 500 }
        );
      }
    }

    // Mark task complete atomically
    const updatedTask = await prisma.planTask.update({
      where: { id },
      data: { completed: true },
    });

    // Award XP for completing task
    const domain = await prisma.domain.findUnique({ where: { id: task.domainId } }).catch(() => null);
    const profile = await prisma.userProfile.findUnique({ where: { id: 'singleton' } }).catch(() => null);

    let effectiveWeight = domain?.weight ?? 1.0;
    if (domain?.name === 'Study' && profile?.examDate) {
      effectiveWeight = getStudyWeight(profile.examDate);
    }

    const xpEarned = computeXp(task.minutesTarget, effectiveWeight);

    try {
      const updated = await prisma.userProfile.update({
        where: { id: 'singleton' },
        data: { totalXp: { increment: xpEarned } },
      });

      const newLevel = computeLevel(updated.totalXp);
      if (newLevel !== updated.level) {
        await prisma.userProfile.update({ where: { id: 'singleton' }, data: { level: newLevel } });
      }
    } catch {}

    await recordProgressActivity(0).catch(() => {});

    // Return sanitized client assessment DTO (NEVER contains answer keys!)
    const clientSession = assessmentSession ? toClientAssessmentSession(assessmentSession) : null;

    return NextResponse.json({
      task: updatedTask,
      xpEarned,
      launchAssessment: Boolean(clientSession),
      assessmentSession: clientSession,
    });
  } catch (error: any) {
    console.error('Error completing task:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
