import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAddisNow, workoutWindowForAddisDate } from '@/lib/workoutTime';
import { computeXp, computeLevel } from '@/lib/xp';
import { getStudyWeight } from '@/lib/taperCurve';
import { evaluateStudyAnswer } from '@/lib/questionEngine';

export async function GET(req: NextRequest) {
  try {
    const addisNow = getAddisNow();
    const { startUtc, endUtc } = workoutWindowForAddisDate(addisNow);

    const [sessions, domains] = await Promise.all([
      prisma.session.findMany({
        where: { startedAt: { gte: startUtc, lte: endUtc } },
        include: { domain: true },
        orderBy: { startedAt: 'desc' },
      }),
      prisma.domain.findMany(),
    ]);

    const totalMinutes = sessions.reduce((acc, s) => acc + s.minutes, 0);
    const completedSessionsCount = sessions.length;
    const longestSessionMinutes = sessions.reduce((max, s) => Math.max(max, s.minutes), 0);

    // Subject breakdown
    const subjectMap: Record<string, number> = {
      Chemistry: 0,
      JavaScript: 0,
      Reading: 0,
      Workout: 0,
    };

    for (const s of sessions) {
      const note = s.note || '';
      const domainName = s.domain?.name || 'Study';
      if (note.includes('Chemistry') || domainName.toLowerCase() === 'study') {
        subjectMap.Chemistry += s.minutes;
      } else if (note.includes('JavaScript') || domainName.toLowerCase() === 'coding') {
        subjectMap.JavaScript += s.minutes;
      } else if (note.includes('Reading') || domainName.toLowerCase() === 'reading') {
        subjectMap.Reading += s.minutes;
      } else if (note.includes('Workout') || domainName.toLowerCase() === 'workout') {
        subjectMap.Workout += s.minutes;
      } else {
        subjectMap[domainName] = (subjectMap[domainName] || 0) + s.minutes;
      }
    }

    return NextResponse.json({
      success: true,
      totalMinutes,
      targetMinutes: 180, // 3h daily study/focus target
      completedSessionsCount,
      longestSessionMinutes,
      subjectBreakdown: subjectMap,
      recentSessions: sessions.slice(0, 5),
    });
  } catch (error: any) {
    console.error('Focus GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch focus stats' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      subject,
      taskTitle,
      taskId,
      plannedMinutes = 45,
      actualMinutes = 45,
      startedAt,
      status = 'COMPLETED',
      reflection,
      questionAnswer,
    } = body;

    const focusedMinutes = Math.max(1, Number(actualMinutes) || 1);

    // Map subject to Domain
    const domains = await prisma.domain.findMany();
    const domainMap = new Map(domains.map((d) => [d.name.toLowerCase(), d]));

    let targetDomain = domainMap.get('study');
    const subjLower = String(subject || '').toLowerCase();

    if (subjLower.includes('code') || subjLower.includes('javascript')) {
      targetDomain = domainMap.get('coding') || domainMap.get('study') || targetDomain;
    } else if (subjLower.includes('read')) {
      targetDomain = domainMap.get('reading') || domainMap.get('study') || targetDomain;
    } else if (subjLower.includes('workout')) {
      targetDomain = domainMap.get('workout') || targetDomain;
    }

    const domainId = targetDomain?.id || domains[0]?.id || 'singleton';

    // Compute XP via existing XP Engine
    const profile = await prisma.userProfile.findUnique({ where: { id: 'singleton' } });
    let effectiveWeight = targetDomain?.weight || 1.0;
    if (targetDomain?.name === 'Study' && profile?.examDate) {
      effectiveWeight = getStudyWeight(profile.examDate);
    }

    // Award XP based on focused minutes; if completed status, bonus 15%
    const baseMultiplier = status === 'COMPLETED' ? 1.15 : 1.0;
    const xpEarned = Math.round(computeXp(focusedMinutes, effectiveWeight) * baseMultiplier);

    const note = `🔒 LOCKED IN: ${subject || 'Focus'} — ${taskTitle || 'Study Session'}${
      reflection ? ` | Note: ${reflection}` : ''
    }`;

    // 1. Create Session record
    const session = await prisma.session.create({
      data: {
        domainId,
        minutes: focusedMinutes,
        note,
        startedAt: startedAt ? new Date(startedAt) : new Date(Date.now() - focusedMinutes * 60 * 1000),
        xpEarned,
      },
      include: { domain: true },
    });

    // 2. Update user profile XP and Level
    const updatedProfile = await prisma.userProfile.update({
      where: { id: 'singleton' },
      data: {
        totalXp: { increment: xpEarned },
      },
    });

    const newLevel = computeLevel(updatedProfile.totalXp);
    if (newLevel !== updatedProfile.level) {
      await prisma.userProfile.update({
        where: { id: 'singleton' },
        data: { level: newLevel },
      });
    }

    // 3. Mark PlanTask completed if taskId provided & session COMPLETED
    let updatedTask = null;
    if (taskId && status === 'COMPLETED') {
      try {
        updatedTask = await prisma.planTask.update({
          where: { id: taskId },
          data: { completed: true },
        });
      } catch (err) {
        console.warn('Could not mark PlanTask completed:', err);
      }
    }

    // 4. Record question mastery answer if provided
    let answerRecord = null;
    if (questionAnswer && questionAnswer.questionId && questionAnswer.selectedOption) {
      try {
        answerRecord = await evaluateStudyAnswer({
          questionId: questionAnswer.questionId,
          userAnswer: questionAnswer.selectedOption,
        });
      } catch (err) {
        console.warn('Could not record study question answer:', err);
      }
    }

    return NextResponse.json({
      success: true,
      xpEarned,
      focusedMinutes,
      session,
      updatedTask,
      answerRecord,
      newTotalXp: updatedProfile.totalXp,
      newLevel,
    });
  } catch (error: any) {
    console.error('Focus POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to complete focus session' }, { status: 500 });
  }
}
