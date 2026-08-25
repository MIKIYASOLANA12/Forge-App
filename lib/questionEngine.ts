import { prisma } from './prisma';
import { recordProgressActivity } from './progressEngine';
import { computeLevel } from './xp';
import { MASTERY_LEVELS } from './studyRoadmaps';

export interface StudyQuestionSeed {
  subject: 'JavaScript' | 'Chemistry';
  topicId: string;
  topicName: string;
  subtopic?: string;
  masteryLevel: number; // 1, 2, 3, 4
  difficulty: 'easy' | 'medium' | 'hard' | 'entrance';
  type: 'multiple_choice' | 'true_false' | 'code_output' | 'calculation';
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  conceptTag: string;
  xpReward: number;
}

// ── BUILT-IN VERIFIED QUESTION CATALOG ────────────────────────────────────────
export const QUESTION_CATALOG: StudyQuestionSeed[] = [
  // ── JAVASCRIPT: CONDITIONALS (Level 1 to 4) ──
  {
    subject: 'JavaScript',
    topicId: 'js-3-conditionals',
    topicName: 'Conditionals',
    subtopic: 'Truthy and Falsy',
    masteryLevel: 1,
    difficulty: 'easy',
    type: 'multiple_choice',
    prompt: 'Which of the following values is considered TRUTHY in JavaScript?',
    options: ['0', '"" (empty string)', '"0" (string containing zero)', 'null'],
    correctAnswer: '"0" (string containing zero)',
    explanation: 'In JavaScript, any non-empty string is truthy, including "0", "false", and " ". Only 0, "", null, undefined, NaN, and false are falsy.',
    conceptTag: 'truthy-falsy',
    xpReward: 20,
  },
  {
    subject: 'JavaScript',
    topicId: 'js-3-conditionals',
    topicName: 'Conditionals',
    subtopic: 'Logical Operators',
    masteryLevel: 2,
    difficulty: 'medium',
    type: 'multiple_choice',
    prompt: 'What will the expression `null ?? "default"` evaluate to in JavaScript?',
    options: ['null', '"default"', 'undefined', 'TypeError'],
    correctAnswer: '"default"',
    explanation: 'The nullish coalescing operator (??) returns its right-hand operand when its left-hand operand is null or undefined.',
    conceptTag: 'nullish-coalescing',
    xpReward: 30,
  },
  {
    subject: 'JavaScript',
    topicId: 'js-3-conditionals',
    topicName: 'Conditionals',
    subtopic: 'Logical Operators & Short-circuiting',
    masteryLevel: 3,
    difficulty: 'hard',
    type: 'code_output',
    prompt: 'What is the exact output of: `console.log(false || (0 && "apple") || "banana" && "cherry");`',
    options: ['false', '0', 'banana', 'cherry'],
    correctAnswer: 'cherry',
    explanation: 'Logical AND (&&) has higher precedence than ||. "banana" && "cherry" evaluates to "cherry". false || 0 || "cherry" returns the first truthy value: "cherry".',
    conceptTag: 'operator-precedence',
    xpReward: 50,
  },
  {
    subject: 'JavaScript',
    topicId: 'js-3-conditionals',
    topicName: 'Conditionals',
    subtopic: 'Checking Your Balance / Strict Equality',
    masteryLevel: 4,
    difficulty: 'entrance',
    type: 'code_output',
    prompt: 'What will be printed?\n```js\nconst balance = 0;\nconst isActive = true;\nconst checkBalance = true;\nif (!checkBalance) {\n  console.log("Thank you!");\n} else if (isActive && balance > 0) {\n  console.log(`$${balance}`);\n} else if (!isActive) {\n  console.log("Account inactive");\n} else if (balance === 0) {\n  console.log("Account is empty");\n} else {\n  console.log("Negative balance");\n}\n```',
    options: ['Thank you!', 'Account inactive', 'Account is empty', 'Negative balance'],
    correctAnswer: 'Account is empty',
    explanation: 'checkBalance is true so first block fails. balance > 0 is false since balance is 0. !isActive is false. balance === 0 is true, printing "Account is empty".',
    conceptTag: 'branching-logic',
    xpReward: 75,
  },

  // ── JAVASCRIPT: LOOPS (Level 1 to 4) ──
  {
    subject: 'JavaScript',
    topicId: 'js-4-loops',
    topicName: 'Loops',
    subtopic: 'while Loops',
    masteryLevel: 1,
    difficulty: 'easy',
    type: 'multiple_choice',
    prompt: 'What is the key difference between a `while` loop and a `do...while` loop?',
    options: [
      'while loops cannot increment variables',
      'do...while loops always execute at least once before checking the condition',
      'while loops only work with numbers',
      'do...while loops run infinitely by default',
    ],
    correctAnswer: 'do...while loops always execute at least once before checking the condition',
    explanation: 'A `do...while` loop evaluates its condition at the bottom of the loop body, guaranteeing at least one execution.',
    conceptTag: 'loop-fundamentals',
    xpReward: 20,
  },
  {
    subject: 'JavaScript',
    topicId: 'js-4-loops',
    topicName: 'Loops',
    subtopic: 'Loop Control (break and continue)',
    masteryLevel: 2,
    difficulty: 'medium',
    type: 'multiple_choice',
    prompt: 'What does the `continue` statement do when encountered inside a loop?',
    options: [
      'Terminates the loop immediately and exits',
      'Restarts the program from line 1',
      'Skips the rest of the current iteration and jumps to the next iteration',
      'Throws a runtime exception',
    ],
    correctAnswer: 'Skips the rest of the current iteration and jumps to the next iteration',
    explanation: '`continue` bypasses the remaining lines in the loop body for the current pass and begins the next loop test/increment.',
    conceptTag: 'loop-control',
    xpReward: 30,
  },
  {
    subject: 'JavaScript',
    topicId: 'js-4-loops',
    topicName: 'Loops',
    subtopic: 'Closure inside Loops & Scoping',
    masteryLevel: 4,
    difficulty: 'entrance',
    type: 'code_output',
    prompt: 'What will be output by:\n```js\nfor (var i = 0; i < 3; i++) {\n  setTimeout(() => console.log(i), 0);\n}\n```',
    options: ['0 1 2', '3 3 3', 'undefined undefined undefined', '0 0 0'],
    correctAnswer: '3 3 3',
    explanation: 'Because `var` is function-scoped (not block-scoped), all 3 setTimeout callbacks share the same `i` reference, which reaches 3 when the loop finishes.',
    conceptTag: 'var-vs-let-loops',
    xpReward: 80,
  },

  // ── CHEMISTRY: ATOMIC STRUCTURE & ELECTRONS (Level 1 to 4) ──
  {
    subject: 'Chemistry',
    topicId: 'chem-2-atom',
    topicName: 'Atomic Structure & Models',
    subtopic: 'Subatomic Particles & Isotopes',
    masteryLevel: 1,
    difficulty: 'easy',
    type: 'multiple_choice',
    prompt: 'Two atoms that have the same number of protons but different numbers of neutrons are called:',
    options: ['Allotropes', 'Isomers', 'Isotopes', 'Isobars'],
    correctAnswer: 'Isotopes',
    explanation: 'Isotopes have identical atomic numbers (same protons/element) but different mass numbers due to differing neutron counts (e.g. Carbon-12 and Carbon-14).',
    conceptTag: 'isotopes',
    xpReward: 20,
  },
  {
    subject: 'Chemistry',
    topicId: 'chem-3-electrons',
    topicName: 'Electron Configuration & Orbitals',
    subtopic: 'Quantum Numbers & Hunds Rule',
    masteryLevel: 2,
    difficulty: 'medium',
    type: 'multiple_choice',
    prompt: 'According to Hunds Rule, how do electrons occupy degenerate (equal energy) orbitals such as the three 2p orbitals?',
    options: [
      'They pair up with opposite spins before occupying empty orbitals',
      'They occupy empty orbitals singly with parallel spins before pairing up',
      'They always pair up in the lowest magnetic quantum number first',
      'They fill according to atomic weight',
    ],
    correctAnswer: 'They occupy empty orbitals singly with parallel spins before pairing up',
    explanation: 'Hunds Rule states that electrons remain unpaired with parallel spins as long as degenerate orbitals of equal energy are vacant, minimizing electron-electron repulsion.',
    conceptTag: 'hunds-rule',
    xpReward: 30,
  },

  // ── CHEMISTRY: STOICHIOMETRY & LIMITING REACTANTS (Level 1 to 4) ──
  {
    subject: 'Chemistry',
    topicId: 'chem-10-stoichiometry',
    topicName: 'Stoichiometry & Limiting Reactants',
    subtopic: 'Mole Calculations',
    masteryLevel: 1,
    difficulty: 'easy',
    type: 'calculation',
    prompt: 'How many moles of O2 are required to completely react with 4.0 moles of Al according to:\n`4 Al + 3 O2 → 2 Al2O3`?',
    options: ['2.0 mol', '3.0 mol', '4.0 mol', '6.0 mol'],
    correctAnswer: '3.0 mol',
    explanation: 'From the balanced stoichiometric coefficients, the mole ratio of Al to O2 is 4 : 3. For 4.0 moles of Al, exactly 3.0 moles of O2 are consumed.',
    conceptTag: 'mole-ratio',
    xpReward: 25,
  },
  {
    subject: 'Chemistry',
    topicId: 'chem-10-stoichiometry',
    topicName: 'Stoichiometry & Limiting Reactants',
    subtopic: 'Limiting Reactant Determination',
    masteryLevel: 3,
    difficulty: 'hard',
    type: 'calculation',
    prompt: 'If 2.0 moles of N2 and 3.0 moles of H2 are reacted according to `N2 + 3 H2 → 2 NH3`, which reactant is limiting, and how many moles of NH3 can be produced theoretically?',
    options: [
      'N2 is limiting; 4.0 mol NH3 produced',
      'H2 is limiting; 2.0 mol NH3 produced',
      'Both are in exact stoichiometric ratio; 2.0 mol NH3 produced',
      'H2 is limiting; 3.0 mol NH3 produced',
    ],
    correctAnswer: 'H2 is limiting; 2.0 mol NH3 produced',
    explanation: '3.0 moles of H2 requires 1.0 mole of N2. We have 2.0 moles of N2 (excess). H2 limits the reaction. 3.0 mol H2 * (2 mol NH3 / 3 mol H2) = 2.0 mol NH3.',
    conceptTag: 'limiting-reactants',
    xpReward: 55,
  },
  {
    subject: 'Chemistry',
    topicId: 'chem-10-stoichiometry',
    topicName: 'Stoichiometry & Limiting Reactants',
    subtopic: 'Excess Mass & Percent Yield (Tricky Entrance Problem)',
    masteryLevel: 4,
    difficulty: 'entrance',
    type: 'calculation',
    prompt: '5.40 g of Al (M = 27.0 g/mol) reacts with 32.0 g of Fe2O3 (M = 160.0 g/mol) via `2 Al + Fe2O3 → Al2O3 + 2 Fe` (Fe M = 55.8 g/mol). If 8.93 g of Fe is isolated in lab, what is the percent yield?',
    options: ['80.0%', '75.0%', '88.5%', '92.0%'],
    correctAnswer: '80.0%',
    explanation: 'Moles of Al = 5.40 / 27 = 0.200 mol. Moles of Fe2O3 = 32.0 / 160 = 0.200 mol. 0.200 mol Al requires 0.100 mol Fe2O3. Thus Al is limiting. Theoretical Fe = 0.200 mol * 55.8 g/mol = 11.16 g. Percent Yield = (8.93 g / 11.16 g) * 100 = 80.0%.',
    conceptTag: 'percent-yield',
    xpReward: 90,
  },

  // ── CHEMISTRY: CHEMICAL EQUILIBRIUM (Level 1 to 4) ──
  {
    subject: 'Chemistry',
    topicId: 'chem-13-equilibrium',
    topicName: 'Chemical Equilibrium & Le Chatelier Principle',
    subtopic: 'Le Chateliers Principle',
    masteryLevel: 2,
    difficulty: 'medium',
    type: 'multiple_choice',
    prompt: 'For the exothermic synthesis of ammonia: `N2(g) + 3 H2(g) ⇌ 2 NH3(g) + Heat (ΔH < 0)`, which condition will shift the equilibrium position to the RIGHT (producing more NH3)?',
    options: [
      'Increasing the temperature',
      'Decreasing the total system pressure',
      'Increasing the total system pressure by reducing volume',
      'Adding an inert gas at constant volume',
    ],
    correctAnswer: 'Increasing the total system pressure by reducing volume',
    explanation: 'The forward reaction goes from 4 moles of gas to 2 moles of gas. Increasing pressure shifts equilibrium toward fewer gas moles (the right).',
    conceptTag: 'le-chatelier-shift',
    xpReward: 35,
  },
  {
    subject: 'Chemistry',
    topicId: 'chem-13-equilibrium',
    topicName: 'Chemical Equilibrium & Le Chatelier Principle',
    subtopic: 'Equilibrium Constant Expression & ICE Tables',
    masteryLevel: 4,
    difficulty: 'entrance',
    type: 'calculation',
    prompt: 'For reaction `A(g) + B(g) ⇌ 2 C(g)`, Kc = 64 at 500 K. If 1.00 mol of A and 1.00 mol of B are placed in a 1.00 L flask, what is the equilibrium concentration of C in mol/L?',
    options: ['0.80 M', '1.60 M', '0.64 M', '1.00 M'],
    correctAnswer: '1.60 M',
    explanation: 'ICE Table: [A] = 1 - x, [B] = 1 - x, [C] = 2x. Kc = (2x)^2 / (1 - x)^2 = 64. Taking square root: 2x / (1 - x) = 8. 2x = 8 - 8x -> 10x = 8 -> x = 0.80. Therefore [C] = 2x = 1.60 M.',
    conceptTag: 'ice-table-kc',
    xpReward: 95,
  },
];

/**
 * Seed questions into the database if not already populated.
 */
export async function seedQuestionBank() {
  for (const q of QUESTION_CATALOG) {
    const existing = await prisma.studyQuestion.findFirst({
      where: { prompt: q.prompt },
    });

    if (!existing) {
      await prisma.studyQuestion.create({
        data: {
          subject: q.subject,
          topicId: q.topicId,
          topicName: q.topicName,
          subtopic: q.subtopic,
          masteryLevel: q.masteryLevel,
          difficulty: q.difficulty,
          type: q.type,
          prompt: q.prompt,
          options: JSON.stringify(q.options),
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          conceptTag: q.conceptTag,
          xpReward: q.xpReward,
        },
      });
    }
  }
}

/**
 * Get test questions for a topic or subject.
 */
export async function getQuestionsForTopic(subject: string, topicId?: string, targetLevel?: number) {
  await seedQuestionBank();

  const where: any = { subject };
  if (topicId) where.topicId = topicId;
  if (targetLevel) where.masteryLevel = targetLevel;

  const questions = await prisma.studyQuestion.findMany({
    where,
    orderBy: { masteryLevel: 'asc' },
    take: 10,
  });

  return questions.map((q) => ({
    id: q.id,
    subject: q.subject,
    topicId: q.topicId,
    topicName: q.topicName,
    subtopic: q.subtopic,
    masteryLevel: q.masteryLevel,
    difficulty: q.difficulty,
    type: q.type,
    prompt: q.prompt,
    options: JSON.parse(q.options),
    conceptTag: q.conceptTag,
    xpReward: q.xpReward,
  }));
}

/**
 * Submit and evaluate a study question answer.
 * Includes anti-farming rules, XP calculation, mastery updates, and weak concept recording.
 */
export async function evaluateStudyAnswer({
  questionId,
  userAnswer,
}: {
  questionId: string;
  userAnswer: string;
}) {
  const question = await prisma.studyQuestion.findUnique({ where: { id: questionId } });
  if (!question) throw new Error('Question not found');

  const isCorrect = question.correctAnswer.trim().toLowerCase() === userAnswer.trim().toLowerCase();

  // Anti-farming check: Count how many times this question was answered correctly in the last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentAttempts = await prisma.studyAnswerLog.count({
    where: {
      questionId,
      answeredAt: { gte: oneDayAgo },
      isCorrect: true,
    },
  });

  // Diminishing returns on XP (1st attempt = 100%, 2nd = 50%, 3rd+ = 0 to prevent farming)
  let xpAwarded = 0;
  if (isCorrect) {
    if (recentAttempts === 0) xpAwarded = question.xpReward;
    else if (recentAttempts === 1) xpAwarded = Math.round(question.xpReward * 0.5);
    else xpAwarded = 5; // Minimal repetition reward
  }

  // 1. Save answer log
  const log = await prisma.studyAnswerLog.create({
    data: {
      questionId,
      subject: question.subject,
      topicId: question.topicId,
      userAnswer,
      isCorrect,
      masteryLevel: question.masteryLevel,
      xpAwarded,
      conceptTag: question.conceptTag,
    },
  });

  // 2. Award XP if earned
  if (xpAwarded > 0) {
    const profile = await prisma.userProfile.update({
      where: { id: 'singleton' },
      data: { totalXp: { increment: xpAwarded } },
    });
    const newLevel = computeLevel(profile.totalXp);
    if (newLevel !== profile.level) {
      await prisma.userProfile.update({
        where: { id: 'singleton' },
        data: { level: newLevel },
      });
    }
  }

  // 3. Update or create Topic Mastery stats
  const allTopicLogs = await prisma.studyAnswerLog.findMany({
    where: { subject: question.subject, topicId: question.topicId },
  });

  const totalAttempts = allTopicLogs.length;
  const correctAttempts = allTopicLogs.filter((l) => l.isCorrect).length;
  const accuracy = Math.round((correctAttempts / totalAttempts) * 1000) / 10;

  // Track weak & strong concepts
  const conceptStats = new Map<string, { total: number; correct: number }>();
  for (const l of allTopicLogs) {
    if (!l.conceptTag) continue;
    const stat = conceptStats.get(l.conceptTag) || { total: 0, correct: 0 };
    stat.total++;
    if (l.isCorrect) stat.correct++;
    conceptStats.set(l.conceptTag, stat);
  }

  const weakConcepts: string[] = [];
  const strongConcepts: string[] = [];

  for (const [tag, stat] of conceptStats.entries()) {
    const acc = stat.correct / stat.total;
    if (stat.total >= 1 && acc < 0.6) weakConcepts.push(tag);
    else if (stat.total >= 2 && acc >= 0.8) strongConcepts.push(tag);
  }

  // Determine Mastery Level (Level 1, 2, 3, or 4 - Mastered)
  // Rule: Must pass Level 4 question with overall accuracy >= 80% to be MASTERED
  const passedLevel4 = allTopicLogs.some((l) => l.masteryLevel >= 4 && l.isCorrect);
  const passedLevel3 = allTopicLogs.some((l) => l.masteryLevel >= 3 && l.isCorrect);
  const passedLevel2 = allTopicLogs.some((l) => l.masteryLevel >= 2 && l.isCorrect);

  let currentLevel = 1;
  if (passedLevel4 && accuracy >= 80) currentLevel = 4;
  else if (passedLevel3 && accuracy >= 70) currentLevel = 3;
  else if (passedLevel2) currentLevel = 2;

  const isMastered = currentLevel === 4;

  const masteryRecord = await prisma.studyTopicMastery.upsert({
    where: {
      subject_topicId: {
        subject: question.subject,
        topicId: question.topicId,
      },
    },
    create: {
      subject: question.subject,
      topicId: question.topicId,
      topicName: question.topicName,
      masteryLevel: currentLevel,
      isMastered,
      masteredAt: isMastered ? new Date() : null,
      accuracy,
      attemptsCount: totalAttempts,
      correctCount: correctAttempts,
      lastStudiedAt: new Date(),
      weakConcepts: JSON.stringify(weakConcepts),
      strongConcepts: JSON.stringify(strongConcepts),
    },
    update: {
      masteryLevel: currentLevel,
      isMastered,
      masteredAt: isMastered ? new Date() : undefined,
      accuracy,
      attemptsCount: totalAttempts,
      correctCount: correctAttempts,
      lastStudiedAt: new Date(),
      weakConcepts: JSON.stringify(weakConcepts),
      strongConcepts: JSON.stringify(strongConcepts),
    },
  });

  // 4. Update progress engine
  await recordProgressActivity(0).catch(() => {});

  // 5. Generate recommendations if incorrect
  let recommendation: string | null = null;
  let recommendedTaskTitle: string | null = null;

  if (!isCorrect) {
    recommendation = `Target Review: Focus on '${question.conceptTag.replace(/-/g, ' ')}' under ${question.topicName}. Recommended 30-min active recall and practice session.`;
    recommendedTaskTitle = `Review ${question.conceptTag.replace(/-/g, ' ')} (${question.topicName})`;
  }

  return {
    isCorrect,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    xpAwarded,
    masteryLevel: currentLevel,
    isMastered,
    accuracy,
    weakConcepts,
    strongConcepts,
    recommendation,
    recommendedTaskTitle,
    questionId: question.id,
    conceptTag: question.conceptTag,
  };
}
