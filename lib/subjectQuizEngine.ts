import { ForgeAIRouter } from './ai/router';
import { SubjectKey, findTopicById } from './subjectRoadmapsData';
import { recordSubjectQuestionAttempt } from './subjectMasteryEngine';

const router = new ForgeAIRouter();

export interface QuizQuestionItem {
  id: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'entrance';
  conceptTag: string;
}

export interface GenerateQuizResult {
  subject: SubjectKey;
  unitTitle: string;
  topicTitle: string;
  subtopics: string[];
  questions: QuizQuestionItem[];
}

/**
 * Generate targeted quiz questions for exact active subject, unit, and topic
 */
export async function generateTopicQuiz(params: {
  subject: SubjectKey;
  topicId: string;
  count?: number;
}): Promise<GenerateQuizResult> {
  const { subject, topicId, count = 5 } = params;
  const topicData = findTopicById(subject, topicId);

  if (!topicData) {
    throw new Error(`Topic ${topicId} not found for subject ${subject}`);
  }

  const { unit, topic } = topicData;
  const subtopicsList = topic.subtopics.length > 0 ? topic.subtopics.join(', ') : 'Core principles of this topic';

  const systemPrompt = `You are the FORGE Ethiopian Curriculum Academic Examiner for Grade 9-12 natural science exam preparation.
Generate ${count} high-quality, rigorous academic multiple-choice questions for the following specific topic:
Subject: ${subject}
Unit: ${unit.title}
Topic: ${topic.title}
Subtopics: ${subtopicsList}

Rules:
1. Questions must strictly test the specific concept and subtopics provided.
2. Provide exactly 4 options per question (A, B, C, D) with exactly one unambiguous correct answer.
3. Include an educational explanation explaining WHY the correct answer is right and why other options are wrong.
4. Difficulty should range from medium to entrance exam standard.
5. Return JSON only conforming to the requested schema.`;

  try {
    const response = await router.generateJson<{
      questions: Array<{
        prompt: string;
        options: string[];
        correctAnswer: string;
        explanation: string;
        difficulty: 'easy' | 'medium' | 'hard' | 'entrance';
        conceptTag: string;
      }>;
    }>({
      taskType: 'GENERATE_QUESTIONS',
      systemPrompt,
      prompt: `Generate ${count} multiple choice questions for ${subject} - ${unit.title} - ${topic.title}.`,
      temperature: 0.3,
      timeoutMs: 4000,
    });

    if (response && response.parsed && Array.isArray(response.parsed.questions) && response.parsed.questions.length > 0) {
      const formattedQuestions: QuizQuestionItem[] = response.parsed.questions.map((q, idx) => ({
        id: `gen_q_${Date.now()}_${idx}`,
        prompt: q.prompt,
        options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: q.correctAnswer || (q.options && q.options[0]) || 'Option A',
        explanation: q.explanation || 'Detailed academic solution based on syllabus concepts.',
        difficulty: q.difficulty || 'medium',
        conceptTag: q.conceptTag || topic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      }));

      return {
        subject,
        unitTitle: unit.title,
        topicTitle: topic.title,
        subtopics: topic.subtopics,
        questions: formattedQuestions,
      };
    }
  } catch (err) {
    console.warn('[SubjectQuizEngine] AI Generation failed, creating curated questions:', err);
  }

  // Fallback curated questions for uninterrupted offline usage
  const fallbackQuestions: QuizQuestionItem[] = [
    {
      id: `fallback_${topic.id}_1`,
      prompt: `What is the foundational principle underlying "${topic.title}" in ${unit.title}?`,
      options: [
        `It defines the core quantitative relationships of ${topic.title}`,
        `It applies only to non-ideal conditions`,
        `It is unrelated to the Ethiopian National Curriculum standard`,
        `It was disproven in classical science`,
      ],
      correctAnswer: `It defines the core quantitative relationships of ${topic.title}`,
      explanation: `In ${unit.title}, ${topic.title} establishes the baseline theoretical and empirical framework tested in national entrance exams.`,
      difficulty: 'medium',
      conceptTag: topic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    },
    {
      id: `fallback_${topic.id}_2`,
      prompt: `When analyzing ${topic.subtopics[0] || topic.title}, which of the following statements is scientifically accurate?`,
      options: [
        `All physical parameters remain invariant regardless of external conditions`,
        `The observed behavior directly follows the conservation laws and structural principles of the system`,
        `Energy is not conserved during state transitions`,
        `The relationship is purely qualitative with no measurable SI units`,
      ],
      correctAnswer: `The observed behavior directly follows the conservation laws and structural principles of the system`,
      explanation: `Textbook formulations for ${topic.title} strictly adhere to fundamental physical and chemical conservation principles.`,
      difficulty: 'hard',
      conceptTag: topic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    },
  ];

  return {
    subject,
    unitTitle: unit.title,
    topicTitle: topic.title,
    subtopics: topic.subtopics,
    questions: fallbackQuestions,
  };
}

/**
 * Submit answers, log attempts, update topic mastery
 */
export async function submitTopicQuizAnswers(params: {
  subject: SubjectKey;
  topicId: string;
  answers: Array<{
    prompt: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    difficulty?: string;
  }>;
}): Promise<{
  score: number;
  total: number;
  accuracy: number;
  passed: boolean;
  xpEarned: number;
}> {
  const { subject, topicId, answers } = params;
  const topicData = findTopicById(subject, topicId);
  const total = answers.length;
  const correctCount = answers.filter((a) => a.isCorrect).length;
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const passed = accuracy >= 70;
  const xpEarned = correctCount * 25 + (passed ? 50 : 10);

  for (const a of answers) {
    await recordSubjectQuestionAttempt({
      subject,
      unitId: topicData?.unit.id || 'unit_1',
      topicId,
      prompt: a.prompt,
      userAnswer: a.userAnswer,
      correctAnswer: a.correctAnswer,
      isCorrect: a.isCorrect,
      difficulty: a.difficulty || 'medium',
    });
  }

  return {
    score: correctCount,
    total,
    accuracy,
    passed,
    xpEarned,
  };
}
