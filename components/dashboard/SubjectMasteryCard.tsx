"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Lock,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  BookOpen,
  ChevronRight,
  Flame,
  Award,
  Zap,
} from "lucide-react";
import type { SubjectCardData } from "@/lib/subjectMasteryEngine";
import Link from "next/link";

interface Props {
  card: SubjectCardData;
  onStartSubject?: (subjectKey: string) => void;
  onOpenQuiz?: (subjectKey: string, topicId: string) => void;
  onStartFocus?: (subjectKey: string, topic: any) => void;
  isCompact?: boolean;
}

export function SubjectMasteryCard({
  card,
  onStartSubject,
  onOpenQuiz,
  onStartFocus,
  isCompact = false,
}: Props) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(
    card.totalSecondsRemaining || 0
  );

  useEffect(() => {
    setSecondsRemaining(card.totalSecondsRemaining || 0);
  }, [card.totalSecondsRemaining]);

  useEffect(() => {
    if (card.status !== "ACTIVE" || secondsRemaining <= 0) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [card.status, secondsRemaining]);

  // Compute live time components
  const days = Math.floor(secondsRemaining / (3600 * 24));
  const hours = Math.floor((secondsRemaining % (3600 * 24)) / 3600);
  const minutes = Math.floor((secondsRemaining % 3600) / 60);
  const seconds = secondsRemaining % 60;

  const isActive = card.status === "ACTIVE";
  const isReady = card.status === "READY";
  const isCompleted = card.status === "COMPLETED";
  const isLocked = card.status === "LOCKED";
  const isDeadlineReached = card.isDeadlineReached || (isActive && secondsRemaining === 0);

  const getCardTheme = () => {
    switch (card.key) {
      case "CHEMISTRY":
        return {
          glow: "from-blue-600/30 to-cyan-500/20",
          accent: "text-cyan-400",
          bar: "bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-400",
          borderBadge: "border-cyan-500/40 text-cyan-300 bg-cyan-950/40",
        };
      case "BIOLOGY":
        return {
          glow: "from-emerald-600/30 to-green-500/20",
          accent: "text-emerald-400",
          bar: "bg-gradient-to-r from-emerald-600 via-green-500 to-lime-400",
          borderBadge: "border-emerald-500/40 text-emerald-300 bg-emerald-950/40",
        };
      case "PHYSICS":
        return {
          glow: "from-purple-600/30 to-indigo-500/20",
          accent: "text-purple-400",
          bar: "bg-gradient-to-r from-purple-600 via-indigo-500 to-blue-400",
          borderBadge: "border-purple-500/40 text-purple-300 bg-purple-950/40",
        };
      case "ENGLISH":
        return {
          glow: "from-amber-600/30 to-orange-500/20",
          accent: "text-amber-400",
          bar: "bg-gradient-to-r from-amber-600 via-orange-500 to-yellow-400",
          borderBadge: "border-amber-500/40 text-amber-300 bg-amber-950/40",
        };
      case "MATHEMATICS":
        return {
          glow: "from-rose-600/30 to-pink-500/20",
          accent: "text-rose-400",
          bar: "bg-gradient-to-r from-rose-600 via-pink-500 to-red-400",
          borderBadge: "border-rose-500/40 text-rose-300 bg-rose-950/40",
        };
      default:
        return {
          glow: "from-slate-600/30 to-slate-500/20",
          accent: "text-slate-300",
          bar: "bg-slate-500",
          borderBadge: "border-slate-700 text-slate-400 bg-slate-900",
        };
    }
  };

  const theme = getCardTheme();

  return (
    <div
      className={`relative rounded-2xl transition-all duration-300 ${
        isActive
          ? "rotating-gradient-card p-6 border border-transparent shadow-2xl"
          : isReady
          ? "border-2 border-dashed border-cyan-500/40 bg-gradient-to-b from-cyan-950/20 to-slate-900/80 p-6"
          : isCompleted
          ? "border border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 to-slate-900/60 p-6"
          : "border border-slate-800/80 bg-slate-900/40 p-6 opacity-75 hover:opacity-90"
      }`}
    >
      {/* Top Header: Icon, Subject Name & Status Badge */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800/90 border border-slate-700 text-2xl shadow-inner">
            {card.icon}
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              {card.name.toUpperCase()}
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              {card.isPendingUpload
                ? "Roadmap Pending Upload"
                : `${card.totalTopics} Total Topics`}
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {isActive && !isDeadlineReached && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-cyan-500/10 border border-cyan-400/40 text-cyan-300 animate-pulse">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              ACTIVE
            </span>
          )}
          {isActive && isDeadlineReached && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-rose-500/20 border border-rose-500/50 text-rose-300">
              <AlertTriangle size={13} />
              DEADLINE REACHED
            </span>
          )}
          {isReady && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-amber-500/10 border border-amber-400/40 text-amber-300">
              <Sparkles size={13} />
              READY TO START
            </span>
          )}
          {isCompleted && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-emerald-500/10 border border-emerald-400/40 text-emerald-300">
              <CheckCircle2 size={13} />
              {card.isCompletedEarly ? "COMPLETED EARLY" : "COMPLETED"}
            </span>
          )}
          {isLocked && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-slate-800 border border-slate-700 text-slate-400">
              <Lock size={12} />
              LOCKED
            </span>
          )}
        </div>
      </div>

      {/* Real-Time Countdown or Status Message */}
      <div className="my-4">
        {isActive ? (
          <div>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                {days > 0 ? (
                  <>
                    <span>{days}</span>
                    <span className="text-sm font-bold text-slate-400 ml-1 mr-2">DAYS</span>
                    <span>{hours}</span>
                    <span className="text-sm font-bold text-slate-400 ml-1 mr-2">HRS</span>
                    <span>{minutes}</span>
                    <span className="text-sm font-bold text-slate-400 ml-1">MIN</span>
                  </>
                ) : (
                  <>
                    <span>{hours}</span>
                    <span className="text-sm font-bold text-slate-400 ml-1 mr-2">HRS</span>
                    <span>{minutes}</span>
                    <span className="text-sm font-bold text-slate-400 ml-1 mr-2">MIN</span>
                    <span className="text-cyan-400">{seconds}</span>
                    <span className="text-sm font-bold text-slate-400 ml-1">SEC</span>
                  </>
                )}
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 ml-auto">
                LEFT
              </span>
            </div>
            {card.deadline && (
              <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5">
                <Clock size={13} className="text-slate-500" />
                Target: {new Date(card.deadline).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            )}
          </div>
        ) : isReady ? (
          <div className="py-2">
            <div className="text-xl font-bold text-slate-200">
              Target Duration: 1 MONTH
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Press the start button to activate your 1-month countdown and unlock daily study tasks.
            </p>
          </div>
        ) : isCompleted ? (
          <div className="py-2">
            <div className="text-xl font-bold text-emerald-400 flex items-center gap-2">
              <Award size={20} />
              100% Subject Mastery Achieved
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {card.isCompletedEarly
                ? `Finished early by ${card.completedEarlyDays} days! Unused time rolls into next subjects.`
                : "All required curriculum units and topics completed."}
            </p>
          </div>
        ) : (
          <div className="py-2 text-slate-500 text-xs flex items-center gap-2">
            <Lock size={14} />
            <span>Unlocks automatically when previous subject is completed.</span>
          </div>
        )}
      </div>

      {/* Progress Bar and Completed / Remaining Statistics */}
      <div className="my-4 pt-3 border-t border-slate-800/80">
        <div className="flex items-center justify-between text-xs font-mono mb-2">
          <span className="text-slate-300 font-bold">
            {card.completedTopics} / {card.totalTopics} topics
          </span>
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 font-bold">
              {card.completionPercent}% COMPLETED
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-amber-400 font-bold">
              {card.remainingPercent}% REMAINING
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-700 ${theme.bar}`}
            style={{ width: `${card.completionPercent}%` }}
          />
        </div>
      </div>

      {/* Active Target / Next Focus Section */}
      {isActive && card.todayTarget && !isCompact && (
        <div className="mt-4 rounded-xl bg-slate-950/70 border border-slate-800 p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
              <Flame size={13} className="text-orange-400" />
              TODAY'S ROADMAP TARGET
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Target: {card.todayTarget.targetMinutes} min
            </span>
          </div>
          <div className="text-sm font-bold text-white mb-1">
            {card.todayTarget.unit}
          </div>
          <div className="text-xs font-semibold text-cyan-300 mb-2">
            → {card.todayTarget.topic}
          </div>

          {card.todayTarget.subtopics && card.todayTarget.subtopics.length > 0 && (
            <ul className="text-[11px] text-slate-400 space-y-1 mb-3 pl-2">
              {card.todayTarget.subtopics.map((sub, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-cyan-400" />
                  <span>{sub}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Action Buttons: START FOCUS & TEST MY UNDERSTANDING */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60">
            {onStartFocus && card.activeTopic && (
              <button
                onClick={() => onStartFocus(card.key, card.activeTopic)}
                className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-black tracking-wider uppercase transition shadow-md"
              >
                <Lock size={13} />
                LOCKED IN (FOCUS)
              </button>
            )}

            {onOpenQuiz && card.activeTopic && (
              <button
                onClick={() => onOpenQuiz(card.key, card.activeTopic!.id)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition"
              >
                <Zap size={13} />
                TEST UNDERSTANDING
              </button>
            )}
          </div>
        </div>
      )}

      {/* Start Button for Ready Subject */}
      {isReady && onStartSubject && (
        <div className="mt-4 pt-2">
          <button
            onClick={() => onStartSubject(card.key)}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-sm font-black tracking-wider uppercase transition shadow-lg hover:shadow-cyan-500/20 active:scale-[0.99]"
          >
            <Play size={16} fill="white" />
            START {card.name.toUpperCase()} (1 MONTH)
          </button>
        </div>
      )}

      {/* Weak & Strong Highlights if any */}
      {!isCompact && (card.strongAreas.length > 0 || card.weakAreas.length > 0) && (
        <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
          {card.strongAreas.length > 0 && (
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="font-bold">Strong:</span> {card.strongAreas[0].topicTitle} ({card.strongAreas[0].accuracy}%)
            </span>
          )}
          {card.weakAreas.length > 0 && (
            <span className="text-rose-400 flex items-center gap-1 ml-auto">
              <span className="font-bold">Next Focus:</span> {card.weakAreas[0].topicTitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
