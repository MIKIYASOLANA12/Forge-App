import { NextRequest, NextResponse } from 'next/server';
import {
  createAssessmentSession,
  getAssessmentSession,
  submitAnswerToSession,
  getActiveSessionForTopic,
  toClientAssessmentSession,
} from '@/lib/studyAssessmentEngine';
import { SubjectKey } from '@/lib/subjectRoadmapsData';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, subject, topicId, count, sessionId, questionId, userAnswer, timeTakenSec, userId } = body;

    // 1. CREATE or RESUME ASSESSMENT SESSION
    if (action === 'START' || action === 'CREATE') {
      if (!subject || !topicId) {
        return NextResponse.json({ error: 'Subject and topicId are required' }, { status: 400 });
      }

      // Check if there's already an active in-progress session to resume
      const existing = await getActiveSessionForTopic(subject, topicId, userId || 'singleton');
      if (existing) {
        return NextResponse.json({
          session: toClientAssessmentSession(existing),
          resumed: true,
        });
      }

      const session = await createAssessmentSession({
        subject: subject as SubjectKey,
        topicId,
        count: count || 40,
        userId: userId || 'singleton',
      });

      return NextResponse.json({
        session: toClientAssessmentSession(session),
        resumed: false,
      });
    }

    // 2. SUBMIT SINGLE ANSWER (Server-side authoritative evaluation)
    if (action === 'ANSWER' || action === 'SUBMIT_ANSWER') {
      if (!sessionId || !questionId || userAnswer === undefined || userAnswer === null) {
        return NextResponse.json(
          { error: 'sessionId, questionId, and userAnswer are required' },
          { status: 400 }
        );
      }

      const { session, result, isSessionCompleted, masteryUpdate } = await submitAnswerToSession({
        sessionId,
        questionId,
        userAnswer: String(userAnswer),
        timeTakenSec: Number(timeTakenSec || 0),
      });

      return NextResponse.json({
        session: toClientAssessmentSession(session),
        result, // Contains isCorrect, correctAnswer, explanation ONLY for this answered question
        isSessionCompleted,
        masteryUpdate,
      });
    }

    // 3. GET SESSION STATE (Browser reload / persistence recovery)
    if (action === 'GET_SESSION') {
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
      }

      const session = await getAssessmentSession(sessionId);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      return NextResponse.json({
        session: toClientAssessmentSession(session),
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('Error in assessment API:', error);
    return NextResponse.json(
      { error: error.message || 'Assessment API failure' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const session = await getAssessmentSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      session: toClientAssessmentSession(session),
    });
  } catch (error: any) {
    console.error('Error fetching assessment session:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch session' }, { status: 500 });
  }
}
