export const PHASE_SCHEDULE = [
  { weeks: [1, 2], sets: 3, reps: '12-15', goal: 'Learn the movements' },
  { weeks: [3, 4], sets: 3, reps: '10-12', goal: 'Add weight' },
  { weeks: [5, 6], sets: 4, reps: '10-12', goal: 'More volume' },
  { weeks: [7, 8], sets: 4, reps: '8-10', goal: 'Go heavier' },
  { weeks: [9, 10], sets: 4, reps: '8-10', goal: 'Heavier again' },
  { weeks: [11, 12], sets: 4, reps: '6-8', goal: 'Strength phase' },
  { weeks: [13, 14], sets: 5, reps: '8-10', goal: 'Peak volume' },
  { weeks: [15, 16], sets: 5, reps: '6-8', goal: 'Heavy + volume' },
  { weeks: [17, 18], sets: 4, reps: '8-10', goal: 'Reload then push' },
  { weeks: [19, 20], sets: 5, reps: '6-8', goal: 'Intensify' },
  { weeks: [21, 22], sets: 5, reps: '5-6', goal: 'Near max' },
  { weeks: [23, 24], sets: 4, reps: '8-12', goal: 'Peak and show' },
] as const

export const getCurrentWeek = (startDate: Date) => Math.min(24, Math.max(1, Math.ceil((Date.now() - startDate.getTime()) / 604800000)))
export const getPhase = (week: number) => PHASE_SCHEDULE.find((phase) => phase.weeks.includes(week as never)) ?? PHASE_SCHEDULE[0]