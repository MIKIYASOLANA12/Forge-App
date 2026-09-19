import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserFromRequest } from '@/lib/auth';

const shape = (profile: any, pref: any) => ({
  examDate: profile?.examDate,
  planStartDate: profile?.planStartDate,
  totalXp: profile?.totalXp || 0,
  level: profile?.level || 1,
  targetCalories: profile?.targetCalories || 2500,
  targetProtein: profile?.targetProtein || 150,
  targetCarbs: profile?.targetCarbs || 300,
  targetFat: profile?.targetFat || 80,
  wakeTime: pref?.wakeTime || '04:02',
  sleepTime: pref?.sleepTime || '23:00',
  voiceCallsEnabled: pref?.voiceCallsEnabled ?? true,
  phoneNumber: pref?.phoneNumber || '',
  dailyCallBudget: pref?.dailyCallBudget || 10,
});

export async function GET(req: NextRequest) {
  const session = await getSessionUserFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [profile, pref] = await Promise.all([
    prisma.userProfile.findUnique({ where: { id: 'singleton' } }),
    prisma.notificationPreference.findUnique({ where: { id: 'singleton' } }),
  ]);

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  return NextResponse.json(shape(profile, pref));
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionUserFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const profileUpdates: any = {};
  const prefUpdates: any = {};

  if (body.examDate && !Number.isNaN(new Date(body.examDate).getTime())) {
    profileUpdates.examDate = new Date(body.examDate);
  }

  if (body.wakeTime && typeof body.wakeTime === 'string') {
    prefUpdates.wakeTime = body.wakeTime.trim();
  }

  if (body.sleepTime && typeof body.sleepTime === 'string') {
    prefUpdates.sleepTime = body.sleepTime.trim();
  }

  if (body.phoneNumber !== undefined) {
    prefUpdates.phoneNumber = body.phoneNumber?.trim() || null;
  }

  if (body.voiceCallsEnabled !== undefined) {
    prefUpdates.voiceCallsEnabled = Boolean(body.voiceCallsEnabled);
  }

  const [updatedProfile, updatedPref] = await Promise.all([
    Object.keys(profileUpdates).length > 0
      ? prisma.userProfile.update({ where: { id: 'singleton' }, data: profileUpdates })
      : prisma.userProfile.findUnique({ where: { id: 'singleton' } }),
    Object.keys(prefUpdates).length > 0
      ? prisma.notificationPreference.upsert({
          where: { id: 'singleton' },
          create: { id: 'singleton', ...prefUpdates },
          update: prefUpdates,
        })
      : prisma.notificationPreference.findUnique({ where: { id: 'singleton' } }),
  ]);

  return NextResponse.json(shape(updatedProfile, updatedPref));
}