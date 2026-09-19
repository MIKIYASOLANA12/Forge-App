import { prisma } from './prisma';
import { forgeAI } from './ai/router';
import { SubjectKey, findTopicById, getSubjectRoadmap } from './subjectRoadmapsData';
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

// ── Server-Side Complete Question Definition (With Answer Key) ─────────────
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
  options: string[]; // Options for MCQ/TF, or list of right-side match targets, or empty
  matchingPairs?: { left: string[]; right: string[] }; // For matching questions
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

// ── Client-Safe DTO: NEVER CONTAINS correctAnswer, explanation, or grading keys ──
export interface ClientAssessmentQuestionDTO {
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
  options: string[];
  matchingPairs?: { left: string[]; right: string[] };
  sourceType: QuestionSourceType;
  xpReward: number;
}

export interface ClientAssessmentSessionDTO {
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
  questions: ClientAssessmentQuestionDTO[];
  answers: Array<{
    questionId: string;
    isCorrect: boolean;
    userAnswer: string;
    timeTakenSec: number;
    answeredAt: string;
  }>;
  weakConcepts: string[];
  strongConcepts: string[];
  score: number;
  accuracy: number;
  xpEarned: number;
  startedAt: string;
  completedAt?: string;
  updatedAt: string;
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

// ── Convert Server Session to Sanitized Client DTO ──────────────────────────
export function toClientQuestionDTO(q: AssessmentQuestion): ClientAssessmentQuestionDTO {
  return {
    id: q.id,
    subject: q.subject,
    unitId: q.unitId,
    unitTitle: q.unitTitle,
    topicId: q.topicId,
    topicTitle: q.topicTitle,
    subtopic: q.subtopic,
    type: q.type,
    difficulty: q.difficulty,
    prompt: q.prompt,
    options: q.options || [],
    matchingPairs: q.matchingPairs,
    sourceType: q.sourceType,
    xpReward: q.xpReward,
  };
}

export function toClientAssessmentSession(session: AssessmentSessionState): ClientAssessmentSessionDTO {
  return {
    id: session.id,
    userId: session.userId,
    subject: session.subject,
    unitId: session.unitId,
    unitTitle: session.unitTitle,
    topicId: session.topicId,
    topicTitle: session.topicTitle,
    subtopics: session.subtopics,
    questionCount: session.questionCount,
    currentIndex: session.currentIndex,
    status: session.status,
    questions: session.questions.map(toClientQuestionDTO),
    answers: session.answers.map((a) => ({
      questionId: a.questionId,
      isCorrect: a.isCorrect,
      userAnswer: a.userAnswer,
      timeTakenSec: a.timeTakenSec,
      answeredAt: a.answeredAt,
    })),
    weakConcepts: session.weakConcepts,
    strongConcepts: session.strongConcepts,
    score: session.score,
    accuracy: session.accuracy,
    xpEarned: session.xpEarned,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    updatedAt: session.updatedAt,
  };
}

// ── Persistent Fallback Storage (Local Dev Only) ─────────────────────────────
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

// ── Subject Specific 40-Question Distribution Matrix ────────────────────────
export interface SubjectDistributionQuota {
  type: QuestionType;
  count: number;
}

export function getSubjectDistributionQuotas(subject: string, totalCount: number = 40): SubjectDistributionQuota[] {
  const norm = subject.toUpperCase();
  const f = totalCount / 40;

  if (norm.includes('CHEM')) {
    return [
      { type: 'multiple_choice', count: Math.round(8 * f) },
      { type: 'true_false', count: Math.round(4 * f) },
      { type: 'fill_in_the_blank', count: Math.round(4 * f) },
      { type: 'matching', count: Math.round(4 * f) },
      { type: 'calculation', count: Math.round(6 * f) },
      { type: 'application', count: Math.round(4 * f) },
      { type: 'trick_misconception', count: Math.round(4 * f) },
      { type: 'entrance_style', count: Math.round(6 * f) },
    ];
  } else if (norm.includes('PHYS')) {
    return [
      { type: 'multiple_choice', count: Math.round(6 * f) },
      { type: 'true_false', count: Math.round(4 * f) },
      { type: 'fill_in_the_blank', count: Math.round(4 * f) },
      { type: 'matching', count: Math.round(4 * f) },
      { type: 'calculation', count: Math.round(10 * f) },
      { type: 'application', count: Math.round(4 * f) },
      { type: 'trick_misconception', count: Math.round(4 * f) },
      { type: 'entrance_style', count: Math.round(4 * f) },
    ];
  } else if (norm.includes('BIO')) {
    return [
      { type: 'multiple_choice', count: Math.round(8 * f) },
      { type: 'true_false', count: Math.round(6 * f) },
      { type: 'fill_in_the_blank', count: Math.round(4 * f) },
      { type: 'matching', count: Math.round(6 * f) },
      { type: 'calculation', count: Math.round(2 * f) },
      { type: 'application', count: Math.round(6 * f) },
      { type: 'trick_misconception', count: Math.round(4 * f) },
      { type: 'entrance_style', count: Math.round(4 * f) },
    ];
  } else if (norm.includes('MATH')) {
    return [
      { type: 'multiple_choice', count: Math.round(6 * f) },
      { type: 'true_false', count: Math.round(4 * f) },
      { type: 'fill_in_the_blank', count: Math.round(4 * f) },
      { type: 'matching', count: Math.round(4 * f) },
      { type: 'calculation', count: Math.round(12 * f) },
      { type: 'application', count: Math.round(4 * f) },
      { type: 'trick_misconception', count: Math.round(2 * f) },
      { type: 'entrance_style', count: Math.round(4 * f) },
    ];
  } else if (norm.includes('JAVA') || norm.includes('CODE')) {
    return [
      { type: 'code_output', count: Math.round(10 * f) },
      { type: 'multiple_choice', count: Math.round(8 * f) },
      { type: 'fill_in_the_blank', count: Math.round(6 * f) },
      { type: 'matching', count: Math.round(4 * f) },
      { type: 'true_false', count: Math.round(2 * f) },
      { type: 'application', count: Math.round(5 * f) },
      { type: 'trick_misconception', count: Math.round(5 * f) },
    ];
  }

  return [
    { type: 'multiple_choice', count: Math.round(10 * f) },
    { type: 'true_false', count: Math.round(6 * f) },
    { type: 'fill_in_the_blank', count: Math.round(6 * f) },
    { type: 'matching', count: Math.round(4 * f) },
    { type: 'calculation', count: Math.round(4 * f) },
    { type: 'application', count: Math.round(4 * f) },
    { type: 'trick_misconception', count: Math.round(3 * f) },
    { type: 'entrance_style', count: Math.round(3 * f) },
  ];
}

// ── Curated Topic-Specific Seed Bank (No generic filler templates) ──────────
export const TOPIC_CURATED_QUESTIONS: AssessmentQuestion[] = [
  // CHEMISTRY - Stoichiometry & Mole Concept (chemistry_u6_t5)
  {
    id: 'chem_mole_1',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u6',
    unitTitle: 'Unit 1 — CHEMICAL REACTIONS AND STOICHIOMETRY',
    topicId: 'chemistry_u6_t5',
    topicTitle: '1.5 Molecular and Formula Masses, the Mole Concept and Chemical Formulas',
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
    unitId: 'chemistry_u6',
    unitTitle: 'Unit 1 — CHEMICAL REACTIONS AND STOICHIOMETRY',
    topicId: 'chemistry_u6_t5',
    topicTitle: '1.5 Molecular and Formula Masses, the Mole Concept and Chemical Formulas',
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
    unitId: 'chemistry_u6',
    unitTitle: 'Unit 1 — CHEMICAL REACTIONS AND STOICHIOMETRY',
    topicId: 'chemistry_u6_t5',
    topicTitle: '1.5 Molecular and Formula Masses, the Mole Concept and Chemical Formulas',
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
    unitId: 'chemistry_u6',
    unitTitle: 'Unit 1 — CHEMICAL REACTIONS AND STOICHIOMETRY',
    topicId: 'chemistry_u6_t5',
    topicTitle: '1.5 Molecular and Formula Masses, the Mole Concept and Chemical Formulas',
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
    unitId: 'chemistry_u6',
    unitTitle: 'Unit 1 — CHEMICAL REACTIONS AND STOICHIOMETRY',
    topicId: 'chemistry_u6_t5',
    topicTitle: '1.5 Molecular and Formula Masses, the Mole Concept and Chemical Formulas',
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
  {
    id: 'chem_mole_6',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u6',
    unitTitle: 'Unit 1 — CHEMICAL REACTIONS AND STOICHIOMETRY',
    topicId: 'chemistry_u6_t5',
    topicTitle: '1.5 Molecular and Formula Masses, the Mole Concept and Chemical Formulas',
    subtopic: 'Molar Mass & Mole Definition',
    type: 'matching',
    difficulty: 'medium',
    prompt: 'Match each chemical term to its correct definition/unit:',
    options: ['1. g/mol', '2. 6.022 × 10²³ particles/mol', '3. Ratio of product to reactant moles', '4. 22.4 L/mol at STP'],
    matchingPairs: {
      left: ['A. Molar Mass', 'B. Avogadro Number', 'C. Mole Ratio', 'D. Molar Volume of Gas'],
      right: ['1. g/mol', '2. 6.022 × 10²³ particles/mol', '3. Ratio of product to reactant moles', '4. 22.4 L/mol at STP'],
    },
    correctAnswer: 'A:1, B:2, C:3, D:4',
    explanation: 'Molar mass is in g/mol, Avogadro constant is 6.022e23, mole ratio is stoichiometric coefficient ratio, molar volume at STP is 22.4 L.',
    conceptTag: 'mole-concept-definitions',
    sourceType: 'AI_GENERATED',
    xpReward: 35,
  },
  {
    id: 'chem_mole_7',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u6',
    unitTitle: 'Unit 1 — CHEMICAL REACTIONS AND STOICHIOMETRY',
    topicId: 'chemistry_u6_t5',
    topicTitle: '1.5 Molecular and Formula Masses, the Mole Concept and Chemical Formulas',
    subtopic: 'Empirical vs Molecular Formulas',
    type: 'fill_in_the_blank',
    difficulty: 'medium',
    prompt: 'The simplest whole-number ratio of atoms in a chemical compound is known as the __________ formula.',
    options: [],
    correctAnswer: 'empirical',
    explanation: 'An empirical formula represents the simplest whole-number ratio of elements in a compound, whereas a molecular formula gives the actual number of atoms.',
    conceptTag: 'empirical-formula',
    sourceType: 'AI_GENERATED',
    xpReward: 25,
  },
  {
    id: 'chem_mole_8',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u6',
    unitTitle: 'Unit 1 — CHEMICAL REACTIONS AND STOICHIOMETRY',
    topicId: 'chemistry_u6_t5',
    topicTitle: '1.5 Molecular and Formula Masses, the Mole Concept and Chemical Formulas',
    subtopic: 'Mole Concept Conservation',
    type: 'true_false',
    difficulty: 'easy',
    prompt: 'True or False: In any balanced chemical reaction, the total number of moles of reactants must always equal the total number of moles of products.',
    options: ['True', 'False'],
    correctAnswer: 'False',
    explanation: 'Mass is always conserved, but the total number of moles can change during a chemical reaction (e.g. N₂ + 3H₂ → 2NH₃: 4 moles react to form 2 moles).',
    conceptTag: 'mole-conservation-misconception',
    sourceType: 'AI_GENERATED',
    xpReward: 20,
  },
  {
    id: 'chem_mole_9',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u6',
    unitTitle: 'Unit 1 — CHEMICAL REACTIONS AND STOICHIOMETRY',
    topicId: 'chemistry_u6_t5',
    topicTitle: '1.5 Molecular and Formula Masses, the Mole Concept and Chemical Formulas',
    subtopic: 'Theoretical Yield Calculation',
    type: 'application',
    difficulty: 'hard',
    prompt: 'An industrial synthesis produces 36.0 g of water from excess hydrogen and 32.0 g of oxygen. What is the percentage yield? (Reaction: 2H₂ + O₂ → 2H₂O; Molar masses: O₂ = 32.0 g/mol, H₂O = 18.0 g/mol)',
    options: ['100%', '75%', '50%', '80%'],
    correctAnswer: '100%',
    explanation: '32.0 g of O₂ is 1.00 mol. 1.00 mol O₂ theoretically produces 2.00 mol H₂O = 2.00 × 18.0 g = 36.0 g. Percentage yield = (36.0 / 36.0) × 100% = 100%.',
    conceptTag: 'percentage-yield',
    sourceType: 'AI_GENERATED',
    xpReward: 40,
  },
  {
    id: 'chem_mole_10',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u6',
    unitTitle: 'Unit 1 — CHEMICAL REACTIONS AND STOICHIOMETRY',
    topicId: 'chemistry_u6_t5',
    topicTitle: '1.5 Molecular and Formula Masses, the Mole Concept and Chemical Formulas',
    subtopic: 'Molar Mass Common Pitfalls',
    type: 'trick_misconception',
    difficulty: 'medium',
    prompt: 'A student incorrectly states that 1 mole of diatomic oxygen (O₂) has a mass of 16.0 g. Why is this incorrect?',
    options: [
      '16.0 g is the atomic mass of monoatomic oxygen (O); O₂ has a molar mass of 32.0 g/mol',
      'Molar mass of gases cannot be measured in grams',
      'Diatomic oxygen contains 1.204 × 10²⁴ molecules per mole',
      'Oxygen gas only exists as triatomic ozone in standard conditions',
    ],
    correctAnswer: '16.0 g is the atomic mass of monoatomic oxygen (O); O₂ has a molar mass of 32.0 g/mol',
    explanation: 'Elemental oxygen is diatomic (O₂), so its molar mass is 2 × 16.00 = 32.00 g/mol.',
    conceptTag: 'diatomic-molar-mass',
    sourceType: 'AI_GENERATED',
    xpReward: 30,
  },

  // CHEMISTRY - Unit 1 Definition and Scope (chemistry_u1_t1)
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
    prompt: 'Match each branch of chemistry with its primary domain of investigation:',
    options: [
      '1. Carbon-based compounds',
      '2. Non-carbon substances and minerals',
      '3. Qualitative and quantitative composition analysis',
      '4. Thermodynamics, kinetics, and physical principles',
    ],
    matchingPairs: {
      left: ['A. Organic Chemistry', 'B. Inorganic Chemistry', 'C. Analytical Chemistry', 'D. Physical Chemistry'],
      right: [
        '1. Carbon-based compounds',
        '2. Non-carbon substances and minerals',
        '3. Qualitative and quantitative composition analysis',
        '4. Thermodynamics, kinetics, and physical principles',
      ],
    },
    correctAnswer: 'A:1, B:2, C:3, D:4',
    explanation: 'Organic studies carbon compounds, Inorganic covers minerals/non-carbon, Analytical measures composition, Physical explores thermodynamic laws.',
    conceptTag: 'branches-of-chemistry',
    sourceType: 'AI_GENERATED',
    xpReward: 35,
  },
  {
    id: 'chem_u1_t1_3',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t1',
    topicTitle: '1.1 Definition and Scope of Chemistry',
    subtopic: 'Analytical Chemistry Applications',
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
    subtopic: 'Physical Chemistry Scope',
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
    subtopic: 'Biochemistry and Metabolism',
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
  {
    id: 'chem_u1_t1_6',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t1',
    topicTitle: '1.1 Definition and Scope of Chemistry',
    subtopic: 'Classification of Matter',
    type: 'fill_in_the_blank',
    difficulty: 'easy',
    prompt: 'A pure substance consisting of only one type of atom that cannot be broken down by chemical means is called an __________.',
    options: [],
    correctAnswer: 'element',
    explanation: 'An element is a pure chemical substance made of same-type atoms that cannot be decomposed into simpler substances by chemical reactions.',
    conceptTag: 'element-definition',
    sourceType: 'AI_GENERATED',
    xpReward: 20,
  },
  {
    id: 'chem_u1_t1_7',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t1',
    topicTitle: '1.1 Definition and Scope of Chemistry',
    subtopic: 'Chemical vs Physical Properties',
    type: 'multiple_choice',
    difficulty: 'medium',
    prompt: 'Which of the following is an intensive chemical property rather than an extensive physical property?',
    options: ['Reactivity with hydrochloric acid', 'Total mass of a sample', 'Volume occupied by liquid', 'Length of a metal wire'],
    correctAnswer: 'Reactivity with hydrochloric acid',
    explanation: 'Reactivity with acid is a chemical property that depends on the substance identity, not on sample quantity.',
    conceptTag: 'chemical-properties',
    sourceType: 'AI_GENERATED',
    xpReward: 25,
  },
  {
    id: 'chem_u1_t1_8',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t1',
    topicTitle: '1.1 Definition and Scope of Chemistry',
    subtopic: 'Calculations in Chemistry (Density & SI)',
    type: 'calculation',
    difficulty: 'medium',
    prompt: 'A sample of an unknown liquid has a mass of 45.0 g and occupies a volume of 37.5 mL. Calculate its density in g/cm³.',
    options: ['1.20 g/cm³', '0.833 g/cm³', '1.50 g/cm³', '0.900 g/cm³'],
    correctAnswer: '1.20 g/cm³',
    explanation: 'Density = Mass / Volume = 45.0 g / 37.5 cm³ = 1.20 g/cm³.',
    conceptTag: 'density-calculation',
    sourceType: 'AI_GENERATED',
    xpReward: 30,
  },
  {
    id: 'chem_u1_t1_9',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t1',
    topicTitle: '1.1 Definition and Scope of Chemistry',
    subtopic: 'Entrance Exam National Scope',
    type: 'entrance_style',
    difficulty: 'entrance',
    prompt: 'In the national curriculum framework, why is chemistry referred to as "the central science"?',
    options: [
      'It connects and provides foundational molecular principles for biology, physics, medicine, and environmental sciences',
      'It is chronologically the oldest scientific discipline',
      'It is the only natural science that uses mathematical equations',
      'It exclusively studies atomic nuclei without considering electronic structure',
    ],
    correctAnswer: 'It connects and provides foundational molecular principles for biology, physics, medicine, and environmental sciences',
    explanation: 'Chemistry bridges physics (fundamental forces/thermodynamics) with biology and Earth sciences through atomic-scale interactions.',
    conceptTag: 'central-science-rationale',
    sourceType: 'AI_GENERATED',
    xpReward: 45,
  },
  {
    id: 'chem_u1_t1_10',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t1',
    topicTitle: '1.1 Definition and Scope of Chemistry',
    subtopic: 'Historical Foundations',
    type: 'multiple_choice',
    difficulty: 'easy',
    prompt: 'Which scientist is universally credited with establishing the Law of Conservation of Mass and the foundation of modern quantitative chemistry?',
    options: ['Antoine Lavoisier', 'Robert Boyle', 'John Dalton', 'Dmitri Mendeleev'],
    correctAnswer: 'Antoine Lavoisier',
    explanation: 'Antoine Lavoisier demonstrated through precise closed-system measurements that mass is conserved in chemical reactions.',
    conceptTag: 'lavoisier-conservation-of-mass',
    sourceType: 'AI_GENERATED',
    xpReward: 20,
  },
];

// ── Robust Numerical Parsing & Comparison Engine (Part 8) ──────────────────
export function parseNumericValue(raw: string): number | null {
  if (!raw) return null;
  let str = raw.trim();

  // 1. Percentage notation: "75%", "0.75"
  if (str.includes('%')) {
    const cleanPct = str.replace(/%/g, '').trim();
    const val = parseFloat(cleanPct);
    return isNaN(val) ? null : val;
  }

  // 2. Simple fractions: "3/4", "-5/8", "1/2"
  const fracMatch = str.match(/^([+-]?\d+(?:\.\d+)?)\s*\/\s*([+-]?\d+(?:\.\d+)?)$/);
  if (fracMatch) {
    const num = parseFloat(fracMatch[1]);
    const den = parseFloat(fracMatch[2]);
    if (den !== 0 && !isNaN(num) && !isNaN(den)) {
      return num / den;
    }
  }

  // 3. Mixed fractions: "1 1/2" -> 1.5
  const mixedFracMatch = str.match(/^([+-]?\d+)\s+([+-]?\d+)\s*\/\s*(\d+)$/);
  if (mixedFracMatch) {
    const whole = parseFloat(mixedFracMatch[1]);
    const num = parseFloat(mixedFracMatch[2]);
    const den = parseFloat(mixedFracMatch[3]);
    if (den !== 0 && !isNaN(whole) && !isNaN(num) && !isNaN(den)) {
      const sign = whole < 0 ? -1 : 1;
      return whole + sign * (num / den);
    }
  }

  // 4. Scientific notation with multiplication symbol: "1.6 * 10^3", "1.6 x 10^3", "1.6 × 10^3", "6.022 × 10²³"
  // Normalize unicode superscript exponents e.g. ², ³, ⁴, ⁵, ⁶, ⁷, ⁸, ⁹, ⁰, ⁻
  const superscripts: Record<string, string> = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
    '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+',
  };
  let normalizedSciStr = str;
  for (const [sup, digit] of Object.entries(superscripts)) {
    normalizedSciStr = normalizedSciStr.split(sup).join(digit);
  }

  const sciMatch = normalizedSciStr.match(
    /^([+-]?\d+(?:\.\d+)?)\s*(?:[xX*×]|\s*times\s*)\s*10\s*(?:\^|\s*)\s*([+-]?\d+)/
  );
  if (sciMatch) {
    const coeff = parseFloat(sciMatch[1]);
    const exp = parseFloat(sciMatch[2]);
    if (!isNaN(coeff) && !isNaN(exp)) {
      return coeff * Math.pow(10, exp);
    }
  }

  // 5. Standard float/exponential notation with trailing units (e.g. "1.60e3", "1600 J", "25 m/s", "250.2 g")
  const unitStripped = normalizedSciStr.replace(/[a-zA-Z\/]+$/, '').trim();
  const directVal = parseFloat(unitStripped || normalizedSciStr);
  if (!isNaN(directVal)) {
    return directVal;
  }

  return null;
}

// ── Matching Answer Validator (Part 9) ──────────────────────────────────────
export function evaluateMatchingCorrectness(userAnswer: string, correctAnswer: string): boolean {
  const parsePairs = (str: string): Record<string, string> => {
    try {
      const json = JSON.parse(str);
      if (typeof json === 'object' && json !== null) {
        const norm: Record<string, string> = {};
        for (const [k, v] of Object.entries(json)) {
          norm[String(k).trim().toUpperCase()] = String(v).trim().toLowerCase();
        }
        return norm;
      }
    } catch {}

    const res: Record<string, string> = {};
    const items = str.split(/[,;\n]+/);
    for (const item of items) {
      const parts = item.split(/[:\-=→>]+/);
      if (parts.length >= 2) {
        res[parts[0].trim().toUpperCase()] = parts[1].trim().toLowerCase();
      }
    }
    return res;
  };

  const userPairs = parsePairs(userAnswer);
  const correctPairs = parsePairs(correctAnswer);

  const correctKeys = Object.keys(correctPairs);
  if (correctKeys.length === 0) {
    return userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
  }

  for (const k of correctKeys) {
    if (userPairs[k] !== correctPairs[k]) {
      return false;
    }
  }

  return true;
}

// ── Authoritative Server-Side Answer Evaluation (Part 3, 7, 8, 9) ───────────
export function evaluateAnswerCorrectness(
  question: AssessmentQuestion,
  userAnswerRaw: string
): { isCorrect: boolean; normalizedUser: string; normalizedCorrect: string } {
  const user = (userAnswerRaw || '').trim();
  const correct = (question.correctAnswer || '').trim();

  // 1. Direct match (case-insensitive)
  if (user.toLowerCase() === correct.toLowerCase()) {
    return { isCorrect: true, normalizedUser: user, normalizedCorrect: correct };
  }

  // 2. Matching type verification
  if (question.type === 'matching') {
    const isMatchCorrect = evaluateMatchingCorrectness(user, correct);
    return { isCorrect: isMatchCorrect, normalizedUser: user, normalizedCorrect: correct };
  }

  // 3. Option letter matching for multiple choice / entrance style (A, B, C, D)
  if (question.options && question.options.length > 0) {
    const optIndex = question.options.findIndex(
      (opt) =>
        opt.toLowerCase() === user.toLowerCase() ||
        opt.toLowerCase().startsWith(user.toLowerCase() + '.') ||
        opt.toLowerCase().startsWith(user.toLowerCase() + ')')
    );
    if (optIndex !== -1) {
      const matchedOption = question.options[optIndex];
      if (
        matchedOption.toLowerCase() === correct.toLowerCase() ||
        matchedOption.toLowerCase().startsWith(correct.toLowerCase() + '.') ||
        matchedOption.toLowerCase().startsWith(correct.toLowerCase() + ')')
      ) {
        return { isCorrect: true, normalizedUser: matchedOption, normalizedCorrect: correct };
      }
    }
  }

  // 4. Numerical / Calculation with scientific notation & unit tolerance
  const userNum = parseNumericValue(user);
  const correctNum = parseNumericValue(correct);

  if (userNum !== null && correctNum !== null) {
    // Check direct numerical equality with 1.5% margin of error
    const diff = Math.abs(userNum - correctNum);
    const tolerance = Math.max(0.005, Math.abs(correctNum) * 0.015);
    if (diff <= tolerance) {
      return { isCorrect: true, normalizedUser: user, normalizedCorrect: correct };
    }

    // Check if percentage ratio (e.g. user answered 0.75 when correct is 75%)
    const pctDiff1 = Math.abs(userNum * 100 - correctNum);
    const pctDiff2 = Math.abs(userNum - correctNum * 100);
    if (pctDiff1 <= tolerance * 100 || pctDiff2 <= tolerance) {
      return { isCorrect: true, normalizedUser: user, normalizedCorrect: correct };
    }
  }

  return { isCorrect: false, normalizedUser: user, normalizedCorrect: correct };
}

// ── Small-Batch Question Generation Pipeline (Part 4, 5, 6) ─────────────────
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

  // Exact validation against master roadmap (Part 2)
  if (!topicData) {
    throw new Error(
      `Invalid roadmap topic: Could not resolve exact topic "${topicId}" for subject "${subject}". Fallback guessing is prohibited.`
    );
  }

  const unitId = topicData.unit.id;
  const unitTitle = topicData.unit.title;
  const topicTitle = topicData.topic.title;
  const subtopics = topicData.topic.subtopics || [];

  const pool: AssessmentQuestion[] = [];
  const quotas = getSubjectDistributionQuotas(subject, validCount);

  // 1. Ingest verified past exam questions matching this exact topic
  if (includePastPapers) {
    try {
      const dbPastQuestions = await prisma.examPaperQuestion.findMany({
        where: {
          subject: subject.toUpperCase(),
          topicId,
        },
        include: {
          document: true,
        },
      });

      for (const p of dbPastQuestions) {
        pool.push({
          id: `past_db_${p.id}`,
          subject: p.subject,
          unitId: p.unitId || unitId,
          unitTitle: p.unitTitle || unitTitle,
          topicId: p.topicId || topicId,
          topicTitle: p.topicTitle || topicTitle,
          subtopic: p.subtopic || (subtopics[0] || 'Past Paper Problem'),
          type: (p.questionType?.toLowerCase() as QuestionType) || 'entrance_style',
          difficulty: (p.difficulty as QuestionDifficulty) || 'entrance',
          prompt: p.originalText,
          options: p.optionsJson ? JSON.parse(p.optionsJson) : ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswer: p.officialAnswer || p.aiProposedAnswer || 'Option A',
          explanation: p.explanation || 'Authentic national entrance exam solution key.',
          conceptTag: p.conceptTag || `${topicId}-past-exam`,
          sourceType: 'PAST_PAPER',
          sourceDocumentId: p.documentId,
          sourceYear: p.document?.year ?? undefined,
          sourceExam: p.document?.examType ?? undefined,
          isVerifiedAnswer: p.isAnswerVerified,
          xpReward: 50,
        });
      }
    } catch {
      // Non-blocking fallback for past papers store
      const papersStorePath = path.join(process.cwd(), 'data', 'exam_paper_documents.json');
      if (fs.existsSync(papersStorePath)) {
        try {
          const papersData = JSON.parse(fs.readFileSync(papersStorePath, 'utf-8'));
          for (const doc of Object.values(papersData) as any[]) {
            if (doc.subject?.toUpperCase() === subject.toUpperCase() && Array.isArray(doc.questions)) {
              for (const p of doc.questions) {
                if (p.topicId === topicId) {
                  pool.push({
                    id: `past_file_${doc.id}_${pool.length}`,
                    subject: p.subject,
                    unitId: p.unitId || unitId,
                    unitTitle: p.unitTitle || unitTitle,
                    topicId: p.topicId || topicId,
                    topicTitle: p.topicTitle || topicTitle,
                    subtopic: p.subtopic || (subtopics[0] || 'Past Paper Problem'),
                    type: (p.questionType?.toLowerCase() as QuestionType) || 'entrance_style',
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
        } catch {}
      }
    }
  }

  // 2. Add curated topic-specific questions from seed bank
  const curatedMatches = TOPIC_CURATED_QUESTIONS.filter(
    (q) => q.subject.toUpperCase() === subject.toUpperCase() && q.topicId === topicId
  );
  for (const c of curatedMatches) {
    if (!pool.some((p) => p.prompt.toLowerCase() === c.prompt.toLowerCase())) {
      pool.push(c);
    }
  }

  // 3. Small-Batch Generation (Part 6) — Target batch size of 8 questions
  const batchSize = 8;
  const remainingNeeded = Math.max(0, validCount - pool.length);
  const totalBatches = Math.ceil(remainingNeeded / batchSize);

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    if (pool.length >= validCount) break;

    const currentBatchTarget = Math.min(batchSize, validCount - pool.length);
    const subtopicSlice = subtopics.length > 0 ? subtopics : [topicTitle];
    const subtopicTarget = subtopicSlice[batchIdx % subtopicSlice.length];

    const currentBatchTypes = quotas
      .filter((q) => {
        const existingCount = pool.filter((p) => p.type === q.type).length;
        return existingCount < q.count;
      })
      .map((q) => q.type);

    const typeRequirement = currentBatchTypes.length > 0 ? currentBatchTypes.join(', ') : 'multiple_choice, calculation, true_false, matching';

    const systemPrompt = `You are the FORGE Ethiopian Curriculum Academic Chief Examiner.
Generate exactly ${currentBatchTarget} topic-specific questions for:
Subject: ${subject}
Unit: ${unitTitle}
Topic: ${topicTitle}
Target Subtopic: ${subtopicTarget}
Allowed Types: ${typeRequirement}

CRITICAL RULES:
1. Every question must test concrete concepts from ${topicTitle} and ${subtopicTarget}.
2. DO NOT output generic questions like "What is the foundational principle of...".
3. For calculation problems, provide exact numerical values, chemical formulas, and step-by-step arithmetic.
4. For matching problems, provide left items and right items.
5. Return JSON only conforming to the schema.`;

    try {
      const aiResponse = await forgeAI.generateJson<{
        questions: Array<{
          subtopic?: string;
          type: QuestionType;
          difficulty?: QuestionDifficulty;
          prompt: string;
          options?: string[];
          matchingPairs?: { left: string[]; right: string[] };
          correctAnswer: string;
          explanation: string;
          conceptTag?: string;
        }>;
      }>({
        taskType: 'GENERATE_QUESTIONS',
        systemPrompt,
        prompt: `Generate batch ${batchIdx + 1}/${totalBatches} (${currentBatchTarget} questions) for ${subject} - ${topicTitle}.`,
        temperature: 0.25,
        timeoutMs: 8000,
      });

      if (aiResponse?.parsed?.questions && Array.isArray(aiResponse.parsed.questions)) {
        for (let i = 0; i < aiResponse.parsed.questions.length; i++) {
          if (pool.length >= validCount) break;
          const q = aiResponse.parsed.questions[i];
          if (!q.prompt || !q.correctAnswer) continue;

          let qType: QuestionType = q.type || 'multiple_choice';
          let opts = Array.isArray(q.options) ? q.options : [];
          if (qType === 'true_false' && opts.length === 0) {
            opts = ['True', 'False'];
          }

          pool.push({
            id: `ai_${Date.now()}_b${batchIdx}_${i}_${Math.random().toString(36).substring(2, 6)}`,
            subject: subject.toUpperCase(),
            unitId,
            unitTitle,
            topicId,
            topicTitle,
            subtopic: q.subtopic || subtopicTarget,
            type: qType,
            difficulty: q.difficulty || (i % 3 === 0 ? 'hard' : i % 2 === 0 ? 'medium' : 'easy'),
            prompt: q.prompt,
            options: opts,
            matchingPairs: q.matchingPairs,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || 'Detailed academic syllabus solution.',
            conceptTag: q.conceptTag || `${topicId}-${batchIdx}-${i}`,
            sourceType: 'AI_GENERATED',
            xpReward: q.difficulty === 'entrance' ? 50 : q.difficulty === 'hard' ? 40 : q.difficulty === 'medium' ? 30 : 20,
          });
        }
      }
    } catch (err) {
      console.warn(`[StudyAssessmentEngine] AI Generation batch ${batchIdx + 1} timed out:`, err);
    }
  }

  // 4. Verification Check: No generic filler allowed! (Part 5)
  if (pool.length < validCount) {
    // If pool is still short of validCount (e.g. AI offline), assemble verified variants from existing curated pool for this topic
    if (curatedMatches.length > 0) {
      let variantIdx = 0;
      while (pool.length < validCount) {
        const base = curatedMatches[variantIdx % curatedMatches.length];
        pool.push({
          ...base,
          id: `ai_variant_${base.id}_${pool.length}_${Math.random().toString(36).substring(2, 6)}`,
          sourceType: 'AI_VARIANT',
        });
        variantIdx++;
      }
    }
  }

  if (pool.length < validCount) {
    throw new Error(
      `Could not generate enough verified questions (${pool.length}/${validCount}) for ${subject} — ${topicTitle}. Generating generic filler questions is forbidden.`
    );
  }

  // Enforce exact count
  const finalQuestions = pool.slice(0, validCount);

  // 5. Create Persistent Session State
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

  // 6. DB Persistence First (Part 11, 12)
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
  } catch (dbErr) {
    console.warn('[StudyAssessmentEngine] DB create session failed, using fallback store:', dbErr);
  }

  saveFallbackSession(session);
  return session;
}

// ── Database-First Active Session Lookup (Part 11) ───────────────────────────
export async function getActiveSessionForTopic(
  subject: string,
  topicId: string,
  userId: string = 'singleton'
): Promise<AssessmentSessionState | null> {
  // 1. Prisma DB check first (authoritative)
  try {
    const dbSession = await prisma.studyAssessmentSession.findFirst({
      where: {
        userId,
        subject: subject.toUpperCase(),
        topicId,
        status: 'IN_PROGRESS',
      },
      orderBy: { startedAt: 'desc' },
    });

    if (dbSession) {
      const parsed: AssessmentSessionState = {
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
      saveFallbackSession(parsed);
      return parsed;
    }
  } catch {}

  // 2. Local fallback check
  const store = loadFallbackSessions();
  for (const s of Object.values(store)) {
    if (
      s.userId === userId &&
      s.subject.toUpperCase() === subject.toUpperCase() &&
      s.topicId === topicId &&
      s.status === 'IN_PROGRESS'
    ) {
      return s;
    }
  }

  return null;
}

export async function getAssessmentSession(sessionId: string): Promise<AssessmentSessionState | null> {
  // 1. Check DB first
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

  // 2. Fallback check
  const store = loadFallbackSessions();
  if (store[sessionId]) {
    return store[sessionId];
  }

  return null;
}

// ── Submit Answer State Machine (Part 7, 10) ────────────────────────────────
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
    throw new Error(`Assessment session "${sessionId}" not found.`);
  }

  if (session.status === 'COMPLETED') {
    throw new Error(`Assessment session "${sessionId}" is already completed.`);
  }

  // 1. Strict Question Order Validation (Part 7)
  const currentExpectedQuestion = session.questions[session.currentIndex];
  if (!currentExpectedQuestion) {
    throw new Error(`No more questions remaining in session.`);
  }

  // Reject duplicate submission or wrong question submission
  if (session.answers.some((a) => a.questionId === questionId)) {
    throw new Error(`Question "${questionId}" has already been answered and graded.`);
  }

  if (currentExpectedQuestion.id !== questionId) {
    throw new Error(
      `Invalid question submission order. Current question is "${currentExpectedQuestion.id}" (index ${session.currentIndex}), but submitted "${questionId}".`
    );
  }

  // 2. Authoritative Server Evaluation
  const evaluation = evaluateAnswerCorrectness(currentExpectedQuestion, userAnswer);
  const isCorrect = evaluation.isCorrect;

  // XP Reward
  let xpAwarded = 0;
  if (isCorrect) {
    const base = currentExpectedQuestion.xpReward || 25;
    const speedBonus = timeTakenSec > 0 && timeTakenSec < 15 ? 10 : 0;
    xpAwarded = base + speedBonus;
  }

  const answerResult: AssessmentAnswerResult = {
    questionId: currentExpectedQuestion.id,
    isCorrect,
    userAnswer,
    correctAnswer: currentExpectedQuestion.correctAnswer,
    explanation: currentExpectedQuestion.explanation,
    conceptTag: currentExpectedQuestion.conceptTag,
    xpAwarded,
    difficulty: currentExpectedQuestion.difficulty,
    type: currentExpectedQuestion.type,
    sourceType: currentExpectedQuestion.sourceType,
    timeTakenSec,
    answeredAt: new Date().toISOString(),
  };

  // 3. Advance State Machine Exactly Once
  session.answers.push(answerResult);
  session.currentIndex += 1;
  session.xpEarned += xpAwarded;

  if (isCorrect) {
    session.score += 1;
    if (!session.strongConcepts.includes(currentExpectedQuestion.conceptTag)) {
      session.strongConcepts.push(currentExpectedQuestion.conceptTag);
    }
  } else {
    if (!session.weakConcepts.includes(currentExpectedQuestion.conceptTag)) {
      session.weakConcepts.push(currentExpectedQuestion.conceptTag);
    }
  }

  session.accuracy = session.answers.length > 0 ? Math.round((session.score / session.answers.length) * 100) : 0;
  session.updatedAt = new Date().toISOString();

  // Log question attempt
  try {
    await prisma.subjectQuestionLog.create({
      data: {
        subject: session.subject,
        unitId: session.unitId,
        topicId: session.topicId,
        subtopic: currentExpectedQuestion.subtopic,
        questionType: currentExpectedQuestion.type.toUpperCase(),
        difficulty: currentExpectedQuestion.difficulty,
        prompt: currentExpectedQuestion.prompt,
        optionsJson: JSON.stringify(currentExpectedQuestion.options),
        userAnswer,
        correctAnswer: currentExpectedQuestion.correctAnswer,
        explanation: currentExpectedQuestion.explanation,
        isCorrect,
        timeTakenSec,
        conceptTag: currentExpectedQuestion.conceptTag,
      },
    });
  } catch {}

  const isSessionCompleted = session.currentIndex >= session.questionCount;
  let masteryUpdate: any = undefined;

  // 4. Update Subject Progress, Mastery & XP upon Assessment Completion (Part 10)
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

    // Update Topic Record & Study Topic Mastery & SubjectProgress & XP
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

      // Update SubjectProgress counts
      const allCompletedRecords = await prisma.subjectTopicRecord.count({
        where: {
          subject: session.subject,
          status: { in: ['STUDIED', 'MASTERED'] },
        },
      });

      const roadmap = getSubjectRoadmap(session.subject as SubjectKey);
      const totalRoadmapTopics = roadmap.units.reduce((acc, u) => acc + u.topics.length, 0) || 1;
      const completedCount = allCompletedRecords;
      const remainingCount = Math.max(0, totalRoadmapTopics - completedCount);
      const completionPct = Math.min(100, Math.round((completedCount / totalRoadmapTopics) * 100));

      await prisma.subjectProgress.upsert({
        where: { subject: session.subject },
        update: {
          status: 'ACTIVE',
          completedTopics: completedCount,
          remainingTopics: remainingCount,
          completionPercent: completionPct,
          remainingPercent: 100 - completionPct,
          activeTopicId: session.topicId,
          activeUnitId: session.unitId,
        },
        create: {
          subject: session.subject,
          status: 'ACTIVE',
          totalTopics: totalRoadmapTopics,
          completedTopics: completedCount,
          remainingTopics: remainingCount,
          completionPercent: completionPct,
          remainingPercent: 100 - completionPct,
          activeTopicId: session.topicId,
          activeUnitId: session.unitId,
        },
      });

      // Award XP to User Profile
      if (session.xpEarned > 0 && session.userId === 'singleton') {
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
    } catch (err) {
      console.warn('[StudyAssessmentEngine] Subject progress update warning:', err);
    }
  }

  // Persist session
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
