import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeXp, computeLevel } from '@/lib/xp';
import { getStudyWeight } from '@/lib/taperCurve';
import { recordProgressActivity } from '@/lib/progressEngine';
import { getAddisNow, workoutWindowForAddisDate } from '@/lib/workoutTime';
import { parsePlanMetadata } from '@/lib/planParser';
import { createAssessmentSession, getActiveSessionForTopic } from '@/lib/studyAssessmentEngine';
import { getSubjectRoadmap, SubjectKey } from '@/lib/subjectRoadmapsData';

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

    // Mark complete
    const updatedTask = await prisma.planTask.update({
      where: { id },
      data: { completed: true },
    });

    // Award XP for completing
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

    // Check if task is a study task and launch exact topic assessment
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
    if (isStudyTask) {
      const subject = (meta.subject || task.subject || 'CHEMISTRY').toUpperCase();
      let topicId = meta.topicId || task.topic || 'chemistry_u1_t1';

      // Ensure valid topicId matching master roadmap
      if (['CHEMISTRY', 'BIOLOGY', 'PHYSICS', 'MATHEMATICS', 'ENGLISH'].includes(subject)) {
        const roadmap = getSubjectRoadmap(subject as SubjectKey);
        const matchTopic = roadmap.units.flatMap((u) => u.topics).find(
          (t) => t.id === topicId || t.title.toLowerCase() === (meta.topicTitle || meta.topic || '').toLowerCase()
        );
        if (matchTopic) {
          topicId = matchTopic.id;
        } else if (roadmap.units[0]?.topics[0]) {
          topicId = roadmap.units[0].topics[0].id;
        }
      }

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
      } catch (err) {
        console.error('Failed to create topic assessment session on task completion:', err);
      }
    }

    return NextResponse.json({
      task: updatedTask,
      xpEarned,
      launchAssessment: Boolean(assessmentSession),
      assessmentSession,
    });
  } catch (error) {
    console.error('Error completing task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
