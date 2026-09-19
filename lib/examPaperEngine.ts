import { prisma } from './prisma';
import { forgeAI } from './ai/router';
import { SubjectKey, findTopicById, getSubjectRoadmap } from './subjectRoadmapsData';
import { PDFParse } from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';

export interface IngestedExamQuestion {
  questionNumber?: number;
  pageNumber?: number;
  subject: string;
  unitId?: string;
  unitTitle?: string;
  topicId?: string;
  topicTitle?: string;
  subtopic?: string;
  questionType: string;
  originalLanguage: string;
  originalText: string;
  translatedText?: string;
  options: string[];
  officialAnswer?: string;
  aiProposedAnswer?: string;
  isAnswerVerified: boolean;
  explanation?: string;
  conceptTag?: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'entrance';
}

export interface IngestedExamDocument {
  id: string;
  title: string;
  subject: string;
  year?: number;
  examType?: string;
  language: string;
  sourceFile?: string;
  pageCount: number;
  status: 'PROCESSING' | 'PROCESSED' | 'ERROR';
  rawText?: string;
  questionsCount: number;
  createdAt: string;
  questions: IngestedExamQuestion[];
}

const PAPERS_DIR = path.join(process.cwd(), 'data');
const PAPERS_FILE = path.join(PAPERS_DIR, 'exam_paper_documents.json');

function loadFallbackPapers(): Record<string, IngestedExamDocument> {
  try {
    if (!fs.existsSync(PAPERS_DIR)) {
      fs.mkdirSync(PAPERS_DIR, { recursive: true });
    }
    if (fs.existsSync(PAPERS_FILE)) {
      const raw = fs.readFileSync(PAPERS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading fallback exam papers:', err);
  }
  return {};
}

function saveFallbackPaper(doc: IngestedExamDocument) {
  try {
    const all = loadFallbackPapers();
    all[doc.id] = doc;
    if (!fs.existsSync(PAPERS_DIR)) {
      fs.mkdirSync(PAPERS_DIR, { recursive: true });
    }
    fs.writeFileSync(PAPERS_FILE, JSON.stringify(all, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving fallback exam paper:', err);
  }
}

/**
 * Main Exam Paper Ingestion Pipeline (Part 13)
 */
export async function ingestExamPaperDocument(params: {
  title: string;
  subject: SubjectKey | string;
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  year?: number;
  examType?: string;
}): Promise<IngestedExamDocument> {
  const { title, subject, fileBuffer, fileName, mimeType, year, examType } = params;
  const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 1. Save physical file to public/uploads/past-papers
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'past-papers');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const safeFileName = `${docId}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const filePath = path.join(uploadDir, safeFileName);
  fs.writeFileSync(filePath, fileBuffer);
  const sourceFileUrl = `/uploads/past-papers/${safeFileName}`;

  // 2. Extract initial raw text from PDF
  let extractedRawText = '';
  let pageCount = 1;
  const isPdf = fileName.toLowerCase().endsWith('.pdf') || mimeType === 'application/pdf';

  if (isPdf) {
    try {
      const parser = new PDFParse({ data: fileBuffer });
      const parsed = await parser.getText();
      extractedRawText = parsed.text || '';
      pageCount = parsed.pages ? parsed.pages.length : 1;
      await parser.destroy();
    } catch (err) {
      console.warn('[ExamPaperEngine] PDF text layer extraction warning:', err);
      extractedRawText = fileBuffer.toString('utf-8');
    }
  } else {
    extractedRawText = fileBuffer.toString('utf-8');
  }

  // 3. Process via Gemini Vision/Multimodal AI Document Parser
  const roadmap = getSubjectRoadmap(subject as SubjectKey);
  const unitsSummary = roadmap.units
    .map((u) => `${u.id}: ${u.title} (Topics: ${u.topics.map((t) => `${t.id}: ${t.title}`).join(' | ')})`)
    .join('\n');

  const systemPrompt = `You are the FORGE Ethiopian Curriculum Academic Document Processing Pipeline.
Analyze this previous examination paper for Subject: ${subject}.

Authoritative Units and Topics for mapping:
${unitsSummary}

YOUR TASKS:
1. Detect document language (e.g. "en" for English, "am" for Amharic).
2. Extract all individual questions accurately.
3. PRESERVE ORIGINAL TEXT EXACTLY including mathematical notation (LaTeX/Unicode), exponents, subscripts, and chemical formulas. DO NOT distort chemical equations or numbers.
4. If the text is in another language (e.g. Amharic), provide a high-precision English translatedText while keeping originalText completely intact.
5. Identify question type (MULTIPLE_CHOICE, CALCULATION, TRUE_FALSE, SHORT_ANSWER, MATCHING).
6. Match each question to the exact Unit ID and Topic ID from the provided curriculum roadmap IF AND ONLY IF confidence is high. If confidence is low or ambiguous, return null for unitId and topicId. DO NOT guess.
7. If an official answer key is clearly marked in the paper, set officialAnswer. If not present, provide a proposed aiProposedAnswer and set isAnswerVerified: false.
8. Provide a clear pedagogical explanation and tag key concepts.`;

  let parsedQuestions: IngestedExamQuestion[] = [];
  let detectedLanguage = 'en';

  try {
    const isRealPdfOrImage =
      (isPdf && fileBuffer.length > 100 && fileBuffer.toString('ascii', 0, 4) === '%PDF') ||
      mimeType.startsWith('image/');

    if (isRealPdfOrImage) {
      const base64Data = fileBuffer.toString('base64');
      const aiDocResult = await forgeAI.processDocument({
        systemPrompt,
        prompt: `Extract and categorize all examination questions from this ${subject} test paper titled "${title}". Return JSON conforming to schema: { language: string, questions: Array<{ questionNumber: number, originalText: string, translatedText?: string, options: string[], officialAnswer?: string, aiProposedAnswer: string, isAnswerVerified: boolean, unitId?: string, topicId?: string, subtopic?: string, questionType: string, conceptTag?: string, explanation?: string, difficulty?: string }> }`,
        documents: [
          {
            mimeType: isPdf ? 'application/pdf' : mimeType || 'image/png',
            data: base64Data,
          },
        ],
        temperature: 0.2,
        maxTokens: 4096,
      });

      const parsedJson = JSON.parse(aiDocResult.text.replace(/```json|```/g, '').trim());
      if (parsedJson && Array.isArray(parsedJson.questions)) {
        detectedLanguage = parsedJson.language || 'en';
        parsedQuestions = parsedJson.questions.map((q: any) => {
          // Exact roadmap validation
          let resolvedUnit = q.unitId ? roadmap.units.find((u) => u.id === q.unitId) : null;
          let resolvedTopic = q.topicId ? roadmap.units.flatMap((u) => u.topics).find((t) => t.id === q.topicId) : null;

          return {
            questionNumber: q.questionNumber,
            pageNumber: q.pageNumber || 1,
            subject: subject.toUpperCase(),
            unitId: resolvedUnit?.id ?? undefined,
            unitTitle: resolvedUnit?.title ?? undefined,
            topicId: resolvedTopic?.id ?? undefined,
            topicTitle: resolvedTopic?.title ?? undefined,
            subtopic: q.subtopic ?? undefined,
            questionType: q.questionType || 'MULTIPLE_CHOICE',
            originalLanguage: detectedLanguage,
            originalText: q.originalText,
            translatedText: q.translatedText,
            options: Array.isArray(q.options) ? q.options : [],
            officialAnswer: q.officialAnswer,
            aiProposedAnswer: q.aiProposedAnswer,
            isAnswerVerified: Boolean(q.isAnswerVerified),
            explanation: q.explanation || 'Official national exam solution.',
            conceptTag: q.conceptTag || `${subject.toLowerCase()}-past-paper`,
            difficulty: (q.difficulty as any) || 'entrance',
          };
        });
      }
    }
  } catch (err) {
    console.warn('[ExamPaperEngine] AI multimodal processing failed or returned non-JSON, falling back to parsed text split:', err);
  }

  // Fallback text parser when OCR is offline or input is structured text
  if (parsedQuestions.length === 0) {
    const rawContent = extractedRawText || fileBuffer.toString('utf-8');
    const chunks = rawContent
      .split(/\n\s*(?=\d+[\.\)])/g)
      .map((c) => c.trim())
      .filter((c) => c.length > 5);

    parsedQuestions = chunks.map((chunk, idx) => {
      const lines = chunk.split('\n').map((l) => l.trim());
      const promptLine = lines[0];
      const optLines = lines.filter((l) => /^[A-D][\)\.]/i.test(l)).map((l) => l.replace(/^[A-D][\)\.]\s*/i, '').trim());

      // Attempt keyword matching against roadmap topics without blind guessing
      let matchedUnitId: string | undefined = undefined;
      let matchedUnitTitle: string | undefined = undefined;
      let matchedTopicId: string | undefined = undefined;
      let matchedTopicTitle: string | undefined = undefined;

      const lowerChunk = chunk.toLowerCase();
      for (const u of roadmap.units) {
        for (const t of u.topics) {
          if (lowerChunk.includes(t.title.toLowerCase()) || (t.subtopics && t.subtopics.some((st) => lowerChunk.includes(st.toLowerCase())))) {
            matchedUnitId = u.id;
            matchedUnitTitle = u.title;
            matchedTopicId = t.id;
            matchedTopicTitle = t.title;
            break;
          }
        }
        if (matchedTopicId) break;
      }

      return {
        questionNumber: idx + 1,
        pageNumber: 1,
        subject: subject.toUpperCase(),
        unitId: matchedUnitId,
        unitTitle: matchedUnitTitle,
        topicId: matchedTopicId,
        topicTitle: matchedTopicTitle,
        subtopic: matchedTopicId ? 'Extracted Past Exam Question' : 'Unmapped — Review Required',
        questionType: optLines.length > 0 ? 'MULTIPLE_CHOICE' : 'CALCULATION',
        originalLanguage: 'en',
        originalText: promptLine || chunk,
        options: optLines.length > 0 ? optLines : ['Option A', 'Option B', 'Option C', 'Option D'],
        aiProposedAnswer: optLines[0] || 'A',
        isAnswerVerified: false,
        explanation: 'Extracted from imported past examination paper.',
        conceptTag: matchedTopicId ? `${matchedTopicId}-past-exam` : `${subject.toLowerCase()}-unmapped-past-exam`,
        difficulty: 'entrance',
      };
    });
  }

  const examDoc: IngestedExamDocument = {
    id: docId,
    title,
    subject: subject.toUpperCase(),
    year: year || new Date().getFullYear(),
    examType: examType || 'National Entrance Exam',
    language: detectedLanguage,
    sourceFile: sourceFileUrl,
    pageCount,
    status: 'PROCESSED',
    rawText: extractedRawText.slice(0, 5000),
    questionsCount: parsedQuestions.length,
    createdAt: new Date().toISOString(),
    questions: parsedQuestions,
  };

  // 4. Save to DB and fallback store
  saveFallbackPaper(examDoc);
  try {
    const createdDbDoc = await prisma.examPaperDocument.create({
      data: {
        id: examDoc.id,
        title: examDoc.title,
        subject: examDoc.subject,
        year: examDoc.year,
        examType: examDoc.examType,
        language: examDoc.language,
        sourceFile: examDoc.sourceFile,
        pageCount: examDoc.pageCount,
        status: examDoc.status,
        rawText: examDoc.rawText,
        questionsCount: examDoc.questionsCount,
      },
    });

    for (const q of parsedQuestions) {
      await prisma.examPaperQuestion.create({
        data: {
          documentId: createdDbDoc.id,
          questionNumber: q.questionNumber,
          pageNumber: q.pageNumber,
          subject: q.subject,
          unitId: q.unitId ?? null,
          unitTitle: q.unitTitle ?? null,
          topicId: q.topicId ?? null,
          topicTitle: q.topicTitle ?? null,
          subtopic: q.subtopic ?? null,
          questionType: q.questionType,
          originalLanguage: q.originalLanguage,
          originalText: q.originalText,
          translatedText: q.translatedText ?? null,
          optionsJson: JSON.stringify(q.options),
          officialAnswer: q.officialAnswer ?? null,
          aiProposedAnswer: q.aiProposedAnswer ?? null,
          isAnswerVerified: q.isAnswerVerified,
          explanation: q.explanation ?? null,
          conceptTag: q.conceptTag ?? null,
          difficulty: q.difficulty,
        },
      });
    }
  } catch (err) {
    console.warn('[ExamPaperEngine] DB persistence warning, saved to fallback store:', err);
  }

  return examDoc;
}

/**
 * Get all past examination papers
 */
export async function getExamPaperDocuments(subject?: string): Promise<IngestedExamDocument[]> {
  try {
    const dbDocs = await prisma.examPaperDocument.findMany({
      where: subject ? { subject: subject.toUpperCase() } : undefined,
      include: { questions: true },
      orderBy: { createdAt: 'desc' },
    });

    if (dbDocs.length > 0) {
      return dbDocs.map((d) => ({
        id: d.id,
        title: d.title,
        subject: d.subject,
        year: d.year ?? undefined,
        examType: d.examType ?? undefined,
        language: d.language,
        sourceFile: d.sourceFile ?? undefined,
        pageCount: d.pageCount,
        status: d.status as any,
        rawText: d.rawText ?? undefined,
        questionsCount: d.questionsCount,
        createdAt: d.createdAt.toISOString(),
        questions: d.questions.map((q) => ({
          questionNumber: q.questionNumber ?? undefined,
          pageNumber: q.pageNumber ?? undefined,
          subject: q.subject,
          unitId: q.unitId ?? undefined,
          unitTitle: q.unitTitle ?? undefined,
          topicId: q.topicId ?? undefined,
          topicTitle: q.topicTitle ?? undefined,
          subtopic: q.subtopic ?? undefined,
          questionType: q.questionType,
          originalLanguage: q.originalLanguage,
          originalText: q.originalText,
          translatedText: q.translatedText ?? undefined,
          options: q.optionsJson ? JSON.parse(q.optionsJson) : [],
          officialAnswer: q.officialAnswer ?? undefined,
          aiProposedAnswer: q.aiProposedAnswer ?? undefined,
          isAnswerVerified: q.isAnswerVerified,
          explanation: q.explanation ?? undefined,
          conceptTag: q.conceptTag ?? undefined,
          difficulty: q.difficulty as any,
        })),
      }));
    }
  } catch {}

  const store = loadFallbackPapers();
  const list = Object.values(store);
  if (subject) {
    return list.filter((d) => d.subject.toUpperCase() === subject.toUpperCase());
  }
  return list;
}
