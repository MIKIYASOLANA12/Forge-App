import { prisma } from './prisma'
import { generateGeminiJson } from './gemini'
import { getStudyWeight, getTaperStage, getDaysToExam } from './taperCurve'
import { subDays, startOfDay, format } from 'date-fns'

export interface PlanTask {
  domainId: string
  domainName: string
  description: string
  minutesTarget: number
}

export interface GeneratedPlan {
  tasks: PlanTask[]
  rawResponse: string
}

export async function buildPlannerContext(date: Date) {
  const [domains, profile, habits, habitLogs, sessions, reflections] = await Promise.all([
    prisma.domain.findMany(),
    prisma.userProfile.findUnique({ where: { id: 'singleton' } }),
    prisma.habit.findMany({ where: { active: true }, include: { domain: true } }),
    prisma.habitLog.findMany({
      where: {
        date: { gte: subDays(new Date(), 14) },
      },
      include: { habit: true },
      orderBy: { date: 'desc' },
    }),
    prisma.session.findMany({
      where: {
        startedAt: { gte: subDays(new Date(), 14) },
      },
      include: { domain: true },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.reflection.findMany({
      orderBy: { date: 'desc' },
      take: 7,
    }),
  ])

  if (!profile) throw new Error('UserProfile not found')

  const daysToExam = getDaysToExam(profile.examDate)
  const taperStage = getTaperStage(profile.examDate)
  const studyWeight = getStudyWeight(profile.examDate)

  // Aggregate sessions by domain for the last 14 days
  const sessionsByDomain = domains.map(d => {
    const domainSessions = sessions.filter(s => s.domainId === d.id)
    const totalMinutes = domainSessions.reduce((sum, s) => sum + s.minutes, 0)
    const days = new Set(domainSessions.map(s => format(s.startedAt, 'yyyy-MM-dd'))).size
    return {
      domain: d.name,
      color: d.color,
      totalMinutes,
      avgMinutesPerDay: days > 0 ? Math.round(totalMinutes / days) : 0,
      sessionCount: domainSessions.length,
    }
  })

  // Habit status
  const habitStatus = habits.map(h => ({
    name: h.name,
    domain: h.domain.name,
    streak: h.streakCount,
    locked: h.streakCount >= 14,
    lastCompleted: h.lastCompletedAt ? format(h.lastCompletedAt, 'yyyy-MM-dd') : null,
    todayDone: habitLogs.some(
      l => l.habitId === h.id && format(l.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') && l.completed
    ),
  }))

  // Last reflections
  const reflectionSummary = reflections.map(r => ({
    date: format(r.date, 'yyyy-MM-dd'),
    whatWorked: r.whatWorked,
    tomorrowKey: r.tomorrowKey,
  }))

  return {
    today: format(date, 'EEEE, MMMM d, yyyy'),
    daysToExam,
    taperStage,
    studyWeight,
    sessionsByDomain,
    habitStatus,
    reflections: reflectionSummary,
    domainIds: Object.fromEntries(domains.map(d => [d.name, d.id])),
  }
}

export async function generateDailyPlan(date: Date): Promise<GeneratedPlan> {
  const ctx = await buildPlannerContext(date)

  const systemPrompt = `You are the FORGE AI planner — a blunt, high-performance personal coach for Mikiyas, a disciplined 17-year-old running a 7-month self-development program.

Your job: generate a concrete, actionable daily plan. No fluff, no vague language, no "great job!" encouragement.

Rules:
- Return ONLY valid JSON — no markdown, no prose outside the JSON
- Generate exactly 4–5 tasks across different domains
- Each task must be specific ("Solve 15 quadratic equations, 40 min") — never vague ("study math")
- Time targets must be realistic for one day total (max 5 hours across all tasks)
- Study gets weight ${ctx.studyWeight}x today (${ctx.taperStage}, ${ctx.daysToExam} days to exam) — reflect this in time allocation
- If a habit isn't done today, include a task that covers it
- Never suggest tasks the user consistently skips — check the session history
- Domains with 0 sessions in the last 7 days need a task today unless exam pressure justifies skipping

Domain IDs:
${JSON.stringify(ctx.domainIds, null, 2)}`

  const userPrompt = `Today: ${ctx.today}
Days to exam: ${ctx.daysToExam} (${ctx.taperStage})
Study weight multiplier: ${ctx.studyWeight}x

Last 14 days by domain:
${JSON.stringify(ctx.sessionsByDomain, null, 2)}

Active habits:
${JSON.stringify(ctx.habitStatus, null, 2)}

Last 7 reflections:
${JSON.stringify(ctx.reflections, null, 2)}

Generate today's plan. Return JSON only in this exact shape:
{
  "tasks": [
    {
      "domainId": "<id from Domain IDs above>",
      "domainName": "<domain name>",
      "description": "<specific concrete task, 1 sentence>",
      "minutesTarget": <number>
    }
  ]
}`

  const { parsed, raw: rawResponse } = await generateGeminiJson<{ tasks: PlanTask[] }>(userPrompt, {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            domainId: { type: 'string' },
            domainName: { type: 'string' },
            description: { type: 'string' },
            minutesTarget: { type: 'integer' },
          },
          required: ['domainId', 'domainName', 'description', 'minutesTarget'],
        },
      },
    },
    required: ['tasks'],
  }, systemPrompt)

  if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
    throw new Error('Invalid plan structure')
  }

  return { tasks: parsed.tasks, rawResponse }
}
