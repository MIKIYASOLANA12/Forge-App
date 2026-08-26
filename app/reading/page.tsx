"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Calendar,
  Flame,
  Award,
  Sparkles,
  Zap,
  Target,
  AlertTriangle,
  Play,
  RotateCcw,
  LoaderCircle,
  Plus,
  HelpCircle,
  ArrowRight,
  TrendingUp,
  FileText,
  Compass,
  Check,
  Lock,
  Layers,
  ChevronRight
} from "lucide-react";
import { clsx } from "clsx";

type BookItem = {
  id: string;
  title: string;
  author: string | null;
  order: number;
  status: "queued" | "reading" | "finished";
  currentPage: number;
  totalPages: number;
  startPage: number;
  deadlineDays: number;
  category: string | null;
  goals: string | null;
  competencyTags: string | null;
  pacing?: {
    totalPages: number;
    currentPage: number;
    remainingPages: number;
    percentage: number;
    daysRemaining: number;
    requiredPagesPerDay: number;
    standardPagesPerDay: number;
    isBehind: boolean;
    statusText: string;
    todayChunk: {
      startPage: number;
      endPage: number;
      pagesCount: number;
      estimatedMinutes: number;
    };
  };
  reflections?: Array<{
    id: string;
    date: string;
    pagesReadToday: number;
    q1Understood: string | null;
    q2MainIdea: string | null;
    q3RealLifeUse: string | null;
    actionItem: string | null;
  }>;
};

type ReadingStatusData = {
  deadline2027: {
    targetDateFormatted: string;
    daysRemaining: number;
    daysPassed: number;
    totalJourneyDays: number;
    percentage: number;
    journeyFormatted: string;
  };
  activeBook: BookItem | null;
  queue: BookItem[];
  finishedBooks: BookItem[];
  stats: {
    booksCompletedCount: number;
    totalBooksCount: number;
    totalPagesRead: number;
    totalReflectionsCount: number;
  };
  developmentAreas: Array<{
    id: string;
    name: string;
    icon: string;
    color: string;
  }>;
};

export default function ReadingPage() {
  const [data, setData] = useState<ReadingStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"current" | "reflect" | "final-test" | "queue" | "competencies" | "add">("current");

  // Daily Reflection Form State
  const [reflectPages, setReflectPages] = useState<number>(12);
  const [reflectStartPage, setReflectStartPage] = useState<number>(1);
  const [reflectEndPage, setReflectEndPage] = useState<number>(12);
  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");
  const [q3, setQ3] = useState("");
  const [q4, setQ4] = useState("");
  const [q5, setQ5] = useState("");
  const [submittingReflect, setSubmittingReflect] = useState(false);
  const [reflectSuccessMessage, setReflectSuccessMessage] = useState("");

  // Final Test Form State
  const [fq1, setFq1] = useState("");
  const [fq2, setFq2] = useState("");
  const [fq3, setFq3] = useState("");
  const [fq4, setFq4] = useState("");
  const [fq5, setFq5] = useState("");
  const [fq6, setFq6] = useState("");
  const [fq7, setFq7] = useState("");
  const [submittingFinal, setSubmittingFinal] = useState(false);
  const [finalSuccessMessage, setFinalSuccessMessage] = useState("");

  // Add Book Form State
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newTotalPages, setNewTotalPages] = useState(300);
  const [newStartPage, setNewStartPage] = useState(1);
  const [newDeadlineDays, setNewDeadlineDays] = useState(30);
  const [newCategory, setNewCategory] = useState("discipline");
  const [newGoals, setNewGoals] = useState("");
  const [addingBook, setAddingBook] = useState(false);

  // 2027 Report Data
  const [reportData, setReportData] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const loadData = async () => {
    try {
      const res = await fetch("/api/reading/status");
      if (res.ok) {
        const d: ReadingStatusData = await res.json();
        setData(d);

        if (d.activeBook?.pacing?.todayChunk) {
          setReflectStartPage(d.activeBook.pacing.todayChunk.startPage);
          setReflectEndPage(d.activeBook.pacing.todayChunk.endPage);
          setReflectPages(d.activeBook.pacing.todayChunk.pagesCount);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSaveReflection = async () => {
    if (!data?.activeBook || !q1.trim() || !q2.trim()) return;
    setSubmittingReflect(true);
    setReflectSuccessMessage("");

    try {
      const res = await fetch("/api/reading/reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: data.activeBook.id,
          pagesReadToday: reflectPages,
          startPage: reflectStartPage,
          endPage: reflectEndPage,
          q1Understood: q1,
          q2MainIdea: q2,
          q3RealLifeUse: q3,
          q4Confused: q4,
          q5ChangeTomorrow: q5,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setReflectSuccessMessage(`✅ ${json.message || "Daily reflection saved successfully!"}`);
        setQ1("");
        setQ2("");
        setQ3("");
        setQ4("");
        setQ5("");
        await loadData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingReflect(false);
    }
  };

  const handleSaveFinalTest = async () => {
    if (!data?.activeBook || !fq1.trim() || !fq2.trim() || !fq3.trim()) return;
    setSubmittingFinal(true);
    setFinalSuccessMessage("");

    try {
      const res = await fetch("/api/reading/final-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: data.activeBook.id,
          q1FiveMainIdeas: fq1,
          q2ThinkingChanged: fq2,
          q3ActuallyApply: fq3,
          q4RealLifeExample: fq4,
          q5OwnWordsSummary: fq5,
          q6DisagreeIdea: fq6,
          q7StartDoing: fq7,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setFinalSuccessMessage(`🏆 ${json.message || "Book finished & next book unlocked!"}`);
        await loadData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingFinal(false);
    }
  };

  const handleAddBook = async () => {
    if (!newTitle.trim() || !newTotalPages) return;
    setAddingBook(true);

    try {
      const res = await fetch("/api/reading/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          author: newAuthor.trim(),
          totalPages: newTotalPages,
          startPage: newStartPage,
          deadlineDays: newDeadlineDays,
          category: newCategory,
          goals: newGoals,
        }),
      });

      if (res.ok) {
        setNewTitle("");
        setNewAuthor("");
        setNewGoals("");
        setActiveTab("queue");
        await loadData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddingBook(false);
    }
  };

  const handleLoadReport = async () => {
    setLoadingReport(true);
    try {
      const res = await fetch("/api/reading/report-2027");
      if (res.ok) {
        const rep = await res.json();
        setReportData(rep);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center gap-3 text-sm text-[var(--text-muted)]">
        <LoaderCircle size={20} className="animate-spin text-purple-500" />
        <span>Loading Sequential Reading OS & June 25, 2027 Life Preparation Engine...</span>
      </div>
    );
  }

  const activeBook = data?.activeBook;
  const deadline2027 = data?.deadline2027;

  return (
    <div className="mx-auto w-full max-w-[1280px] animate-fade-in pb-16 space-y-6">
      {/* ── 2027 LIFE PREPARATION BANNER ────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-purple-500/40 bg-gradient-to-br from-[#1c112e] via-[#140e24] to-[#0c0817] p-6 md:p-8 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1.5">
                <Target size={14} /> Major Life Deadline: June 25, 2027
              </span>
              <span className="text-xs text-slate-400 font-bold">
                {deadline2027?.journeyFormatted}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white">
              Forge Life Reading & Synthesis Engine
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Sequential 1-book deliberate study program. Preparing for communication, ethical influence, business, investing, personal branding, and high-stakes problem solving before{" "}
              <strong className="text-purple-300">{deadline2027?.targetDateFormatted}</strong>.
            </p>
          </div>

          {/* Countdown Clock to June 25, 2027 */}
          <div className="flex flex-col items-start md:items-end gap-1.5 bg-slate-950/90 p-5 rounded-2xl border border-purple-500/30 shadow-xl">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-purple-400">
              Days Remaining Until 2027
            </span>
            <div className="text-4xl font-black text-white font-mono">
              {deadline2027?.daysRemaining} <span className="text-sm font-sans text-slate-400">days</span>
            </div>
            <span className="text-xs text-slate-400 font-semibold">
              {deadline2027?.percentage}% of 303-Day Preparation Elapsed
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap rounded-xl border border-purple-500/30 bg-slate-950/80 p-1">
          <button
            className={`btn btn-sm ${
              activeTab === "current"
                ? "bg-purple-600 text-white shadow-sm font-bold"
                : "text-slate-400 hover:text-white"
            }`}
            onClick={() => setActiveTab("current")}
          >
            <BookOpen size={14} /> Current Book
          </button>
          <button
            className={`btn btn-sm ${
              activeTab === "reflect"
                ? "bg-purple-600 text-white shadow-sm font-bold"
                : "text-slate-400 hover:text-white"
            }`}
            onClick={() => setActiveTab("reflect")}
          >
            <FileText size={14} /> Daily Reflection (5 Questions)
          </button>
          <button
            className={`btn btn-sm ${
              activeTab === "final-test"
                ? "bg-purple-600 text-white shadow-sm font-bold"
                : "text-slate-400 hover:text-white"
            }`}
            onClick={() => setActiveTab("final-test")}
          >
            <Award size={14} /> Final Book Mastery Test
          </button>
          <button
            className={`btn btn-sm ${
              activeTab === "queue"
                ? "bg-purple-600 text-white shadow-sm font-bold"
                : "text-slate-400 hover:text-white"
            }`}
            onClick={() => setActiveTab("queue")}
          >
            <Layers size={14} /> Book Queue ({data?.queue.length})
          </button>
          <button
            className={`btn btn-sm ${
              activeTab === "competencies"
                ? "bg-purple-600 text-white shadow-sm font-bold"
                : "text-slate-400 hover:text-white"
            }`}
            onClick={() => {
              setActiveTab("competencies");
              void handleLoadReport();
            }}
          >
            <Compass size={14} /> 12 Competencies & 2027 Report
          </button>
          <button
            className={`btn btn-sm ${
              activeTab === "add"
                ? "bg-purple-600 text-white shadow-sm font-bold"
                : "text-slate-400 hover:text-white"
            }`}
            onClick={() => setActiveTab("add")}
          >
            <Plus size={14} /> Add Book
          </button>
        </div>
      </section>

      {/* ── TAB 1: CURRENT ACTIVE BOOK ───────────────────────────────────────── */}
      {activeTab === "current" && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Main Book Card */}
          {activeBook ? (
            <div className="space-y-6">
              <section className="rounded-2xl border border-purple-500/30 bg-slate-900/60 p-6 md:p-8 shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/30">
                      CURRENT ACTIVE BOOK · 01 IN FOCUS
                    </span>
                    <h2 className="text-2xl md:text-3xl font-black text-white mt-1">
                      {activeBook.title}
                    </h2>
                    <p className="text-sm font-bold text-slate-400">by {activeBook.author || "Unknown"}</p>
                  </div>

                  <div className="text-right">
                    <span className="text-2xl font-black text-purple-400 font-mono">
                      {activeBook.pacing?.percentage}%
                    </span>
                    <div className="text-xs text-slate-500 font-bold">
                      {activeBook.currentPage} / {activeBook.totalPages} pages
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="h-3 w-full rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-500"
                      style={{ width: `${activeBook.pacing?.percentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                    <span>{activeBook.pacing?.remainingPages} pages remaining</span>
                    <span className="font-bold text-purple-300">{activeBook.pacing?.statusText}</span>
                  </div>
                </div>

                {/* Today's Reading Prescription Card */}
                {activeBook.pacing?.todayChunk && (
                  <div className="rounded-2xl border border-purple-500/40 bg-purple-950/20 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                        <Clock size={14} /> Today's Scheduled Reading Chunk
                      </span>
                      <span className="text-xs font-bold font-mono text-purple-400">
                        ~{activeBook.pacing.todayChunk.estimatedMinutes} mins
                      </span>
                    </div>

                    <div className="text-lg font-black text-white">
                      Pages {activeBook.pacing.todayChunk.startPage} – {activeBook.pacing.todayChunk.endPage}
                      <span className="text-xs text-slate-400 font-normal ml-2">
                        ({activeBook.pacing.todayChunk.pagesCount} pages target)
                      </span>
                    </div>

                    <p className="text-xs text-slate-300">
                      Required pace to hit deadline: <strong>{activeBook.pacing.requiredPagesPerDay} pages/day</strong>.
                    </p>

                    <div className="pt-2 border-t border-purple-500/20 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs text-slate-400">
                        When you finish these pages, record today's 5-question reflection.
                      </span>
                      <button
                        onClick={() => setActiveTab("reflect")}
                        className="btn btn-primary btn-sm rounded-xl font-bold flex items-center gap-1.5 shadow-md"
                      >
                        <FileText size={14} /> Open Daily Reflection (+35 XP)
                      </button>
                    </div>
                  </div>
                )}

                {/* Core Learning Goals */}
                {activeBook.goals && (
                  <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-4 space-y-1.5 text-xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Book's Core Life Preparation Goals:
                    </span>
                    <p className="text-slate-200 leading-relaxed font-medium">{activeBook.goals}</p>
                  </div>
                )}

                {/* Ready for Final Mastery Test Button */}
                {activeBook.currentPage >= activeBook.totalPages && (
                  <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/20 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-black text-emerald-400">🎉 100% of Pages Completed!</div>
                      <p className="text-xs text-slate-300">Complete the 7-question final book test to unlock the next book.</p>
                    </div>
                    <button
                      onClick={() => setActiveTab("final-test")}
                      className="btn btn-primary btn-sm rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500"
                    >
                      <Award size={14} /> Start Final Test (+250 XP)
                    </button>
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-8 text-center text-slate-400 space-y-3">
              <BookOpen size={32} className="mx-auto text-purple-400" />
              <h3 className="text-lg font-bold text-white">No active book currently reading</h3>
              <p className="text-xs text-slate-400">Add a book or activate one from the queue.</p>
            </div>
          )}

          {/* Sidebar: Reading Metrics & Action Engine */}
          <aside className="space-y-4">
            {/* Reading Stats Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg space-y-4">
              <span className="text-xs font-extrabold uppercase tracking-wider text-purple-400 block border-b border-slate-800 pb-2">
                Reading Program Metrics
              </span>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-2xl font-black text-white">{data?.stats.booksCompletedCount}</div>
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mt-1">
                    Books Finished
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-2xl font-black text-purple-400">{data?.stats.totalPagesRead}</div>
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mt-1">
                    Pages Read
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Daily Reflections Logged</span>
                <span className="font-bold text-white font-mono">{data?.stats.totalReflectionsCount}</span>
              </div>
            </div>

            {/* Book to Real Life Action Principle */}
            <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/20 via-slate-900 to-slate-950 p-5 shadow-lg space-y-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                <Sparkles size={14} /> Book → Real Life Action
              </span>
              <p className="text-xs text-slate-200 leading-relaxed">
                Forge converts every book idea into a concrete daily behavior. We don't read to store trivia—we read to transform communication, business, and execution before 2027.
              </p>
            </div>
          </aside>
        </div>
      )}

      {/* ── TAB 2: DAILY REFLECTION FORM (5 QUESTIONS) ──────────────────────── */}
      {activeTab === "reflect" && (
        <section className="rounded-2xl border border-purple-500/30 bg-slate-900/70 p-6 md:p-8 space-y-6 shadow-xl">
          <div className="border-b border-slate-800 pb-4 space-y-1">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <FileText className="text-purple-400" size={20} />
                Daily Reading Reflection (5 Essential Questions)
              </h2>
              <span className="text-xs font-bold text-purple-300 font-mono">
                {activeBook?.title}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Concise active synthesis. Explain the core ideas in your own words to make them permanent.
            </p>
          </div>

          {reflectSuccessMessage && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{reflectSuccessMessage}</span>
            </div>
          )}

          {/* Page Range Read Today */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Start Page
              </label>
              <input
                type="number"
                value={reflectStartPage}
                onChange={(e) => {
                  const s = Number(e.target.value);
                  setReflectStartPage(s);
                  setReflectPages(Math.max(1, reflectEndPage - s + 1));
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-white focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                End Page
              </label>
              <input
                type="number"
                value={reflectEndPage}
                onChange={(e) => {
                  const end = Number(e.target.value);
                  setReflectEndPage(end);
                  setReflectPages(Math.max(1, end - reflectStartPage + 1));
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-white focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Pages Read Today
              </label>
              <input
                type="number"
                value={reflectPages}
                readOnly
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono text-purple-300 font-bold focus:outline-none"
              />
            </div>
          </div>

          {/* The 5 Reflection Questions */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-extrabold text-white block mb-1.5">
                1. What did you understand from today's reading?
              </label>
              <textarea
                rows={2}
                placeholder="Core concepts and principles explained in plain terms..."
                value={q1}
                onChange={(e) => setQ1(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-white block mb-1.5">
                2. What is the single most important idea?
              </label>
              <textarea
                rows={2}
                placeholder="The key insight that stands out the most..."
                value={q2}
                onChange={(e) => setQ2(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-white block mb-1.5">
                3. How can you use it in real life / projects?
              </label>
              <textarea
                rows={2}
                placeholder="Specific action, communication tactic, or engineering habit to apply..."
                value={q3}
                onChange={(e) => setQ3(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-white block mb-1.5">
                4. What confused you or requires deeper clarity?
              </label>
              <textarea
                rows={2}
                placeholder="Unresolved questions or difficult parts..."
                value={q4}
                onChange={(e) => setQ4(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-white block mb-1.5">
                5. What will you change tomorrow because of this?
              </label>
              <textarea
                rows={2}
                placeholder="Behavioral adjustment or new routine..."
                value={q5}
                onChange={(e) => setQ5(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-800 pt-4">
            <span className="text-xs text-slate-400">
              Awards <strong>+35 XP</strong> and automatically marks today's Todo reading task completed.
            </span>
            <button
              onClick={handleSaveReflection}
              disabled={submittingReflect || !q1.trim() || !q2.trim()}
              className="btn btn-primary font-bold px-6 py-2 rounded-xl flex items-center gap-2 shadow-lg"
            >
              {submittingReflect ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}
              Save Reflection & Advance Progress
            </button>
          </div>
        </section>
      )}

      {/* ── TAB 3: FINAL BOOK MASTERY TEST (7 QUESTIONS) ────────────────────── */}
      {activeTab === "final-test" && (
        <section className="rounded-2xl border border-emerald-500/30 bg-slate-900/70 p-6 md:p-8 space-y-6 shadow-xl">
          <div className="border-b border-slate-800 pb-4 space-y-1">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Award className="text-emerald-400" size={22} />
                Final Book Review & Mastery Assessment
              </h2>
              <span className="text-xs font-bold text-emerald-300 font-mono">
                {activeBook?.title}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Complete these 7 mastery questions to finalize this book, store your permanent review, and unlock the next book in the queue (+250 XP).
            </p>
          </div>

          {finalSuccessMessage && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{finalSuccessMessage}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-xs font-extrabold text-white block mb-1.5">
                1. What are the 5 most important ideas from this entire book?
              </label>
              <textarea
                rows={3}
                placeholder="1. ... 2. ... 3. ... 4. ... 5. ..."
                value={fq1}
                onChange={(e) => setFq1(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-white block mb-1.5">
                2. What specifically changed in your thinking or mindset?
              </label>
              <textarea
                rows={2}
                placeholder="How your perspective evolved compared to before reading..."
                value={fq2}
                onChange={(e) => setFq2(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-white block mb-1.5">
                3. What will you actually apply in your daily life or projects?
              </label>
              <textarea
                rows={2}
                placeholder="Concrete actions and habits..."
                value={fq3}
                onChange={(e) => setFq3(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-white block mb-1.5">
                4. Give a real-life example of applying this book's teachings.
              </label>
              <textarea
                rows={2}
                placeholder="A real scenario in software, communication, or fitness..."
                value={fq4}
                onChange={(e) => setFq4(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-white block mb-1.5">
                5. Explain the book to a friend in your own words (3 sentences).
              </label>
              <textarea
                rows={2}
                placeholder="Synthesized summary..."
                value={fq5}
                onChange={(e) => setFq5(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-white block mb-1.5">
                6. What idea in the book do you disagree with or nuance, and why?
              </label>
              <textarea
                rows={2}
                placeholder="Critical analysis of the author's arguments..."
                value={fq6}
                onChange={(e) => setFq6(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-white block mb-1.5">
                7. What will you start doing immediately because of this book?
              </label>
              <textarea
                rows={2}
                placeholder="Immediate non-negotiable standard..."
                value={fq7}
                onChange={(e) => setFq7(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-800 pt-4">
            <span className="text-xs text-slate-400">
              Awards <strong>+250 Mastery XP</strong> and unlocks the next queued book.
            </span>
            <button
              onClick={handleSaveFinalTest}
              disabled={submittingFinal || !fq1.trim() || !fq2.trim() || !fq3.trim()}
              className="btn btn-primary font-bold px-6 py-2 rounded-xl flex items-center gap-2 shadow-lg bg-emerald-600 hover:bg-emerald-500"
            >
              {submittingFinal ? <LoaderCircle size={15} className="animate-spin" /> : <Award size={15} />}
              Submit Mastery Review & Unlock Next Book
            </button>
          </div>
        </section>
      )}

      {/* ── TAB 4: SEQUENTIAL BOOK QUEUE ────────────────────────────────────── */}
      {activeTab === "queue" && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:p-8 space-y-6 shadow-xl">
          <div className="border-b border-slate-800 pb-4 space-y-1">
            <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
              <Layers className="text-purple-400" size={20} />
              Sequential Curriculum Queue (1 Book at a Time)
            </h3>
            <p className="text-xs text-slate-400">
              Books are unlocked in strict sequential order. Finishing a book unlocks the next in line.
            </p>
          </div>

          <div className="space-y-3">
            {[activeBook, ...(data?.queue || []), ...(data?.finishedBooks || [])]
              .filter(Boolean)
              .sort((a, b) => (a?.order || 0) - (b?.order || 0))
              .map((b, i) => {
                if (!b) return null;
                const isCurrent = b.id === activeBook?.id;
                const isFinished = b.status === "finished";

                return (
                  <div
                    key={b.id}
                    className={clsx(
                      "p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all",
                      isFinished
                        ? "border-emerald-500/30 bg-emerald-950/10 opacity-80"
                        : isCurrent
                        ? "border-purple-500/40 bg-purple-950/20 shadow-md"
                        : "border-slate-800 bg-slate-950/60 opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-slate-500">0{i + 1}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{b.title}</h4>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                              ACTIVE NOW
                            </span>
                          )}
                          {isFinished && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              COMPLETED
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">
                          {b.author || "Unknown"} · {b.totalPages} pages · ~{b.deadlineDays} days target
                        </p>
                      </div>
                    </div>

                    <div className="text-right text-xs font-mono">
                      {isFinished ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <Check size={14} /> Mastered
                        </span>
                      ) : isCurrent ? (
                        <span className="text-purple-300 font-bold">
                          {b.currentPage} / {b.totalPages} p ({b.pacing?.percentage}%)
                        </span>
                      ) : (
                        <span className="text-slate-500 flex items-center gap-1">
                          <Lock size={12} /> Queued
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* ── TAB 5: 12 LIFE COMPETENCIES & 2027 REPORT ───────────────────────── */}
      {activeTab === "competencies" && (
        <section className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:p-8 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <Compass className="text-purple-400" size={22} />
                  12 Life Competencies for June 25, 2027
                </h3>
                <p className="text-xs text-slate-400">
                  Targeted capability domains developed through sequential reading & deliberate application.
                </p>
              </div>

              <button
                onClick={handleLoadReport}
                disabled={loadingReport}
                className="btn btn-primary btn-sm rounded-xl font-bold flex items-center gap-1.5 shadow-md"
              >
                {loadingReport ? <LoaderCircle size={14} className="animate-spin" /> : <FileText size={14} />}
                Generate 2027 Life Report
              </button>
            </div>

            {/* 12 Competencies Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {data?.developmentAreas.map((area) => (
                <div
                  key={area.id}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 hover:border-purple-500/40 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{area.name}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: area.color,
                        width: `${Math.min(100, Math.max(15, (data?.stats.booksCompletedCount || 0) * 20))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full 2027 Life Preparation Report Viewer */}
          {reportData && (
            <section className="rounded-2xl border border-purple-500/40 bg-slate-950 p-6 md:p-8 space-y-6 shadow-2xl">
              <div className="border-b border-purple-500/30 pb-4 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">
                  CONFIDENTIAL LIFETIME AUDIT
                </span>
                <h3 className="text-2xl font-black text-white">{reportData.title}</h3>
                <div className="flex flex-wrap gap-3 text-xs text-slate-400 pt-1">
                  <span>Target: <strong>{reportData.targetDate}</strong></span>
                  <span>·</span>
                  <span>Days Left: <strong className="text-purple-300">{reportData.daysRemaining} days</strong></span>
                  <span>·</span>
                  <span>Journey: <strong className="text-white">{reportData.journeyProgress}</strong></span>
                </div>
              </div>

              {/* Summary Pillars */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <span className="text-purple-400 font-extrabold uppercase tracking-wider block">
                    📚 Reading Mastery
                  </span>
                  <div className="text-slate-200 font-medium">
                    {reportData.readingPillar.booksCompletedCount} of {reportData.readingPillar.totalBooksQueued} books completed
                  </div>
                  <div className="text-slate-400">{reportData.readingPillar.totalPagesRead} total pages read</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <span className="text-cyan-400 font-extrabold uppercase tracking-wider block">
                    💻 Academics & Coding
                  </span>
                  <div className="text-slate-200 font-medium">
                    {reportData.academics.totalMasteredTopics} topics mastered
                  </div>
                  <div className="text-slate-400">JavaScript + Chemistry active curriculum</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <span className="text-orange-400 font-extrabold uppercase tracking-wider block">
                    🏋️ Physical Protocol
                  </span>
                  <div className="text-slate-200 font-medium">
                    Level {reportData.physicalConsistency.level} ({reportData.physicalConsistency.currentXp} XP)
                  </div>
                  <div className="text-slate-400">{reportData.physicalConsistency.totalWorkoutsLogged} workouts logged</div>
                </div>
              </div>

              {/* Verdict & Focus Areas */}
              <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-950/20 space-y-2 text-xs">
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-300 block">
                  Strategic Verdict & Execution Mandate:
                </span>
                <p className="text-slate-200 font-semibold">{reportData.synthesis.verdict}</p>
              </div>
            </section>
          )}
        </section>
      )}

      {/* ── TAB 6: ADD CUSTOM BOOK ─────────────────────────────────────────── */}
      {activeTab === "add" && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:p-8 space-y-6 shadow-xl">
          <div className="border-b border-slate-800 pb-4 space-y-1">
            <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
              <Plus className="text-purple-400" size={20} />
              Add Custom Book with Dynamic Page Scheduling
            </h3>
            <p className="text-xs text-slate-400">
              Enter the exact page count of your specific book edition to compute precise daily pages.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Book Title *</label>
              <input
                type="text"
                placeholder="e.g. Zero to One"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Author</label>
              <input
                type="text"
                placeholder="e.g. Peter Thiel"
                value={newAuthor}
                onChange={(e) => setNewAuthor(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Total Pages (Edition Count) *</label>
              <input
                type="number"
                value={newTotalPages}
                onChange={(e) => setNewTotalPages(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs font-mono text-white focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Target Deadline (Days)</label>
              <input
                type="number"
                value={newDeadlineDays}
                onChange={(e) => setNewDeadlineDays(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs font-mono text-white focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Competency Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="discipline">Discipline & Habits</option>
                <option value="communication">Communication & Speaking</option>
                <option value="influence">Ethical Influence & Relationships</option>
                <option value="business">Business Fundamentals</option>
                <option value="startup">Startup & Product Thinking</option>
                <option value="personal_brand">Personal Brand & Creator Identity</option>
                <option value="money">Money Behavior & Psychology</option>
                <option value="investing">Investing & Assets</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Calculated Pace</label>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-purple-300 font-bold">
                ≈ {Math.max(1, Math.ceil(newTotalPages / (newDeadlineDays || 30)))} pages / day
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Core Learning Goals</label>
            <textarea
              rows={2}
              placeholder="What high-stakes skills will this book impart before June 25, 2027?"
              value={newGoals}
              onChange={(e) => setNewGoals(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end border-t border-slate-800 pt-4">
            <button
              onClick={handleAddBook}
              disabled={addingBook || !newTitle.trim()}
              className="btn btn-primary font-bold px-6 py-2 rounded-xl flex items-center gap-2 shadow-lg"
            >
              {addingBook ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />}
              Add to Reading Queue
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
