import { google } from 'googleapis';
import { prisma } from './prisma';
import { getAddisNow, workoutWindowForAddisDate, TIMEZONE } from './workoutTime';

const calendar = google.calendar('v3');

export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || 'FORGE_GOOGLE_CLIENT_ID_PLACEHOLDER';
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || 'FORGE_GOOGLE_CLIENT_SECRET_PLACEHOLDER';
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    `${(process.env.NEXT_PUBLIC_APP_URL || process.env.FORGE_PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/calendar/auth/callback`;

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGoogleAuthUrl(): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  });
}

export async function saveGoogleTokens(tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
}) {
  if (!tokens.access_token) {
    throw new Error('No access token received from Google OAuth');
  }

  const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date)
    : new Date(Date.now() + 3600 * 1000);

  const existing = await prisma.googleCalendarToken.findUnique({
    where: { id: 'singleton' },
  });

  const refreshToken = tokens.refresh_token || existing?.refreshToken || '';

  return prisma.googleCalendarToken.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      accessToken: tokens.access_token,
      refreshToken,
      expiresAt,
    },
    update: {
      accessToken: tokens.access_token,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      expiresAt,
    },
  });
}

export async function getAuthenticatedCalendarClient() {
  const tokenRecord = await prisma.googleCalendarToken.findUnique({
    where: { id: 'singleton' },
  });

  if (!tokenRecord || !tokenRecord.accessToken) {
    return null;
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokenRecord.accessToken,
    refresh_token: tokenRecord.refreshToken,
    expiry_date: tokenRecord.expiresAt.getTime(),
  });

  // Check if token is expired (with 2 min buffer)
  if (tokenRecord.expiresAt.getTime() - Date.now() < 120 * 1000 && tokenRecord.refreshToken) {
    try {
      const refreshed = await oauth2Client.refreshAccessToken();
      await saveGoogleTokens(refreshed.credentials);
      oauth2Client.setCredentials(refreshed.credentials);
    } catch (err) {
      console.error('Error refreshing Google Calendar access token:', err);
    }
  }

  return oauth2Client;
}

export async function isGoogleCalendarConnected(): Promise<boolean> {
  const token = await prisma.googleCalendarToken.findUnique({
    where: { id: 'singleton' },
  });
  return Boolean(token && token.accessToken);
}

export async function disconnectGoogleCalendar() {
  return prisma.googleCalendarToken.deleteMany({
    where: { id: 'singleton' },
  });
}

/**
 * Real Event Sync Engine
 * Syncs Forge planned tasks and scheduled workouts into Google Calendar using Africa/Addis_Ababa timezone.
 * Updates existing events if googleEventId exists to prevent duplicate creation.
 */
export async function syncForgePlanToGoogleCalendar() {
  const authClient = await getAuthenticatedCalendarClient();
  if (!authClient) {
    return {
      success: false,
      synced: 0,
      reason: 'Google Calendar is not connected. Please complete OAuth flow.',
    };
  }

  const addisNow = getAddisNow();
  const { startUtc, endUtc } = workoutWindowForAddisDate(addisNow);

  // Fetch recent & upcoming plans
  const plans = await prisma.dailyPlan.findMany({
    where: {
      date: { gte: new Date(startUtc.getTime() - 2 * 24 * 60 * 60 * 1000) },
    },
    include: { tasks: true },
    orderBy: { date: 'asc' },
  });

  const domains = await prisma.domain.findMany();
  const domainMap = new Map(domains.map((d) => [d.id, d.name]));

  let syncedCount = 0;
  const errors: string[] = [];

  for (const plan of plans) {
    const planDateStr = plan.date.toISOString().split('T')[0];

    for (const task of plan.tasks) {
      const dName = domainMap.get(task.domainId) || 'Task';
      let title = 'Forge Planned Task';
      let startTimeStr = '09:00';
      let endTimeStr = '10:00';
      let description = '';

      try {
        const parsed = JSON.parse(task.description);
        title = parsed.title || parsed.description || title;
        description = parsed.description || '';
        if (parsed.startTime) startTimeStr = parsed.startTime;
        if (parsed.endTime) endTimeStr = parsed.endTime;
      } catch {
        title = task.description || title;
      }

      // Construct start & end ISO strings in Addis Ababa (+03:00)
      const startDateTime = `${planDateStr}T${startTimeStr}:00+03:00`;
      const endDateTime = `${planDateStr}T${endTimeStr}:00+03:00`;

      const eventPayload = {
        summary: `[${dName.toUpperCase()}] ${title}`,
        description: `FORGE Personal OS Task\nDomain: ${dName}\nTarget: ${task.minutesTarget} mins\nStatus: ${task.completed ? 'COMPLETED' : 'PENDING'}\n\n${description}`,
        start: {
          dateTime: startDateTime,
          timeZone: TIMEZONE,
        },
        end: {
          dateTime: endDateTime,
          timeZone: TIMEZONE,
        },
      };

      try {
        if (task.googleEventId) {
          // Update existing event to prevent duplicates
          await calendar.events.update({
            auth: authClient,
            calendarId: 'primary',
            eventId: task.googleEventId,
            requestBody: eventPayload,
          });
          syncedCount++;
        } else {
          // Insert new event and store googleEventId
          const res = await calendar.events.insert({
            auth: authClient,
            calendarId: 'primary',
            requestBody: eventPayload,
          });

          if (res.data.id) {
            await prisma.planTask.update({
              where: { id: task.id },
              data: { googleEventId: res.data.id },
            });
            syncedCount++;
          }
        }
      } catch (err: any) {
        // If event was deleted from Google Calendar remotely (404/410), recreate it
        if (err?.code === 404 || err?.code === 410) {
          try {
            const res = await calendar.events.insert({
              auth: authClient,
              calendarId: 'primary',
              requestBody: eventPayload,
            });
            if (res.data.id) {
              await prisma.planTask.update({
                where: { id: task.id },
                data: { googleEventId: res.data.id },
              });
              syncedCount++;
            }
          } catch (reInsertErr: any) {
            errors.push(reInsertErr.message);
          }
        } else {
          errors.push(err.message || 'Error syncing event');
        }
      }
    }
  }

  return {
    success: errors.length === 0,
    synced: syncedCount,
    errors: errors.length > 0 ? errors : undefined,
  };
}
