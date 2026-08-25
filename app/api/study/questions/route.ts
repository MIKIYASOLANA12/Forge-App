import { NextRequest, NextResponse } from 'next/server';
import { getQuestionsForTopic, seedQuestionBank } from '@/lib/questionEngine';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subject = searchParams.get('subject') || 'Chemistry';
    const topicId = searchParams.get('topicId') || undefined;
    const levelStr = searchParams.get('level');
    const level = levelStr ? parseInt(levelStr, 10) : undefined;

    await seedQuestionBank();
    const questions = await getQuestionsForTopic(subject, topicId, level);
    return NextResponse.json({ questions });
  } catch (error: any) {
    console.error('Study questions error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch questions' }, { status: 500 });
  }
}
