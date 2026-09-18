import * as fs from 'fs';
import * as path from 'path';

export type SubjectKey = 'CHEMISTRY' | 'BIOLOGY' | 'PHYSICS' | 'ENGLISH' | 'MATHEMATICS';

export interface SubjectSubtopic {
  id?: string;
  title: string;
}

export interface SubjectTopic {
  id: string;
  title: string;
  subtopics: string[];
}

export interface SubjectUnit {
  id: string;
  grade: string;
  title: string;
  topics: SubjectTopic[];
}

export interface SubjectRoadmap {
  key: SubjectKey;
  name: string;
  icon: string;
  totalUnits: number;
  totalTopics: number;
  totalSubtopics: number;
  isPendingUpload?: boolean;
  units: SubjectUnit[];
}

export const ORDERED_SUBJECT_KEYS: SubjectKey[] = [
  'CHEMISTRY',
  'BIOLOGY',
  'PHYSICS',
  'ENGLISH',
  'MATHEMATICS',
];

function loadJsonRoadmaps(): Record<SubjectKey, SubjectRoadmap> {
  try {
    const jsonPath = path.join(process.cwd(), 'data', 'subjectRoadmapsRaw.json');
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error loading subjectRoadmapsRaw.json:', err);
  }
  return {
    CHEMISTRY: { key: 'CHEMISTRY', name: 'Chemistry', icon: '🧪', totalUnits: 16, totalTopics: 70, totalSubtopics: 359, units: [] },
    BIOLOGY: { key: 'BIOLOGY', name: 'Biology', icon: '🧬', totalUnits: 24, totalTopics: 145, totalSubtopics: 298, units: [] },
    PHYSICS: { key: 'PHYSICS', name: 'Physics', icon: '⚛️', totalUnits: 25, totalTopics: 150, totalSubtopics: 24, units: [] },
    ENGLISH: { key: 'ENGLISH', name: 'English', icon: '🇬🇧', totalUnits: 0, totalTopics: 0, totalSubtopics: 0, isPendingUpload: true, units: [] },
    MATHEMATICS: { key: 'MATHEMATICS', name: 'Mathematics', icon: '📐', totalUnits: 29, totalTopics: 145, totalSubtopics: 144, units: [] },
  };
}

export const SUBJECT_ROADMAPS = loadJsonRoadmaps();

export function getSubjectRoadmap(subject: SubjectKey): SubjectRoadmap {
  return SUBJECT_ROADMAPS[subject] || {
    key: subject,
    name: subject,
    icon: '📚',
    totalUnits: 0,
    totalTopics: 0,
    totalSubtopics: 0,
    isPendingUpload: true,
    units: [],
  };
}

export function getAllSubjectRoadmaps(): SubjectRoadmap[] {
  return ORDERED_SUBJECT_KEYS.map((key) => SUBJECT_ROADMAPS[key]);
}

export function findTopicById(subject: SubjectKey, topicId: string): { unit: SubjectUnit; topic: SubjectTopic } | null {
  const roadmap = getSubjectRoadmap(subject);
  for (const unit of roadmap.units) {
    for (const topic of unit.topics) {
      if (topic.id === topicId) {
        return { unit, topic };
      }
    }
  }
  return null;
}

export function getNextTopicInRoadmap(subject: SubjectKey, currentTopicId?: string | null): { unit: SubjectUnit; topic: SubjectTopic; isLast: boolean } | null {
  const roadmap = getSubjectRoadmap(subject);
  if (!roadmap.units || roadmap.units.length === 0) return null;

  const allTopics: Array<{ unit: SubjectUnit; topic: SubjectTopic }> = [];
  for (const unit of roadmap.units) {
    for (const topic of unit.topics) {
      allTopics.push({ unit, topic });
    }
  }

  if (allTopics.length === 0) return null;

  if (!currentTopicId) {
    return { ...allTopics[0], isLast: allTopics.length === 1 };
  }

  const currentIndex = allTopics.findIndex((t) => t.topic.id === currentTopicId);
  if (currentIndex === -1 || currentIndex + 1 >= allTopics.length) {
    return { ...allTopics[allTopics.length - 1], isLast: true };
  }

  return { ...allTopics[currentIndex + 1], isLast: currentIndex + 1 === allTopics.length - 1 };
}
