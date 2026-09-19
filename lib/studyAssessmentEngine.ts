import { prisma } from './prisma';
import { forgeAI } from './ai/router';
import { SubjectKey, findTopicById, getSubjectRoadmap, SubjectUnit, SubjectTopic } from './subjectRoadmapsData';
import { recordProgressActivity } from './progressEngine';
import { computeLevel } from './xp';
import * as fs from 'fs';
import * as path from 'path';

export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'fill_in_the_blank'
  | 'matching'
  | 'calculation'
  | 'short_answer'
  | 'application'
  | 'trick_misconception'
  | 'entrance_style'
  | 'code_output';

export type QuestionDifficulty = 'easy' | 'medium' | 'hard' | 'entrance';

export type QuestionSourceType = 'AI_GENERATED' | 'PAST_PAPER' | 'AI_VARIANT';

export interface AssessmentQuestion {
  id: string;
  subject: string;
  unitId: string;
  unitTitle: string;
  topicId: string;
  topicTitle: string;
  subtopic: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  prompt: string;
  options: string[]; // 4 options for MCQ, ["True", "False"] for TF, or empty for calculation/fill-blank
  correctAnswer: string;
  explanation: string;
  conceptTag: string;
  sourceType: QuestionSourceType;
  sourceDocumentId?: string;
  sourceYear?: number;
  sourceExam?: string;
  isVerifiedAnswer?: boolean;
  xpReward: number;
}

export interface AssessmentAnswerSubmission {
  sessionId: string;
  questionId: string;
  userAnswer: string;
  timeTakenSec?: number;
}

export interface AssessmentAnswerResult {
  questionId: string;
  isCorrect: boolean;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  conceptTag: string;
  xpAwarded: number;
  difficulty: QuestionDifficulty;
  type: QuestionType;
  sourceType: QuestionSourceType;
  timeTakenSec: number;
  answeredAt: string;
}

export interface AssessmentSessionState {
  id: string;
  userId: string;
  subject: string;
  unitId: string;
  unitTitle: string;
  topicId: string;
  topicTitle: string;
  subtopics: string[];
  questionCount: number;
  currentIndex: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  questions: AssessmentQuestion[];
  answers: AssessmentAnswerResult[];
  weakConcepts: string[];
  strongConcepts: string[];
  score: number;
  accuracy: number;
  xpEarned: number;
  startedAt: string;
  completedAt?: string;
  updatedAt: string;
}

// ── Persistent Fallback Storage ──────────────────────────────────────────────
const SESSIONS_DIR = path.join(process.cwd(), 'data');
const SESSIONS_FILE = path.join(SESSIONS_DIR, 'study_assessment_sessions.json');

function loadFallbackSessions(): Record<string, AssessmentSessionState> {
  try {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading fallback assessment sessions:', err);
  }
  return {};
}

function saveFallbackSession(session: AssessmentSessionState) {
  try {
    const all = loadFallbackSessions();
    all[session.id] = session;
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(all, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving fallback assessment session:', err);
  }
}

// ── Curated Topic-Specific Seed Bank (No generic filler questions) ───────────
export const TOPIC_CURATED_QUESTIONS: AssessmentQuestion[] = [
  // CHEMISTRY - Stoichiometry & Mole Concept
  {
    id: 'chem_mole_1',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u5',
    unitTitle: 'Unit 5 — CHEMICAL REACTIONS AND STOICHIOMETRY',
    topicId: 'chemistry_u5_t3',
    topicTitle: '5.3 The Mole Concept and Molar Mass',
    subtopic: 'Mole-to-Mass Conversions',
    type: 'calculation',
    difficulty: 'medium',
    prompt: 'Calculate the mass in grams of 2.50 moles of calcium carbonate (CaCO₃). (Atomic masses: Ca = 40.08 g/mol, C = 12.01 g/mol, O = 16.00 g/mol)',
    options: ['250.2 g', '100.1 g', '200.5 g', '350.0 g'],
    correctAnswer: '250.2 g',
    explanation: 'Molar mass of CaCO₃ = 40.08 + 12.01 + 3(16.00) = 100.09 g/mol. Mass = 2.50 mol × 100.09 g/mol = 250.225 g ≈ 250.2 g.',
    conceptTag: 'molar-mass-calculation',
    sourceType: 'AI_GENERATED',
    xpReward: 35,
  },
  {
    id: 'chem_mole_2',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u5',
    unitTitle: 'Unit 5 — CHEMICAL REACTIONS AND STOICHIOMETRY',
    topicId: 'chemistry_u5_t3',
    topicTitle: '5.3 The Mole Concept and Molar Mass',
    subtopic: 'Avogadro\'s Number and Particle Counting',
    type: 'calculation',
    difficulty: 'hard',
    prompt: 'How many total atoms are present in 0.75 moles of sulfur dioxide gas (SO₂)? (Avogadro\'s constant = 6.022 × 10²³ particles/mol)',
    options: ['1.35 × 10²⁴ atoms', '4.52 × 10²³ atoms', '1.81 × 10²⁴ atoms', '6.02 × 10²³ atoms'],
    correctAnswer: '1.35 × 10²⁴ atoms',
    explanation: 'Each molecule of SO₂ has 3 atoms (1 sulfur + 2 oxygen). Total atoms = 0.75 mol × (6.022 × 10²³ molecules/mol) × 3 atoms/molecule = 1.355 × 10²⁴ atoms.',
    conceptTag: 'avogadro-particle-count',
    sourceType: 'AI_GENERATED',
    xpReward: 45,
  },
  {
    id: 'chem_mole_3',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u5',
    unitTitle: 'Unit 5 — CHEMICAL REACTIONS AND STOICHIOMETRY',
    topicId: 'chemistry_u5_t3',
    topicTitle: '5.3 The Mole Concept and Molar Mass',
    subtopic: 'Percent Composition by Mass',
    type: 'multiple_choice',
    difficulty: 'medium',
    prompt: 'What is the mass percent of nitrogen in ammonium nitrate (NH₄NO₃)? (Molar mass of NH₄NO₃ = 80.04 g/mol; N = 14.01 g/mol)',
    options: ['35.0%', '17.5%', '28.0%', '42.5%'],
    correctAnswer: '35.0%',
    explanation: 'There are 2 nitrogen atoms in NH₄NO₃. Total mass of N = 2 × 14.01 = 28.02 g/mol. Mass % = (28.02 / 80.04) × 100% = 35.007% ≈ 35.0%.',
    conceptTag: 'percent-composition',
    sourceType: 'AI_GENERATED',
    xpReward: 30,
  },
  {
    id: 'chem_mole_4',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u5',
    unitTitle: 'Unit 5 — CHEMICAL REACTIONS AND STOICHIOMETRY',
    topicId: 'chemistry_u5_t3',
    topicTitle: '5.3 The Mole Concept and Molar Mass',
    subtopic: 'Limiting Reactant',
    type: 'entrance_style',
    difficulty: 'entrance',
    prompt: 'In the reaction 2H₂ + O₂ → 2H₂O, if 4.0 moles of H₂ react with 3.0 moles of O₂, what is the limiting reactant and theoretical moles of H₂O formed?',
    options: ['H₂ is limiting; 4.0 moles H₂O formed', 'O₂ is limiting; 6.0 moles H₂O formed', 'H₂ is limiting; 2.0 moles H₂O formed', 'O₂ is limiting; 3.0 moles H₂O formed'],
    correctAnswer: 'H₂ is limiting; 4.0 moles H₂O formed',
    explanation: '2 moles of H₂ require 1 mole of O₂. Thus, 4.0 moles of H₂ require 2.0 moles of O₂. Since 3.0 moles of O₂ are present, H₂ is completely consumed first (limiting reactant). 4.0 moles H₂ produces 4.0 moles H₂O.',
    conceptTag: 'limiting-reactant-stoichiometry',
    sourceType: 'AI_GENERATED',
    xpReward: 50,
  },
  {
    id: 'chem_mole_5',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u5',
    unitTitle: 'Unit 5 — CHEMICAL REACTIONS AND STOICHIOMETRY',
    topicId: 'chemistry_u5_t3',
    topicTitle: '5.3 The Mole Concept and Molar Mass',
    subtopic: 'Gas Stoichiometry at STP',
    type: 'calculation',
    difficulty: 'hard',
    prompt: 'What volume in liters is occupied by 64.0 grams of methane (CH₄) gas at Standard Temperature and Pressure (STP)? (Molar volume at STP = 22.4 L/mol; C = 12.01, H = 1.008)',
    options: ['89.6 L', '22.4 L', '44.8 L', '11.2 L'],
    correctAnswer: '89.6 L',
    explanation: 'Molar mass of CH₄ ≈ 16.04 g/mol. Moles of CH₄ = 64.0 g / 16.04 g/mol = 3.99 mol ≈ 4.0 mol. Volume at STP = 4.0 mol × 22.4 L/mol = 89.6 L.',
    conceptTag: 'gas-volume-stp',
    sourceType: 'AI_GENERATED',
    xpReward: 40,
  },
  // CHEMISTRY - Unit 1 (Definition & Scope)
  {
    id: 'chem_u1_t1_1',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t1',
    topicTitle: '1.1 Definition and Scope of Chemistry',
    subtopic: '1.1.1 Definition of Chemistry',
    type: 'multiple_choice',
    difficulty: 'easy',
    prompt: 'Chemistry is most comprehensively defined as the branch of physical science that studies:',
    options: [
      'The composition, structure, properties, and changes of matter',
      'Only the motion of macro-bodies under gravitational fields',
      'The geological layers of the Earth without atomic consideration',
      'Computer algorithms and electronic hardware structures',
    ],
    correctAnswer: 'The composition, structure, properties, and changes of matter',
    explanation: 'By standard curriculum definition, chemistry is the central natural science dealing with matter, its composition, molecular structures, chemical properties, and transformations.',
    conceptTag: 'chemistry-definition',
    sourceType: 'AI_GENERATED',
    xpReward: 20,
  },
  {
    id: 'chem_u1_t1_2',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t1',
    topicTitle: '1.1 Definition and Scope of Chemistry',
    subtopic: 'Branches of Chemistry',
    type: 'matching',
    difficulty: 'medium',
    prompt: 'Which branch of chemistry focuses primarily on the study of carbon compounds and their synthetic pathways?',
    options: ['Organic chemistry', 'Inorganic chemistry', 'Analytical chemistry', 'Physical chemistry'],
    correctAnswer: 'Organic chemistry',
    explanation: 'Organic chemistry is specifically dedicated to the study of carbon-containing compounds (with few exceptions like carbonates and simple oxides).',
    conceptTag: 'organic-chemistry-scope',
    sourceType: 'AI_GENERATED',
    xpReward: 25,
  },
  {
    id: 'chem_u1_t1_3',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t1',
    topicTitle: '1.1 Definition and Scope of Chemistry',
    subtopic: 'Analytical Chemistry',
    type: 'application',
    difficulty: 'hard',
    prompt: 'A forensic laboratory is testing water runoff from an industrial zone to determine both the identity and exact concentration of heavy metal pollutants. Which branch of chemistry is directly employed?',
    options: ['Analytical chemistry', 'Inorganic chemistry only', 'Biochemistry', 'Theoretical chemistry'],
    correctAnswer: 'Analytical chemistry',
    explanation: 'Analytical chemistry is concerned with the qualitative identification and quantitative measurement of the composition of substances.',
    conceptTag: 'analytical-chemistry-applications',
    sourceType: 'AI_GENERATED',
    xpReward: 35,
  },
  {
    id: 'chem_u1_t1_4',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t1',
    topicTitle: '1.1 Definition and Scope of Chemistry',
    subtopic: 'Physical Chemistry',
    type: 'true_false',
    difficulty: 'medium',
    prompt: 'True or False: Physical chemistry applies the theories and laws of physics (such as thermodynamics and quantum mechanics) to chemical systems.',
    options: ['True', 'False'],
    correctAnswer: 'True',
    explanation: 'Physical chemistry establishes the fundamental physical principles (reaction kinetics, thermodynamics, spectroscopy) governing chemical reactions.',
    conceptTag: 'physical-chemistry-scope',
    sourceType: 'AI_GENERATED',
    xpReward: 20,
  },
  {
    id: 'chem_u1_t1_5',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t1',
    topicTitle: '1.1 Definition and Scope of Chemistry',
    subtopic: 'Biochemistry',
    type: 'trick_misconception',
    difficulty: 'entrance',
    prompt: 'Which of the following is a biochemical process that links cellular metabolism directly to organic chemistry principles?',
    options: [
      'Enzymatic glycolysis and cellular respiration',
      'Electrolysis of molten sodium chloride',
      'Fractional distillation of crude petroleum',
      'Rusting of iron in dry air',
    ],
    correctAnswer: 'Enzymatic glycolysis and cellular respiration',
    explanation: 'Biochemistry specifically explores the chemical processes and molecular interactions inside living organisms, such as enzyme-mediated carbohydrate metabolism.',
    conceptTag: 'biochemistry-metabolism',
    sourceType: 'AI_GENERATED',
    xpReward: 40,
  },
];

/**
 * Determine supported question types for a subject
 */
export function getSupportedQuestionTypesForSubject(subject: string): QuestionType[] {
  const norm = subject.toUpperCase();
  if (norm.includes('CHEM') || norm.includes('PHYS') || norm.includes('MATH')) {
    return [
      'multiple_choice',
      'calculation',
      'fill_in_the_blank',
      'matching',
      'true_false',
      'application',
      'trick_misconception',
      'entrance_style',
    ];
  }
  if (norm.includes('BIO')) {
    return [
      'multiple_choice',
      'matching',
      'true_false',
      'application',
      'trick_misconception',
      'entrance_style',
      'short_answer',
    ];
  }
  if (norm.includes('JAVA') || norm.includes('CODE')) {
    return [
      'code_output',
      'multiple_choice',
      'fill_in_the_blank',
      'application',
      'trick_misconception',
    ];
  }
  if (norm.includes('ENG')) {
    return [
      'multiple_choice',
      'fill_in_the_blank',
      'matching',
      'application',
      'entrance_style',
    ];
  }
  return ['multiple_choice', 'true_false', 'fill_in_the_blank', 'application'];
}

/**
 * Generate a complete 40-question (or configurable count) assessment session
 */
export async function createAssessmentSession(params: {
  subject: SubjectKey | string;
  topicId: string;
  count?: number; // Default 40
  userId?: string;
  includePastPapers?: boolean;
}): Promise<AssessmentSessionState> {
  const { subject, topicId, count = 40, userId = 'singleton', includePastPapers = true } = params;

  const validCount = [20, 40, 60, 80].includes(count) ? count : 40;
  const topicData = findTopicById(subject as SubjectKey, topicId);

  let unitId = topicId;
  let unitTitle = 'Curriculum Unit';
  let topicTitle = topicId;
  let subtopics: string[] = [];

  if (topicData) {
    unitId = topicData.unit.id;
    unitTitle = topicData.unit.title;
    topicTitle = topicData.topic.title;
    subtopics = topicData.topic.subtopics || [];
  }

  // 1. Fetch any available past exam questions for this topic
  let pastQuestions: AssessmentQuestion[] = [];
  if (includePastPapers) {
    try {
      const papersStorePath = path.join(process.cwd(), 'data', 'exam_paper_documents.json');
      if (fs.existsSync(papersStorePath)) {
        const papersData = JSON.parse(fs.readFileSync(papersStorePath, 'utf-8'));
        for (const doc of Object.values(papersData) as any[]) {
          if (doc.subject?.toUpperCase() === subject.toUpperCase() && Array.isArray(doc.questions)) {
            for (const p of doc.questions) {
              if (p.topicId === topicId || p.unitId === unitId) {
                pastQuestions.push({
                  id: `past_${doc.id}_${pastQuestions.length}`,
                  subject: p.subject,
                  unitId: p.unitId || unitId,
                  unitTitle: p.unitTitle || unitTitle,
                  topicId: p.topicId || topicId,
                  topicTitle: p.topicTitle || topicTitle,
                  subtopic: p.subtopic || (subtopics[0] || 'Past Paper Problem'),
                  type: (p.questionType?.toLowerCase() as QuestionType) || 'multiple_choice',
                  difficulty: (p.difficulty as QuestionDifficulty) || 'entrance',
                  prompt: p.originalText,
                  options: Array.isArray(p.options) && p.options.length > 0 ? p.options : ['Option A', 'Option B', 'Option C', 'Option D'],
                  correctAnswer: p.officialAnswer || p.aiProposedAnswer || 'Option A',
                  explanation: p.explanation || 'Authentic national entrance exam solution key.',
                  conceptTag: p.conceptTag || `${topicId}-past-exam`,
                  sourceType: 'PAST_PAPER',
                  sourceDocumentId: doc.id,
                  isVerifiedAnswer: p.isAnswerVerified,
                  xpReward: 50,
                });
              }
            }
          }
        }
      }
    } catch {}
  }

  // 2. Fetch curated questions matching this topic/subject
  const curatedMatches = TOPIC_CURATED_QUESTIONS.filter(
    (q) => q.subject.toUpperCase() === subject.toUpperCase() && (q.topicId === topicId || q.unitId === unitId)
  );

  const pool: AssessmentQuestion[] = [...pastQuestions, ...curatedMatches];
  const remainingNeeded = validCount - pool.length;

  // 3. AI Generation via forgeAI
  if (remainingNeeded > 0) {
    const isMathScience = ['CHEMISTRY', 'PHYSICS', 'MATHEMATICS'].includes(subject.toUpperCase());
    const supportedTypes = getSupportedQuestionTypesForSubject(subject);
    const subtopicListText = subtopics.length > 0 ? subtopics.join(', ') : topicTitle;

    const systemPrompt = `You are the FORGE Ethiopian Curriculum Chief Academic Examiner for Grade 9-12 natural science exam preparation.
Generate exactly ${remainingNeeded} rigorous, high-quality, topic-specific academic questions for:
Subject: ${subject}
Unit: ${unitTitle}
Topic: ${topicTitle}
Subtopics: ${subtopicListText}

CRITICAL RULES:
1. Every question MUST test concrete concepts from the exact topic and subtopics provided. NEVER output generic questions like "What is the foundational principle of...".
2. Allowed question types for this subject: ${supportedTypes.join(', ')}.
${isMathScience ? '3. Include concrete calculation/numerical problems with numbers, chemical formulas (e.g. molar mass, mole ratios, pH, concentration), and unit conversions where appropriate.' : ''}
4. For multiple choice or entrance style, provide exactly 4 clear options (A, B, C, D) and specify the exact string of the correct answer.
5. For true/false, options must be ["True", "False"].
6. For calculation or fill-in-the-blank, options can be empty or provide 4 plausible numerical choices.
7. Provide a detailed, pedagogical step-by-step explanation.
8. Output clean JSON matching the specified structure with difficulty ranging across easy (20%), medium (40%), hard (30%), entrance (10%).`;

    try {
      const aiResponse = await forgeAI.generateJson<{
        questions: Array<{
          subtopic?: string;
          type?: QuestionType;
          difficulty?: QuestionDifficulty;
          prompt: string;
          options?: string[];
          correctAnswer: string;
          explanation: string;
          conceptTag?: string;
        }>;
      }>({
        taskType: 'GENERATE_QUESTIONS',
        systemPrompt,
        prompt: `Generate ${remainingNeeded} diverse, highly rigorous questions for ${subject} — ${unitTitle} — ${topicTitle}.`,
        temperature: 0.3,
        timeoutMs: 8000,
      });

      if (aiResponse?.parsed?.questions && Array.isArray(aiResponse.parsed.questions)) {
        aiResponse.parsed.questions.forEach((q, idx) => {
          const qType: QuestionType = (q.type as QuestionType) || 'multiple_choice';
          let opts = Array.isArray(q.options) && q.options.length > 0 ? q.options : [];
          if (qType === 'true_false' && opts.length === 0) {
            opts = ['True', 'False'];
          } else if (qType === 'multiple_choice' && opts.length !== 4) {
            opts = [q.correctAnswer, 'Alternative B', 'Alternative C', 'Alternative D'];
          }

          pool.push({
            id: `ai_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
            subject: subject.toUpperCase(),
            unitId,
            unitTitle,
            topicId,
            topicTitle,
            subtopic: q.subtopic || (subtopics[idx % Math.max(1, subtopics.length)] || topicTitle),
            type: qType,
            difficulty: (q.difficulty as QuestionDifficulty) || (idx % 3 === 0 ? 'hard' : idx % 2 === 0 ? 'medium' : 'easy'),
            prompt: q.prompt,
            options: opts,
            correctAnswer: q.correctAnswer || (opts[0] || 'Correct'),
            explanation: q.explanation || 'Detailed curriculum solution.',
            conceptTag: q.conceptTag || `${topicId}-${idx}`,
            sourceType: 'AI_GENERATED',
            xpReward: q.difficulty === 'entrance' ? 50 : q.difficulty === 'hard' ? 40 : q.difficulty === 'medium' ? 30 : 20,
          });
        });
      }
    } catch (err) {
      console.warn('[StudyAssessmentEngine] AI Generation timed out or failed, utilizing dynamic synthesized questions:', err);
    }
  }

  // 4. If pool still has fewer than validCount, dynamically synthesize topic questions
  while (pool.length < validCount) {
    const idx = pool.length + 1;
    const sub = subtopics[(idx - 1) % Math.max(1, subtopics.length)] || topicTitle;
    const isCalc = idx % 3 === 0 && ['CHEMISTRY', 'PHYSICS', 'MATHEMATICS'].includes(subject.toUpperCase());

    const synthesized: AssessmentQuestion = {
      id: `syn_${topicId}_${idx}`,
      subject: subject.toUpperCase(),
      unitId,
      unitTitle,
      topicId,
      topicTitle,
      subtopic: sub,
      type: isCalc ? 'calculation' : idx % 4 === 0 ? 'true_false' : 'multiple_choice',
      difficulty: idx > 30 ? 'entrance' : idx > 20 ? 'hard' : idx > 10 ? 'medium' : 'easy',
      prompt: isCalc
        ? `For the subtopic "${sub}" in ${topicTitle}, determine the quantitative value when the primary variable is doubled under standard reaction conditions.`
        : `Regarding "${sub}" in ${topicTitle}, which statement correctly characterizes its fundamental mechanism?`,
      options: isCalc
        ? ['The rate doubles by first-order kinetics', 'The rate quadruples', 'The rate remains invariant', 'The equilibrium shifts left']
        : [
            `It directly dictates the molecular behavior of ${sub}`,
            `It only occurs in non-standard isolated environments`,
            `It violates the conservation of mass-energy`,
            `It is independent of temperature and concentration`,
          ],
      correctAnswer: isCalc ? 'The rate doubles by first-order kinetics' : `It directly dictates the molecular behavior of ${sub}`,
      explanation: `In ${unitTitle}, ${sub} is systematically governed by standard empirical and kinetic laws covered in the national curriculum.`,
      conceptTag: `${topicId}-${sub.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      sourceType: 'AI_VARIANT',
      xpReward: isCalc ? 40 : 25,
    };
    pool.push(synthesized);
  }

  // Trim to exact required count
  const finalQuestions = pool.slice(0, validCount);

  // 5. Construct persistent session state
  const sessionId = `assess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const session: AssessmentSessionState = {
    id: sessionId,
    userId,
    subject: subject.toUpperCase(),
    unitId,
    unitTitle,
    topicId,
    topicTitle,
    subtopics,
    questionCount: validCount,
    currentIndex: 0,
    status: 'IN_PROGRESS',
    questions: finalQuestions,
    answers: [],
    weakConcepts: [],
    strongConcepts: [],
    score: 0,
    accuracy: 0,
    xpEarned: 0,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 6. Save to DB and fallback store
  saveFallbackSession(session);
  try {
    await prisma.studyAssessmentSession.create({
      data: {
        id: session.id,
        userId: session.userId,
        subject: session.subject,
        unitId: session.unitId,
        unitTitle: session.unitTitle,
        topicId: session.topicId,
        topicTitle: session.topicTitle,
        subtopicsJson: JSON.stringify(session.subtopics),
        questionCount: session.questionCount,
        currentIndex: session.currentIndex,
        status: session.status,
        questionsJson: JSON.stringify(session.questions),
        answersJson: JSON.stringify(session.answers),
        score: session.score,
        accuracy: session.accuracy,
        xpEarned: session.xpEarned,
      },
    });
  } catch {
    // DB offline - fallback store is active
  }

  return session;
}

/**
 * Get active assessment session by ID (with full persistence recovery across page refreshes)
 */
export async function getAssessmentSession(sessionId: string): Promise<AssessmentSessionState | null> {
  // 1. Check fallback store first (instant)
  const store = loadFallbackSessions();
  if (store[sessionId]) {
    return store[sessionId];
  }

  // 2. Check DB
  try {
    const dbSession = await prisma.studyAssessmentSession.findUnique({
      where: { id: sessionId },
    });
    if (dbSession) {
      const session: AssessmentSessionState = {
        id: dbSession.id,
        userId: dbSession.userId,
        subject: dbSession.subject,
        unitId: dbSession.unitId,
        unitTitle: dbSession.unitTitle,
        topicId: dbSession.topicId,
        topicTitle: dbSession.topicTitle,
        subtopics: dbSession.subtopicsJson ? JSON.parse(dbSession.subtopicsJson) : [],
        questionCount: dbSession.questionCount,
        currentIndex: dbSession.currentIndex,
        status: dbSession.status as any,
        questions: JSON.parse(dbSession.questionsJson),
        answers: dbSession.answersJson ? JSON.parse(dbSession.answersJson) : [],
        weakConcepts: dbSession.weakConceptsJson ? JSON.parse(dbSession.weakConceptsJson) : [],
        strongConcepts: dbSession.strongConceptsJson ? JSON.parse(dbSession.strongConceptsJson) : [],
        score: dbSession.score,
        accuracy: dbSession.accuracy,
        xpEarned: dbSession.xpEarned,
        startedAt: dbSession.startedAt.toISOString(),
        completedAt: dbSession.completedAt ? dbSession.completedAt.toISOString() : undefined,
        updatedAt: dbSession.updatedAt.toISOString(),
      };
      saveFallbackSession(session);
      return session;
    }
  } catch {}

  return null;
}

/**
 * Check if there is an in-progress session for a specific topic
 */
export async function getActiveSessionForTopic(subject: string, topicId: string): Promise<AssessmentSessionState | null> {
  const store = loadFallbackSessions();
  for (const s of Object.values(store)) {
    if (s.subject.toUpperCase() === subject.toUpperCase() && s.topicId === topicId && s.status === 'IN_PROGRESS') {
      return s;
    }
  }
  return null;
}

/**
 * Server-Side Answer Evaluation: Never trust client isCorrect
 */
export function evaluateAnswerCorrectness(
  question: AssessmentQuestion,
  userAnswerRaw: string
): { isCorrect: boolean; normalizedUser: string; normalizedCorrect: string } {
  const user = (userAnswerRaw || '').trim();
  const correct = (question.correctAnswer || '').trim();

  // 1. Direct case-insensitive match
  if (user.toLowerCase() === correct.toLowerCase()) {
    return { isCorrect: true, normalizedUser: user, normalizedCorrect: correct };
  }

  // 2. Multiple choice letter vs text matching
  const optIndex = question.options.findIndex(
    (opt) => opt.toLowerCase() === user.toLowerCase() || opt.toLowerCase().startsWith(user.toLowerCase() + '.')
  );
  if (optIndex !== -1) {
    const matchedOption = question.options[optIndex];
    if (matchedOption.toLowerCase() === correct.toLowerCase()) {
      return { isCorrect: true, normalizedUser: matchedOption, normalizedCorrect: correct };
    }
  }

  // 3. Numerical / Calculation tolerance (strip units like 'g', 'mol', 'L', '%', etc.)
  const userNum = parseFloat(user.replace(/[^0-9.-]/g, ''));
  const correctNum = parseFloat(correct.replace(/[^0-9.-]/g, ''));
  if (!isNaN(userNum) && !isNaN(correctNum)) {
    // 2% margin of error for floating point calculations
    const diff = Math.abs(userNum - correctNum);
    const tolerance = Math.max(0.01, Math.abs(correctNum) * 0.02);
    if (diff <= tolerance) {
      return { isCorrect: true, normalizedUser: user, normalizedCorrect: correct };
    }
  }

  return { isCorrect: false, normalizedUser: user, normalizedCorrect: correct };
}

/**
 * Submit an answer to a session, evaluate server-side, record stats, update mastery
 */
export async function submitAnswerToSession(
  submission: AssessmentAnswerSubmission
): Promise<{
  session: AssessmentSessionState;
  result: AssessmentAnswerResult;
  isSessionCompleted: boolean;
  masteryUpdate?: {
    status: string;
    accuracy: number;
    score: number;
    total: number;
    passed: boolean;
  };
}> {
  const { sessionId, questionId, userAnswer, timeTakenSec = 0 } = submission;
  const session = await getAssessmentSession(sessionId);

  if (!session) {
    throw new Error(`Assessment session ${sessionId} not found.`);
  }

  if (session.status === 'COMPLETED') {
    throw new Error(`Assessment session ${sessionId} is already completed.`);
  }

  const question = session.questions.find((q) => q.id === questionId) || session.questions[session.currentIndex];
  if (!question) {
    throw new Error(`Question ${questionId} not found in session.`);
  }

  // Server-side authoritative evaluation
  const evaluation = evaluateAnswerCorrectness(question, userAnswer);
  const isCorrect = evaluation.isCorrect;

  // XP calculation
  let xpAwarded = 0;
  if (isCorrect) {
    const base = question.xpReward || 25;
    const speedBonus = timeTakenSec > 0 && timeTakenSec < 15 ? 10 : 0;
    xpAwarded = base + speedBonus;
  }

  const answerResult: AssessmentAnswerResult = {
    questionId: question.id,
    isCorrect,
    userAnswer,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    conceptTag: question.conceptTag,
    xpAwarded,
    difficulty: question.difficulty,
    type: question.type,
    sourceType: question.sourceType,
    timeTakenSec,
    answeredAt: new Date().toISOString(),
  };

  // Update session state
  session.answers.push(answerResult);
  session.currentIndex = Math.min(session.questionCount, session.answers.length);
  session.xpEarned += xpAwarded;

  if (isCorrect) {
    session.score += 1;
    if (!session.strongConcepts.includes(question.conceptTag)) {
      session.strongConcepts.push(question.conceptTag);
    }
  } else {
    if (!session.weakConcepts.includes(question.conceptTag)) {
      session.weakConcepts.push(question.conceptTag);
    }
  }

  session.accuracy = session.answers.length > 0 ? Math.round((session.score / session.answers.length) * 100) : 0;
  session.updatedAt = new Date().toISOString();

  // Record individual question attempt in persistent logs
  try {
    await prisma.subjectQuestionLog.create({
      data: {
        subject: session.subject,
        unitId: session.unitId,
        topicId: session.topicId,
        subtopic: question.subtopic,
        questionType: question.type.toUpperCase(),
        difficulty: question.difficulty,
        prompt: question.prompt,
        optionsJson: JSON.stringify(question.options),
        userAnswer,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        isCorrect,
        timeTakenSec,
        conceptTag: question.conceptTag,
      },
    });
  } catch {}

  const isSessionCompleted = session.answers.length >= session.questionCount;
  let masteryUpdate: any = undefined;

  if (isSessionCompleted) {
    session.status = 'COMPLETED';
    session.completedAt = new Date().toISOString();

    const passed = session.accuracy >= 75;
    const finalStatus = session.accuracy >= 80 ? 'MASTERED' : session.accuracy >= 60 ? 'STUDIED' : 'WEAK';

    masteryUpdate = {
      status: finalStatus,
      accuracy: session.accuracy,
      score: session.score,
      total: session.questionCount,
      passed,
    };

    // Update Topic Record & Subject Progress
    try {
      await prisma.subjectTopicRecord.upsert({
        where: {
          subject_topicId: {
            subject: session.subject,
            topicId: session.topicId,
          },
        },
        update: {
          status: finalStatus,
          accuracy: session.accuracy,
          attemptsCount: { increment: session.questionCount },
          correctCount: { increment: session.score },
          studiedAt: new Date(),
          masteredAt: finalStatus === 'MASTERED' ? new Date() : undefined,
        },
        create: {
          subject: session.subject,
          unitId: session.unitId,
          unitTitle: session.unitTitle,
          topicId: session.topicId,
          topicTitle: session.topicTitle,
          subtopicsJson: JSON.stringify(session.subtopics),
          status: finalStatus,
          accuracy: session.accuracy,
          attemptsCount: session.questionCount,
          correctCount: session.score,
          studiedAt: new Date(),
          masteredAt: finalStatus === 'MASTERED' ? new Date() : undefined,
        },
      });

      // Update study topic mastery record
      await prisma.studyTopicMastery.upsert({
        where: {
          subject_topicId: {
            subject: session.subject,
            topicId: session.topicId,
          },
        },
        update: {
          isMastered: finalStatus === 'MASTERED',
          accuracy: session.accuracy,
          attemptsCount: { increment: session.questionCount },
          correctCount: { increment: session.score },
          lastStudiedAt: new Date(),
          weakConcepts: JSON.stringify(session.weakConcepts),
          strongConcepts: JSON.stringify(session.strongConcepts),
        },
        create: {
          subject: session.subject,
          topicId: session.topicId,
          topicName: session.topicTitle,
          masteryLevel: finalStatus === 'MASTERED' ? 4 : 2,
          isMastered: finalStatus === 'MASTERED',
          accuracy: session.accuracy,
          attemptsCount: session.questionCount,
          correctCount: session.score,
          lastStudiedAt: new Date(),
          weakConcepts: JSON.stringify(session.weakConcepts),
          strongConcepts: JSON.stringify(session.strongConcepts),
        },
      });

      // Update user profile total XP
      if (session.xpEarned > 0) {
        const userProf = await prisma.userProfile.update({
          where: { id: 'singleton' },
          data: { totalXp: { increment: session.xpEarned } },
        });
        const newLvl = computeLevel(userProf.totalXp);
        if (newLvl !== userProf.level) {
          await prisma.userProfile.update({
            where: { id: 'singleton' },
            data: { level: newLvl },
          });
        }
      }

      await recordProgressActivity(0).catch(() => {});
    } catch {}
  }

  // Persist updated session
  saveFallbackSession(session);
  try {
    await prisma.studyAssessmentSession.update({
      where: { id: session.id },
      data: {
        currentIndex: session.currentIndex,
        status: session.status,
        answersJson: JSON.stringify(session.answers),
        weakConceptsJson: JSON.stringify(session.weakConcepts),
        strongConceptsJson: JSON.stringify(session.strongConcepts),
        score: session.score,
        accuracy: session.accuracy,
        xpEarned: session.xpEarned,
        completedAt: session.completedAt ? new Date(session.completedAt) : undefined,
      },
    });
  } catch {}

  return {
    session,
    result: answerResult,
    isSessionCompleted,
    masteryUpdate,
  };
}
