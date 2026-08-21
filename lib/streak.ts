import { prisma } from './prisma'

/**
 * Check all active habits for missed days and reset streaks as needed.
 * Should be called once at app startup (via middleware or layout server component).
 */
export async function checkAndResetStreaks(): Promise<void> {
  const habits = await prisma.habit.findMany({
    where: { active: true },
  })

  const now = new Date()
  const updates: Promise<unknown>[] = []

  for (const habit of habits) {
    if (!habit.lastCompletedAt) continue

    const msPerDay = 1000 * 60 * 60 * 24
    const hoursSinceLast = (now.getTime() - habit.lastCompletedAt.getTime()) / (1000 * 60 * 60)

    // If more than 36 hours since last completion (allowing some grace on same day),
    // and streakCount > 0, reset the streak
    if (hoursSinceLast > 36 && habit.streakCount > 0) {
      updates.push(
        prisma.habit.update({
          where: { id: habit.id },
          data: {
            streakCount: 0,
            streakStartedAt: null,
          },
        })
      )
    }
  }

  await Promise.all(updates)
}

/**
 * Returns whether a habit has "locked in" (14-day unbroken streak).
 * Locked habits show as filled rings in the UI.
 */
export function isHabitLocked(streakCount: number): boolean {
  return streakCount >= 14
}

/**
 * Returns the number of hours until a streak is at risk.
 * Used for push notification timing.
 */
export function hoursUntilStreakAtRisk(lastCompletedAt: Date | null): number | null {
  if (!lastCompletedAt) return null
  const now = new Date()
  const hoursElapsed = (now.getTime() - lastCompletedAt.getTime()) / (1000 * 60 * 60)
  const hoursLeft = 36 - hoursElapsed
  return Math.max(0, hoursLeft)
}

/**
 * Counts currently active habits (system-wide, not per domain).
 * Used to enforce the 4-habit cap.
 */
export async function countActiveHabits(): Promise<number> {
  return prisma.habit.count({ where: { active: true } })
}

export const MAX_ACTIVE_HABITS = 4
