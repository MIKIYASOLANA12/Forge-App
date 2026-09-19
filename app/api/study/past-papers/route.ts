import { NextRequest, NextResponse } from 'next/server';
import { getExamPaperDocuments } from '@/lib/examPaperEngine';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subject = searchParams.get('subject') || undefined;
    const documents = await getExamPaperDocuments(subject);
    return NextResponse.json({ documents });
  } catch (error: any) {
    console.error('Error fetching past exam documents:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch exam papers' }, { status: 500 });
  }
}
