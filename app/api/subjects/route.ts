import { NextRequest, NextResponse } from 'next/server';
import { getSubjectMasteryOverview, startSubject } from '@/lib/subjectMasteryEngine';
import { SubjectKey } from '@/lib/subjectRoadmapsData';

export async function GET() {
  try {
    const overview = await getSubjectMasteryOverview();
    return NextResponse.json(overview);
  } catch (error: any) {
    console.error('Error fetching subject mastery overview:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subject mastery overview', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, subject } = body;

    if (action === 'START_SUBJECT') {
      if (!subject) {
        return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
      }
      const result = await startSubject(subject as SubjectKey);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('Error in subject action:', error);
    return NextResponse.json(
      { error: 'Failed to execute subject action', message: error.message },
      { status: 500 }
    );
  }
}
