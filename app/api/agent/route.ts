import { NextRequest, NextResponse } from 'next/server'
import type { Content, Part } from '@google/genai'
import { prisma } from '@/lib/prisma'
import { AGENT_TOOLS, handleToolCall } from '@/lib/agentTools'
import { getDaysToExam, getTaperStage } from '@/lib/taperCurve'
import { GEMINI_MODEL, gemini } from '@/lib/gemini'


const SYSTEM_PROMPT = `You are the FORGE schedule agent — a direct, no-nonsense AI assistant that manages Mikiyas's daily plan and habits.

Your personality: blunt, specific, efficient. No filler phrases. If something is wrong, say so plainly. If something is good, acknowledge it briefly and move on.

Your capabilities (via tools):
- Create, update, retire, and delete habits (hard cap: max 4 active habits — you CANNOT bypass this)
- Add, remove, and reschedule tasks in today's plan

Rules:
- For destructive actions (delete habit with active streak > 0), always ask for explicit confirmation before calling the tool
- For low-stakes changes (add task, reschedule time), act immediately without asking
- Every action is logged — nothing is silent
- The 4-habit cap is absolute. If the user asks you to add a 5th, explain why it's a feature and suggest retiring one instead
- Give specific suggestions, not vague ones ("Add a 45-min Python session at 3pm" not "add some coding time")`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const clientMessages = body.history || body.messages

    if (!Array.isArray(clientMessages) || clientMessages.length === 0) {
      return NextResponse.json({ error: 'message and history are required' }, { status: 400 })
    }

    // Get context for the agent
    const [habits, profile, todayPlan] = await Promise.all([
      prisma.habit.findMany({ where: { active: true }, include: { domain: true } }),
      prisma.userProfile.findUnique({ where: { id: 'singleton' } }),
      prisma.dailyPlan.findUnique({
        where: { date: new Date(new Date().toDateString()) },
        include: { tasks: true },
      }),
    ])

    const contextNote = profile ? `
Current context:
- Days to exam: ${getDaysToExam(profile.examDate)} (${getTaperStage(profile.examDate)})
- Active habits: ${habits.map(h => `${h.name} (${h.streakCount}d streak)`).join(', ') || 'none'}
- Today's plan: ${todayPlan?.tasks.map(t => `${t.description} (${t.minutesTarget}min, ${t.completed ? 'done' : 'pending'})`).join('; ') || 'no plan yet'}
` : ''

    const lastMessage = clientMessages[clientMessages.length - 1]
    const history = clientMessages.slice(0, -1).map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
    const fullMessages: Content[] = [...history, { role: 'user', parts: [{ text: `${contextNote}\n\n${lastMessage.content}` }] }]
    const config = { systemInstruction: SYSTEM_PROMPT, tools: [{ functionDeclarations: AGENT_TOOLS }] }

    // Agentic loop
    let response = await gemini.models.generateContent({ model: GEMINI_MODEL, contents: fullMessages, config })

    const actionsTaken: string[] = []
    const loopMessages = [...fullMessages]

    // Handle tool use loop
    while (response.functionCalls?.length) {
      loopMessages.push({ role: 'model', parts: response.candidates?.[0]?.content?.parts || [] })
      const toolResults: Part[] = []

      for (const toolUse of response.functionCalls) {
        const result = await handleToolCall(toolUse.name || '', (toolUse.args || {}) as Record<string, unknown>)

        if (result.actionTaken) {
          actionsTaken.push(result.actionTaken)

        }

        const toolResponse = result.success ? result.data || { success: true } : { error: result.error }
        toolResults.push({ functionResponse: { name: toolUse.name || '', response: toolResponse as Record<string, unknown> } })
      }

      loopMessages.push({ role: 'user', parts: toolResults })
      response = await gemini.models.generateContent({ model: GEMINI_MODEL, contents: loopMessages, config })
    }

    const agentText = response.text || ''

    // Save user and agent messages
    const userContent = clientMessages[clientMessages.length - 1].content
    await prisma.chatMessage.createMany({
      data: [
        { role: 'user', content: userContent },
        { role: 'agent', content: agentText, actionTaken: actionsTaken.join('; ') || null },
      ],
    })

    return NextResponse.json({
      message: agentText,
      actionsTaken,
    })
  } catch (error) {
    console.error('Agent error:', error)
    return NextResponse.json({ error: 'Agent failed', detail: String(error) }, { status: 500 })
  }
}

export async function GET() {
  const messages = await prisma.chatMessage.findMany({
    orderBy: { createdAt: 'asc' },
    take: 50,
  })
  return NextResponse.json(messages)
}
