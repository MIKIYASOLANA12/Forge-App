"use client";

import { useEffect, useState } from "react";
import { CalendarDays, LoaderCircle, Plus, Trash2 } from "lucide-react";

type PlanItem = {
  id: string;
  title: string;
  description: string;
  date: string;
  category: string;
  priority: string;
  startTime?: string | null;
  endTime?: string | null;
  reminder?: string | null;
  repeat?: string | null;
};

const initialForm = {
  title: "",
  description: "",
  category: "Workout",
  date: new Date().toISOString().slice(0, 10),
  startTime: "09:00",
  endTime: "10:00",
  priority: "High",
  reminder: "",
  repeat: "",
};

export default function PlansPage() {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadPlans = async () => {
      const response = await fetch("/api/plans");
      if (response.ok) {
        const data = await response.json();
        setPlans(data);
      }
      setLoading(false);
    };

    void loadPlans();
  }, []);

  const savePlan = async () => {
    setSaving(true);
    const response = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (response.ok) {
      const created = await response.json();
      setPlans((current) => [
        created,
        ...current.filter((plan) => plan.id !== created.id),
      ]);
      setForm(initialForm);
    }
    setSaving(false);
  };

  const deletePlan = async (id: string) => {
    const response = await fetch(`/api/plans?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) {
      setPlans((current) => current.filter((plan) => plan.id !== id));
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] animate-fade-in pb-10">
      <section className="mb-8 border-b border-[var(--border)] pb-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--workout)]">Plans / scheduling</p>
        <h1>Plan the week without losing the day.</h1>
        <p className="mt-2 max-w-xl text-sm">Create a future plan and it will sit on the calendar as a first-class event.</p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="card">
          <div className="mb-5 flex items-center gap-3">
            <CalendarDays size={18} className="text-[var(--workout)]" />
            <h2 className="text-lg">Add plan</h2>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium">
              Title
              <input className="input mt-2" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Workout / Study / Deep work" />
            </label>

            <label className="block text-sm font-medium">
              Notes
              <textarea className="textarea mt-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What matters most?" />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Category
                <select className="input mt-2" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {['Study','Coding','Workout','Home Workout','Business','Reading','Faith','Nutrition','Personal','Other'].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium">
                Priority
                <select className="input mt-2" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {['High','Medium','Low'].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Date
                <input type="date" className="input mt-2" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </label>

              <label className="block text-sm font-medium">
                Reminder
                <input className="input mt-2" value={form.reminder} onChange={(e) => setForm({ ...form, reminder: e.target.value })} placeholder="15 min" />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Start
                <input type="time" className="input mt-2" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </label>

              <label className="block text-sm font-medium">
                End
                <input type="time" className="input mt-2" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </label>
            </div>

            <label className="block text-sm font-medium">
              Repeat
              <input className="input mt-2" value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value })} placeholder="Weekly, weekdays, weekends" />
            </label>

            <button className="btn btn-primary w-full" onClick={() => void savePlan()} disabled={saving || !form.title.trim()}>
              {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />} Save plan
            </button>
          </div>
        </section>

        <section className="card">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg">Upcoming plans</h2>
            <span className="text-xs text-[var(--text-muted)]">{plans.length} items</span>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]"><LoaderCircle size={16} className="animate-spin" /> Loading plans...</div>
          ) : plans.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-sm text-[var(--text-muted)]">No plans yet. Add one to start building your schedule.</div>
          ) : (
            <div className="space-y-3">
              {plans.map((plan) => (
                <article key={plan.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--workout)]">{plan.category}</div>
                      <h3 className="mt-1 text-base font-semibold">{plan.title}</h3>
                    </div>
                    <button className="p-2 text-[var(--text-muted)] hover:text-[var(--danger)]" aria-label="Delete plan" onClick={() => void deletePlan(plan.id)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-[var(--text-secondary)]">
                    <div>{new Date(plan.date).toLocaleDateString(undefined, { dateStyle: "medium" })}</div>
                    {plan.startTime && <div>{plan.startTime} {plan.endTime ? `– ${plan.endTime}` : ""}</div>}
                    <div>{plan.priority} priority</div>
                    {plan.description && <p className="mt-2 text-sm text-[var(--text-primary)]">{plan.description}</p>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
