import { NextRequest, NextResponse } from 'next/server';
import { generateTopicQuiz, submitTopicQuizAnswers } from '@/lib/subjectQuizEngine';
import { SubjectKey } from '@/lib/subjectRoadmapsData';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, subject, topicId, count, answers } = body;

    if (action === 'GENERATE') {
      if (!subject || !topicId) {
        return NextResponse.json({ error: 'Subject and topicId are required' }, { status: 400 });
      }
      const quiz = await generateTopicQuiz({
        subject: subject as SubjectKey,
        topicId,
        count: count || 5,
      });
      return NextResponse.json(quiz);
    }

    if (action === 'SUBMIT') {
      if (!subject || !topicId || !answers) {
        return NextResponse.json({ error: 'Subject, topicId, and answers are required' }, { status: 400 });
      }
      const result = await submitTopicQuizAnswers({
        subject: subject as SubjectKey,
        topicId,
        answers,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('Error in subject quiz API:', error);
    return NextResponse.json(
      { error: 'Failed to process subject quiz', message: error.message },
      { status: 500 }
    );
  }
}
