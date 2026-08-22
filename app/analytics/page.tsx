import { prisma } from '@/lib/prisma'
import { getStudyWeight } from '@/lib/taperCurve'
import { levelProgress } from '@/lib/xp'
import AnalyticsDashboard from './AnalyticsDashboard'

export default async function AnalyticsPage() {
  const [profile, domains, habits] = await Promise.all([
    prisma.userProfile.findUnique({ where: { id: 'singleton' } }),
    prisma.domain.findMany({ orderBy: { name: 'asc' } }),
    prisma.habit.findMany({ where: { active: true }, orderBy: { streakCount: 'desc' }, select: { id: true, name: true, streakCount: true } }),
  ])
  const xp = levelProgress(profile?.totalXp ?? 0)
  return <AnalyticsDashboard profile={{ examDate: profile?.examDate.toISOString() ?? null, totalXp: profile?.totalXp ?? 0, level: xp.level, progress: xp.progress, nextLevelXp: xp.nextLevelXp }} studyWeight={profile ? getStudyWeight(profile.examDate) : 1} domains={domains.map(({ name, color }) => ({ name, color }))} habits={habits} />
}