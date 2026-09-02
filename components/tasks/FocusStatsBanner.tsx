'use client';

import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import {
  Lock,
  Clock,
  Award,
  Flame,
  ArrowRight,
  TrendingUp,
  FlaskConical,
  Code2,
  BookOpen,
  Dumbbell,
  Play,
  Pause,
} from 'lucide-react';
import {
  getStoredFocusSession,
  ActiveFocusPayload,
  FOCUS_STORAGE_KEY,
} from './StudyFocusModal';

interface FocusStatsData {
  totalMinutes: number;
  targetMinutes: number;
  completedSessionsCount: number;
  longestSessionMinutes: number;
  subjectBreakdown: Record<string, number>;
}

interface FocusStatsBannerProps {
  onOpenActiveSession: (session: ActiveFocusPayload) => void;
  onRefreshTrigger?: number;
}

export default function FocusStatsBanner({
  onOpenActiveSession,
  onRefreshTrigger,
}: FocusStatsBannerProps) {
  const [stats, setStats] = useState<FocusStatsData | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveFocusPayload | null>(null);
  const [activeRemainingFormatted, setActiveRemainingFormatted] = useState<string>('');

  const loadStats = async () => {
    try {
      const res = await fetch('/api/focus');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.warn('Could not load focus stats:', e);
    }
  };

  const syncActiveSession = () => {
    const stored = getStoredFocusSession();
    setActiveSession(stored);
  };

  useEffect(() => {
    void loadStats();
    syncActiveSession();

    const handleUpdate = () => {
      syncActiveSession();
      void loadStats();
    };

    window.addEventListener('forge_focus_session_update', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('forge_focus_session_update', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [onRefreshTrigger]);

  // Active session countdown tick for the banner
  useEffect(() => {
    if (!activeSession) return;

    const tick = () => {
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
      const mins = Math.floor(remainingMs / 60000);
      const secs = Math.floor((remainingMs % 60000) / 1000);
      setActiveRemainingFormatted(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const totalHours = stats ? Math.floor(stats.totalMinutes / 60) : 0;
  const totalMins = stats ? stats.totalMinutes % 60 : 0;
  const targetHours = stats ? Math.floor(stats.targetMinutes / 60) : 3;

  const chemMins = stats?.subjectBreakdown?.Chemistry || 0;
  const jsMins = stats?.subjectBreakdown?.JavaScript || 0;
  const readMins = stats?.subjectBreakdown?.Reading || 0;
  const workoutMins = stats?.subjectBreakdown?.Workout || 0;

  const formatMinStr = (m: number) => {
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const rest = m % 60;
      return rest > 0 ? `${h}h ${rest}m` : `${h}h`;
    }
    return `${m}m`;
  };

  return (
    <div className="space-y-4">
      {/* ── PERSISTENT ACTIVE FOCUS BAR ── */}
      {activeSession && (
        <div className="rounded-2xl border border-orange-500/50 bg-gradient-to-r from-orange-950/60 via-slate-900 to-slate-950 p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse-subtle">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/40 flex items-center justify-center shrink-0">
              <Lock size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-400">
                  Today's Active Focus Session
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {activeSession.sessionState === 'PAUSED' ? '· ⏸ PAUSED' : '· ⏳ RUNNING'}
                </span>
              </div>
              <p className="text-sm font-bold text-white leading-tight">
                {activeSession.subject} — {activeSession.taskTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
            <span className="font-mono text-base font-black text-amber-300">
              {activeRemainingFormatted} remaining
            </span>
            <button
              onClick={() => onOpenActiveSession(activeSession)}
              className="btn btn-primary btn-sm rounded-xl font-bold flex items-center gap-1 shadow-md shadow-orange-950/40"
            >
              Open Session <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── FOCUS DASHBOARD STATISTICS ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Flame className="text-orange-400" size={18} />
            <h3 className="text-sm font-extrabold text-white tracking-wide">
              Today's Focus & Study Statistics
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-orange-400">
            {totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins}m`} / {targetHours}h Target
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-3 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Total Focus
            </span>
            <span className="text-lg font-black text-white font-mono">
              {totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins}m`}
            </span>
          </div>

          <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-3 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Completed
            </span>
            <span className="text-lg font-black text-emerald-400 font-mono">
              {stats?.completedSessionsCount || 0} Sessions
            </span>
          </div>

          <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-3 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Longest
            </span>
            <span className="text-lg font-black text-amber-400 font-mono">
              {stats?.longestSessionMinutes || 0}m
            </span>
          </div>

          <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-3 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Daily Goal
            </span>
            <span className="text-lg font-black text-cyan-400 font-mono">
              {Math.min(100, Math.round(((stats?.totalMinutes || 0) / 180) * 100))}%
            </span>
          </div>
        </div>

        {/* Breakdown by subject */}
        <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <FlaskConical size={14} className="text-blue-400" />
            <span>Chemistry:</span>
            <span className="font-bold text-white font-mono">{formatMinStr(chemMins)}</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <Code2 size={14} className="text-cyan-400" />
            <span>JavaScript:</span>
            <span className="font-bold text-white font-mono">{formatMinStr(jsMins)}</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <BookOpen size={14} className="text-purple-400" />
            <span>Reading:</span>
            <span className="font-bold text-white font-mono">{formatMinStr(readMins)}</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <Dumbbell size={14} className="text-orange-400" />
            <span>Workout:</span>
            <span className="font-bold text-white font-mono">{formatMinStr(workoutMins)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
