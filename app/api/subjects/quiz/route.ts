import { NextRequest, NextResponse } from 'next/server';
import {
  createAssessmentSession,
  getAssessmentSession,
  submitAnswerToSession,
} from '@/lib/studyAssessmentEngine';
import { SubjectKey } from '@/lib/subjectRoadmapsData';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, subject, topicId, count, answers, sessionId, questionId, userAnswer } = body;

    if (action === 'GENERATE') {
      if (!subject || !topicId) {
        return NextResponse.json({ error: 'Subject and topicId are required' }, { status: 400 });
      }
      const session = await createAssessmentSession({
        subject: subject as SubjectKey,
        topicId,
        count: count || 40,
      });

      return NextResponse.json({
        sessionId: session.id,
        subject: session.subject,
        unitTitle: session.unitTitle,
        topicTitle: session.topicTitle,
        subtopics: session.subtopics,
        questionCount: session.questionCount,
        questions: session.questions,
      });
    }

    if (action === 'SUBMIT') {
      if (!subject || !topicId || !answers) {
        return NextResponse.json({ error: 'Subject, topicId, and answers are required' }, { status: 400 });
      }

      // If batch answers submitted from legacy modal, evaluate sequentially server-side
      const session = await createAssessmentSession({
        subject: subject as SubjectKey,
        topicId,
        count: Array.isArray(answers) ? answers.length : 40,
      });

      let totalScore = 0;
      let totalXp = 0;
      const results = [];

      for (let i = 0; i < answers.length; i++) {
        const a = answers[i];
        const q = session.questions[i];
        if (q) {
          const evalRes = await submitAnswerToSession({
            sessionId: session.id,
            questionId: q.id,
            userAnswer: a.userAnswer,
            timeTakenSec: a.timeTakenSec || 0,
          });
          if (evalRes.result.isCorrect) totalScore++;
          totalXp += evalRes.result.xpAwarded;
          results.push(evalRes.result);
        }
      }

      const accuracy = answers.length > 0 ? Math.round((totalScore / answers.length) * 100) : 0;
      const passed = accuracy >= 75;

      return NextResponse.json({
        sessionId: session.id,
        score: totalScore,
        total: answers.length,
        accuracy,
        passed,
        xpEarned: totalXp,
        results,
      });
    }

    if (action === 'ANSWER') {
      if (!sessionId || !questionId || userAnswer === undefined) {
        return NextResponse.json({ error: 'sessionId, questionId, and userAnswer are required' }, { status: 400 });
      }
      const result = await submitAnswerToSession({
        sessionId,
        questionId,
        userAnswer: String(userAnswer),
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('Error in subject quiz API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process subject quiz' },
      { status: 500 }
    );
  }
}
