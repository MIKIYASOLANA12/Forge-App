"use client";

import { useEffect, useState } from "react";
import { BookOpen, Check, Circle, LoaderCircle } from "lucide-react";
import { ReadingCheckIn } from "@/components/ReadingCheckIn";

type Item = { id: string; reference: string; order: number; status: string; readAt: string | null };
type Plan = { current: Item | null; upcoming: Item[]; completed: Item[] };

export default function FaithPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const load = async () => { const response = await fetch("/api/faith/plan"); if (response.ok) setPlan(await response.json()); setLoading(false); };
  useEffect(() => { void load(); }, []);
  const markRead = async () => { if (!plan?.current) return; const response = await fetch(`/api/faith/plan/${plan.current.id}`, { method: "PATCH" }); if (response.ok) await load(); };
  return <div className="mx-auto w-full max-w-[1200px] animate-fade-in pb-10"><section className="mb-8 border-b border-[var(--border)] pb-6"><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--faith)]">Faith / scripture practice</p><h1>Read. Reflect. Return.</h1><p className="mt-2 max-w-xl text-sm">Stay with one passage long enough to understand it, then carry its meaning into the week.</p></section>{loading ? <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]"><LoaderCircle size={16} className="animate-spin" /> Loading reading plan...</div> : plan?.current ? <><div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><section className="card"><h4>Current passage</h4><div className="mt-3 flex items-end justify-between gap-4"><div><h2>{plan.current.reference}</h2><p className="mt-1 text-xs">Passage {plan.current.order}</p></div><BookOpen size={25} className="text-[var(--faith)]" /></div><button className="btn btn-primary mt-6" onClick={() => void markRead()}><Check size={15} /> Mark as read</button></section><ReadingCheckIn generateUrl={`/api/faith/plan/${plan.current.id}/checkin`} answerUrl={(checkInId) => `/api/faith/plan/${plan.current?.id}/checkin/answer`} accent="var(--faith)" /></div><section className="mt-6"><h2 className="mb-3">Plan overview</h2><div className="grid gap-5 md:grid-cols-3"><PlanSection title="Completed" items={plan.completed} tone="var(--success)" /><PlanSection title="Current" items={[plan.current]} tone="var(--faith)" /><PlanSection title="Upcoming" items={plan.upcoming} tone="var(--text-muted)" /></div></section></> : <div className="card text-sm text-[var(--text-muted)]">The reading plan is complete.</div>}</div>;
}

function PlanSection({ title, items, tone }: { title: string; items: Item[]; tone: string }) { return <section className="card"><div className="mb-3 flex items-center justify-between"><h4>{title}</h4><span className="text-xs" style={{ color: tone }}>{items.length}</span></div><div className="space-y-3">{items.length ? items.map((item) => <div className="flex items-center gap-2 text-sm" key={item.id}>{item.status === "done" ? <Check size={14} style={{ color: tone }} /> : <Circle size={14} style={{ color: tone }} />}<span>{item.reference}</span></div>) : <p className="text-xs text-[var(--text-muted)]">Nothing here yet.</p>}</div></section>; }
