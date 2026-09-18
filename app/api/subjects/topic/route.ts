import { NextRequest, NextResponse } from 'next/server';
import { completeTopicProgress } from '@/lib/subjectMasteryEngine';
import { SubjectKey } from '@/lib/subjectRoadmapsData';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subject, topicId, status, focusMinutes, accuracy } = body;

    if (!subject || !topicId) {
      return NextResponse.json({ error: 'Subject and topicId are required' }, { status: 400 });
    }

    const result = await completeTopicProgress({
      subject: subject as SubjectKey,
      topicId,
      status: status || 'STUDIED',
      focusMinutes: focusMinutes || 0,
      accuracy: accuracy !== undefined ? accuracy : 100,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error updating topic progress:', error);
    return NextResponse.json(
      { error: 'Failed to update topic progress', message: error.message },
      { status: 500 }
    );
  }
}
