'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import clsx from 'clsx';
import {
  Lock,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  X,
  Flame,
  Award,
  Clock,
  Sparkles,
  BookOpen,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';

export type FocusSessionState = 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'INTERRUPTED';

export interface ActiveFocusPayload {
  taskId?: string;
  subject: string;
  taskTitle: string;
  subtopics?: string[];
  learningTarget?: string;
  plannedMinutes: number;
  startTimestamp: number;
  durationMinutes: number;
  sessionState: FocusSessionState;
  accumulatedPausedMs: number;
  pausedAt: number | null;
}

export const FOCUS_STORAGE_KEY = 'forge_active_focus_session';

export function getStoredFocusSession(): ActiveFocusPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(FOCUS_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveStoredFocusSession(payload: ActiveFocusPayload | null) {
  if (typeof window === 'undefined') return;
  try {
    if (payload) {
      localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(payload));
    } else {
      localStorage.removeItem(FOCUS_STORAGE_KEY);
    }
    window.dispatchEvent(new Event('forge_focus_session_update'));
  } catch (e) {
    console.error('Error saving focus session:', e);
  }
}

interface StudyQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  xpReward: number;
}

interface StudyFocusModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionPayload: ActiveFocusPayload | null;
  onSessionComplete?: () => void;
}

export default function StudyFocusModal({
  isOpen,
  onClose,
  sessionPayload,
  onSessionComplete,
}: StudyFocusModalProps) {
  const [activeSession, setActiveSession] = useState<ActiveFocusPayload | null>(sessionPayload);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(0);
  const [focusedMinutes, setFocusedMinutes] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);

  // Post session states
  const [step, setStep] = useState<'FOCUS' | 'SUMMARY' | 'QUESTION'>('FOCUS');
  const [reflection, setReflection] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [earnedXp, setEarnedXp] = useState(0);

  // Question Engine drill state
  const [question, setQuestion] = useState<StudyQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState(false);

  // Sync state from prop
  useEffect(() => {
    if (sessionPayload) {
      setActiveSession(sessionPayload);
      setStep('FOCUS');
    }
  }, [sessionPayload]);

  // Recalculate precision remaining time from timestamps
  const updateTimer = useCallback(() => {
    if (!activeSession) return;

    const { startTimestamp, durationMinutes, sessionState, accumulatedPausedMs, pausedAt } = activeSession;
    const totalMs = durationMinutes * 60 * 1000;

    let elapsedMs = 0;
    if (sessionState === 'PAUSED' && pausedAt) {
      elapsedMs = pausedAt - startTimestamp - accumulatedPausedMs;
    } else if (sessionState === 'RUNNING') {
      elapsedMs = Date.now() - startTimestamp - accumulatedPausedMs;
    }

    elapsedMs = Math.max(0, elapsedMs);
    const remainingMs = Math.max(0, totalMs - elapsedMs);

    const remainingSecs = Math.ceil(remainingMs / 1000);
    const currentFocusedMins = Math.floor(elapsedMs / 60000);
    const percent = Math.min(100, Math.round((elapsedMs / totalMs) * 100));

    setTimeLeftSeconds(remainingSecs);
    setFocusedMinutes(currentFocusedMins);
    setProgressPercent(percent);

    // If timer reaches 0, trigger completion
    if (remainingSecs <= 0 && sessionState === 'RUNNING') {
      handleCompleteSession();
    }
  }, [activeSession]);

  // Timer Tick
  useEffect(() => {
    if (!isOpen || !activeSession || activeSession.sessionState !== 'RUNNING') return;

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [isOpen, activeSession, updateTimer]);

  // Load question for study subject on finish
  const fetchTopicQuestion = async (subject: string) => {
    try {
      const res = await fetch(`/api/study/questions?subject=${encodeURIComponent(subject)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.questions && data.questions.length > 0) {
          const rand = data.questions[Math.floor(Math.random() * data.questions.length)];
          setQuestion(rand);
        }
      }
    } catch (e) {
      console.warn('Could not load focus drill question:', e);
    }
  };

  const handleTogglePause = () => {
    if (!activeSession) return;
    const now = Date.now();

    if (activeSession.sessionState === 'RUNNING') {
      const updated: ActiveFocusPayload = {
        ...activeSession,
        sessionState: 'PAUSED',
        pausedAt: now,
      };
      setActiveSession(updated);
      saveStoredFocusSession(updated);
    } else if (activeSession.sessionState === 'PAUSED') {
      const additionalPaused = activeSession.pausedAt ? now - activeSession.pausedAt : 0;
      const updated: ActiveFocusPayload = {
        ...activeSession,
        sessionState: 'RUNNING',
        accumulatedPausedMs: activeSession.accumulatedPausedMs + additionalPaused,
        pausedAt: null,
      };
      setActiveSession(updated);
      saveStoredFocusSession(updated);
    }
  };

  const handleInterruptEarly = async () => {
    if (!activeSession) return;
    const confirm = window.confirm(
      `End focus session early? You have completed ${focusedMinutes} minutes. You will receive proportional XP credit.`
    );
    if (!confirm) return;

    await finishAndSave('INTERRUPTED');
  };

  const handleCompleteSession = async () => {
    if (!activeSession) return;
    setStep('SUMMARY');
    await fetchTopicQuestion(activeSession.subject);
  };

  const finishAndSave = async (finalStatus: 'COMPLETED' | 'INTERRUPTED' = 'COMPLETED') => {
    if (!activeSession) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: activeSession.subject,
          taskTitle: activeSession.taskTitle,
          taskId: activeSession.taskId,
          plannedMinutes: activeSession.plannedMinutes,
          actualMinutes: Math.max(1, focusedMinutes),
          startedAt: new Date(activeSession.startTimestamp).toISOString(),
          status: finalStatus,
          reflection: reflection.trim() || undefined,
          questionAnswer:
            question && selectedOption
              ? {
                  questionId: question.id,
                  selectedOption,
                  isCorrect: isAnswerCorrect,
                }
              : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setEarnedXp(data.xpEarned || 50);
        saveStoredFocusSession(null);
        setActiveSession(null);
        if (onSessionComplete) onSessionComplete();
        onClose();
      }
    } catch (e) {
      console.error('Failed to save focus session:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswerQuestion = (option: string) => {
    if (!question || isAnswerSubmitted) return;
    setSelectedOption(option);
    const correct = option === question.correctAnswer;
    setIsAnswerCorrect(correct);
    setIsAnswerSubmitted(true);
  };

  if (!isOpen || !activeSession) return null;

  const hours = Math.floor(timeLeftSeconds / 3600);
  const minutes = Math.floor((timeLeftSeconds % 3600) / 60);
  const seconds = timeLeftSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  const isCoding = activeSession.subject.toLowerCase().includes('javascript') || activeSession.subject.toLowerCase().includes('code');
  const isChemistry = activeSession.subject.toLowerCase().includes('chemistry');
  const isReading = activeSession.subject.toLowerCase().includes('reading');

  const themeColor = isCoding ? 'cyan' : isChemistry ? 'blue' : isReading ? 'purple' : 'orange';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-700/80 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 p-6 sm:p-8 shadow-2xl space-y-6 text-white">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <span
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-md',
                isCoding && 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
                isChemistry && 'bg-blue-500/20 text-blue-400 border-blue-500/40',
                isReading && 'bg-purple-500/20 text-purple-400 border-purple-500/40',
                !isCoding && !isChemistry && !isReading && 'bg-orange-500/20 text-orange-400 border-orange-500/40'
              )}
            >
              <Lock size={12} /> LOCKED IN
            </span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
              {activeSession.subject}
            </span>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            title="Minimize focus mode"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── STEP 1: ACTIVE FOCUS TIMER HUD ── */}
        {step === 'FOCUS' && (
          <div className="space-y-6 text-center">
            {/* Task Title Banner */}
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {activeSession.taskTitle}
              </h2>
              {activeSession.learningTarget && (
                <p className="text-xs text-slate-400 max-w-lg mx-auto font-medium">
                  🎯 {activeSession.learningTarget}
                </p>
              )}
            </div>

            {/* Giant Countdown Clock */}
            <div className="py-6 sm:py-8 rounded-3xl bg-slate-950/80 border border-slate-800/90 shadow-inner relative overflow-hidden">
              <div
                className={clsx(
                  'absolute inset-0 opacity-10 bg-radial pointer-events-none',
                  isCoding && 'from-cyan-500 to-transparent',
                  isChemistry && 'from-blue-500 to-transparent',
                  isReading && 'from-purple-500 to-transparent',
                  !isCoding && !isChemistry && !isReading && 'from-orange-500 to-transparent'
                )}
              />

              <div className="font-mono text-5xl sm:text-7xl font-black tracking-wider text-white select-none">
                {hours > 0 && <span>{pad(hours)}:</span>}
                <span>{pad(minutes)}</span>:<span>{pad(seconds)}</span>
              </div>

              <div className="flex items-center justify-center gap-4 mt-3 text-xs font-bold text-slate-400">
                <span>{progressPercent}% Complete</span>
                <span>•</span>
                <span className="text-amber-400">Focused: {focusedMinutes}m</span>
                <span>•</span>
                <span>Target: {activeSession.durationMinutes}m</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="h-3 w-full rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                <div
                  className={clsx(
                    'h-full transition-all duration-500 bg-gradient-to-r',
                    isCoding && 'from-cyan-600 to-teal-400',
                    isChemistry && 'from-blue-600 to-cyan-400',
                    isReading && 'from-purple-600 to-pink-400',
                    !isCoding && !isChemistry && !isReading && 'from-orange-600 to-amber-400'
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Subtopics Checklist if available */}
            {activeSession.subtopics && activeSession.subtopics.length > 0 && (
              <div className="text-left rounded-2xl bg-slate-950/60 border border-slate-800/80 p-4 space-y-2 text-xs">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                  Session Roadmap Topics:
                </span>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                  {activeSession.subtopics.slice(0, 6).map((st, i) => (
                    <li key={i} className="flex items-start gap-1.5 font-medium">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>{st}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Control Buttons */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleTogglePause}
                className={clsx(
                  'btn font-black px-6 py-3 rounded-2xl flex items-center gap-2 shadow-xl text-sm transition-all',
                  activeSession.sessionState === 'RUNNING'
                    ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
                )}
              >
                {activeSession.sessionState === 'RUNNING' ? (
                  <>
                    <Pause size={16} /> Pause Timer
                  </>
                ) : (
                  <>
                    <Play size={16} /> Resume Timer
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCompleteSession}
                className="btn btn-primary font-black px-6 py-3 rounded-2xl flex items-center gap-2 shadow-xl shadow-orange-950/40 text-sm"
              >
                <CheckCircle2 size={16} /> Finish Session
              </button>

              <button
                type="button"
                onClick={handleInterruptEarly}
                className="rounded-2xl px-4 py-3 text-xs font-bold text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 border border-transparent hover:border-rose-900/40 transition-colors"
              >
                End Early
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: SUMMARY & REFLECTION MODAL ── */}
        {step === 'SUMMARY' && (
          <div className="space-y-6 text-left animate-fade-in">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
                <Flame size={32} />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                🔥 LOCKED IN COMPLETE!
              </h2>
              <p className="text-xs text-slate-400">
                You focused for <span className="font-bold text-white">{focusedMinutes} minutes</span> on{' '}
                <span className="font-bold text-cyan-300">{activeSession.taskTitle}</span>.
              </p>
            </div>

            {/* Reflection prompt */}
            <div className="space-y-2 rounded-2xl bg-slate-950 border border-slate-800 p-4">
              <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <BookOpen size={14} className="text-orange-400" />
                Active Recall & Key Takeaways:
              </label>
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                rows={3}
                placeholder="What was the main concept, rule, formula, or solution you mastered in this session?"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>

            {/* Quick Question Drill if available */}
            {question && (
              <div className="space-y-3 rounded-2xl bg-slate-950 border border-slate-800 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                    <Sparkles size={12} /> Mastery Verification Drill (+{question.xpReward} XP)
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-200 leading-relaxed">
                  {question.prompt}
                </p>

                <div className="space-y-1.5 pt-1">
                  {question.options.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={isAnswerSubmitted}
                      onClick={() => handleAnswerQuestion(opt)}
                      className={clsx(
                        'w-full text-left p-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between',
                        selectedOption === opt
                          ? isAnswerCorrect
                            ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                            : 'bg-rose-950/40 border-rose-500 text-rose-300'
                          : isAnswerSubmitted && opt === question.correctAnswer
                          ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-400'
                          : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800'
                      )}
                    >
                      <span>{opt}</span>
                      {selectedOption === opt && (
                        <span>{isAnswerCorrect ? '✓ Correct' : '✗ Incorrect'}</span>
                      )}
                    </button>
                  ))}
                </div>

                {isAnswerSubmitted && (
                  <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                    💡 <span className="font-bold text-slate-300">Explanation:</span>{' '}
                    {question.explanation}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => finishAndSave('COMPLETED')}
                className="btn btn-primary font-black px-8 py-3 rounded-2xl flex items-center gap-2 shadow-xl shadow-orange-950/40 text-sm"
              >
                {submitting ? 'Saving Progress...' : 'Save & Claim XP'} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
