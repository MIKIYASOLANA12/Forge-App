import { NextRequest, NextResponse } from 'next/server';
import { ingestExamPaperDocument } from '@/lib/examPaperEngine';
import { SubjectKey } from '@/lib/subjectRoadmapsData';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const title = formData.get('title')?.toString() || 'Past Examination Paper';
    const subject = (formData.get('subject')?.toString() || 'CHEMISTRY').toUpperCase();
    const yearStr = formData.get('year')?.toString();
    const year = yearStr ? parseInt(yearStr, 10) : undefined;
    const examType = formData.get('examType')?.toString() || 'National Entrance Exam';

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Valid file is required' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const doc = await ingestExamPaperDocument({
      title,
      subject: subject as SubjectKey,
      fileBuffer: buffer,
      fileName: file.name,
      mimeType: file.type || 'application/pdf',
      year,
      examType,
    });

    return NextResponse.json({
      success: true,
      document: {
        id: doc.id,
        title: doc.title,
        subject: doc.subject,
        questionsCount: doc.questionsCount,
        language: doc.language,
        questions: doc.questions,
      },
    });
  } catch (error: any) {
    console.error('Past paper upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to ingest past exam paper' },
      { status: 500 }
    );
  }
}
