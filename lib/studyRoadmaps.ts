export interface StudyLessonItem {
  id: string;
  order: number;
  title: string;
  subtopics: string[];
  estimatedMinutes: number;
  quizzes: string[];
  difficulty: 'easy' | 'medium' | 'hard' | 'entrance';
}

export interface ChemistryTopicItem {
  id: string;
  order: number;
  name: string;
  stage: 'Foundation' | 'Reactions & Quantitative' | 'Equilibrium & Kinetics' | 'Electrochem & Organic' | 'Applied & Materials';
  difficulty: 'easy' | 'medium' | 'hard' | 'entrance';
  estimatedHours: number;
  keyConcepts: string[];
  prerequisites: string[];
}

// ── 1. JAVASCRIPT (5 MILLION CODERS) ROADMAP ──────────────────────────────────
export const JAVASCRIPT_COURSE_NAME = '5 Million Coders / JavaScript';

export const JAVASCRIPT_ROADMAP: StudyLessonItem[] = [
  {
    id: 'js-1-intro',
    order: 1,
    title: '1. What is JavaScript & Getting Started',
    subtopics: ['JavaScript Origins', 'Running JS in Browser & Node', 'Console & Comments'],
    estimatedMinutes: 45,
    quizzes: ['Quiz: First JS Output'],
    difficulty: 'easy',
  },
  {
    id: 'js-2-variables-types',
    order: 2,
    title: '2. Data Types & Variables',
    subtopics: ['Strings & Template Literals', 'Numbers & Booleans', 'Null & Undefined', 'var, let, const'],
    estimatedMinutes: 60,
    quizzes: ['Quiz: Variable Declarations', 'Quiz: Type Coercion'],
    difficulty: 'easy',
  },
  {
    id: 'js-3-conditionals',
    order: 3,
    title: '3. Conditionals',
    subtopics: ['if / else statements', 'else if branching', 'Logical Operators (&&, ||, !)', 'Ternary Operator', 'Truthy & Falsy values', 'Switch statements'],
    estimatedMinutes: 60,
    quizzes: ['Quiz: Checking Your Balance', 'Quiz: Musical Groups', 'Quiz: Navigating the Food Chain'],
    difficulty: 'medium',
  },
  {
    id: 'js-4-loops',
    order: 4,
    title: '4. Loops',
    subtopics: [
      'Intro to Loops',
      'while Loops',
      'Parts of a while Loop',
      'for Loops',
      'Parts of a for Loop',
      'Nested Loops',
      'Loop Control (break, continue)',
      'Increment & Decrement Operators',
    ],
    estimatedMinutes: 90,
    quizzes: [
      'Quiz: JuliaJames',
      'Quiz: 99 Bottles of Juice',
      'Quiz: Countdown, Liftoff!',
      'Quiz: Changing the Loop',
      'Quiz: Fix the Error 1',
      'Quiz: Fix the Error 2',
      'Quiz: Factorials!',
      'Quiz: Find my Seat',
    ],
    difficulty: 'medium',
  },
  {
    id: 'js-5-functions',
    order: 5,
    title: '5. Functions',
    subtopics: [
      'Intro to Functions',
      'Declaring Functions & Parameters',
      'Return Values vs Console Log',
      'Scope (Global, Function & Block)',
      'The Scope Chain & Shadowing',
      'Function Expressions & Anonymous Functions',
      'Hoisting with Functions and Variables',
      'Arrow Functions & Callbacks',
    ],
    estimatedMinutes: 90,
    quizzes: [
      'Quiz: Laugh it Off 1 & 2',
      'Quiz: Build a Triangle',
      'Quiz: Inline Function Expressions',
      'Quiz: Cry',
    ],
    difficulty: 'hard',
  },
  {
    id: 'js-6-arrays',
    order: 6,
    title: '6. Arrays',
    subtopics: [
      'Creating & Indexing Arrays',
      'Array Properties (length)',
      'Push, Pop, Shift, Unshift',
      'Splice and Slice',
      'Array Iteration (forEach, map, filter, reduce)',
      '2D Arrays (Matrices)',
    ],
    estimatedMinutes: 75,
    quizzes: ['Quiz: UdaciFamily', 'Quiz: Building the Crew', 'Quiz: Another Pick a Card'],
    difficulty: 'medium',
  },
  {
    id: 'js-7-objects',
    order: 7,
    title: '7. Objects & Object-Oriented JS',
    subtopics: [
      'Object Literals (Keys and Values)',
      'Dot vs Bracket Notation',
      'Object Methods & the `this` keyword',
      'Iterating through Objects (for...in, Object.keys)',
      'Pass by Reference vs Value',
    ],
    estimatedMinutes: 75,
    quizzes: ['Quiz: Umbrella Object', 'Quiz: Bank Accounts', 'Quiz: Facebook Friends'],
    difficulty: 'medium',
  },
  {
    id: 'js-8-dom',
    order: 8,
    title: '8. DOM Selection & Manipulation',
    subtopics: [
      'Document Object Model Tree',
      'querySelector & querySelectorAll',
      'getElementById & getElementsByClassName',
      'Changing Text (textContent, innerHTML)',
      'Manipulating CSS Styles and ClassLists',
    ],
    estimatedMinutes: 60,
    quizzes: ['Quiz: DOM Tree Selectors', 'Quiz: Style Manipulator'],
    difficulty: 'medium',
  },
  {
    id: 'js-9-creating-content',
    order: 9,
    title: '9. Creating Content with JavaScript',
    subtopics: [
      'createElement & appendChild',
      'insertBefore & removeChild',
      'DocumentFragments for Performance',
      'Creating Dynamic Cards & Lists',
    ],
    estimatedMinutes: 60,
    quizzes: ['Quiz: Dynamic List Builder', 'Quiz: Element Injection'],
    difficulty: 'medium',
  },
  {
    id: 'js-10-browser-events',
    order: 10,
    title: '10. Working With Browser Events',
    subtopics: [
      'addEventListener & Event Listeners',
      'Click, Keydown, Submit & Change Events',
      'Event Object & event.target',
      'Event Bubbling & Event Delegation',
      'preventDefault and stopPropagation',
    ],
    estimatedMinutes: 75,
    quizzes: ['Quiz: Event Delegation', 'Quiz: Interactive Form'],
    difficulty: 'hard',
  },
];

// ── 2. CHEMISTRY CONNECTED 21-TOPIC ROADMAP ──────────────────────────────────
export const CHEMISTRY_ROADMAP: ChemistryTopicItem[] = [
  {
    id: 'chem-1-matter',
    order: 1,
    name: 'Matter & Classification',
    stage: 'Foundation',
    difficulty: 'easy',
    estimatedHours: 2.5,
    keyConcepts: ['States of matter', 'Physical vs Chemical changes', 'Pure substances vs Mixtures', 'Separation techniques'],
    prerequisites: [],
  },
  {
    id: 'chem-2-atom',
    order: 2,
    name: 'Atomic Structure & Models',
    stage: 'Foundation',
    difficulty: 'easy',
    estimatedHours: 3.0,
    keyConcepts: ['Protons, neutrons, electrons', 'Atomic number & Mass number', 'Isotopes & Relative atomic mass', 'Rutherford & Bohr models'],
    prerequisites: ['chem-1-matter'],
  },
  {
    id: 'chem-3-electrons',
    order: 3,
    name: 'Electron Configuration & Orbitals',
    stage: 'Foundation',
    difficulty: 'medium',
    estimatedHours: 3.5,
    keyConcepts: ['Quantum numbers', 's, p, d, f subshells', 'Aufbau principle, Hunds rule, Pauli exclusion', 'Ground vs Excited states'],
    prerequisites: ['chem-2-atom'],
  },
  {
    id: 'chem-4-periodic-table',
    order: 4,
    name: 'The Periodic Table & Trends',
    stage: 'Foundation',
    difficulty: 'medium',
    estimatedHours: 3.5,
    keyConcepts: ['Groups & Periods', 'Atomic radius trend', 'Ionization energy', 'Electronegativity & Electron affinity', 'Metallic character'],
    prerequisites: ['chem-3-electrons'],
  },
  {
    id: 'chem-5-valence',
    order: 5,
    name: 'Valence Electrons & Lewis Dot Structures',
    stage: 'Foundation',
    difficulty: 'easy',
    estimatedHours: 2.5,
    keyConcepts: ['Octet rule', 'Valence electron counting', 'Lewis symbols for elements and ions', 'Formal charge'],
    prerequisites: ['chem-4-periodic-table'],
  },
  {
    id: 'chem-6-bonding',
    order: 6,
    name: 'Chemical Bonding (Ionic, Covalent & Metallic)',
    stage: 'Foundation',
    difficulty: 'medium',
    estimatedHours: 4.0,
    keyConcepts: ['Ionic lattice & lattice energy', 'Covalent sigma & pi bonds', 'Polar vs Non-polar covalent', 'Metallic electron sea model', 'VSEPR molecular geometries'],
    prerequisites: ['chem-5-valence'],
  },
  {
    id: 'chem-7-molecules',
    order: 7,
    name: 'Molecules, Compounds & Nomenclature',
    stage: 'Foundation',
    difficulty: 'medium',
    estimatedHours: 3.0,
    keyConcepts: ['IUPAC chemical naming', 'Polyatomic ions', 'Intermolecular forces (Hydrogen bonding, Dipole-dipole, London dispersion)', 'Boiling point comparisons'],
    prerequisites: ['chem-6-bonding'],
  },
  {
    id: 'chem-8-reactions',
    order: 8,
    name: 'Chemical Reactions & Balancing Equations',
    stage: 'Reactions & Quantitative',
    difficulty: 'medium',
    estimatedHours: 3.5,
    keyConcepts: ['Synthesis & Decomposition', 'Single & Double replacement', 'Combustion reactions', 'Net ionic equations & Precipitates', 'Balancing inspection method'],
    prerequisites: ['chem-7-molecules'],
  },
  {
    id: 'chem-9-moles',
    order: 9,
    name: 'The Mole Concept & Avogadro Constant',
    stage: 'Reactions & Quantitative',
    difficulty: 'medium',
    estimatedHours: 3.5,
    keyConcepts: ['Avogadros number (6.022e23)', 'Molar mass conversions', 'Molar volume of gases at STP', 'Percentage composition', 'Empirical vs Molecular formula'],
    prerequisites: ['chem-8-reactions'],
  },
  {
    id: 'chem-10-stoichiometry',
    order: 10,
    name: 'Stoichiometry & Limiting Reactants',
    stage: 'Reactions & Quantitative',
    difficulty: 'hard',
    estimatedHours: 5.0,
    keyConcepts: ['Mole-to-mole conversions', 'Mass-to-mass stoichiometry', 'Limiting reactant identification', 'Excess reactant remaining', 'Theoretical, actual & percent yield'],
    prerequisites: ['chem-9-moles'],
  },
  {
    id: 'chem-11-solutions',
    order: 11,
    name: 'Solutions & Solubility Concentrations',
    stage: 'Reactions & Quantitative',
    difficulty: 'medium',
    estimatedHours: 3.5,
    keyConcepts: ['Solute, solvent, solvation', 'Molarity (M) & Molality (m)', 'Dilution equation (M1V1 = M2V2)', 'Solubility curves & Factors affecting solubility', 'Colligative properties'],
    prerequisites: ['chem-10-stoichiometry'],
  },
  {
    id: 'chem-12-acids-bases',
    order: 12,
    name: 'Acids, Bases & pH Calculations',
    stage: 'Reactions & Quantitative',
    difficulty: 'hard',
    estimatedHours: 4.5,
    keyConcepts: ['Arrhenius & Bronsted-Lowry theories', 'Strong vs Weak acids and bases', 'Autoionization of water (Kw)', 'pH and pOH calculations', 'Acid-base titrations & Indicators'],
    prerequisites: ['chem-11-solutions'],
  },
  {
    id: 'chem-13-equilibrium',
    order: 13,
    name: 'Chemical Equilibrium & Le Chatelier Principle',
    stage: 'Equilibrium & Kinetics',
    difficulty: 'entrance',
    estimatedHours: 5.5,
    keyConcepts: ['Dynamic equilibrium', 'Equilibrium constant expression (Kc & Kp)', 'ICE tables for equilibrium concentrations', 'Le Chateliers Principle (Pressure, Temperature, Concentration)', 'Reaction quotient (Q) vs K'],
    prerequisites: ['chem-12-acids-bases'],
  },
  {
    id: 'chem-14-reaction-rate',
    order: 14,
    name: 'Chemical Kinetics & Reaction Rates',
    stage: 'Equilibrium & Kinetics',
    difficulty: 'hard',
    estimatedHours: 4.0,
    keyConcepts: ['Collision theory & Orientation', 'Factors affecting rate', 'Rate laws & Reaction order', 'Activation energy & Maxwell-Boltzmann distribution', 'Catalyst mechanism'],
    prerequisites: ['chem-13-equilibrium'],
  },
  {
    id: 'chem-15-energy',
    order: 15,
    name: 'Thermochemistry & Chemical Energetics',
    stage: 'Equilibrium & Kinetics',
    difficulty: 'hard',
    estimatedHours: 4.5,
    keyConcepts: ['Exothermic vs Endothermic', 'Enthalpy change (ΔH)', 'Calorimetry (q = mcΔT)', 'Hess Law of heat summation', 'Bond enthalpies', 'Entropy (ΔS) and Gibbs Free Energy (ΔG)'],
    prerequisites: ['chem-14-reaction-rate'],
  },
  {
    id: 'chem-16-redox',
    order: 16,
    name: 'Redox Reactions & Oxidation Numbers',
    stage: 'Electrochem & Organic',
    difficulty: 'hard',
    estimatedHours: 4.5,
    keyConcepts: ['Assigning oxidation states', 'Oxidizing vs Reducing agents', 'Balancing redox via ion-electron half-reaction method', 'Disproportionation reactions'],
    prerequisites: ['chem-15-energy'],
  },
  {
    id: 'chem-17-electrochemistry',
    order: 17,
    name: 'Electrochemistry & Galvanic/Electrolytic Cells',
    stage: 'Electrochem & Organic',
    difficulty: 'entrance',
    estimatedHours: 5.5,
    keyConcepts: ['Galvanic/Voltaic cells & Salt bridge', 'Standard reduction potentials (E°cell)', 'Electrolysis & Faradays laws', 'Corrosion & Battery chemistry', 'Nernst equation qualitative understanding'],
    prerequisites: ['chem-16-redox'],
  },
  {
    id: 'chem-18-organic',
    order: 18,
    name: 'Organic Chemistry (Hydrocarbons & Functional Groups)',
    stage: 'Electrochem & Organic',
    difficulty: 'entrance',
    estimatedHours: 6.5,
    keyConcepts: ['Alkanes, Alkenes, Alkynes nomenclature', 'Isomerism (structural & stereoisomers)', 'Functional groups (Alcohols, Aldehydes, Ketones, Carboxylic acids, Esters, Amines)', 'Addition, substitution & esterification reactions'],
    prerequisites: ['chem-7-molecules', 'chem-17-electrochemistry'],
  },
  {
    id: 'chem-19-industrial',
    order: 19,
    name: 'Industrial Chemistry & Manufacturing Processes',
    stage: 'Applied & Materials',
    difficulty: 'medium',
    estimatedHours: 3.5,
    keyConcepts: ['Haber process for Ammonia', 'Contact process for Sulfuric acid', 'Ostwald process for Nitric acid', 'Chlor-alkali process', 'Industrial yield optimization'],
    prerequisites: ['chem-13-equilibrium', 'chem-18-organic'],
  },
  {
    id: 'chem-20-polymers',
    order: 20,
    name: 'Polymers & Biomolecules',
    stage: 'Applied & Materials',
    difficulty: 'medium',
    estimatedHours: 3.5,
    keyConcepts: ['Addition polymerization (Polyethylene, PVC)', 'Condensation polymerization (Nylon, Polyester)', 'Carbohydrates & Lipids', 'Proteins & Peptide bonds', 'DNA/RNA nucleotide structures'],
    prerequisites: ['chem-18-organic'],
  },
  {
    id: 'chem-21-environment',
    order: 21,
    name: 'Environmental Chemistry & Green Chemistry',
    stage: 'Applied & Materials',
    difficulty: 'easy',
    estimatedHours: 2.5,
    keyConcepts: ['Greenhouse effect & Global warming', 'Acid rain causes and mitigation', 'Ozone layer depletion (CFCs)', 'Water treatment & Heavy metal pollutants', '12 Principles of Green Chemistry'],
    prerequisites: ['chem-19-industrial', 'chem-20-polymers'],
  },
];

// ── 3. MASTERY LEVEL DEFINITIONS ─────────────────────────────────────────────
export const MASTERY_LEVELS = [
  {
    level: 1,
    name: 'UNDERSTAND',
    shortName: 'Understand',
    criteria: 'Can explain the fundamental definition and core principles simply in own words.',
    passingThreshold: 'Explain core concept + 1 basic check',
    xpReward: 25,
  },
  {
    level: 2,
    name: 'RECALL',
    shortName: 'Recall',
    criteria: 'Can recall key formulas, definitions, and syntax accurately without reference notes.',
    passingThreshold: 'Score >= 80% on closed-book recall questions',
    xpReward: 40,
  },
  {
    level: 3,
    name: 'APPLY',
    shortName: 'Apply',
    criteria: 'Can solve standard multi-step application problems and code challenges accurately.',
    passingThreshold: 'Score >= 80% on multi-step application questions',
    xpReward: 65,
  },
  {
    level: 4,
    name: 'ENTRANCE / MASTERED',
    shortName: 'Mastered',
    criteria: 'Can solve difficult, tricky, or entrance-level questions under exam timing with full accuracy.',
    passingThreshold: 'Pass Level 4 tricky/entrance challenge questions (>= 85% accuracy)',
    xpReward: 100,
  },
];

// ── 4. CHEMISTRY 1-MONTH PACING CALCULATION ──────────────────────────────────
export function calculateChemistryOneMonthPlan(completedTopicIds: string[] = []) {
  const totalTopics = CHEMISTRY_ROADMAP.length; // 21
  const remaining = CHEMISTRY_ROADMAP.filter((t) => !completedTopicIds.includes(t.id));
  const totalHoursRemaining = remaining.reduce((sum, t) => sum + t.estimatedHours, 0);

  // Target 30 study days
  const targetDays = 30;
  const hoursPerDay = Math.round((totalHoursRemaining / targetDays) * 10) / 10;
  const minutesPerDay = Math.round(hoursPerDay * 60);

  // Current active topic is the first uncompleted topic in connected sequence
  const currentTopic = remaining[0] || CHEMISTRY_ROADMAP[CHEMISTRY_ROADMAP.length - 1];
  const nextTopic = remaining[1] || null;

  return {
    totalTopics,
    completedCount: totalTopics - remaining.length,
    remainingCount: remaining.length,
    percentage: Math.round(((totalTopics - remaining.length) / totalTopics) * 100),
    totalHoursRemaining,
    targetDays,
    hoursPerDay,
    minutesPerDay,
    currentTopic,
    nextTopic,
    isPacingRealistic: minutesPerDay <= 120, // Max 2 hours chemistry study per day
    recommendedStudyBlocks: [
      { name: 'LEARN', minutes: 60, focus: 'First-principles breakdown of core concept and derivations' },
      { name: 'ACTIVE RECALL', minutes: 20, focus: 'Closed-book blank page summary & diagram drawing' },
      { name: 'FLASHCARDS', minutes: 30, focus: 'Key terms, formulas, oxidation states, and reactions' },
      { name: 'PRACTICE / WORKOUT', minutes: 45, focus: 'Solving 10-15 real numerical & conceptual problems' },
      { name: 'OLD-TOPIC RECALL', minutes: 10, focus: 'Spaced repetition question from previous prerequisite topic' },
    ],
  };
}

// ── 5. JAVASCRIPT PACING CALCULATION ──────────────────────────────────────────
export function calculateJavaScriptPacing(completedLessonIds: string[] = ['js-1-intro', 'js-2-variables-types']) {
  const totalLessons = JAVASCRIPT_ROADMAP.length;
  const remaining = JAVASCRIPT_ROADMAP.filter((l) => !completedLessonIds.includes(l.id));

  // Current is Conditionals (order 3) if not completed
  const currentLesson = JAVASCRIPT_ROADMAP.find((l) => l.id === 'js-3-conditionals') || remaining[0] || JAVASCRIPT_ROADMAP[0];
  const nextLesson = JAVASCRIPT_ROADMAP.find((l) => l.id === 'js-4-loops') || remaining[1] || JAVASCRIPT_ROADMAP[3];

  const totalMinutesRemaining = remaining.reduce((sum, l) => sum + l.estimatedMinutes, 0);

  return {
    courseName: JAVASCRIPT_COURSE_NAME,
    totalLessons,
    completedCount: totalLessons - remaining.length,
    remainingCount: remaining.length,
    percentage: Math.round(((totalLessons - remaining.length) / totalLessons) * 100),
    currentLesson,
    nextLesson,
    totalMinutesRemaining,
    todayTaskRecommendation: {
      lessonTitle: currentLesson.title,
      durationMinutes: 60,
      breakdown: [
        { label: 'Learn', minutes: 30, description: 'if/else, logical operators (&&, ||, !), and ternary operator' },
        { label: 'Practice', minutes: 20, description: 'Coding conditionals & nested logic in editor' },
        { label: 'Quiz', minutes: 10, description: 'Checking Your Balance & Food Chain quizzes' },
      ],
    },
  };
}
