import { prisma } from '../lib/prisma';
import * as fs from 'fs';
import * as path from 'path';
import { getSubjectRoadmap } from '../lib/subjectRoadmapsData';
import { calculateChemistryOneMonthPlan } from '../lib/studyRoadmaps';
import { ensureTodayDailyPlan } from '../lib/dailyPlanGenerator';
import { getAddisNow, workoutWindowForAddisDate } from '../lib/workoutTime';

async function main() {
  console.log('--- RESETTING CHEMISTRY TO FRESH START (DAY 1 / UNIT 1) ---');

  // 1. Delete all chemistry topic masteries safely if DB is online
  try {
    const deletedMasteries = await prisma.studyTopicMastery.deleteMany({
      where: {
        OR: [
          { subject: 'CHEMISTRY' },
          { subject: 'Chemistry' },
          { topicId: { startsWith: 'chemistry_' } },
          { topicId: { startsWith: 'chem_' } },
        ],
      },
    });
    console.log(`Deleted ${deletedMasteries.count} Prisma StudyTopicMastery records for Chemistry.`);
  } catch (err: any) {
    console.log('Database not reachable for StudyTopicMastery cleanup (skipping DB purge).');
  }

  // 2. Delete all chemistry assessment sessions safely if DB is online
  try {
    const deletedSessions = await prisma.studyAssessmentSession.deleteMany({
      where: {
        OR: [
          { subject: 'CHEMISTRY' },
          { subject: 'Chemistry' },
          { topicId: { startsWith: 'chemistry_' } },
          { topicId: { startsWith: 'chem_' } },
        ],
      },
    });
    console.log(`Deleted ${deletedSessions.count} Prisma StudyAssessmentSession records for Chemistry.`);
  } catch (err: any) {
    console.log('Database not reachable for StudyAssessmentSession cleanup (skipping DB purge).');
  }

  // 3. Reset subject_mastery_state.json fallback store
  const statePath = path.join(process.cwd(), 'data', 'subject_mastery_state.json');
  if (fs.existsSync(statePath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      if (raw.subjects && raw.subjects.CHEMISTRY) {
        raw.subjects.CHEMISTRY = {
          status: 'READY',
          startDate: null,
          deadline: null,
          completedAt: null,
          activeUnitId: 'chemistry_u1',
          activeTopicId: 'chemistry_u1_t1',
        };
      }
      // Remove any chemistry topics from topics map
      if (raw.topics) {
        for (const k of Object.keys(raw.topics)) {
          if (k.startsWith('chemistry_') || k.startsWith('chem_')) {
            delete raw.topics[k];
          }
        }
      }
      // Filter out chemistry question logs / sessions if any
      if (Array.isArray(raw.questionLogs)) {
        raw.questionLogs = raw.questionLogs.filter((q: any) => q.subject !== 'CHEMISTRY' && q.subject !== 'Chemistry');
      }
      if (Array.isArray(raw.sessions)) {
        raw.sessions = raw.sessions.filter((s: any) => s.subject !== 'CHEMISTRY' && s.subject !== 'Chemistry');
      }
      fs.writeFileSync(statePath, JSON.stringify(raw, null, 2), 'utf8');
      console.log('Successfully updated data/subject_mastery_state.json for Chemistry.');
    } catch (err) {
      console.error('Error updating subject_mastery_state.json:', err);
    }
  }

  // 4. Reset assessment sessions file if exists
  const assessFilePath = path.join(process.cwd(), 'data', 'study_assessment_sessions.json');
  if (fs.existsSync(assessFilePath)) {
    try {
      const rawAssess = JSON.parse(fs.readFileSync(assessFilePath, 'utf8'));
      const filtered = Array.isArray(rawAssess)
        ? rawAssess.filter((s: any) => s.subject !== 'CHEMISTRY' && s.subject !== 'Chemistry')
        : [];
      fs.writeFileSync(assessFilePath, JSON.stringify(filtered, null, 2), 'utf8');
      console.log('Cleared chemistry entries in data/study_assessment_sessions.json.');
    } catch (err) {
      console.error('Error updating study_assessment_sessions.json:', err);
    }
  }

  // 5. Update or recreate today's Chemistry Daily Task safely
  try {
    const windowInfo = workoutWindowForAddisDate(getAddisNow());
    const chemRoadmap = getSubjectRoadmap('CHEMISTRY');
    const chemPacing = calculateChemistryOneMonthPlan([]);
    const activeChemUnit = chemRoadmap.units[0];
    const activeChemTopic = activeChemUnit?.topics[0];

    const todayPlan = await prisma.dailyPlan.findFirst({
      where: { date: { gte: windowInfo.startUtc, lte: windowInfo.endUtc } },
      include: { tasks: true },
    });

    if (todayPlan) {
      const chemTask = todayPlan.tasks.find((t) => t.subject === 'CHEMISTRY' || t.description.toLowerCase().includes('chemistry'));
      const payload = JSON.stringify({
        title: `Chemistry — ${activeChemTopic?.title || chemPacing.currentTopic.name}`,
        subject: 'CHEMISTRY',
        unitId: activeChemUnit?.id || 'chemistry_u1',
        unitTitle: activeChemUnit?.title || 'Unit 1 — CHEMISTRY AND ITS IMPORTANCE',
        topicId: activeChemTopic?.id || 'chemistry_u1_t1',
        topicTitle: activeChemTopic?.title || chemPacing.currentTopic.name,
        subtopics: activeChemTopic?.subtopics || chemPacing.currentTopic.subtopics,
        practiceTarget: chemPacing.currentTopic.practiceTarget,
        reviewTarget: chemPacing.currentTopic.reviewTarget,
        isEntrancePriority: chemPacing.currentTopic.isEntrancePriority,
        sessionBreakdown: chemPacing.currentTopic.sessionBreakdown,
        isStudy: true,
      });

      if (chemTask) {
        await prisma.planTask.update({
          where: { id: chemTask.id },
          data: {
            description: payload,
            topic: activeChemTopic?.title || chemPacing.currentTopic.name,
            completed: false,
            minutesTarget: chemPacing.minutesPerDay || 75,
            priority: 'MEDIUM',
            xpTarget: 85,
          },
        });
        console.log(`Updated today's task (${chemTask.id}) to fresh Chemistry Day 1 / Unit 1.1.`);
      }
    }
  } catch (err) {
    console.log('Database not reachable for task DB update (in-memory plan will serve Day 1).');
  }

  // 6. Verify enriched daily plan
  const plan = await ensureTodayDailyPlan();
  console.log('Today Plan verified. Tasks count:', plan.tasks.length);
  const chemInPlan = plan.tasks.find((t) => t.subject === 'CHEMISTRY' || t.displayTitle.includes('Chemistry'));
  console.log('Fresh Chemistry Task:', chemInPlan?.displayTitle);
  console.log('Subtopics:', chemInPlan?.subtopics);

  console.log('--- FRESH CHEMISTRY START COMPLETE ---');
}

main()
  .catch((err) => {
    console.error('Reset Chemistry script failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
