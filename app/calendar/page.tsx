"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays, LoaderCircle, RefreshCw, CheckCircle2,
  ExternalLink, Unlink, ShieldCheck, AlertCircle, Clock,
  Dumbbell, BookOpen, Code, Heart, Sparkles
} from "lucide-react";
import { clsx } from "clsx";

type CalendarEvent = {
  id: string;
  title: string;
  category: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  description?: string | null;
  completed?: boolean;
  minutesTarget?: number;
  googleEventId?: string | null;
  isSyncedToGoogle?: boolean;
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Workout: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30" },
  Study: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30" },
  Coding: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" },
  Reading: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30" },
  Faith: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/30" },
  Personal: { bg: "bg-slate-800", text: "text-slate-300", border: "border-slate-700" },
};

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const loadData = async () => {
    try {
      setLoading(true);
      const [calRes, authRes] = await Promise.all([
        fetch("/api/calendar"),
        fetch("/api/calendar/auth"),
      ]);

      if (calRes.ok) {
        const calData = await calRes.json();
        setEvents(calData.events || []);
        setConnected(Boolean(calData.connected));
      }

      if (authRes.ok) {
        const authData = await authRes.json();
        setAuthUrl(authData.authUrl || null);
        setConnected(Boolean(authData.connected));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSyncNow = async () => {
    try {
      setSyncing(true);
      setSyncResult(null);
      const res = await fetch("/api/calendar/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(`✅ Successfully synced ${data.synced ?? 0} events to Google Calendar!`);
        await loadData();
      } else {
        setSyncResult(`⚠️ Sync notice: ${data.error || 'Failed to sync'}`);
      }
    } catch (err: any) {
      setSyncResult(`❌ Error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Google Calendar?")) return;
    try {
      await fetch("/api/calendar/auth", { method: "DELETE" });
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredEvents = events.filter((e) =>
    activeCategory === "All" ? true : e.category.toLowerCase() === activeCategory.toLowerCase()
  );

  return (
    <div className="mx-auto w-full max-w-[1200px] animate-fade-in space-y-8 pb-16">
      {/* Header & OAuth Sync Status Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-full">
              Google Calendar 2-Way Sync
            </span>
            <span className="text-xs text-[var(--text-muted)]">Timezone: Africa/Addis_Ababa (+03:00)</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <CalendarDays className="text-blue-500" size={32} />
            Schedule & Google Calendar Sync
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Live 2-way synchronization for workouts, study, coding, reading, and daily tasks.
          </p>
        </div>

        {/* OAuth Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {connected ? (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                <ShieldCheck size={15} />
                <span>Google Calendar Connected</span>
              </div>

              <button
                onClick={handleSyncNow}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md transition-all"
              >
                <RefreshCw size={14} className={clsx(syncing && "animate-spin")} />
                <span>{syncing ? "Syncing..." : "Sync Now"}</span>
              </button>

              <button
                onClick={handleDisconnect}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg border border-slate-800 transition-colors"
                title="Disconnect Google Calendar"
              >
                <Unlink size={15} />
              </button>
            </>
          ) : (
            <a
              href={authUrl || "#"}
              className={clsx(
                "flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md transition-all",
                !authUrl && "opacity-50 pointer-events-none"
              )}
            >
              <Sparkles size={15} />
              <span>Connect Google Calendar</span>
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>

      {/* Sync Notification Banner */}
      {syncResult && (
        <div className="p-4 rounded-xl bg-slate-900 border border-blue-500/40 text-xs text-slate-200 flex items-center justify-between">
          <span>{syncResult}</span>
          <button onClick={() => setSyncResult(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {['All', 'Workout', 'Study', 'Coding', 'Reading', 'Faith'].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
              activeCategory === cat
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-white border border-[var(--border)]"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Events List */}
      <section className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoaderCircle size={28} className="animate-spin text-blue-500" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[var(--bg-surface)] border border-dashed border-[var(--border)] text-center space-y-2">
            <CalendarDays size={36} className="mx-auto text-[var(--text-muted)]" />
            <h3 className="text-base font-bold text-white">No Scheduled Events Found</h3>
            <p className="text-xs text-[var(--text-muted)]">
              Create daily plans or log focus routines in Forge and they will automatically sync here and to Google Calendar.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEvents.map((event) => {
              const catCfg = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.Personal;
              const formattedDate = new Date(event.date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              });

              return (
                <article
                  key={event.id}
                  className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={clsx(
                        "px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md border",
                        catCfg.bg,
                        catCfg.text,
                        catCfg.border
                      )}>
                        {event.category}
                      </span>

                      {event.isSyncedToGoogle ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          <CheckCircle2 size={11} />
                          Google Synced
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">Local Only</span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-white mb-1.5 leading-snug">
                      {event.title}
                    </h3>

                    {event.description && (
                      <p className="text-xs text-[var(--text-muted)] line-clamp-2 mb-3">
                        {event.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span className="font-semibold text-white">{formattedDate}</span>
                    <div className="flex items-center gap-1.5 text-blue-400 font-semibold">
                      <Clock size={13} />
                      <span>{event.startTime ? `${event.startTime} - ${event.endTime || '10:00'}` : `${event.minutesTarget || 30}m`}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
