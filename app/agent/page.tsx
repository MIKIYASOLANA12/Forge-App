"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Bot, Check, LoaderCircle, Send, Sparkles, User } from "lucide-react";

type Message = { id?: string; role: "user" | "agent" | "assistant"; content: string; createdAt?: string; actionTaken?: string | null };

const formatTime = (date?: string) => date ? new Date(date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "now";

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/agent").then(async response => {
      if (!response.ok) throw new Error((await response.json()).error || "Could not load conversation.");
      setMessages(await response.json());
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Could not load conversation.")).finally(() => setLoading(false));
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  const send = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setError("");
    const userMessage: Message = { role: "user", content, createdAt: new Date().toISOString() };
    const history = [...messages, userMessage].map(message => ({ role: message.role === "agent" ? "assistant" : "user", content: message.content }));
    setMessages(current => [...current, userMessage]);
    setInput("");
    setSending(true);
    try {
      const response = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: content, history }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || result.error || "Agent request failed.");
      setMessages(current => [...current, { role: "agent", content: result.message, actionTaken: result.actionsTaken?.join("; ") || null, createdAt: new Date().toISOString() }]);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Agent request failed.";
      setError(message);
      setMessages(current => [...current, { role: "agent", content: `Error: ${message}`, createdAt: new Date().toISOString() }]);
    } finally { setSending(false); }
  };

  const submit = (event: FormEvent) => { event.preventDefault(); void send(); };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } };

  return <div className="mx-auto flex h-[calc(100vh-7rem)] w-full max-w-[1100px] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] animate-fade-in"><header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[rgba(59,130,246,0.15)] text-[var(--study)]"><Bot size={19} /></div><div><h1 className="text-base">Schedule agent</h1><p className="text-xs">Direct changes to your plan and habits</p></div></div><Sparkles size={17} className="text-[var(--xp-gold)]" /></header><div className="flex-1 overflow-y-auto px-4 py-6 md:px-8"><div className="mx-auto max-w-3xl space-y-5">{loading ? <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]"><LoaderCircle size={16} className="animate-spin" /> Loading conversation...</div> : messages.length === 0 ? <div className="py-16 text-center"><Bot size={28} className="mx-auto mb-3 text-[var(--study)]" /><h2 className="text-lg">What do you want to change today?</h2><p className="mt-2 text-sm">Ask me to reschedule a task, manage a habit, or adjust your plan.</p></div> : messages.map((message, index) => <MessageBubble key={message.id || `${message.createdAt}-${index}`} message={message} />)}{sending && <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-elevated)]"><Bot size={15} /></div><span className="flex gap-1"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--study)]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--study)] [animation-delay:150ms]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--study)] [animation-delay:300ms]" /></span></div>}<div ref={endRef} /></div></div><form onSubmit={submit} className="border-t border-[var(--border)] bg-[var(--bg-elevated)] p-4"><div className="mx-auto flex max-w-3xl items-end gap-3"><textarea aria-label="Message agent" className="input min-h-[44px] resize-none" rows={1} value={input} onChange={event => setInput(event.target.value)} onKeyDown={keyDown} placeholder="Tell the agent what to change..." disabled={sending} />{error && <span className="sr-only" role="alert">{error}</span>}<button className="btn btn-primary h-11 w-11 shrink-0 justify-center p-0" aria-label="Send message" disabled={!input.trim() || sending}><Send size={16} /></button></div></form></div>;
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}><div className={`flex max-w-[85%] gap-3 ${isUser ? "flex-row-reverse" : ""}`}><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isUser ? "bg-[rgba(59,130,246,0.2)] text-[var(--study)]" : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"}`}>{isUser ? <User size={15} /> : <Bot size={15} />}</div><div className={isUser ? "chat-bubble-user" : "chat-bubble-agent"}><div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>{message.actionTaken && <div className="mt-3 flex items-start gap-1.5 border-t border-[rgba(255,255,255,0.1)] pt-2 text-xs text-[var(--text-secondary)]"><Check size={13} className="mt-0.5 shrink-0 text-[var(--success)]" /><span>Action taken: {message.actionTaken}</span></div>}<div className="mt-2 text-[10px] text-[var(--text-muted)]">{formatTime(message.createdAt)}</div></div></div></div>;
}