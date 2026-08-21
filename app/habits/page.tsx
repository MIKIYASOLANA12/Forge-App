"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, Check, Flame, LoaderCircle, LockKeyhole, Plus, RotateCcw, Target, Trash2 } from "lucide-react";

type Domain = { id: string; name: string; color: string };
type Habit = { id: string; name: string; active: boolean; streakCount: number; lastCompletedAt: string | null; domain: Domain };

const isToday = (date: string | null) => date ? new Date(date).toDateString() === new Date().toDateString() : false;
const isPastCutoff = () => new Date().getHours() >= 20;

function StreakStatus({ habit }: { habit: Habit }) {
  const locked = habit.streakCount >= 14;
  const loggedToday = isToday(habit.lastCompletedAt);
  const atRisk = habit.active && !loggedToday && isPastCutoff();
  const progress = Math.min((habit.streakCount / 14) * 100, 100);
  return <div className="min-w-[150px]"><div className="mb-1.5 flex items-center justify-between text-xs"><span className={`flex items-center gap-1 font-bold ${atRisk ? "text-[var(--danger)]" : "text-[var(--xp-gold)]"}`}>{atRisk ? <AlertTriangle size={13} /> : <Flame size={13} />} {habit.streakCount} day{habit.streakCount === 1 ? "" : "s"}</span><span className="text-[10px] text-[var(--text-muted)]">{locked ? "LOCKED IN" : `${14 - habit.streakCount} to lock-in`}</span></div><div className="progress-bar"><div className={`progress-fill ${atRisk ? "bg-[var(--danger)]" : locked ? "bg-[var(--success)]" : "bg-[var(--xp-gold)]"}`} style={{ width: `${progress}%` }} /></div><div className={`mt-1.5 flex items-center gap-1 text-[10px] ${atRisk ? "font-bold text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>{atRisk ? "At risk tonight" : locked ? <><LockKeyhole size={11} /> Streak protected</> : loggedToday ? <><Check size={11} /> Logged today</> : "Not logged today"}</div></div>;
}

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [name, setName] = useState("");
  const [domainId, setDomainId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const [habitsResponse, domainsResponse] = await Promise.all([fetch("/api/habits?includeInactive=1"), fetch("/api/domains")]);
    if (!habitsResponse.ok || !domainsResponse.ok) { setError("Could not load habits right now."); setLoading(false); return; }
    setHabits(await habitsResponse.json());
    const loadedDomains: Domain[] = await domainsResponse.json();
    setDomains(loadedDomains);
    if (!domainId && loadedDomains[0]) setDomainId(loadedDomains[0].id);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setSaving(true);
    const response = await fetch("/api/habits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, domainId }) });
    const result = await response.json(); setSaving(false);
    if (!response.ok) { setError(result.error || "Could not create habit."); return; }
    setName(""); await load();
  };

  const setActive = async (habit: Habit, active: boolean) => {
    setError(""); setBusyId(habit.id);
    const response = await fetch(`/api/habits/${habit.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }) });
    const result = await response.json(); setBusyId(null);
    if (!response.ok) { setError(result.error || "Could not update habit."); return; }
    setHabits(current => current.map(item => item.id === habit.id ? result : item));
  };

  const activeHabits = habits.filter(habit => habit.active);
  const retiredHabits = habits.filter(habit => !habit.active);
  return <div className="mx-auto w-full max-w-[1180px] animate-fade-in pb-10"><section className="mb-8 flex flex-col justify-between gap-5 border-b border-[var(--border)] pb-6 md:flex-row md:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--coding)]">Daily systems / habit engine</p><h1>Habits that hold.</h1><p className="mt-2 max-w-xl text-sm">Four active commitments at a time. Build the streak, protect the streak, and retire what no longer earns its place.</p></div><div className="flex items-center gap-3 rounded-xl border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.07)] px-4 py-3"><Target size={18} className="text-[var(--coding)]" /><div><div className="text-sm font-bold">{activeHabits.length} / 4 active</div><div className="text-xs text-[var(--text-muted)]">Keep the bar deliberate</div></div></div></section><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]"><div className="space-y-6"><section><div className="mb-3 flex items-center justify-between"><h2>Active habits</h2><span className="text-xs text-[var(--text-muted)]">{activeHabits.length} of 4 slots used</span></div><div className="space-y-3">{loading ? <div className="card flex items-center gap-2 text-sm text-[var(--text-muted)]"><LoaderCircle size={16} className="animate-spin" /> Loading habits...</div> : activeHabits.length ? activeHabits.map((habit, index) => <HabitRow key={habit.id} habit={habit} index={index} busy={busyId === habit.id} onToggle={() => void setActive(habit, false)} />) : <div className="card text-sm text-[var(--text-muted)]">No active habits yet. Choose one worth repeating.</div>}</div></section><section><div className="mb-3 flex items-center justify-between"><h2>Retired</h2><span className="text-xs text-[var(--text-muted)]">History stays intact</span></div><div className="space-y-3">{retiredHabits.length ? retiredHabits.map((habit, index) => <HabitRow key={habit.id} habit={habit} index={index} busy={busyId === habit.id} onToggle={() => void setActive(habit, true)} />) : <div className="card text-sm text-[var(--text-muted)]">Retired habits will remain here with their streak history.</div>}</div></section></div><section className="card h-fit lg:sticky lg:top-6"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-lg">Start a habit</h2><p className="mt-1 text-xs">Make the next repeat obvious.</p></div><Plus size={19} className="text-[var(--coding)]" /></div><form onSubmit={submit} className="space-y-4"><label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Habit name<input className="input mt-2" value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Walk after lunch" required /></label><label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Domain<select className="input mt-2" value={domainId} onChange={event => setDomainId(event.target.value)} required><option value="" disabled>Choose a domain</option>{domains.map(domain => <option key={domain.id} value={domain.id}>{domain.name}</option>)}</select></label>{error && <div role="alert" className="rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.1)] p-3 text-xs leading-relaxed text-[var(--danger)]">{error}</div>}<button className="btn btn-primary w-full justify-center" disabled={saving}>{saving ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />} {saving ? "Adding..." : "Add habit"}</button></form></section></div></div>;
}

function HabitRow({ habit, index, busy, onToggle }: { habit: Habit; index: number; busy: boolean; onToggle: () => void }) {
  return <div className={`card flex flex-col gap-4 sm:flex-row sm:items-center ${!habit.active ? "opacity-70" : ""}`}><div className="flex min-w-0 flex-1 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold" style={{ backgroundColor: `${habit.domain.color}22`, color: habit.domain.color }}>{String(index + 1).padStart(2, "0")}</div><div className="min-w-0"><div className="truncate font-semibold">{habit.name}</div><div className="mt-1 flex items-center gap-2"><span className="domain-pill" style={{ color: habit.domain.color, backgroundColor: `${habit.domain.color}18` }}>{habit.domain.name}</span>{!habit.active && <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Retired</span>}</div></div></div><StreakStatus habit={habit} /><button className="btn btn-ghost btn-sm shrink-0 justify-center" onClick={onToggle} disabled={busy}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : habit.active ? <Trash2 size={14} /> : <RotateCcw size={14} />}{habit.active ? "Retire" : "Reactivate"}</button></div>;
}