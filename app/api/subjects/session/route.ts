import { NextRequest, NextResponse } from 'next/server';
import { recordSubjectFocusSession } from '@/lib/subjectMasteryEngine';
import { SubjectKey } from '@/lib/subjectRoadmapsData';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subject, unitId, topicId, subtopic, minutes, xpEarned } = body;

    if (!subject || !unitId || !topicId || minutes === undefined) {
      return NextResponse.json({ error: 'Missing required session parameters' }, { status: 400 });
    }

    const result = await recordSubjectFocusSession({
      subject: subject as SubjectKey,
      unitId,
      topicId,
      subtopic,
      minutes: Number(minutes) || 0,
      xpEarned: Number(xpEarned) || (Number(minutes) * 2),
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error recording focus session:', error);
    return NextResponse.json(
      { error: 'Failed to record focus session', message: error.message },
      { status: 500 }
    );
  }
}
