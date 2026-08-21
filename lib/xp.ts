// XP and Level computation for FORGE

export const BASE_RATE = 10 // XP per minute per domain weight unit

export function computeXp(minutes: number, domainWeight: number): number {
  return Math.round(minutes * domainWeight * BASE_RATE)
}

export function computeLevel(totalXp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(totalXp / 100)))
}

export function xpForNextLevel(currentLevel: number): number {
  return Math.pow(currentLevel + 1, 2) * 100
}

export function xpForCurrentLevel(currentLevel: number): number {
  return Math.pow(currentLevel, 2) * 100
}

export function levelProgress(totalXp: number): {
  level: number
  currentLevelXp: number
  nextLevelXp: number
  progress: number // 0-1
} {
  const level = computeLevel(totalXp)
  const currentLevelXp = xpForCurrentLevel(level)
  const nextLevelXp = xpForNextLevel(level)
  const progress = (totalXp - currentLevelXp) / (nextLevelXp - currentLevelXp)
  return { level, currentLevelXp, nextLevelXp, progress: Math.min(1, Math.max(0, progress)) }
}

// Variable bonus XP — not predictable/fixed, so users can't game it
export function computeStreakBonus(streakCount: number): number {
  if (streakCount === 14) return 500   // lock-in bonus
  if (streakCount === 7) return 200    // week milestone
  if (streakCount === 30) return 1000  // month milestone
  if (streakCount === 21) return 600   // 3-week milestone
  // Occasional random bonus for streaks > 3 (roughly 1 in 5 chance)
  if (streakCount > 3 && Math.random() < 0.2) {
    return Math.round(50 + Math.random() * 150) // 50–200 bonus
  }
  return 0
}

export function computeBalanceDayBonus(
  domainsHitToday: number,
  totalDomains: number
): number {
  if (domainsHitToday === totalDomains) return 300 // full balance day
  if (domainsHitToday >= Math.ceil(totalDomains * 0.8)) return 100
  return 0
}
