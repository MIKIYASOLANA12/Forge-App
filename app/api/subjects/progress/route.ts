import { NextRequest, NextResponse } from 'next/server';
import { getSubjectHistoricalProgress } from '@/lib/subjectMasteryEngine';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const range = (searchParams.get('range') || '30D') as '7D' | '30D' | '90D' | '180D' | 'ALL';
    const progressData = await getSubjectHistoricalProgress(range);
    return NextResponse.json(progressData);
  } catch (error: any) {
    console.error('Error fetching subject progress data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress data', message: error.message },
      { status: 500 }
    );
  }
}
