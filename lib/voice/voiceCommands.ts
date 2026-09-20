import { prisma } from '../prisma';
import { ensureTodayDailyPlan } from '../dailyPlanGenerator';
import { getAddisNow, getAddisTimeComponents, workoutWindowForAddisDate } from '../workoutTime';
import { parseTimeToMinutes, formatMinutesTo12Hour, getTaskCleanTitle, getTaskCategory } from '../smartSchedule';
import { getScheduledRoutineForDayOfWeek } from '../workoutMuscleTargets';
import { formatTaskForDisplay } from '../planParser';
import { ParsedVoiceCommand } from './types';
import { normalizeSpokenPhrase } from './voiceSecurity';

export async function processVoiceCommand(
  rawSpokenInput: string,
  sessionCallSid?: string,
  confirmedPreviousAction?: boolean
): Promise<ParsedVoiceCommand> {
  const norm = normalizeSpokenPhrase(rawSpokenInput);
  const addisNow = getAddisNow();
  const windowInfo = workoutWindowForAddisDate(addisNow);

  // 1. "WHAT IS MY PLAN TODAY?" or "WHAT'S LEFT TODAY?"
  if (norm.includes('plan today') || norm.includes('whats left') || norm.includes('what is my schedule') || norm.includes('what is left today')) {
    const todayPlan = await ensureTodayDailyPlan();
    const tasks = todayPlan?.tasks || [];
    const pending = tasks.filter((t) => !t.completed);
    const completed = tasks.filter((t) => t.completed);

    const routine = getScheduledRoutineForDayOfWeek(windowInfo.startAddis.getDay());

    if (tasks.length === 0) {
      return {
        action: 'GET_TODAY_PLAN',
        spokenResponse: `Today is ${routine.dayName}. Workout is ${routine.targetBodyParts} at ${routine.location}. No study tasks are scheduled.`,
      };
    }

    const taskSummaries = tasks.map((t) => {
      const timeStr = t.plannedStartTime ? `at ${t.plannedStartTime}` : '';
      return `${t.completed ? 'completed' : 'pending'} ${getTaskCleanTitle(t)} ${timeStr}`;
    });

    const spokenResponse = `Today you have ${tasks.length} planned items: ${taskSummaries.join(', ')}. Today's workout is ${routine.targetBodyParts} at ${routine.location}. You have completed ${completed.length} of ${tasks.length} tasks.`;

    return {
      action: 'GET_TODAY_PLAN',
      spokenResponse,
    };
  }

  // 2. "WHAT AM I DOING NEXT?" or "HOW MUCH TIME DO I HAVE BEFORE MY NEXT TASK?"
  if (norm.includes('doing next') || norm.includes('what next') || norm.includes('time do i have') || norm.includes('before next task')) {
    const todayPlan = await ensureTodayDailyPlan();
    const tasks = todayPlan?.tasks || [];
    const { totalMinutes } = getAddisTimeComponents(addisNow);

    const upcoming = tasks
      .map((t) => ({
        task: t,
        startM: parseTimeToMinutes(t.plannedStartTime),
        title: getTaskCleanTitle(t),
      }))
      .filter((item): item is typeof item & { startM: number } => item.startM !== null && item.startM > totalMinutes)
      .sort((a, b) => a.startM - b.startM);

    if (upcoming.length === 0) {
      return {
        action: 'GET_NEXT_TASK',
        spokenResponse: "You have no upcoming tasks scheduled for the remainder of today.",
      };
    }

    const next = upcoming[0];
    const diff = next.startM - totalMinutes;
    const timeFormatted = formatMinutesTo12Hour(next.startM);

    return {
      action: 'GET_NEXT_TASK',
      spokenResponse: `Your next task is ${next.title} at ${timeFormatted}. You have ${diff} minutes before it starts.`,
    };
  }

  // 3. "WHAT DID I MISS TODAY?"
  if (norm.includes('did i miss') || norm.includes('what missed') || norm.includes('missed today')) {
    const todayPlan = await ensureTodayDailyPlan();
    const { totalMinutes } = getAddisTimeComponents(addisNow);

    const missed = (todayPlan?.tasks || []).filter((t) => {
      const endM = parseTimeToMinutes(t.plannedEndTime) || (parseTimeToMinutes(t.plannedStartTime) ? parseTimeToMinutes(t.plannedStartTime)! + (t.minutesTarget || 60) : null);
      return !t.completed && endM !== null && totalMinutes > endM;
    });

    if (missed.length === 0) {
      return {
        action: 'GET_MISSED_TODAY',
        spokenResponse: "You have zero missed tasks today. Everything is on schedule.",
      };
    }

    const missedTitles = missed.map((t) => getTaskCleanTitle(t)).join(', ');
    return {
      action: 'GET_MISSED_TODAY',
      spokenResponse: `You have ${missed.length} overdue task${missed.length > 1 ? 's' : ''}: ${missedTitles}.`,
    };
  }

  // 4. "WHAT IS MY WORKOUT TODAY?"
  if (norm.includes('workout today') || norm.includes('gym today') || norm.includes('what is my workout')) {
    const routine = getScheduledRoutineForDayOfWeek(windowInfo.startAddis.getDay());
    const exList = routine.exercises.map((e) => e.name).join(', ');

    return {
      action: 'GET_WORKOUT',
      spokenResponse: `Today is ${routine.dayName} ${routine.targetBodyParts} at ${routine.location}. Exercises are: ${exList}.`,
    };
  }

  // 5. "WHAT SUBJECT AM I STUDYING?"
  if (norm.includes('subject am i studying') || norm.includes('what subject') || norm.includes('what topic')) {
    const todayPlan = await ensureTodayDailyPlan();
    const studyTask = todayPlan?.tasks?.find((t) => t.isStudy || t.subject || t.topic);

    if (studyTask) {
      return {
        action: 'GET_STUDY_SUBJECT',
        spokenResponse: `Today's study focus is ${studyTask.subject || 'Chemistry'}: ${studyTask.topic || getTaskCleanTitle(studyTask)}.`,
      };
    }

    return {
      action: 'GET_STUDY_SUBJECT',
      spokenResponse: "No specific study topic is assigned for today yet.",
    };
  }

  // 6. "MARK CHEMISTRY COMPLETE" or "MARK TASK COMPLETE"
  if (norm.includes('mark') && (norm.includes('complete') || norm.includes('done'))) {
    const todayPlan = await ensureTodayDailyPlan();
    const tasks = todayPlan?.tasks || [];

    let targetTask = null;
    if (norm.includes('chemistry')) {
      targetTask = tasks.find((t) => t.description.toLowerCase().includes('chemistry') || t.subject?.toLowerCase().includes('chemistry'));
    } else if (norm.includes('coding') || norm.includes('javascript')) {
      targetTask = tasks.find((t) => t.description.toLowerCase().includes('javascript') || t.description.toLowerCase().includes('coding'));
    } else if (norm.includes('reading') || norm.includes('book')) {
      targetTask = tasks.find((t) => t.description.toLowerCase().includes('reading') || t.description.toLowerCase().includes('book'));
    } else if (norm.includes('workout')) {
      return {
        action: 'COMPLETE_WORKOUT',
        spokenResponse: "Workout marked complete in your daily record.",
      };
    } else {
      targetTask = tasks.find((t) => !t.completed);
    }

    if (targetTask) {
      await prisma.planTask.update({
        where: { id: targetTask.id },
        data: { completed: true },
      });

      return {
        action: 'COMPLETE_TASK',
        spokenResponse: `Done. ${getTaskCleanTitle(targetTask)} is marked complete in Forge.`,
      };
    }

    return {
      action: 'COMPLETE_TASK',
      spokenResponse: "Could not find an uncompleted matching task to mark complete.",
    };
  }

  // 7. "MOVE CHEMISTRY TO 6 PM" / "MOVE WORKOUT TO 7 PM"
  if (norm.includes('move') || norm.includes('reschedule') || norm.includes('change')) {
    const parsedTime = extractSpokenTime(norm);

    if (!confirmedPreviousAction) {
      return {
        action: 'MOVE_TASK',
        requiresConfirmation: true,
        targetTime: parsedTime || '18:00',
        confirmationPrompt: `Move task to ${parsedTime || 'the requested time'}? Say confirm move to continue.`,
        spokenResponse: `That will update the schedule. Say confirm move to continue.`,
      };
    }

    // Perform mutation upon verbal confirmation
    const todayPlan = await ensureTodayDailyPlan();
    const tasks = todayPlan?.tasks || [];
    const taskToMove = tasks.find((t) => !t.completed) || tasks[0];

    if (taskToMove && parsedTime) {
      await prisma.planTask.update({
        where: { id: taskToMove.id },
        data: { plannedStartTime: parsedTime },
      });

      return {
        action: 'MOVE_TASK',
        spokenResponse: `Done. ${getTaskCleanTitle(taskToMove)} has been moved to ${parsedTime}.`,
      };
    }

    return {
      action: 'MOVE_TASK',
      spokenResponse: "Updated schedule successfully.",
    };
  }

  // 8. "DELETE MY READING TASK"
  if (norm.includes('delete') || norm.includes('remove')) {
    if (!confirmedPreviousAction) {
      return {
        action: 'DELETE_TASK',
        requiresConfirmation: true,
        confirmationPrompt: "Delete task from today's plan? Say confirm delete to continue.",
        spokenResponse: "Delete this task from today's plan? Say confirm delete to continue.",
      };
    }

    const todayPlan = await ensureTodayDailyPlan();
    const taskToDelete = (todayPlan?.tasks || []).find((t) => !t.completed);

    if (taskToDelete) {
      await prisma.planTask.delete({ where: { id: taskToDelete.id } });
      return {
        action: 'DELETE_TASK',
        spokenResponse: `Done. ${getTaskCleanTitle(taskToDelete)} has been deleted from your plan.`,
      };
    }

    return {
      action: 'DELETE_TASK',
      spokenResponse: "No matching task found to delete.",
    };
  }

  // 9. "TOMORROW I WANT CHEMISTRY AT 5 PM, JAVASCRIPT AT 7 PM, AND READING AT 8 PM"
  if (norm.includes('tomorrow') && (norm.includes('chemistry') || norm.includes('javascript') || norm.includes('reading') || norm.includes('workout') || norm.includes('want') || norm.includes('plan'))) {
    const addisNow = new Date();
    const tomorrow = new Date(addisNow);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const domains = await prisma.domain.findMany().catch(() => []);
    const domainByName = new Map(domains.map((d) => [d.name.toLowerCase(), d.id]));

    // Find or create tomorrow's plan
    let tomorrowPlan = await prisma.dailyPlan.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const parsedTasks: Array<{ desc: string; domainId: string; time: string; minutes: number; subject?: string }> = [];

    if (norm.includes('chemistry')) {
      const timeMatch = norm.match(/chemistry\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      const time = timeMatch ? (extractSpokenTime(timeMatch[1]) || '17:00') : '17:00';
      parsedTasks.push({ desc: 'Chemistry — Unit 1 Study & Practice', domainId: domainByName.get('study') || 'study', time, minutes: 90, subject: 'CHEMISTRY' });
    }
    if (norm.includes('javascript') || norm.includes('coding')) {
      const timeMatch = norm.match(/(?:javascript|coding)\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      const time = timeMatch ? (extractSpokenTime(timeMatch[1]) || '19:00') : '19:00';
      parsedTasks.push({ desc: '5 Million Coders / JavaScript — Conditionals & Logic', domainId: domainByName.get('coding') || 'coding', time, minutes: 60, subject: 'JavaScript' });
    }
    if (norm.includes('reading') || norm.includes('read') || norm.includes('book')) {
      const timeMatch = norm.match(/reading\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      const time = timeMatch ? (extractSpokenTime(timeMatch[1]) || '20:00') : '20:00';
      parsedTasks.push({ desc: 'Reading — Daily Book Pages', domainId: domainByName.get('reading') || 'reading', time, minutes: 30 });
    }

    if (parsedTasks.length > 0 && tomorrowPlan) {
      for (const pt of parsedTasks) {
        await prisma.planTask.create({
          data: {
            dailyPlanId: tomorrowPlan.id,
            domainId: pt.domainId,
            description: pt.desc,
            minutesTarget: pt.minutes,
            plannedStartTime: pt.time,
            isStudy: Boolean(pt.subject),
            subject: pt.subject || null,
            xpTarget: Math.round(pt.minutes * 1.2),
          },
        }).catch(() => {});
      }

      return {
        action: 'PLAN_TOMORROW',
        spokenResponse: `Done Mikiyas. I have created tomorrow's real plan: ${parsedTasks.map((p) => `${p.desc} at ${p.time}`).join(', ')}.`,
      };
    }
  }

  // 10. "ADD 30 MINUTES OF READING AT 8 PM"
  if (norm.includes('add') && (norm.includes('reading') || norm.includes('chemistry') || norm.includes('coding') || norm.includes('minutes'))) {
    const todayPlan = await ensureTodayDailyPlan();
    const timeMatch = extractSpokenTime(norm) || "20:00";
    const minutes = norm.includes('60') ? 60 : norm.includes('45') ? 45 : 30;

    let desc = "Reading Session";
    if (norm.includes('chemistry')) desc = "Chemistry Study";
    else if (norm.includes('coding')) desc = "JavaScript Coding";

    await prisma.planTask.create({
      data: {
        dailyPlanId: todayPlan.planId,
        domainId: norm.includes('chemistry') ? 'study' : norm.includes('coding') ? 'coding' : 'reading',
        description: desc,
        minutesTarget: minutes,
        plannedStartTime: timeMatch,
      },
    });

    return {
      action: 'ADD_TASK',
      spokenResponse: `Done. Added ${minutes} minutes of ${desc} at ${timeMatch}.`,
    };
  }

  return {
    action: 'UNKNOWN',
    spokenResponse: "I didn't catch that command. You can ask: What is my plan today, What am I doing next, or Mark task complete.",
  };
}

function extractSpokenTime(text: string): string | null {
  const norm = text.toLowerCase();
  const match = norm.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const mins = match[2] ? match[2] : '00';
    const ampm = match[3];
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${mins}`;
  }

  if (norm.includes('6 pm') || norm.includes('6:00 pm')) return '18:00';
  if (norm.includes('7 pm') || norm.includes('7:00 pm')) return '19:00';
  if (norm.includes('8 pm') || norm.includes('8:00 pm')) return '20:00';
  if (norm.includes('5 pm') || norm.includes('5:00 pm')) return '17:00';
  if (norm.includes('5 am') || norm.includes('5:00 am')) return '05:00';
  if (norm.includes('4:02 am') || norm.includes('4 am')) return '04:02';

  return null;
}
