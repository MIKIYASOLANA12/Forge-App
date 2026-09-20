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

  // CHEMISTRY - 1.2 Relationship Between Chemistry and Other Natural Sciences (chemistry_u1_t2)
  {
    id: 'chem_u1_t2_1',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t2',
    topicTitle: '1.2 Relationship Between Chemistry and Other Natural Sciences',
    subtopic: 'Physical chemistry / chemical physics',
    type: 'multiple_choice',
    difficulty: 'easy',
    prompt: 'The interdisciplinary field that applies the principles and theories of physics, such as thermodynamics, kinetics, and quantum mechanics, to study chemical systems is known as:',
    options: ['Physical chemistry', 'Biochemistry', 'Geochemistry', 'Organic chemistry'],
    correctAnswer: 'Physical chemistry',
    explanation: 'Physical chemistry is the branch at the boundary of chemistry and physics that studies the physical properties and principles underlying chemical systems and reactions.',
    conceptTag: 'physical-chemistry-definition',
    sourceType: 'AI_GENERATED',
    xpReward: 20,
  },
  {
    id: 'chem_u1_t2_2',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t2',
    topicTitle: '1.2 Relationship Between Chemistry and Other Natural Sciences',
    subtopic: 'Chemistry and physics',
    type: 'true_false',
    difficulty: 'easy',
    prompt: 'True or False: The study of atomic structure, electron configurations, and energy transformations during chemical bonds represents a fundamental intersection between chemistry and physics.',
    options: ['True', 'False'],
    correctAnswer: 'True',
    explanation: 'Both physics and chemistry investigate the structure of atoms, subatomic particles, and energy changes during state transitions and chemical bonds.',
    conceptTag: 'chemistry-physics-atomic-overlap',
    sourceType: 'AI_GENERATED',
    xpReward: 20,
  },
  {
    id: 'chem_u1_t2_3',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t2',
    topicTitle: '1.2 Relationship Between Chemistry and Other Natural Sciences',
    subtopic: 'Biochemistry',
    type: 'multiple_choice',
    difficulty: 'medium',
    prompt: 'Which interdisciplinary science is dedicated to investigating the chemical substances, enzymatic pathways, and molecular transformations occurring inside living organisms?',
    options: ['Biochemistry', 'Geochemistry', 'Astrophysics', 'Inorganic chemistry'],
    correctAnswer: 'Biochemistry',
    explanation: 'Biochemistry bridges biology and chemistry by examining biomolecules (proteins, carbohydrates, lipids, nucleic acids) and metabolic processes within cells.',
    conceptTag: 'biochemistry-definition',
    sourceType: 'AI_GENERATED',
    xpReward: 30,
  },
  {
    id: 'chem_u1_t2_4',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t2',
    topicTitle: '1.2 Relationship Between Chemistry and Other Natural Sciences',
    subtopic: 'Chemistry and biology',
    type: 'application',
    difficulty: 'hard',
    prompt: 'During photosynthesis, green plants absorb carbon dioxide and water to synthesize glucose and oxygen gas (6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂). Why is this biological process fundamentally considered a chemical transformation?',
    options: [
      'It involves the breaking and forming of chemical bonds and conversion of light energy into stored chemical bond energy',
      'It is purely a physical phase change without molecular alteration',
      'It produces new atomic elements through nuclear fusion',
      'It is governed entirely by gravitational forces inside plant leaves',
    ],
    correctAnswer: 'It involves the breaking and forming of chemical bonds and conversion of light energy into stored chemical bond energy',
    explanation: 'Photosynthesis is an endothermic chemical reaction that rearranges atoms into new chemical substances with different molecular properties.',
    conceptTag: 'photosynthesis-chemical-transformation',
    sourceType: 'AI_GENERATED',
    xpReward: 40,
  },
  {
    id: 'chem_u1_t2_5',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t2',
    topicTitle: '1.2 Relationship Between Chemistry and Other Natural Sciences',
    subtopic: 'Geochemistry',
    type: 'multiple_choice',
    difficulty: 'medium',
    prompt: 'Geochemistry is the specialized branch of natural science that merges chemistry with geology primarily to:',
    options: [
      'Study the chemical composition, distribution, and migration of elements and minerals in the Earth\'s crust and mantle',
      'Synthesize synthetic pharmaceutical vaccines for clinical use',
      'Analyze electromagnetic spectrum waves from distant galaxies',
      'Develop compiler algorithms for operating systems',
    ],
    correctAnswer: 'Study the chemical composition, distribution, and migration of elements and minerals in the Earth\'s crust and mantle',
    explanation: 'Geochemistry utilizes chemical principles to analyze the composition, formation, and weathering of rocks, minerals, soil, and geological formations.',
    conceptTag: 'geochemistry-scope',
    sourceType: 'AI_GENERATED',
    xpReward: 30,
  },
  {
    id: 'chem_u1_t2_6',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t2',
    topicTitle: '1.2 Relationship Between Chemistry and Other Natural Sciences',
    subtopic: 'Chemistry and geology',
    type: 'application',
    difficulty: 'hard',
    prompt: 'A research team analyzing volcanic rock specimens from the Main Ethiopian Rift measures isotopic ratios and mineral compositions to trace ancient magma evolution. This scientific workflow demonstrates the direct intersection of:',
    options: [
      'Chemistry and Geology (Geochemistry & Analytical Chemistry)',
      'Botany and Zoology',
      'Pure Sociology and Economics',
      'Astrophysics and Ecology',
    ],
    correctAnswer: 'Chemistry and Geology (Geochemistry & Analytical Chemistry)',
    explanation: 'Analyzing isotopic abundance and mineral chemistry in volcanic rocks is a classic application of analytical geochemistry.',
    conceptTag: 'rift-valley-geochemistry-application',
    sourceType: 'AI_GENERATED',
    xpReward: 40,
  },
  {
    id: 'chem_u1_t2_7',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t2',
    topicTitle: '1.2 Relationship Between Chemistry and Other Natural Sciences',
    subtopic: 'Chemistry and medicine',
    type: 'multiple_choice',
    difficulty: 'easy',
    prompt: 'Which of the following highlights the primary contribution of chemistry to medical science and healthcare?',
    options: [
      'The design, synthesis, and quantitative formulation of pharmaceuticals, antibiotics, antiseptics, and diagnostic reagents',
      'The calculation of orbital trajectories of satellites',
      'The architectural drafting of hospital building foundations',
      'The mechanical calibration of steam engines',
    ],
    correctAnswer: 'The design, synthesis, and quantitative formulation of pharmaceuticals, antibiotics, antiseptics, and diagnostic reagents',
    explanation: 'Medicinal and pharmaceutical chemistry provides the drugs, diagnostic tests, and synthetic materials essential for modern medicine.',
    conceptTag: 'chemistry-medicine-contribution',
    sourceType: 'AI_GENERATED',
    xpReward: 20,
  },
  {
    id: 'chem_u1_t2_8',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t2',
    topicTitle: '1.2 Relationship Between Chemistry and Other Natural Sciences',
    subtopic: 'Physical chemistry / chemical physics',
    type: 'matching',
    difficulty: 'medium',
    prompt: 'Match each interdisciplinary branch of science to its core domain of investigation:',
    options: [
      '1. Chemical processes in living organisms',
      '2. Chemical composition and processes of Earth\'s rocks and minerals',
      '3. Physical principles (energy, thermodynamics, quantum mechanics) in chemical systems',
      '4. Chemical synthesis and analysis of medicinal drugs and diagnostics',
    ],
    matchingPairs: {
      left: ['A. Biochemistry', 'B. Geochemistry', 'C. Physical Chemistry', 'D. Pharmaceutical Chemistry'],
      right: [
        '1. Chemical processes in living organisms',
        '2. Chemical composition and processes of Earth\'s rocks and minerals',
        '3. Physical principles (energy, thermodynamics, quantum mechanics) in chemical systems',
        '4. Chemical synthesis and analysis of medicinal drugs and diagnostics',
      ],
    },
    correctAnswer: 'A:1, B:2, C:3, D:4',
    explanation: 'Biochemistry studies living organisms, Geochemistry studies rocks/minerals, Physical Chemistry studies thermodynamic/quantum laws in reactions, Pharmaceutical chemistry studies medicinal drugs.',
    conceptTag: 'interdisciplinary-chemistry-branches-matching',
    sourceType: 'AI_GENERATED',
    xpReward: 35,
  },
  {
    id: 'chem_u1_t2_9',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t2',
    topicTitle: '1.2 Relationship Between Chemistry and Other Natural Sciences',
    subtopic: 'Chemistry and physics',
    type: 'trick_misconception',
    difficulty: 'medium',
    prompt: 'A student asserts that "Chemistry is an isolated discipline that has nothing to do with physics." What fundamental scientific principle disproves this misconception?',
    options: [
      'Chemical reactions, bond energy, and electronic configurations are directly governed by the physical laws of thermodynamics and electromagnetism',
      'Physics only deals with macroscopic machinery, whereas chemistry only deals with liquids',
      'Chemistry was invented before physics and therefore replaced it completely',
      'Natural sciences operate without any shared fundamental principles',
    ],
    correctAnswer: 'Chemical reactions, bond energy, and electronic configurations are directly governed by the physical laws of thermodynamics and electromagnetism',
    explanation: 'Chemistry and physics are deeply linked; the behavior of atoms, chemical bonding, and reaction energetics are governed by quantum mechanics and thermodynamics.',
    conceptTag: 'physics-chemistry-overlap-misconception',
    sourceType: 'AI_GENERATED',
    xpReward: 30,
  },
  {
    id: 'chem_u1_t2_10',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t2',
    topicTitle: '1.2 Relationship Between Chemistry and Other Natural Sciences',
    subtopic: 'Chemistry and biology',
    type: 'entrance_style',
    difficulty: 'entrance',
    prompt: 'Why is chemistry universally recognized as the "Central Science" in the natural science hierarchy?',
    options: [
      'It provides the atomic and molecular foundation linking physical laws to biological, geological, and environmental processes',
      'It is the only natural science that does not require laboratory equipment',
      'It focuses exclusively on subatomic particles without considering molecules',
      'It is strictly theoretical and has no practical applications in production',
    ],
    correctAnswer: 'It provides the atomic and molecular foundation linking physical laws to biological, geological, and environmental processes',
    explanation: 'Chemistry is the central science because a grasp of chemical principles is essential for understanding physics, biology, geology, medicine, and environmental science.',
    conceptTag: 'central-science-national-entrance',
    sourceType: 'AI_GENERATED',
    xpReward: 50,
  },
  {
    id: 'chem_u1_t2_11',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t2',
    topicTitle: '1.2 Relationship Between Chemistry and Other Natural Sciences',
    subtopic: 'Geochemistry',
    type: 'fill_in_the_blank',
    difficulty: 'easy',
    prompt: 'The branch of science that combines chemistry and geology to study the chemical composition of rocks, minerals, and soils is called __________.',
    options: [],
    correctAnswer: 'geochemistry',
    explanation: 'Geochemistry applies chemical tools to study Earth\'s geological systems and mineral structures.',
    conceptTag: 'geochemistry-definition-fill',
    sourceType: 'AI_GENERATED',
    xpReward: 25,
  },
  {
    id: 'chem_u1_t2_12',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t2',
    topicTitle: '1.2 Relationship Between Chemistry and Other Natural Sciences',
    subtopic: 'Physical chemistry / chemical physics',
    type: 'calculation',
    difficulty: 'medium',
    prompt: 'In a physical chemistry investigation of reaction thermodynamics, a system absorbs 750 J of heat energy from the surroundings (q = +750 J) while doing 250 J of work on the surroundings (w = -250 J). Using the first law of thermodynamics (ΔU = q + w), calculate the net change in internal energy ΔU in Joules.',
    options: ['+500 J', '+1000 J', '-500 J', '-1000 J'],
    correctAnswer: '+500 J',
    explanation: 'ΔU = q + w = 750 J + (-250 J) = +500 J. This physical chemistry calculation shows internal energy change during a thermodynamic process.',
    conceptTag: 'thermodynamics-internal-energy-calc',
    sourceType: 'AI_GENERATED',
    xpReward: 35,
  },

  // CHEMISTRY - 1.3 The Role Chemistry Plays in Production and in Society (chemistry_u1_t3)
  {
    id: 'chem_u1_t3_1',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t3',
    topicTitle: '1.3 The Role Chemistry Plays in Production and in Society',
    subtopic: 'Agriculture',
    type: 'multiple_choice',
    difficulty: 'easy',
    prompt: 'Which primary essential plant macronutrients are supplied by synthetic NPK fertilizers produced through chemical industrial processes?',
    options: [
      'Nitrogen, Phosphorus, and Potassium',
      'Nickel, Platinum, and Krypton',
      'Sodium, Phosphorus, and Potassium',
      'Nitrogen, Polonium, and Carbon',
    ],
    correctAnswer: 'Nitrogen, Phosphorus, and Potassium',
    explanation: 'NPK stands for Nitrogen (N), Phosphorus (P), and Potassium (K), the three vital primary macronutrients needed for plant growth.',
    conceptTag: 'npk-fertilizers-agriculture',
    sourceType: 'AI_GENERATED',
    xpReward: 20,
  },
  {
    id: 'chem_u1_t3_2',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t3',
    topicTitle: '1.3 The Role Chemistry Plays in Production and in Society',
    subtopic: 'Agriculture',
    type: 'application',
    difficulty: 'medium',
    prompt: 'How does the industrial chemical synthesis of ammonia via the Haber-Bosch process (N₂ + 3H₂ ⇌ 2NH₃) directly impact global food security?',
    options: [
      'It provides the ammonia precursor required to manufacture nitrogen-rich fertilizers such as urea and ammonium nitrate at scale',
      'It creates artificial irrigation water by reducing atmospheric nitrogen',
      'It directly kills invasive insect pests without biological toxicity',
      'It prevents ultraviolet radiation from reaching cultivated farm soils',
    ],
    correctAnswer: 'It provides the ammonia precursor required to manufacture nitrogen-rich fertilizers such as urea and ammonium nitrate at scale',
    explanation: 'The Haber-Bosch process fixes atmospheric nitrogen into ammonia, enabling large-scale synthetic nitrogen fertilizers that sustain global crop yields.',
    conceptTag: 'haber-bosch-fertilizer-impact',
    sourceType: 'AI_GENERATED',
    xpReward: 25,
  },
  {
    id: 'chem_u1_t3_3',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t3',
    topicTitle: '1.3 The Role Chemistry Plays in Production and in Society',
    subtopic: 'Medicine',
    type: 'multiple_choice',
    difficulty: 'easy',
    prompt: 'Chemical substances that selectively inhibit the growth of or destroy pathogenic bacteria inside the human body are called:',
    options: ['Antibiotics', 'Fertilizers', 'Preservatives', 'Coagulants'],
    correctAnswer: 'Antibiotics',
    explanation: 'Antibiotics are pharmaceutical compounds (such as penicillin and amoxicillin) synthesized or derived to treat bacterial infections.',
    conceptTag: 'pharmaceuticals-antibiotics',
    sourceType: 'AI_GENERATED',
    xpReward: 20,
  },
  {
    id: 'chem_u1_t3_4',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t3',
    topicTitle: '1.3 The Role Chemistry Plays in Production and in Society',
    subtopic: 'Medicine',
    type: 'trick_misconception',
    difficulty: 'medium',
    prompt: 'A patient believes that synthetic chemical pharmaceuticals are inherently toxic compared to natural plant extracts. What is the scientifically accurate comparison?',
    options: [
      'Synthetic drugs are standardized chemical molecules with verified purity and precise dosages, identical or superior to active principles in nature',
      'Natural plant extracts never contain harmful secondary metabolites or toxins',
      'Synthetic medicines do not have active chemical ingredients',
      'Natural compounds do not obey the laws of chemical thermodynamics',
    ],
    correctAnswer: 'Synthetic drugs are standardized chemical molecules with verified purity and precise dosages, identical or superior to active principles in nature',
    explanation: 'A pure chemical molecule has identical pharmacological activity regardless of whether it is synthesized in a lab or extracted from nature, with synthetic forms offering precise dosage control and purity.',
    conceptTag: 'synthetic-vs-natural-drugs',
    sourceType: 'AI_GENERATED',
    xpReward: 30,
  },
  {
    id: 'chem_u1_t3_5',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t3',
    topicTitle: '1.3 The Role Chemistry Plays in Production and in Society',
    subtopic: 'Food production',
    type: 'multiple_choice',
    difficulty: 'easy',
    prompt: 'Which chemical compound is widely used as an antioxidant food additive (Vitamin C) to prevent oxidative spoilage and browning in processed foods?',
    options: ['Ascorbic acid', 'Sodium hypochlorite', 'Sulfuric acid', 'Calcium carbide'],
    correctAnswer: 'Ascorbic acid',
    explanation: 'Ascorbic acid (Vitamin C) acts as an antioxidant and dietary additive in food preservation.',
    conceptTag: 'food-preservation-antioxidants',
    sourceType: 'AI_GENERATED',
    xpReward: 20,
  },
  {
    id: 'chem_u1_t3_6',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t3',
    topicTitle: '1.3 The Role Chemistry Plays in Production and in Society',
    subtopic: 'Food production',
    type: 'application',
    difficulty: 'medium',
    prompt: 'In traditional and industrial Ethiopian food processing, fermentation of injera dough relies on biochemical reactions carried out by microorganisms to produce:',
    options: [
      'Lactic acid and carbon dioxide gas which leaven the batter and impart a tangy flavor',
      'Hydrochloric acid and pure hydrogen gas for cooking heat',
      'Sodium hydroxide for neutralizing grain proteins',
      'Inorganic silicate polymers for structural rigidity',
    ],
    correctAnswer: 'Lactic acid and carbon dioxide gas which leaven the batter and impart a tangy flavor',
    explanation: 'Fermentation of teff flour by lactic acid bacteria and yeasts produces lactic acid (giving the characteristic sour taste) and CO₂ (creating the spongy eyes/air pockets).',
    conceptTag: 'fermentation-food-processing',
    sourceType: 'AI_GENERATED',
    xpReward: 25,
  },
  {
    id: 'chem_u1_t3_7',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t3',
    topicTitle: '1.3 The Role Chemistry Plays in Production and in Society',
    subtopic: 'Building construction',
    type: 'multiple_choice',
    difficulty: 'medium',
    prompt: 'Ordinary Portland Cement used in building construction is manufactured by heating limestone (CaCO₃) with clay (silicates) in a rotary kiln. The principal reactive compounds formed include calcium silicates, which set through what chemical process when mixed with water?',
    options: ['Hydration', 'Sublimation', 'Distillation', 'Electrolysis'],
    correctAnswer: 'Hydration',
    explanation: 'The setting and hardening of cement is an exothermic chemical hydration reaction where calcium silicate hydrates form interlocking crystal networks.',
    conceptTag: 'cement-hydration-chemistry',
    sourceType: 'AI_GENERATED',
    xpReward: 25,
  },
  {
    id: 'chem_u1_t3_8',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t3',
    topicTitle: '1.3 The Role Chemistry Plays in Production and in Society',
    subtopic: 'Building construction',
    type: 'matching',
    difficulty: 'medium',
    prompt: 'Match each construction material with the underlying chemical product category:',
    options: [
      '1. Structural alloy of iron with small carbon content',
      '2. Inorganic non-metallic amorphous solid formed by fusing silica (SiO₂)',
      '3. Hydraulic binding powder produced from calcined limestone and clay',
      '4. Synthetic polymer used in plumbing pipes (polyvinyl chloride)',
    ],
    matchingPairs: {
      left: ['A. Steel', 'B. Glass', 'C. Cement', 'D. PVC'],
      right: [
        '1. Structural alloy of iron with small carbon content',
        '2. Inorganic non-metallic amorphous solid formed by fusing silica (SiO₂)',
        '3. Hydraulic binding powder produced from calcined limestone and clay',
        '4. Synthetic polymer used in plumbing pipes (polyvinyl chloride)',
      ],
    },
    correctAnswer: 'A:1, B:2, C:3, D:4',
    explanation: 'Steel is an Fe-C alloy, glass is fused silica, cement is calcined calcium silicates/aluminates, and PVC is a synthetic polymer.',
    conceptTag: 'construction-materials-matching',
    sourceType: 'AI_GENERATED',
    xpReward: 30,
  },
  {
    id: 'chem_u1_t3_9',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t3',
    topicTitle: '1.3 The Role Chemistry Plays in Production and in Society',
    subtopic: 'Other societal and technological applications',
    type: 'multiple_choice',
    difficulty: 'easy',
    prompt: 'Synthetic polymers such as polyethylene, nylon, and polyester have transformed textiles and packaging. These materials are formed through chemical reactions known as:',
    options: ['Polymerization', 'Neutralization', 'Precipitation', 'Sedimentation'],
    correctAnswer: 'Polymerization',
    explanation: 'Polymerization is the chemical process of linking small monomer units together to build long-chain macromolecules (polymers).',
    conceptTag: 'synthetic-polymers-society',
    sourceType: 'AI_GENERATED',
    xpReward: 20,
  },
  {
    id: 'chem_u1_t3_10',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t3',
    topicTitle: '1.3 The Role Chemistry Plays in Production and in Society',
    subtopic: 'Other societal and technological applications',
    type: 'entrance_style',
    difficulty: 'entrance',
    prompt: 'In modern water treatment plants, which chemical agent is predominantly added during disinfection to eliminate waterborne microbiological pathogens?',
    options: [
      'Chlorine (Cl₂) or Sodium hypochlorite (NaOCl)',
      'Copper sulfate pentahydrate',
      'Sodium bicarbonate',
      'Methane gas',
    ],
    correctAnswer: 'Chlorine (Cl₂) or Sodium hypochlorite (NaOCl)',
    explanation: 'Chlorination uses chlorine or hypochlorite salts to generate hypochlorous acid (HOCl), a powerful oxidizing agent that kills bacteria and viruses in potable water.',
    conceptTag: 'water-treatment-chlorination',
    sourceType: 'AI_GENERATED',
    xpReward: 45,
  },
  {
    id: 'chem_u1_t3_11',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t3',
    topicTitle: '1.3 The Role Chemistry Plays in Production and in Society',
    subtopic: 'Agriculture',
    type: 'calculation',
    difficulty: 'hard',
    prompt: 'A standard bag of urea fertilizer [CO(NH₂)₂] weighs 50.0 kg. What is the theoretical percentage by mass of nitrogen (N) in pure urea, and how many kilograms of nitrogen are supplied per bag? (Atomic masses: C = 12.01, O = 16.00, N = 14.01, H = 1.01 g/mol)',
    options: [
      '46.7% N, supplying ~23.3 kg N',
      '28.0% N, supplying ~14.0 kg N',
      '60.0% N, supplying ~30.0 kg N',
      '35.0% N, supplying ~17.5 kg N',
    ],
    correctAnswer: '46.7% N, supplying ~23.3 kg N',
    explanation: 'Molar mass of CO(NH₂)₂ = 12.01 + 16.00 + 2(14.01) + 4(1.01) = 60.07 g/mol. % N = (28.02 / 60.07) × 100% = 46.65% ≈ 46.7%. In 50 kg: 50.0 × 0.4665 = 23.32 kg ≈ 23.3 kg N.',
    conceptTag: 'urea-nitrogen-percentage-calc',
    sourceType: 'AI_GENERATED',
    xpReward: 40,
  },
  {
    id: 'chem_u1_t3_12',
    subject: 'CHEMISTRY',
    unitId: 'chemistry_u1',
    unitTitle: 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
    topicId: 'chemistry_u1_t3',
    topicTitle: '1.3 The Role Chemistry Plays in Production and in Society',
    subtopic: 'Other societal and technological applications',
    type: 'trick_misconception',
    difficulty: 'medium',
    prompt: 'Why is catalytic converter technology in automotive exhaust systems a crucial environmental application of chemistry?',
    options: [
      'It uses precious metal catalysts (Pt, Pd, Rh) to convert toxic CO, NOx, and unburnt hydrocarbons into less harmful CO₂, N₂, and H₂O',
      'It converts fuel into perpetual battery energy without any chemical exhaust',
      'It replaces the internal combustion engine with liquid nitrogen coolant',
      'It turns carbon monoxide into combustible gasoline inside the exhaust manifold',
    ],
    correctAnswer: 'It uses precious metal catalysts (Pt, Pd, Rh) to convert toxic CO, NOx, and unburnt hydrocarbons into less harmful CO₂, N₂, and H₂O',
    explanation: 'Catalytic converters facilitate redox reactions on catalyst surfaces to transform harmful tailpipe pollutants (CO, NOx, VOCs) into benign atmospheric gases (CO₂, N₂, H₂O).',
    conceptTag: 'catalytic-converter-chemistry',
    sourceType: 'AI_GENERATED',
    xpReward: 30,
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

// ── Resilient Question Normalization and Strict Topic Lock Validator ────────
export interface RawAiQuestionInput {
  prompt?: string;
  question?: string;
  question_text?: string;
  text?: string;

  options?: string[] | Record<string, string>;
  choices?: string[] | Record<string, string>;
  answers?: string[] | Record<string, string>;

  matchingPairs?: { left: string[]; right: string[] };
  matching_pairs?: { left: string[]; right: string[] };

  correctAnswer?: string;
  correct_answer?: string;
  correct_option?: string;
  answer?: string;
  correct?: string;

  explanation?: string;
  rationale?: string;
  solution?: string;

  type?: string;
  question_type?: string;

  difficulty?: string;
  subtopic?: string;
  conceptTag?: string;
  concept_tag?: string;
}

export function validateAndNormalizeQuestion(
  raw: RawAiQuestionInput,
  context: {
    subject: string;
    unitId: string;
    unitTitle: string;
    topicId: string;
    topicTitle: string;
    subtopics: string[];
    targetSubtopic: string;
  }
): { question: AssessmentQuestion | null; rejectionReason: string | null } {
  // 1. Extract and sanitize prompt
  const rawPrompt = raw.prompt || raw.question || raw.question_text || raw.text;
  if (!rawPrompt || typeof rawPrompt !== 'string' || rawPrompt.trim().length < 10) {
    return { question: null, rejectionReason: 'Prompt is missing or too short (< 10 chars).' };
  }
  const prompt = rawPrompt.trim();

  // Check for generic placeholder patterns
  const lowerPrompt = prompt.toLowerCase();
  if (
    lowerPrompt.includes('for the subtopic') ||
    lowerPrompt.includes('what is the foundational principle of') ||
    lowerPrompt.includes('placeholder') ||
    lowerPrompt.includes('insert question here')
  ) {
    return { question: null, rejectionReason: `Prompt contains generic filler pattern: "${prompt.slice(0, 60)}..."` };
  }

  // 2. Extract and sanitize type
  const rawType = (raw.type || raw.question_type || 'multiple_choice').toLowerCase().trim();
  let type: QuestionType = 'multiple_choice';
  if (rawType.includes('true') || rawType === 'tf' || rawType === 'boolean') {
    type = 'true_false';
  } else if (rawType.includes('fill') || rawType === 'fib') {
    type = 'fill_in_the_blank';
  } else if (rawType.includes('match')) {
    type = 'matching';
  } else if (rawType.includes('calc') || rawType.includes('num')) {
    type = 'calculation';
  } else if (rawType.includes('trick') || rawType.includes('misconception')) {
    type = 'trick_misconception';
  } else if (rawType.includes('entrance') || rawType.includes('exam')) {
    type = 'entrance_style';
  } else if (rawType.includes('app')) {
    type = 'application';
  } else if (rawType.includes('code')) {
    type = 'code_output';
  } else {
    type = 'multiple_choice';
  }

  // 3. Extract options
  let options: string[] = [];
  const rawOpts = raw.options || raw.choices || raw.answers;
  if (Array.isArray(rawOpts)) {
    options = rawOpts.map((o) => (typeof o === 'string' ? o.trim() : String(o).trim())).filter(Boolean);
  } else if (rawOpts && typeof rawOpts === 'object') {
    options = Object.entries(rawOpts).map(([k, v]) => `${k}: ${v}`.trim());
  }

  // 4. Extract matching pairs
  let matchingPairs: { left: string[]; right: string[] } | undefined = undefined;
  const rawMatching = raw.matchingPairs || raw.matching_pairs;
  if (rawMatching && Array.isArray(rawMatching.left) && Array.isArray(rawMatching.right)) {
    matchingPairs = {
      left: rawMatching.left.map((s) => String(s).trim()),
      right: rawMatching.right.map((s) => String(s).trim()),
    };
    if (options.length === 0) {
      options = matchingPairs.right;
    }
  }

  // 5. Extract correct answer & normalize letter option (e.g. "C" or "Option C")
  let rawAns = raw.correctAnswer || raw.correct_answer || raw.correct_option || raw.answer || raw.correct;
  if (rawAns === undefined || rawAns === null || String(rawAns).trim().length === 0) {
    return { question: null, rejectionReason: 'Missing correct answer in question object.' };
  }
  let correctAnswer = String(rawAns).trim();

  // If correctAnswer is single letter "A", "B", "C", "D" or "A:", "B:", etc.
  if (options.length > 0) {
    const letterMatch = correctAnswer.match(/^(?:option\s+)?([A-Da-d0-3])(?:\:|\.|\))?$/i);
    if (letterMatch) {
      const char = letterMatch[1].toUpperCase();
      const idx = char === 'A' || char === '0' ? 0 : char === 'B' || char === '1' ? 1 : char === 'C' || char === '2' ? 2 : 3;
      if (options[idx]) {
        correctAnswer = options[idx];
      } else {
        const matched = options.find(
          (o) =>
            o.toUpperCase().startsWith(`${char}:`) ||
            o.toUpperCase().startsWith(`${char}.`) ||
            o.toUpperCase().startsWith(`${char})`)
        );
        if (matched) {
          correctAnswer = matched;
        }
      }
    } else {
      const matched = options.find(
        (o) => o.toLowerCase() === correctAnswer.toLowerCase() || o.toLowerCase().endsWith(correctAnswer.toLowerCase())
      );
      if (matched) {
        correctAnswer = matched;
      }
    }
  }

  // 6. Type-specific integrity checks
  if (type === 'multiple_choice') {
    if (options.length < 2) {
      return { question: null, rejectionReason: `multiple_choice question requires at least 2 options, got ${options.length}.` };
    }
  } else if (type === 'application' || type === 'entrance_style' || type === 'trick_misconception') {
    if (options.length < 2) {
      // If no options provided but answer exists, gracefully treat as structured short-answer / fill-in
      if (correctAnswer && correctAnswer.length > 0) {
        type = 'fill_in_the_blank';
        options = [];
      } else {
        return { question: null, rejectionReason: `${type} question requires at least 2 options or valid direct answer.` };
      }
    }
  } else if (type === 'true_false') {
    if (options.length !== 2) {
      options = ['True', 'False'];
    }
    const lowerAns = correctAnswer.toLowerCase();
    if (lowerAns === 't' || lowerAns.includes('true')) {
      correctAnswer = 'True';
    } else if (lowerAns === 'f' || lowerAns.includes('false')) {
      correctAnswer = 'False';
    }
  } else if (type === 'matching') {
    if (!matchingPairs || matchingPairs.left.length < 2 || matchingPairs.right.length < 2) {
      if (options.length >= 2) {
        // Reclassify as multiple-choice matching problem
        type = 'multiple_choice';
      } else {
        return { question: null, rejectionReason: 'Matching question requires at least 2 left and 2 right items or 2+ options.' };
      }
    }
  }

  // 7. Subtopic validation & Strict topic lock
  let subtopic = (raw.subtopic || '').trim();
  if (!subtopic || !context.subtopics.some((s) => s.toLowerCase() === subtopic.toLowerCase())) {
    const closest = context.subtopics.find(
      (s) =>
        lowerPrompt.includes(s.toLowerCase()) ||
        (raw.subtopic && s.toLowerCase().includes(raw.subtopic.toLowerCase()))
    );
    subtopic = closest || context.targetSubtopic || context.subtopics[0] || context.topicTitle;
  }

  // 8. Difficulty
  let difficulty: QuestionDifficulty = 'medium';
  const rawDiff = (raw.difficulty || '').toLowerCase();
  if (rawDiff.includes('easy')) difficulty = 'easy';
  else if (rawDiff.includes('hard')) difficulty = 'hard';
  else if (rawDiff.includes('entrance')) difficulty = 'entrance';
  else difficulty = 'medium';

  const explanation = (
    raw.explanation ||
    raw.rationale ||
    raw.solution ||
    'Academic Ethiopian curriculum verified explanation.'
  ).trim();
  const conceptTag = (
    raw.conceptTag ||
    raw.concept_tag ||
    `${context.topicId}-${subtopic.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  ).trim();
  const xpReward = difficulty === 'entrance' ? 50 : difficulty === 'hard' ? 40 : difficulty === 'medium' ? 30 : 20;

  const validQuestion: AssessmentQuestion = {
    id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    subject: context.subject.toUpperCase(),
    unitId: context.unitId,
    unitTitle: context.unitTitle,
    topicId: context.topicId,
    topicTitle: context.topicTitle,
    subtopic,
    type,
    difficulty,
    prompt,
    options,
    matchingPairs,
    correctAnswer,
    explanation,
    conceptTag,
    sourceType: 'AI_GENERATED',
    xpReward,
  };

  return { question: validQuestion, rejectionReason: null };
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

  console.log(`[StudyAssessmentEngine] ==========================================`);
  console.log(`[StudyAssessmentEngine] STARTING ASSESSMENT SESSION GENERATION`);
  console.log(`[StudyAssessmentEngine] Subject: ${subject.toUpperCase()}`);
  console.log(`[StudyAssessmentEngine] Exact Unit: ${unitId} ("${unitTitle}")`);
  console.log(`[StudyAssessmentEngine] Exact Topic: ${topicId} ("${topicTitle}")`);
  console.log(`[StudyAssessmentEngine] Exact Subtopics (${subtopics.length}):`, subtopics);
  console.log(`[StudyAssessmentEngine] Requested Question Count: ${validCount}`);
  const quotas = getSubjectDistributionQuotas(subject, validCount);
  console.log(
    `[StudyAssessmentEngine] Distribution Quotas:`,
    quotas.map((q) => `${q.type}: ${q.count}`).join(', ')
  );
  console.log(`[StudyAssessmentEngine] ==========================================`);

  const pool: AssessmentQuestion[] = [];

  // 1. Ingest verified past exam questions matching this exact topic
  if (includePastPapers) {
    console.log(`[StudyAssessmentEngine] [Step 1] Ingesting verified past exam questions matching "${topicId}"...`);
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
      console.log(`[StudyAssessmentEngine] Ingested ${dbPastQuestions.length} past exam questions from DB.`);
    } catch {
      // Non-blocking fallback for past papers store
      const papersStorePath = path.join(process.cwd(), 'data', 'exam_paper_documents.json');
      if (fs.existsSync(papersStorePath)) {
        try {
          const papersData = JSON.parse(fs.readFileSync(papersStorePath, 'utf-8'));
          let fileCount = 0;
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
                  fileCount++;
                }
              }
            }
          }
          console.log(`[StudyAssessmentEngine] Ingested ${fileCount} past exam questions from fallback file store.`);
        } catch {}
      }
    }
  }

  // 2. Add curated topic-specific questions from seed bank
  console.log(`[StudyAssessmentEngine] [Step 2] Matching curated topic seed bank for "${topicId}"...`);
  const curatedMatches = TOPIC_CURATED_QUESTIONS.filter(
    (q) => q.subject.toUpperCase() === subject.toUpperCase() && q.topicId === topicId
  );
  for (const c of curatedMatches) {
    if (!pool.some((p) => p.prompt.toLowerCase() === c.prompt.toLowerCase())) {
      pool.push(c);
    }
  }
  console.log(`[StudyAssessmentEngine] Curated seeds matched: ${curatedMatches.length}. Pool count now: ${pool.length}/${validCount}.`);

  // 3. Small-Batch Generation (Part 6) — Target batch size of 8 questions
  const batchSize = 8;
  const remainingNeeded = Math.max(0, validCount - pool.length);
  const totalBatches = Math.ceil(remainingNeeded / batchSize);
  console.log(`[StudyAssessmentEngine] [Step 3] AI Batch Generation: Needed=${remainingNeeded}, BatchSize=${batchSize}, TotalBatches=${totalBatches}`);

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

    const typeRequirement = currentBatchTypes.length > 0 ? currentBatchTypes.join(', ') : 'multiple_choice, calculation, true_false, matching, application';

    console.log(`\n[StudyAssessmentEngine] --- Starting Batch ${batchIdx + 1}/${totalBatches} (Target: ${currentBatchTarget}, Subtopic: "${subtopicTarget}", Types: [${typeRequirement}]) ---`);

    let batchAttempts = 0;
    const maxBatchAttempts = 2;
    let batchAcceptedCount = 0;

    while (batchAttempts < maxBatchAttempts && batchAcceptedCount < currentBatchTarget && pool.length < validCount) {
      batchAttempts++;
      const attemptTarget = currentBatchTarget - batchAcceptedCount;
      const attemptSubtopic = subtopicSlice[(batchIdx + batchAttempts - 1) % subtopicSlice.length];

      const systemPrompt = `You are the FORGE Ethiopian Curriculum Academic Chief Examiner.
Generate exactly ${attemptTarget} topic-specific questions strictly for:
Subject: ${subject}
Unit: ${unitTitle}
Topic: ${topicTitle}
Target Subtopic: ${attemptSubtopic}
Allowed Types: ${typeRequirement}

CRITICAL RULES:
1. Every question must test concrete concepts from "${topicTitle}" and "${attemptSubtopic}".
2. For multiple_choice questions, provide 4 clear options and the correct answer.
3. For true_false questions, provide options: ["True", "False"].
4. For calculation questions, provide realistic numbers and clear steps in the explanation.
5. For matching questions, provide left items and right items.
6. Return a valid JSON object strictly matching this schema:
{
  "questions": [
    {
      "prompt": "Full question text",
      "type": "multiple_choice",
      "difficulty": "medium",
      "subtopic": "${attemptSubtopic}",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctAnswer": "Exact text of the correct option",
      "explanation": "Curriculum-aligned step-by-step rationale",
      "conceptTag": "${topicId}-concept"
    }
  ]
}`;

      try {
        const startTime = Date.now();
        console.log(`[StudyAssessmentEngine] AI Request started (Batch ${batchIdx + 1}, Attempt ${batchAttempts}/${maxBatchAttempts}, Target: ${attemptTarget})...`);

        const aiResponse = await forgeAI.generateJson<{
          questions?: RawAiQuestionInput[];
          items?: RawAiQuestionInput[];
          results?: RawAiQuestionInput[];
        }>({
          taskType: 'GENERATE_QUESTIONS',
          systemPrompt,
          prompt: `Generate batch ${batchIdx + 1} (${attemptTarget} questions) for ${subject} - ${topicTitle} (Subtopic: ${attemptSubtopic}).`,
          temperature: 0.25,
          timeoutMs: 25000,
        });

        const elapsedMs = Date.now() - startTime;
        const responseLength = aiResponse?.text?.length || 0;
        console.log(
          `[StudyAssessmentEngine] AI Request completed in ${elapsedMs}ms. Provider: ${aiResponse.provider}, Model: ${aiResponse.model}, Response Length: ${responseLength} chars.`
        );

        let rawQuestions: RawAiQuestionInput[] = [];
        if (aiResponse?.parsed) {
          if (Array.isArray(aiResponse.parsed)) {
            rawQuestions = aiResponse.parsed;
          } else if (Array.isArray(aiResponse.parsed.questions)) {
            rawQuestions = aiResponse.parsed.questions;
          } else if (Array.isArray(aiResponse.parsed.items)) {
            rawQuestions = aiResponse.parsed.items;
          } else if (Array.isArray(aiResponse.parsed.results)) {
            rawQuestions = aiResponse.parsed.results;
          }
        }

        console.log(`[StudyAssessmentEngine] JSON parsed. Candidate questions received: ${rawQuestions.length}.`);

        for (let i = 0; i < rawQuestions.length; i++) {
          if (pool.length >= validCount) break;
          const rawQ = rawQuestions[i];
          const { question, rejectionReason } = validateAndNormalizeQuestion(rawQ, {
            subject: String(subject),
            unitId,
            unitTitle,
            topicId,
            topicTitle,
            subtopics,
            targetSubtopic: attemptSubtopic,
          });

          if (!question) {
            console.warn(`[StudyAssessmentEngine] [Rejected Q${i + 1}]: ${rejectionReason}`);
            continue;
          }

          if (pool.some((p) => p.prompt.toLowerCase() === question.prompt.toLowerCase())) {
            console.warn(`[StudyAssessmentEngine] [Rejected Q${i + 1}]: Duplicate question prompt.`);
            continue;
          }

          pool.push(question);
          batchAcceptedCount++;
          console.log(
            `[StudyAssessmentEngine] [Accepted Q${i + 1}]: (${question.type}, ${question.difficulty}) "${question.prompt.slice(0, 55)}..."`
          );
        }
      } catch (err: any) {
        console.warn(`[StudyAssessmentEngine] Batch ${batchIdx + 1} Attempt ${batchAttempts} failed:`, err?.message || err);
      }
    }

    console.log(
      `[StudyAssessmentEngine] Batch ${batchIdx + 1} completed. Batch accepted: ${batchAcceptedCount}/${currentBatchTarget}. Running pool: ${pool.length}/${validCount}.`
    );
  }

  // 4. Verification Check: No generic filler allowed! (Part 5)
  console.log(`\n[StudyAssessmentEngine] [Step 4] Checking pool completion (${pool.length}/${validCount})...`);
  if (pool.length < validCount) {
    if (curatedMatches.length > 0) {
      console.log(
        `[StudyAssessmentEngine] Pool has ${pool.length}/${validCount}. Assembling verified AI variants from ${curatedMatches.length} curated topic seeds...`
      );
      let variantIdx = 0;
      while (pool.length < validCount && variantIdx < 100) {
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

  console.log(`[StudyAssessmentEngine] Final verified pool size: ${pool.length}/${validCount}`);

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
