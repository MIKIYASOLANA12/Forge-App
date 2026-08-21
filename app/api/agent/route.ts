import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { AGENT_TOOLS, handleToolCall } from '@/lib/agentTools'
import { getDaysToExam, getTaperStage } from '@/lib/taperCurve'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
    const { messages: clientMessages } = body

    if (!Array.isArray(clientMessages)) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 })
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

    // Build messages for Claude
    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: `${contextNote}\n\n${clientMessages[clientMessages.length - 1].content}`,
      },
    ]

    // Add previous messages (skip the last one we just added)
    const history = clientMessages.slice(0, -1).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    const fullMessages: Anthropic.MessageParam[] = [...history, messages[0]]

    // Agentic loop
    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: AGENT_TOOLS,
      messages: fullMessages,
    })

    const actionsTaken: string[] = []
    const loopMessages: Anthropic.MessageParam[] = [...fullMessages]

    // Handle tool use loop
    while (response.stop_reason === 'tool_use') {
      const toolUses = response.content.filter(b => b.type === 'tool_use')
      
      loopMessages.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const toolUse of toolUses) {
        if (toolUse.type !== 'tool_use') continue

        const result = await handleToolCall(toolUse.name, toolUse.input as Record<string, unknown>)

        if (result.actionTaken) {
          actionsTaken.push(result.actionTaken)

          // Log to ChatMessage
          await prisma.chatMessage.create({
            data: {
              role: 'agent',
              content: `[Tool: ${toolUse.name}]`,
              actionTaken: result.actionTaken,
            },
          })
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result.success ? result.data || { success: true } : { error: result.error }),
          is_error: !result.success,
        })
      }

      loopMessages.push({ role: 'user', content: toolResults })

      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: AGENT_TOOLS,
        messages: loopMessages,
      })
    }

    const agentText = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('\n')

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
    take: 100,
  })
  return NextResponse.json(messages)
}
