import { Type, type FunctionDeclaration } from '@google/genai'
import { prisma } from './prisma'
import { countActiveHabits, MAX_ACTIVE_HABITS } from './streak'

// ── Tool Definitions ───────────────────────────────────────────────────────

export const AGENT_TOOLS: FunctionDeclaration[] = [
  {
    name: 'createHabit',
    description: 'Create a new active habit. Will fail if 4 habits are already active — the cap cannot be bypassed.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        domainId: { type: Type.STRING, description: 'Domain ID for the habit' },
        name: { type: Type.STRING, description: 'Habit name — specific and measurable' },
      },
      required: ['domainId', 'name'],
    },
  },
  {
    name: 'updateHabit',
    description: 'Rename or retire an active habit. Retiring frees a slot for a new one.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        habitId: { type: Type.STRING },
        name: { type: Type.STRING, description: 'New name (optional)' },
        retire: { type: Type.BOOLEAN, description: 'Set true to retire (deactivate) the habit' },
      },
      required: ['habitId'],
    },
  },
  {
    name: 'deleteHabit',
    description: 'Permanently delete a habit. REQUIRES explicit confirmation if the habit has an active streak > 0. Ask the user before calling this.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        habitId: { type: Type.STRING },
        confirmed: { type: Type.BOOLEAN, description: 'Must be true if the habit has an active streak' },
      },
      required: ['habitId', 'confirmed'],
    },
  },
  {
    name: 'addPlanTask',
    description: 'Add a task to today\'s plan.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        domainId: { type: Type.STRING },
        description: { type: Type.STRING },
        minutesTarget: { type: Type.NUMBER },
      },
      required: ['domainId', 'description', 'minutesTarget'],
    },
  },
  {
    name: 'removePlanTask',
    description: 'Remove a task from today\'s plan.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskId: { type: Type.STRING },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'rescheduleTask',
    description: 'Update a plan task description or time target.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskId: { type: Type.STRING },
        description: { type: Type.STRING },
        minutesTarget: { type: Type.NUMBER },
      },
      required: ['taskId'],
    },
  },
]

// ── Tool Handlers ──────────────────────────────────────────────────────────

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
  actionTaken?: string
}

export async function handleToolCall(name: string, input: Record<string, unknown>): Promise<ToolResult> {
  try {
    switch (name) {
      case 'createHabit': {
        const { domainId, name: habitName } = input as { domainId: string; name: string }

        // Enforce cap — no exceptions
        const activeCount = await countActiveHabits()
        if (activeCount >= MAX_ACTIVE_HABITS) {
          return {
            success: false,
            error: `Cannot create habit: ${MAX_ACTIVE_HABITS} habits are already active. Retire one first.`,
          }
        }

        const domain = await prisma.domain.findUnique({ where: { id: domainId } })
        if (!domain) return { success: false, error: 'Domain not found' }

        const habit = await prisma.habit.create({
          data: { domainId, name: habitName },
          include: { domain: true },
        })

        return {
          success: true,
          data: habit,
          actionTaken: `Created habit "${habitName}" in ${domain.name} domain`,
        }
      }

      case 'updateHabit': {
        const { habitId, name: newName, retire } = input as { habitId: string; name?: string; retire?: boolean }

        const habit = await prisma.habit.findUnique({ where: { id: habitId } })
        if (!habit) return { success: false, error: 'Habit not found' }

        const updates: Record<string, unknown> = {}
        if (newName) updates.name = newName.trim()
        if (retire) updates.active = false

        const updated = await prisma.habit.update({ where: { id: habitId }, data: updates })

        return {
          success: true,
          data: updated,
          actionTaken: retire
            ? `Retired habit "${habit.name}"`
            : `Renamed habit to "${newName}"`,
        }
      }

      case 'deleteHabit': {
        const { habitId, confirmed } = input as { habitId: string; confirmed: boolean }

        const habit = await prisma.habit.findUnique({ where: { id: habitId } })
        if (!habit) return { success: false, error: 'Habit not found' }

        if (habit.streakCount > 0 && !confirmed) {
          return {
            success: false,
            error: `This habit has an active ${habit.streakCount}-day streak. Confirm deletion explicitly before proceeding.`,
          }
        }

        await prisma.habit.delete({ where: { id: habitId } })
        return {
          success: true,
          actionTaken: `Deleted habit "${habit.name}" (had ${habit.streakCount}-day streak)`,
        }
      }

      case 'addPlanTask': {
        const { domainId, description, minutesTarget } = input as {
          domainId: string
          description: string
          minutesTarget: number
        }

        // Get or create today's plan
        const today = new Date()
        const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())

        let plan = await prisma.dailyPlan.findUnique({ where: { date: dayStart } })
        if (!plan) {
          plan = await prisma.dailyPlan.create({ data: { date: dayStart, generatedByAI: false } })
        }

        const task = await prisma.planTask.create({
          data: { dailyPlanId: plan.id, domainId, description, minutesTarget },
        })

        return {
          success: true,
          data: task,
          actionTaken: `Added task "${description}" (${minutesTarget} min) to today's plan`,
        }
      }

      case 'removePlanTask': {
        const { taskId } = input as { taskId: string }

        const task = await prisma.planTask.findUnique({ where: { id: taskId } })
        if (!task) return { success: false, error: 'Task not found' }

        await prisma.planTask.delete({ where: { id: taskId } })
        return {
          success: true,
          actionTaken: `Removed task "${task.description}" from today's plan`,
        }
      }

      case 'rescheduleTask': {
        const { taskId, description, minutesTarget } = input as {
          taskId: string
          description?: string
          minutesTarget?: number
        }

        const task = await prisma.planTask.findUnique({ where: { id: taskId } })
        if (!task) return { success: false, error: 'Task not found' }

        const updates: Record<string, unknown> = {}
        if (description) updates.description = description
        if (minutesTarget) updates.minutesTarget = minutesTarget

        const updated = await prisma.planTask.update({ where: { id: taskId }, data: updates })
        return {
          success: true,
          data: updated,
          actionTaken: `Updated task: ${description ? `description changed` : ''} ${minutesTarget ? `time target → ${minutesTarget} min` : ''}`.trim(),
        }
      }

      default:
        return { success: false, error: `Unknown tool: ${name}` }
    }
  } catch (error) {
    console.error(`Tool ${name} error:`, error)
    return { success: false, error: String(error) }
  }
}
