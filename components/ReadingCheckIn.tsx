"use client";

import { useState } from "react";
import { Check, LoaderCircle, MessageCircle, Send } from "lucide-react";

type Props = { generateUrl: string; answerUrl: (checkInId: string) => string; accent?: string };
const decodeEntities = (str: string) => str.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');

export function ReadingCheckIn({ generateUrl, answerUrl, accent = "var(--study)" }: Props) {
  const [checkIn, setCheckIn] = useState<{ id: string; question: string } | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<{ assessment: string; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const generate = async () => { setBusy(true); const response = await fetch(generateUrl, { method: "POST" }); if (response.ok) { setCheckIn(await response.json()); setResult(null); setAnswer(""); } setBusy(false); };
  const submit = async () => { if (!checkIn || !answer.trim()) return; setBusy(true); const response = await fetch(answerUrl(checkIn.id), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkInId: checkIn.id, answer }) }); if (response.ok) { const data = await response.json(); setResult({ assessment: data.assessment ?? data.verdict, note: data.note ?? data.feedback }); } setBusy(false); };
  return <section className="card"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg">Reading check-in</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Read closely, then put the idea into your own words.</p></div><MessageCircle size={19} style={{ color: accent }} /></div>{!checkIn ? <button className="btn btn-primary" onClick={() => void generate()} disabled={busy}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <MessageCircle size={15} />} Get check-in question</button> : <div><div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-sm font-semibold">{checkIn.question}</div><textarea className="textarea mt-3" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Write your answer here..." disabled={!!result} />{!result ? <button className="btn btn-primary mt-3" onClick={() => void submit()} disabled={busy || !answer.trim()}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />} Submit answer</button> : <div className={`mt-4 border-l-2 px-3 py-2 ${result.assessment === "understood" ? "border-[var(--success)]" : "border-[var(--warning)]"}`}><div className="flex items-center gap-2 text-sm font-bold" style={{ color: result.assessment === "understood" ? "var(--success)" : "var(--warning)" }}>{result.assessment === "understood" && <Check size={15} />} {result.assessment === "understood" ? "Understood" : decodeEntities("Gap detected — you&apos;ll be asked about this again")}</div><p className="mt-1 text-xs">{decodeEntities(result.note)}</p><button className="btn btn-ghost btn-sm mt-3" onClick={() => void generate()}>Get another check-in</button></div>}</div>}</section>;
}