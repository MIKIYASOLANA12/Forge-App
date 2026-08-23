"use client";

import { useState, useEffect } from "react";
import {
  Quote,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  GraduationCap,
  Flame,
  Compass,
  Lightbulb,
} from "lucide-react";
import { DAILY_QUOTES, getDailyQuote, getRandomQuote, type DailyQuote } from "@/lib/quotes";
import { clsx } from "clsx";

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; icon: any }> = {
  Discipline: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
    icon: Flame,
  },
  Mastery: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/30",
    icon: GraduationCap,
  },
  Resilience: {
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/30",
    icon: Compass,
  },
  Focus: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/30",
    icon: Sparkles,
  },
  Wisdom: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    icon: Lightbulb,
  },
  Vision: {
    bg: "bg-indigo-500/10",
    text: "text-indigo-400",
    border: "border-indigo-500/30",
    icon: Compass,
  },
};

export function DailyMotivation() {
  const [currentQuote, setCurrentQuote] = useState<DailyQuote>(getDailyQuote());
  const [isAnimating, setIsAnimating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isTeacherNoteOpen, setIsTeacherNoteOpen] = useState(true);

  // Initialize with today's quote
  useEffect(() => {
    setCurrentQuote(getDailyQuote());
  }, []);

  const handleNextQuote = () => {
    setIsAnimating(true);
    setTimeout(() => {
      let next = getRandomQuote();
      // Ensure we don't pick the exact same quote twice in a row
      if (next.id === currentQuote.id && DAILY_QUOTES.length > 1) {
        const remaining = DAILY_QUOTES.filter((q) => q.id !== currentQuote.id);
        next = remaining[Math.floor(Math.random() * remaining.length)];
      }
      setCurrentQuote(next);
      setIsAnimating(false);
    }, 200);
  };

  const handleCopy = () => {
    const textToCopy = `"${currentQuote.quote}" — ${currentQuote.author} (${currentQuote.role})\n\n💡 Master's Lesson: ${currentQuote.lesson}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const catStyle = CATEGORY_STYLES[currentQuote.category] || CATEGORY_STYLES.Wisdom;
  const CategoryIcon = catStyle.icon;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[#0e111a] via-[#121624] to-[#0c0f18] p-6 shadow-xl transition-all hover:border-slate-700">
      {/* Ambient background glow accents */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 -bottom-20 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />

      {/* Header bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-inner">
            <Quote size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-amber-400">
                Daily Master's Mindset
              </span>
              <span className="h-1 w-1 rounded-full bg-slate-600" />
              <span className="text-[11px] text-[var(--text-muted)] font-semibold">
                Daily Transmission
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider border",
              catStyle.bg,
              catStyle.text,
              catStyle.border
            )}
          >
            <CategoryIcon size={11} />
            {currentQuote.category}
          </span>

          <button
            onClick={handleCopy}
            title="Copy Quote"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </button>

          <button
            onClick={handleNextQuote}
            title="Next Insight"
            className="flex items-center gap-1 h-7 px-2.5 rounded-lg border border-slate-800 bg-slate-900 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-all active:scale-95"
          >
            <RefreshCw size={12} className={clsx(isAnimating && "animate-spin text-amber-400")} />
            <span>Next</span>
          </button>
        </div>
      </div>

      {/* Quote Body with animated fade */}
      <div
        className={clsx(
          "relative z-10 space-y-4 transition-all duration-200",
          isAnimating ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
        )}
      >
        <div className="space-y-2">
          <p className="text-base md:text-lg font-medium leading-relaxed tracking-tight text-slate-100 italic">
            "{currentQuote.quote}"
          </p>
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-4 bg-amber-400 rounded-full" />
            <span className="text-sm font-bold text-white tracking-wide">
              {currentQuote.author}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              — {currentQuote.role}
            </span>
          </div>
        </div>

        {/* Teacher's Student Lesson Callout */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 flex items-start gap-3">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <GraduationCap size={14} />
          </div>
          <div className="space-y-0.5">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400">
              Master's Daily Lesson to Student:
            </div>
            <p className="text-xs leading-relaxed text-slate-300 font-medium">
              {currentQuote.lesson}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
