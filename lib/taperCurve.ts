// Taper curve logic — automatically shifts study weight as exam approaches

export interface DomainAllocation {
  domainName: string
  weight: number
  targetPercent: number
}

/**
 * Returns the Study domain weight multiplier based on months remaining until exam.
 * This is the core of the exam-aware scheduling system.
 */
export function getStudyWeight(examDate: Date): number {
  const now = new Date()
  const msPerMonth = 1000 * 60 * 60 * 24 * 30.44
  const monthsRemaining = (examDate.getTime() - now.getTime()) / msPerMonth

  if (monthsRemaining > 5) return 1.0       // 7–5 months: equal footing
  if (monthsRemaining > 3) return 1.5       // 4–3 months: slight priority
  if (monthsRemaining > 1) return 2.5       // 2 months: strong priority
  return 4.0                                 // Final month: dominant priority
}

/**
 * Returns current taper stage label for display.
 */
export function getTaperStage(examDate: Date): string {
  const now = new Date()
  const msPerMonth = 1000 * 60 * 60 * 24 * 30.44
  const monthsRemaining = (examDate.getTime() - now.getTime()) / msPerMonth

  if (monthsRemaining > 5) return 'Foundation Phase'
  if (monthsRemaining > 3) return 'Acceleration Phase'
  if (monthsRemaining > 1) return 'Priority Phase'
  if (monthsRemaining > 0) return 'Final Push'
  return 'Exam Passed'
}

/**
 * Returns days remaining until exam date.
 */
export function getDaysToExam(examDate: Date): number {
  const now = new Date()
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.max(0, Math.ceil((examDate.getTime() - now.getTime()) / msPerDay))
}

/**
 * Returns the target time allocation percentages for each domain given current taper stage.
 * Study weight shifts; other domains share the remaining equally (adjusted for their own weights).
 */
export function getTargetAllocation(
  examDate: Date,
  domains: { name: string; weight: number }[]
): Record<string, number> {
  const studyWeight = getStudyWeight(examDate)

  // Build effective weights: Study uses taper weight, others use their stored weight
  const effectiveWeights: Record<string, number> = {}
  let totalWeight = 0

  for (const d of domains) {
    const w = d.name === 'Study' ? studyWeight : d.weight
    effectiveWeights[d.name] = w
    totalWeight += w
  }

  const allocation: Record<string, number> = {}
  for (const [name, w] of Object.entries(effectiveWeights)) {
    allocation[name] = (w / totalWeight) * 100
  }

  return allocation
}

/**
 * Compute a balance score (0–100) comparing actual time allocation to target.
 * 100 = perfect match. Deduct points for each domain deviation.
 */
export function computeBalanceScore(
  actual: Record<string, number>, // domain -> minutes
  target: Record<string, number>  // domain -> percent
): number {
  const totalActual = Object.values(actual).reduce((a, b) => a + b, 0)
  if (totalActual === 0) return 0

  let totalDeviation = 0
  for (const [domain, targetPct] of Object.entries(target)) {
    const actualPct = ((actual[domain] ?? 0) / totalActual) * 100
    totalDeviation += Math.abs(actualPct - targetPct)
  }

  // Max possible deviation is 200 (one domain at 100%, rest at 0%)
  return Math.max(0, Math.round(100 - (totalDeviation / 200) * 100))
}
