import { prisma } from './prisma';
import {
  SubjectKey,
  ORDERED_SUBJECT_KEYS,
  getSubjectRoadmap,
  getAllSubjectRoadmaps,
  findTopicById,
  getNextTopicInRoadmap,
  SubjectRoadmap,
  SubjectTopic,
  SubjectUnit,
} from './subjectRoadmapsData';
import * as fs from 'fs';
import * as path from 'path';

export interface SubjectCardData {
  key: SubjectKey;
  name: string;
  icon: string;
  status: 'NOT_STARTED' | 'READY' | 'ACTIVE' | 'COMPLETED' | 'LOCKED';
  startDate: string | null;
  deadline: string | null;
  completedAt: string | null;
  daysLeft: number;
  hoursLeft: number;
  minutesLeft: number;
  secondsLeft: number;
  totalSecondsRemaining: number;
  countdownDisplay: string;
  isDeadlineReached: boolean;
  isCompletedEarly: boolean;
  completedEarlyDays?: number;
  totalTopics: number;
  completedTopics: number;
  remainingTopics: number;
  completionPercent: number;
  remainingPercent: number;
  activeUnit: { id: string; title: string; grade: string } | null;
  activeTopic: { id: string; title: string; subtopics: string[] } | null;
  todayTarget: {
    unit: string;
    topic: string;
    subtopics: string[];
    targetMinutes: number;
    questionsCount: number;
  } | null;
  strongAreas: Array<{ topicTitle: string; accuracy: number }>;
  weakAreas: Array<{ topicTitle: string; accuracy: number }>;
  improvingAreas: Array<{ topicTitle: string; accuracy: number }>;
  repeatedMistakes: Array<{ prompt: string; wrongAnswer: string; count: number }>;
  isPendingUpload?: boolean;
}

export interface SubjectMasteryOverview {
  activeSubject: SubjectKey | 'NONE';
  allSubjects: SubjectCardData[];
  overallStats: {
    totalSubjects: number;
    subjectsStarted: number;
    subjectsCompleted: number;
    totalTopicsAcrossAll: number;
    completedTopicsAcrossAll: number;
    totalStudyMinutes: number;
    totalQuestionsAttempted: number;
    overallAccuracy: number;
    overallCompletionPercent: number;
  };
  examCountdown: {
    targetDateIso: string;
    formattedDate: string;
    ethiopianDate: string;
    daysLeft: number;
  };
}

// Fallback JSON store directory
const STORE_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(STORE_DIR, 'subject_mastery_state.json');

interface FallbackStore {
  subjects: Record<
    string,
    {
      status: 'NOT_STARTED' | 'READY' | 'ACTIVE' | 'COMPLETED' | 'LOCKED';
      startDate: string | null;
      deadline: string | null;
      completedAt: string | null;
      activeUnitId: string | null;
      activeTopicId: string | null;
    }
  >;
  topics: Record<
    string,
    {
      status: 'NOT_STARTED' | 'IN_PROGRESS' | 'STUDIED' | 'QUESTIONED' | 'WEAK' | 'MASTERED';
      focusMinutes: number;
      accuracy: number;
      attemptsCount: number;
      correctCount: number;
      studiedAt: string | null;
      masteredAt: string | null;
    }
  >;
  questionLogs: Array<{
    id: string;
    subject: string;
    unitId: string;
    topicId: string;
    subtopic?: string;
    difficulty: string;
    questionType: string;
    prompt: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    timeTakenSec: number;
    attemptNumber: number;
    createdAt: string;
  }>;
  sessions: Array<{
    id: string;
    subject: string;
    unitId: string;
    topicId: string;
    subtopic?: string;
    minutes: number;
    completedAt: string;
    xpEarned: number;
  }>;
}

function loadFallbackStore(): FallbackStore {
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_FILE)) {
      const content = fs.readFileSync(STORE_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading fallback store:', err);
  }
  return {
    subjects: {
      CHEMISTRY: { status: 'READY', startDate: null, deadline: null, completedAt: null, activeUnitId: null, activeTopicId: null },
      BIOLOGY: { status: 'LOCKED', startDate: null, deadline: null, completedAt: null, activeUnitId: null, activeTopicId: null },
      PHYSICS: { status: 'LOCKED', startDate: null, deadline: null, completedAt: null, activeUnitId: null, activeTopicId: null },
      ENGLISH: { status: 'LOCKED', startDate: null, deadline: null, completedAt: null, activeUnitId: null, activeTopicId: null },
      MATHEMATICS: { status: 'LOCKED', startDate: null, deadline: null, completedAt: null, activeUnitId: null, activeTopicId: null },
    },
    topics: {},
    questionLogs: [],
    sessions: [],
  };
}

function saveFallbackStore(data: FallbackStore) {
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving fallback store:', err);
  }
}

/**
 * Addis Ababa Time Calculations
 */
export function getAddisCurrentDate(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 3); // UTC+3
}

export function calculate1MonthDeadline(startDate: Date): Date {
  const deadline = new Date(startDate.getTime());
  deadline.setMonth(deadline.getMonth() + 1);
  return deadline;
}

export function calculateTimeRemaining(deadlineDate: Date | null): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isReached: boolean;
} {
  if (!deadlineDate) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, isReached: false };
  }

  const now = getAddisCurrentDate().getTime();
  const target = new Date(deadlineDate).getTime();
  const diff = target - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, isReached: true };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, totalSeconds, isReached: false };
}

/**
 * Fetch Full Overview of all 5 Subjects
 */
export async function getSubjectMasteryOverview(): Promise<SubjectMasteryOverview> {
  const store = loadFallbackStore();

  // Try fetching from Prisma DB if available, else sync with store
  let dbSubjects: Record<string, any> = {};
  let dbTopics: Record<string, any> = {};
  let dbQuestionLogs: any[] = [];
  let dbSessions: any[] = [];

  try {
    const subjectsFromDb = await prisma.subjectProgress.findMany();
    for (const sub of subjectsFromDb) {
      dbSubjects[sub.subject] = sub;
    }
    const topicsFromDb = await prisma.subjectTopicRecord.findMany();
    for (const top of topicsFromDb) {
      dbTopics[`${top.subject}_${top.topicId}`] = top;
    }
    dbQuestionLogs = await prisma.subjectQuestionLog.findMany();
    dbSessions = await prisma.subjectStudySession.findMany();
  } catch {
    // If DB is offline, store is the source
  }

  let activeSubject: SubjectKey | 'NONE' = 'NONE';
  const allCards: SubjectCardData[] = [];

  let subjectsStartedCount = 0;
  let subjectsCompletedCount = 0;
  let totalCompletedTopicsAll = 0;
  let totalTopicsAll = 0;
  let totalStudyMinutesAll = 0;
  let totalQuestionsAttemptedAll = 0;
  let totalCorrectQuestionsAll = 0;

  // Process each subject in strict fixed order
  for (let i = 0; i < ORDERED_SUBJECT_KEYS.length; i++) {
    const key = ORDERED_SUBJECT_KEYS[i];
    const roadmap = getSubjectRoadmap(key);
    totalTopicsAll += roadmap.totalTopics;

    const dbSub = dbSubjects[key] || store.subjects[key] || {
      status: i === 0 ? 'READY' : 'LOCKED',
      startDate: null,
      deadline: null,
      completedAt: null,
      activeUnitId: null,
      activeTopicId: null,
    };

    let status: 'NOT_STARTED' | 'READY' | 'ACTIVE' | 'COMPLETED' | 'LOCKED' = dbSub.status;

    // Verify sequential integrity
    if (i === 0 && status !== 'ACTIVE' && status !== 'COMPLETED') {
      status = 'READY';
    } else if (i > 0 && status !== 'COMPLETED' && status !== 'ACTIVE') {
      const prevKey = ORDERED_SUBJECT_KEYS[i - 1];
      const prevCard = allCards[i - 1];
      if (prevCard && prevCard.status === 'COMPLETED') {
        status = 'READY';
      } else {
        status = 'LOCKED';
      }
    }

    if (status === 'ACTIVE') {
      activeSubject = key;
      subjectsStartedCount++;
    } else if (status === 'COMPLETED') {
      subjectsStartedCount++;
      subjectsCompletedCount++;
    }

    const startDate = dbSub.startDate ? new Date(dbSub.startDate).toISOString() : null;
    const deadline = dbSub.deadline ? new Date(dbSub.deadline).toISOString() : null;
    const completedAt = dbSub.completedAt ? new Date(dbSub.completedAt).toISOString() : null;

    // Calculate time remaining
    const timeRemaining = deadline ? calculateTimeRemaining(new Date(deadline)) : {
      days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, isReached: false,
    };

    let isCompletedEarly = false;
    let completedEarlyDays = 0;
    if (completedAt && deadline) {
      const compDate = new Date(completedAt).getTime();
      const deadDate = new Date(deadline).getTime();
      if (compDate < deadDate) {
        isCompletedEarly = true;
        completedEarlyDays = Math.max(1, Math.floor((deadDate - compDate) / (1000 * 3600 * 24)));
      }
    }

    // Count topics and progress
    let completedTopicsCount = 0;
    const strongList: Array<{ topicTitle: string; accuracy: number }> = [];
    const weakList: Array<{ topicTitle: string; accuracy: number }> = [];
    const improvingList: Array<{ topicTitle: string; accuracy: number }> = [];

    for (const unit of roadmap.units) {
      for (const top of unit.topics) {
        const topKey = `${key}_${top.id}`;
        const topicRecord = dbTopics[topKey] || store.topics[topKey];
        if (topicRecord) {
          if (topicRecord.status === 'STUDIED' || topicRecord.status === 'MASTERED' || topicRecord.status === 'QUESTIONED') {
            completedTopicsCount++;
          }
          if (topicRecord.attemptsCount > 0) {
            const acc = Math.round(topicRecord.accuracy || (topicRecord.correctCount / topicRecord.attemptsCount) * 100);
            if (acc >= 80 || topicRecord.status === 'MASTERED') {
              strongList.push({ topicTitle: top.title, accuracy: acc });
            } else if (acc >= 60) {
              improvingList.push({ topicTitle: top.title, accuracy: acc });
            } else {
              weakList.push({ topicTitle: top.title, accuracy: acc });
            }
          }
        }
      }
    }

    totalCompletedTopicsAll += completedTopicsCount;
    const remainingTopicsCount = Math.max(0, roadmap.totalTopics - completedTopicsCount);
    const completionPercent = roadmap.totalTopics > 0 ? Math.round((completedTopicsCount / roadmap.totalTopics) * 100) : 0;
    const remainingPercent = 100 - completionPercent;

    // Determine Active Unit and Active Topic
    let activeUnit: { id: string; title: string; grade: string } | null = null;
    let activeTopic: { id: string; title: string; subtopics: string[] } | null = null;

    if (status === 'ACTIVE' || status === 'READY') {
      const nextT = getNextTopicInRoadmap(key, dbSub.activeTopicId);
      if (nextT) {
        activeUnit = { id: nextT.unit.id, title: nextT.unit.title, grade: nextT.unit.grade };
        activeTopic = { id: nextT.topic.id, title: nextT.topic.title, subtopics: nextT.topic.subtopics };
      }
    }

    // Questions and sessions count
    const subjectSessions = (dbSessions.length > 0 ? dbSessions : store.sessions).filter((s) => s.subject === key);
    const subjectMinutes = subjectSessions.reduce((acc, s) => acc + (s.minutes || 0), 0);
    totalStudyMinutesAll += subjectMinutes;

    const subjectQuestions = (dbQuestionLogs.length > 0 ? dbQuestionLogs : store.questionLogs).filter((q) => q.subject === key);
    totalQuestionsAttemptedAll += subjectQuestions.length;
    const correctQuestions = subjectQuestions.filter((q) => q.isCorrect).length;
    totalCorrectQuestionsAll += correctQuestions;

    // Repeated mistakes analysis
    const wrongMap: Record<string, { prompt: string; wrongAnswer: string; count: number }> = {};
    for (const q of subjectQuestions) {
      if (!q.isCorrect) {
        const hash = `${q.prompt}_${q.userAnswer}`;
        if (!wrongMap[hash]) {
          wrongMap[hash] = { prompt: q.prompt, wrongAnswer: q.userAnswer, count: 1 };
        } else {
          wrongMap[hash].count++;
        }
      }
    }
    const repeatedMistakes = Object.values(wrongMap).filter((m) => m.count >= 2);

    let countdownDisplay = `${timeRemaining.days} DAYS ${timeRemaining.hours} HOURS`;
    if (timeRemaining.days === 0 && timeRemaining.hours === 0) {
      countdownDisplay = `${timeRemaining.minutes}M ${timeRemaining.seconds}S`;
    }

    allCards.push({
      key,
      name: roadmap.name,
      icon: roadmap.icon,
      status,
      startDate,
      deadline,
      completedAt,
      daysLeft: timeRemaining.days,
      hoursLeft: timeRemaining.hours,
      minutesLeft: timeRemaining.minutes,
      secondsLeft: timeRemaining.seconds,
      totalSecondsRemaining: timeRemaining.totalSeconds,
      countdownDisplay,
      isDeadlineReached: timeRemaining.isReached && status === 'ACTIVE',
      isCompletedEarly,
      completedEarlyDays,
      totalTopics: roadmap.totalTopics,
      completedTopics: completedTopicsCount,
      remainingTopics: remainingTopicsCount,
      completionPercent,
      remainingPercent,
      activeUnit,
      activeTopic,
      todayTarget: activeTopic && activeUnit ? {
        unit: activeUnit.title,
        topic: activeTopic.title,
        subtopics: activeTopic.subtopics.slice(0, 4),
        targetMinutes: 90,
        questionsCount: 10,
      } : null,
      strongAreas: strongList.slice(0, 5),
      weakAreas: weakList.slice(0, 5),
      improvingAreas: improvingList.slice(0, 5),
      repeatedMistakes: repeatedMistakes.slice(0, 5),
      isPendingUpload: roadmap.isPendingUpload,
    });
  }

  const overallAccuracy = totalQuestionsAttemptedAll > 0 ? Math.round((totalCorrectQuestionsAll / totalQuestionsAttemptedAll) * 100) : 0;
  const overallCompletionPercent = totalTopicsAll > 0 ? Math.round((totalCompletedTopicsAll / totalTopicsAll) * 100) : 0;

  return {
    activeSubject,
    allSubjects: allCards,
    overallStats: {
      totalSubjects: 5,
      subjectsStarted: subjectsStartedCount,
      subjectsCompleted: subjectsCompletedCount,
      totalTopicsAcrossAll: totalTopicsAll,
      completedTopicsAcrossAll: totalCompletedTopicsAll,
      totalStudyMinutes: totalStudyMinutesAll,
      totalQuestionsAttempted: totalQuestionsAttemptedAll,
      overallAccuracy,
      overallCompletionPercent,
    },
    examCountdown: {
      targetDateIso: '2027-06-21T00:00:00+03:00',
      formattedDate: 'June 21, 2027',
      ethiopianDate: 'Sene 14, 2019 E.C.',
      daysLeft: calculateDaysLeft(new Date('2027-06-21T00:00:00+03:00')),
    },
  };
}

function calculateDaysLeft(target: Date): number {
  const now = getAddisCurrentDate().getTime();
  const diff = target.getTime() - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Start a Subject (e.g. Chemistry)
 * Sets start date = now, deadline = now + 1 month, status = ACTIVE
 */
export async function startSubject(subjectKey: SubjectKey): Promise<{ success: boolean; subjectCard: SubjectCardData }> {
  const store = loadFallbackStore();
  const roadmap = getSubjectRoadmap(subjectKey);

  // Validate ordering: if subject is not Chemistry, previous subject must be COMPLETED
  const subjectIndex = ORDERED_SUBJECT_KEYS.indexOf(subjectKey);
  if (subjectIndex > 0) {
    const prevKey = ORDERED_SUBJECT_KEYS[subjectIndex - 1];
    const prevSub = store.subjects[prevKey];
    if (!prevSub || prevSub.status !== 'COMPLETED') {
      throw new Error(`Cannot start ${subjectKey}. Previous subject ${prevKey} is not completed.`);
    }
  }

  const now = getAddisCurrentDate();
  const deadline = calculate1MonthDeadline(now);
  const firstUnit = roadmap.units[0];
  const firstTopic = firstUnit?.topics[0];

  const updatedSubjectState = {
    status: 'ACTIVE' as const,
    startDate: now.toISOString(),
    deadline: deadline.toISOString(),
    completedAt: null,
    activeUnitId: firstUnit ? firstUnit.id : null,
    activeTopicId: firstTopic ? firstTopic.id : null,
  };

  store.subjects[subjectKey] = updatedSubjectState;
  saveFallbackStore(store);

  // Persist to Prisma DB if accessible
  try {
    await prisma.subjectProgress.upsert({
      where: { subject: subjectKey },
      update: {
        status: 'ACTIVE',
        startDate: now,
        deadline: deadline,
        completedAt: null,
        activeUnitId: firstUnit?.id || null,
        activeTopicId: firstTopic?.id || null,
        totalTopics: roadmap.totalTopics,
      },
      create: {
        subject: subjectKey,
        status: 'ACTIVE',
        startDate: now,
        deadline: deadline,
        activeUnitId: firstUnit?.id || null,
        activeTopicId: firstTopic?.id || null,
        totalTopics: roadmap.totalTopics,
        completedTopics: 0,
        remainingTopics: roadmap.totalTopics,
        completionPercent: 0,
        remainingPercent: 100,
      },
    });
  } catch (err) {
    console.warn('Prisma subject progress upsert failed, stored in local file:', err);
  }

  const overview = await getSubjectMasteryOverview();
  const card = overview.allSubjects.find((s) => s.key === subjectKey)!;
  return { success: true, subjectCard: card };
}

/**
 * Mark a Topic as Studied / Questioned / Mastered and advance to next
 */
export async function completeTopicProgress(params: {
  subject: SubjectKey;
  topicId: string;
  status?: 'STUDIED' | 'MASTERED' | 'WEAK';
  focusMinutes?: number;
  accuracy?: number;
}): Promise<{ success: boolean; isSubjectCompleted: boolean; nextTopic: any }> {
  const { subject, topicId, status = 'STUDIED', focusMinutes = 0, accuracy = 100 } = params;
  const store = loadFallbackStore();
  const roadmap = getSubjectRoadmap(subject);
  const topicInfo = findTopicById(subject, topicId);

  if (!topicInfo) {
    throw new Error(`Topic ${topicId} not found in ${subject} roadmap.`);
  }

  const topKey = `${subject}_${topicId}`;
  const now = getAddisCurrentDate().toISOString();

  store.topics[topKey] = {
    status,
    focusMinutes: (store.topics[topKey]?.focusMinutes || 0) + focusMinutes,
    accuracy: accuracy,
    attemptsCount: (store.topics[topKey]?.attemptsCount || 0) + 1,
    correctCount: accuracy >= 70 ? (store.topics[topKey]?.correctCount || 0) + 1 : (store.topics[topKey]?.correctCount || 0),
    studiedAt: now,
    masteredAt: status === 'MASTERED' ? now : (store.topics[topKey]?.masteredAt || null),
  };

  // Find next topic in sequence
  const nextT = getNextTopicInRoadmap(subject, topicId);
  if (nextT && !nextT.isLast) {
    store.subjects[subject].activeUnitId = nextT.unit.id;
    store.subjects[subject].activeTopicId = nextT.topic.id;
  }

  // Check if all topics in this subject are completed
  let allDone = true;
  for (const u of roadmap.units) {
    for (const t of u.topics) {
      const k = `${subject}_${t.id}`;
      const rec = store.topics[k];
      if (!rec || (rec.status !== 'STUDIED' && rec.status !== 'MASTERED')) {
        allDone = false;
        break;
      }
    }
    if (!allDone) break;
  }

  if (allDone) {
    store.subjects[subject].status = 'COMPLETED';
    store.subjects[subject].completedAt = now;

    // Unlock next subject in order (set to READY)
    const currentIndex = ORDERED_SUBJECT_KEYS.indexOf(subject);
    if (currentIndex + 1 < ORDERED_SUBJECT_KEYS.length) {
      const nextSubjectKey = ORDERED_SUBJECT_KEYS[currentIndex + 1];
      if (store.subjects[nextSubjectKey]?.status === 'LOCKED') {
        store.subjects[nextSubjectKey].status = 'READY';
      }
    }
  }

  saveFallbackStore(store);

  // Sync to Prisma DB if available
  try {
    await prisma.subjectTopicRecord.upsert({
      where: { subject_topicId: { subject, topicId } },
      update: {
        status,
        focusMinutes: { increment: focusMinutes },
        accuracy,
        studiedAt: new Date(),
        masteredAt: status === 'MASTERED' ? new Date() : undefined,
      },
      create: {
        subject,
        unitId: topicInfo.unit.id,
        unitTitle: topicInfo.unit.title,
        topicId,
        topicTitle: topicInfo.topic.title,
        status,
        focusMinutes,
        accuracy,
        attemptsCount: 1,
        correctCount: accuracy >= 70 ? 1 : 0,
        studiedAt: new Date(),
        masteredAt: status === 'MASTERED' ? new Date() : null,
      },
    });

    if (allDone) {
      await prisma.subjectProgress.update({
        where: { subject },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      const currentIndex = ORDERED_SUBJECT_KEYS.indexOf(subject);
      if (currentIndex + 1 < ORDERED_SUBJECT_KEYS.length) {
        const nextSub = ORDERED_SUBJECT_KEYS[currentIndex + 1];
        await prisma.subjectProgress.upsert({
          where: { subject: nextSub },
          update: { status: 'READY' },
          create: { subject: nextSub, status: 'READY' },
        });
      }
    }
  } catch (err) {
    console.warn('Prisma sync failed during completeTopicProgress:', err);
  }

  return { success: true, isSubjectCompleted: allDone, nextTopic: nextT ? nextT.topic : null };
}

/**
 * Record locked-in focus session for subject topic
 */
export async function recordSubjectFocusSession(params: {
  subject: SubjectKey;
  unitId: string;
  topicId: string;
  subtopic?: string;
  minutes: number;
  xpEarned: number;
}): Promise<{ success: boolean; session: any }> {
  const { subject, unitId, topicId, subtopic, minutes, xpEarned } = params;
  const store = loadFallbackStore();
  const sessionItem = {
    id: `sess_${Date.now()}`,
    subject,
    unitId,
    topicId,
    subtopic,
    minutes,
    completedAt: getAddisCurrentDate().toISOString(),
    xpEarned,
  };

  store.sessions.push(sessionItem);

  // Update topic focus minutes
  const topKey = `${subject}_${topicId}`;
  if (store.topics[topKey]) {
    store.topics[topKey].focusMinutes = (store.topics[topKey].focusMinutes || 0) + minutes;
    if (store.topics[topKey].status === 'NOT_STARTED') {
      store.topics[topKey].status = 'IN_PROGRESS';
    }
  } else {
    store.topics[topKey] = {
      status: 'IN_PROGRESS',
      focusMinutes: minutes,
      accuracy: 0,
      attemptsCount: 0,
      correctCount: 0,
      studiedAt: sessionItem.completedAt,
      masteredAt: null,
    };
  }

  saveFallbackStore(store);

  try {
    await prisma.subjectStudySession.create({
      data: {
        subject,
        unitId,
        topicId,
        subtopic,
        minutes,
        startedAt: new Date(Date.now() - minutes * 60000),
        completedAt: new Date(),
        xpEarned,
      },
    });
  } catch (err) {
    console.warn('Prisma record session fallback:', err);
  }

  return { success: true, session: sessionItem };
}

/**
 * Record Question Answers in Question Log
 */
export async function recordSubjectQuestionAttempt(params: {
  subject: SubjectKey;
  unitId: string;
  topicId: string;
  subtopic?: string;
  questionType?: string;
  difficulty?: string;
  prompt: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  timeTakenSec?: number;
  attemptNumber?: number;
}): Promise<{ success: boolean }> {
  const store = loadFallbackStore();
  const now = getAddisCurrentDate().toISOString();

  const logEntry = {
    id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    subject: params.subject,
    unitId: params.unitId,
    topicId: params.topicId,
    subtopic: params.subtopic,
    questionType: params.questionType || 'MULTIPLE_CHOICE',
    difficulty: params.difficulty || 'medium',
    prompt: params.prompt,
    userAnswer: params.userAnswer,
    correctAnswer: params.correctAnswer,
    isCorrect: params.isCorrect,
    timeTakenSec: params.timeTakenSec || 30,
    attemptNumber: params.attemptNumber || 1,
    createdAt: now,
  };

  store.questionLogs.push(logEntry);

  // Recalculate accuracy for topic
  const topKey = `${params.subject}_${params.topicId}`;
  const topicLogs = store.questionLogs.filter((q) => q.subject === params.subject && q.topicId === params.topicId);
  const correctLogs = topicLogs.filter((q) => q.isCorrect).length;
  const accuracy = topicLogs.length > 0 ? Math.round((correctLogs / topicLogs.length) * 100) : 0;

  if (store.topics[topKey]) {
    store.topics[topKey].attemptsCount = topicLogs.length;
    store.topics[topKey].correctCount = correctLogs;
    store.topics[topKey].accuracy = accuracy;
    if (accuracy >= 80) {
      store.topics[topKey].status = 'MASTERED';
      store.topics[topKey].masteredAt = now;
    } else if (accuracy < 60) {
      store.topics[topKey].status = 'WEAK';
    } else {
      store.topics[topKey].status = 'QUESTIONED';
    }
  }

  saveFallbackStore(store);

  try {
    await prisma.subjectQuestionLog.create({
      data: {
        subject: params.subject,
        unitId: params.unitId,
        topicId: params.topicId,
        subtopic: params.subtopic,
        questionType: params.questionType || 'MULTIPLE_CHOICE',
        difficulty: params.difficulty || 'medium',
        prompt: params.prompt,
        optionsJson: JSON.stringify([]),
        userAnswer: params.userAnswer,
        correctAnswer: params.correctAnswer,
        isCorrect: params.isCorrect,
        timeTakenSec: params.timeTakenSec || 30,
        attemptNumber: params.attemptNumber || 1,
      },
    });
  } catch (err) {
    console.warn('Prisma question log error:', err);
  }

  return { success: true };
}

/**
 * Historical Progress Time Series for /subjects/progress
 */
export async function getSubjectHistoricalProgress(range: '7D' | '30D' | '90D' | '180D' | 'ALL') {
  const store = loadFallbackStore();
  const days = range === '7D' ? 7 : range === '30D' ? 30 : range === '90D' ? 90 : range === '180D' ? 180 : 365;

  const now = getAddisCurrentDate();
  const timeSeries: Array<{
    date: string;
    studyMinutes: number;
    topicsCompleted: number;
    questionsAttempted: number;
    questionAccuracy: number;
    consistencyScore: number;
    xpEarned: number;
    masteryLevel: number;
  }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const dateStr = d.toISOString().split('T')[0];

    // Filter sessions on this day
    const daySessions = store.sessions.filter((s) => s.completedAt.startsWith(dateStr));
    const studyMinutes = daySessions.reduce((acc, s) => acc + s.minutes, 0);
    const xpEarned = daySessions.reduce((acc, s) => acc + s.xpEarned, 0);

    // Filter questions on this day
    const dayQuestions = store.questionLogs.filter((q) => q.createdAt.startsWith(dateStr));
    const questionsAttempted = dayQuestions.length;
    const correctCount = dayQuestions.filter((q) => q.isCorrect).length;
    const questionAccuracy = questionsAttempted > 0 ? Math.round((correctCount / questionsAttempted) * 100) : 0;

    // Filter topics studied on this day
    const topicsCompleted = Object.values(store.topics).filter(
      (t) => t.studiedAt && t.studiedAt.startsWith(dateStr) && (t.status === 'STUDIED' || t.status === 'MASTERED')
    ).length;

    // Consistency score calculation
    let consistencyScore = 0;
    if (studyMinutes >= 60) consistencyScore += 40;
    else if (studyMinutes > 0) consistencyScore += (studyMinutes / 60) * 40;

    if (questionsAttempted >= 10) consistencyScore += 40;
    else if (questionsAttempted > 0) consistencyScore += (questionsAttempted / 10) * 40;

    if (topicsCompleted >= 1) consistencyScore += 20;

    timeSeries.push({
      date: dateStr,
      studyMinutes,
      topicsCompleted,
      questionsAttempted,
      questionAccuracy,
      consistencyScore: Math.min(100, Math.round(consistencyScore)),
      xpEarned,
      masteryLevel: topicsCompleted > 0 ? 3 : studyMinutes > 0 ? 2 : 1,
    });
  }

  return { range, timeSeries };
}
