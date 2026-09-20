export interface VoiceCallConfig {
  phoneNumber?: string;
  wakeTime: string; // "04:02"
  sleepTime: string; // "23:00"
  maxWakeAttempts: number;
  maxSleepAttempts: number;
  maxCallDurationSec: number;
  dailyCallBudget: number;
  voiceCallsEnabled: boolean;
}

export type VoiceEventType = 'WAKE' | 'SLEEP';

export type VoiceCallStatus =
  | 'SCHEDULED'
  | 'ATTEMPTED'
  | 'ANSWERED'
  | 'CONFIRMED'
  | 'MISSED'
  | 'FAILED';

export interface VoiceCallRecord {
  id: string;
  date: Date;
  eventType: VoiceEventType;
  scheduledTime: string;
  status: VoiceCallStatus;
  attemptNumber: number;
  confirmationState: 'PENDING' | 'CONFIRMED' | 'FAILED';
  failureReason?: string;
  durationSeconds: number;
}

export interface VoiceCallProvider {
  name: string;
  placeCall(params: {
    to: string;
    from?: string;
    promptText: string;
    expectedEventType: VoiceEventType;
    callbackUrl: string;
  }): Promise<{ success: boolean; callSid?: string; error?: string }>;
}

export interface ParsedVoiceCommand {
  action:
    | 'GET_TODAY_PLAN'
    | 'GET_NEXT_TASK'
    | 'GET_MISSED_TODAY'
    | 'GET_WORKOUT'
    | 'GET_STUDY_SUBJECT'
    | 'GET_TIME_LEFT'
    | 'COMPLETE_TASK'
    | 'COMPLETE_WORKOUT'
    | 'MOVE_TASK'
    | 'DELETE_TASK'
    | 'ADD_TASK'
    | 'PLAN_TOMORROW'
    | 'CONFIRM_PENDING_ACTION'
    | 'UNKNOWN';
  targetSubject?: string;
  targetCategory?: string;
  targetTime?: string;
  durationMinutes?: number;
  taskDescription?: string;
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
  spokenResponse: string;
}
