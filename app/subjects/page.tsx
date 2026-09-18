"use client";

import React, { useState, useEffect } from "react";
import {
  GraduationCap,
  Sparkles,
  TrendingUp,
  Clock,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Flame,
  Award,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { SubjectMasteryCard } from "@/components/dashboard/SubjectMasteryCard";
import { TopicQuizModal } from "@/components/study/TopicQuizModal";
import type { SubjectMasteryOverview, SubjectCardData } from "@/lib/subjectMasteryEngine";

export default function SubjectsPage() {
  const [overview, setOverview] = useState<SubjectMasteryOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeQuiz, setActiveQuiz] = useState<{ subject: string; topicId: string } | null>(null);

  const fetchOverview = async () => {
    try {
      const res = await fetch("/api/subjects");
      const data = await res.json();
      setOverview(data);
    } catch (err) {
      console.error("Error fetching subject overview:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleStartSubject = async (subjectKey: string) => {
    try {
      const res = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "START_SUBJECT",
          subject: subjectKey,
        }),
      });
      if (res.ok) {
        await fetchOverview();
      }
    } catch (err) {
      console.error("Error starting subject:", err);
    }
  };

  const handleOpenQuiz = (subjectKey: string, topicId: string) => {
    setActiveQuiz({ subject: subjectKey, topicId });
  };

  const handleStartFocus = (subjectKey: string, topic: any) => {
    // Navigate or link to locked in focus timer
    window.location.href = `/?focusSubject=${subjectKey}&topicId=${topic.id}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="text-xs font-mono text-slate-400">Loading Subject Mastery Matrix...</p>
        </div>
      </div>
    );
  }

  const activeCard = overview?.allSubjects.find((s) => s.status === "ACTIVE");
  const readyCard = overview?.allSubjects.find((s) => s.status === "READY");

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-white p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🇪🇹</span>
            <span className="text-xs font-black uppercase tracking-widest text-cyan-400">
              FORGE ACADEMIC ENGINE
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Sequential Subject Mastery
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Strict single-subject sequential preparation (Chemistry → Biology → Physics → English → Mathematics) mapped to official Ethiopian Ministry of Education curriculum roadmaps.
          </p>
        </div>

        {/* Exam Countdown Badge & Link to Progress */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 px-4 py-2.5 flex items-center gap-3">
            <GraduationCap className="text-blue-400" size={24} />
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-blue-300">
                FINAL ENTRANCE EXAM
              </div>
              <div className="text-sm font-bold text-white">
                {overview?.examCountdown.daysLeft} DAYS LEFT
              </div>
              <div className="text-[10px] text-slate-400">
                {overview?.examCountdown.formattedDate} ({overview?.examCountdown.ethiopianDate})
              </div>
            </div>
          </div>

          <Link
            href="/subjects/progress"
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 transition shadow"
          >
            <TrendingUp size={16} className="text-emerald-400" />
            <span>PROGRESS GRAPH</span>
          </Link>
        </div>
      </div>

      {/* Overview Statistics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="text-[11px] font-mono text-slate-400 mb-1 uppercase">Subjects Started</div>
          <div className="text-2xl font-black text-white">
            {overview?.overallStats.subjectsStarted} / 5
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {overview?.overallStats.subjectsCompleted} Completed
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="text-[11px] font-mono text-slate-400 mb-1 uppercase">Topics Mastered</div>
          <div className="text-2xl font-black text-cyan-400">
            {overview?.overallStats.completedTopicsAcrossAll} / {overview?.overallStats.totalTopicsAcrossAll}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {overview?.overallStats.overallCompletionPercent}% Overall Syllabus
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="text-[11px] font-mono text-slate-400 mb-1 uppercase">Questions Attempted</div>
          <div className="text-2xl font-black text-emerald-400">
            {overview?.overallStats.totalQuestionsAttempted}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {overview?.overallStats.overallAccuracy}% Overall Accuracy
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="text-[11px] font-mono text-slate-400 mb-1 uppercase">Active Status</div>
          <div className="text-xl font-black text-white">
            {overview?.activeSubject === "NONE" ? "NOT STARTED" : overview?.activeSubject}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {overview?.activeSubject === "NONE" ? "Ready for Chemistry" : "1 Month Target"}
          </div>
        </div>
      </div>

      {/* Prominent Current / Next Action Banner if not started */}
      {overview?.activeSubject === "NONE" && readyCard && (
        <div className="rounded-2xl border-2 border-cyan-500/50 bg-gradient-to-r from-blue-950/40 via-cyan-950/30 to-slate-900/60 p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="space-y-1">
            <span className="text-xs font-black uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
              <Sparkles size={14} />
              STUDY JOURNEY INITIAL STATE
            </span>
            <h2 className="text-2xl font-black text-white">
              Ready to begin: 🧪 CHEMISTRY
            </h2>
            <p className="text-xs text-slate-300 max-w-xl">
              All 16 Chemistry units and 70 topics are loaded. Press the button to start your official 1-month countdown. No timer runs until you click.
            </p>
          </div>

          <button
            onClick={() => handleStartSubject(readyCard.key)}
            className="w-full md:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-sm uppercase tracking-wider shadow-lg transition active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Zap size={18} fill="white" />
            START CHEMISTRY (1 MONTH)
          </button>
        </div>
      )}

      {/* Five Sequential Subject Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-cyan-400" />
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-300">
              5 FIXED SEQUENTIAL SUBJECTS
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Order: Chemistry → Biology → Physics → English → Mathematics
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {overview?.allSubjects.map((card) => (
            <SubjectMasteryCard
              key={card.key}
              card={card}
              onStartSubject={handleStartSubject}
              onOpenQuiz={handleOpenQuiz}
              onStartFocus={handleStartFocus}
            />
          ))}
        </div>
      </div>

      {/* Topic Quiz Modal */}
      {activeQuiz && (
        <TopicQuizModal
          isOpen={true}
          subjectKey={activeQuiz.subject}
          topicId={activeQuiz.topicId}
          onClose={() => setActiveQuiz(null)}
          onQuizCompleted={fetchOverview}
        />
      )}
    </div>
  );
}
