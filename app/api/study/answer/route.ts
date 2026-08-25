import { NextRequest, NextResponse } from 'next/server';
import { evaluateStudyAnswer } from '@/lib/questionEngine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { questionId, userAnswer } = body;

    if (!questionId || userAnswer === undefined || userAnswer === null) {
      return NextResponse.json({ error: 'questionId and userAnswer are required' }, { status: 400 });
    }

    const evaluation = await evaluateStudyAnswer({
      questionId: String(questionId),
      userAnswer: String(userAnswer),
    });

    return NextResponse.json(evaluation);
  } catch (error: any) {
    console.error('Study answer error:', error);
    return NextResponse.json({ error: error.message || 'Failed to evaluate answer' }, { status: 500 });
  }
}
