"use client";

import { useEffect, useState } from "react";
import { CalendarDays, LoaderCircle } from "lucide-react";

type CalendarEvent = {
  id: string;
  title: string;
  category: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  description?: string | null;
};

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEvents = async () => {
      const response = await fetch("/api/calendar");
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
      setLoading(false);
    };

    void loadEvents();
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1200px] animate-fade-in pb-10">
      <section className="mb-8 border-b border-[var(--border)] pb-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--study)]">Calendar / schedule</p>
        <h1>See what is scheduled next.</h1>
      </section>

      <section className="card">
        <div className="mb-5 flex items-center gap-3">
          <CalendarDays size={18} className="text-[var(--study)]" />
          <h2 className="text-lg">Upcoming events</h2>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]"><LoaderCircle size={16} className="animate-spin" /> Loading calendar...</div>
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-sm text-[var(--text-muted)]">No calendar entries yet. Create a plan and it will appear here.</div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <article key={event.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--study)]">{event.category}</div>
                <h3 className="text-base font-semibold">{event.title}</h3>
                <div className="mt-3 text-sm text-[var(--text-secondary)]">
                  <div>{new Date(event.date).toLocaleDateString(undefined, { dateStyle: "medium" })}</div>
                  {event.startTime && <div>{event.startTime} {event.endTime ? `– ${event.endTime}` : ""}</div>}
                  {event.description && <p className="mt-2 text-sm text-[var(--text-primary)]">{event.description}</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
