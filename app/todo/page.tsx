"use client";

import { useEffect, useState } from "react";
import {
  CheckSquare,
  Square,
  Plus,
  Flame,
  Clock3,
  Calendar,
  Sparkles,
  Zap,
  Award,
  AlertTriangle,
  BookOpen,
  Dumbbell,
  Code2,
  CheckCircle2,
  LoaderCircle,
  ArrowRight,
  TrendingUp,
  Target,
  Layers,
  Lock,
  History,
  XCircle,
  FlaskConical,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Sparkle
} from "lucide-react";
import { clsx } from "clsx";

type TaskItem = {
  id: string;
  dailyPlanId: string;
  domainId: string;
  description: string;
  displayTitle?: string;
  subtopics?: string[];
  isEntrancePriority?: boolean;
  minutesTarget: number;
  completed: boolean;
  status: "COMPLETED" | "MISSED" | "PENDING";
  isLocked?: boolean;
  subject?: string | null;
  topic?: string | null;
  priority?: string | null;
  xpTarget?: number | null;
  plannedStartTime?: string | null;
  plannedEndTime?: string | null;
  isStudy?: boolean;
  domain?: {
    name: string;
    color: string;
    icon: string;
  };
};

type YesterdayData = {
  dateFormatted: string;
  workout: { status: "COMPLETED" | "MISSED"; type: string };
  tasks: Array<{ id: string; description: string; completed: boolean; status: "COMPLETED" | "MISSED"; minutesTarget: number }>;
  completedCount: number;
  totalCount: number;
};

type StudyProgressData = {
  javascript: {
    dayNumber: number;
    totalDays: number;
    formattedDay: string;
    completedCount: number;
    totalItems: number;
    percentage: number;
    daysRemaining: number;
    requiredItemsPerDay: number;
    isBehind: boolean;
    statusText: string;
    catchUpWorkload: string;
    currentLesson: {
      id: string;
      title: string;
      module: string;
      mainTopic: string;
      itemRange: string;
      subtopics: string[];
      quizzes: string[];
      targetMinutes: number;
      learningTarget: string;
    };
    tomorrowLesson: {
      title: string;
      module: string;
      mainTopic: string;
      subtopics: string[];
      targetMinutes: number;
    };
  };
  chemistry: {
    dayNumber: number;
    totalDays: number;
    formattedDay: string;
    completedCount: number;
    totalTopics: number;
    percentage: number;
    daysRemaining: number;
    requiredTopicsPerDay: number;
    isBehind: boolean;
    statusText: string;
    catchUpWorkload: string;
    minutesPerDay: number;
    currentTopic: {
      id: string;
      name: string;
      weekNumber: number;
      subtopics: string[];
      difficulty: string;
      isEntrancePriority: boolean;
      practiceTarget: string;
      reviewTarget: string;
      sessionBreakdown: {
        learnMins: number;
        activeRecallMins: number;
        flashcardsMins: number;
        practiceMins: number;
        oldTopicRecallMins: number;
      };
    };
    tomorrowTopic: {
      name: string;
      subtopics: string[];
      targetMinutes: number;
    };
  };
};

type TodayPlanData = {
  planId: string | null;
  dateFormatted: string;
  day300: {
    dayNumber: number;
    totalDays: number;
    formatted: string;
    percentage: number;
    daysRemaining: number;
  };
  openTimeFormatted: string;
  closeTimeFormatted: string;
  closeTimestamp: number;
  nextUnlockTimestamp: number;
  isOpen: boolean;
  isClosed: boolean;
  tasks: TaskItem[];
  studyProgress?: StudyProgressData;
  yesterday?: YesterdayData;
};

type RoastData = {
  roast: string;
  category: string;
  missedItems: string[];
  consistencyScore: number;
  isPerfectDay: boolean;
};

function CountdownClock({ targetTimestamp, isClosed }: { targetTimestamp: number; isClosed: boolean }) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    const update = () => {
      const diff = targetTimestamp - Date.now();
      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ hours, minutes, seconds });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  if (!timeLeft) return <span className="font-mono">--:--:--</span>;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="flex items-center gap-1.5 font-mono text-sm font-black">
      <span className={clsx("px-2 py-1 rounded-md border", isClosed ? "bg-rose-950/40 text-rose-400 border-rose-500/30" : "bg-orange-950/40 text-orange-400 border-orange-500/30")}>
        {pad(timeLeft.hours)}h : {pad(timeLeft.minutes)}m : {pad(timeLeft.seconds)}s
      </span>
    </div>
  );
}

export default function TodoPage() {
  const [tab, setTab] = useState<"today" | "tomorrow" | "history">("today");
  const [todayData, setTodayData] = useState<TodayPlanData | null>(null);
  const [roastData, setRoastData] = useState<RoastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskMinutes, setNewTaskMinutes] = useState(45);
  const [newTaskPriority, setNewTaskPriority] = useState("MEDIUM");
  const [addingTask, setAddingTask] = useState(false);

  // Tomorrow planning state
  const [tomorrowTasks, setTomorrowTasks] = useState<
    Array<{ description: string; domainName: string; minutesTarget: number; priority: string; isStudy?: boolean }>
  >([]);
  const [savingTomorrow, setSavingTomorrow] = useState(false);
  const [tomorrowSavedMessage, setTomorrowSavedMessage] = useState("");

  const loadData = async () => {
    try {
      const [planRes, roastRes] = await Promise.all([
        fetch("/api/plan/today"),
        fetch("/api/accountability/roast"),
      ]);

      if (planRes.ok) {
        const p: TodayPlanData = await planRes.json();
        setTodayData(p);

        // Pre-populate tomorrow plan with roadmap targets if not already set
        if (p.studyProgress) {
          const nextChem = p.studyProgress.chemistry.tomorrowTopic;
          const nextJs = p.studyProgress.javascript.tomorrowLesson;
          setTomorrowTasks([
            {
              description: `Chemistry — ${nextChem.name} (Learn, Active Recall & Practice)`,
              domainName: "Study",
              minutesTarget: nextChem.targetMinutes || 85,
              priority: "HIGH",
              isStudy: true,
            },
            {
              description: `5 Million Coders / JavaScript — ${nextJs.title}`,
              domainName: "Coding",
              minutesTarget: nextJs.targetMinutes || 100,
              priority: "HIGH",
              isStudy: true,
            },
            {
              description: "Daily Scheduled Workout Session",
              domainName: "Workout",
              minutesTarget: 45,
              priority: "HIGH",
            },
            {
              description: "Focused Reading & Knowledge Synthesis",
              domainName: "Reading",
              minutesTarget: 30,
              priority: "MEDIUM",
            },
          ]);
        }
      }
      if (roastRes.ok) {
        const r = await roastRes.json();
        setRoastData(r);
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

  const handleToggleTask = async (task: TaskItem) => {
    if (task.completed || todayData?.isClosed) return;
    setCompletingId(task.id);
    setActionError("");

    try {
      const res = await fetch(`/api/plan/tasks/${task.id}/complete`, {
        method: "POST",
      });

      if (res.ok) {
        setTodayData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            tasks: prev.tasks.map((t) => (t.id === task.id ? { ...t, completed: true, status: "COMPLETED" } : t)),
          };
        });
      } else {
        const errJson = await res.json();
        setActionError(errJson.error || "Failed to complete task");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCompletingId(null);
    }
  };

  const handleAddTaskToday = async () => {
    if (!newTaskText.trim() || todayData?.isClosed) return;
    setAddingTask(true);

    try {
      const res = await fetch("/api/study/recommendation/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskText.trim(),
          targetDay: "today",
          minutes: newTaskMinutes,
          priority: newTaskPriority,
        }),
      });

      if (res.ok) {
        setNewTaskText("");
        await loadData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddingTask(false);
    }
  };

  const handleSaveTomorrowPlan = async () => {
    setSavingTomorrow(true);
    setTomorrowSavedMessage("");

    try {
      const res = await fetch("/api/plan/tomorrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: tomorrowTasks }),
      });

      if (res.ok) {
        const data = await res.json();
        setTomorrowSavedMessage(`✅ ${data.message || "Tomorrow's plan saved successfully!"}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingTomorrow(false);
    }
  };

  const completedCount = todayData?.tasks.filter((t) => t.completed).length || 0;
  const totalCount = todayData?.tasks.length || 0;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center gap-3 text-sm text-[var(--text-muted)]">
        <LoaderCircle size={20} className="animate-spin text-orange-500" />
        <span>Loading Daily Execution OS, Real Tasks & Study Schedules...</span>
      </div>
    );
  }

  const jsProgress = todayData?.studyProgress?.javascript;
  const chemProgress = todayData?.studyProgress?.chemistry;

  return (
    <div className="mx-auto w-full max-w-[1280px] animate-fade-in pb-16 space-y-6">
      {/* ── HEADER / DAILY ACTIVE WINDOW BANNER ──────────────────────────────── */}
      <section className="flex flex-col justify-between gap-5 border-b border-[var(--border)] pb-6 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-orange-500/15 text-orange-400 border border-orange-500/30">
              <Flame size={14} /> {todayData?.day300.formatted || "DAY 1 / 300"}
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-slate-300 bg-slate-900 border border-slate-800">
              <Calendar size={13} /> {todayData?.dateFormatted}
            </span>
            <span
              className={clsx(
                "px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border",
                todayData?.isOpen
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-400 border-rose-500/30"
              )}
            >
              {todayData?.isOpen ? "🟢 Window OPEN (05:00 AM - 09:28 PM)" : "🔴 Window CLOSED (Locked at 09:28 PM)"}
            </span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <CheckSquare className="text-orange-500" size={32} />
            Daily Execution OS & Study Schedules
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">
            Execution Window: <strong>05:00 AM – 09:28 PM</strong> Ethiopia Time. Chemistry (30-Day Goal) & 5 Million Coders JavaScript (14-Day Goal).
          </p>
        </div>

        {/* Live Window Countdown Clock & Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
            <Clock3 size={15} className={todayData?.isClosed ? "text-rose-400" : "text-orange-400"} />
            <span className="text-xs font-bold text-slate-400">
              {todayData?.isClosed ? "Unlocks in:" : "Closes in:"}
            </span>
            <CountdownClock
              targetTimestamp={todayData?.isClosed ? todayData.nextUnlockTimestamp : todayData?.closeTimestamp || Date.now()}
              isClosed={Boolean(todayData?.isClosed)}
            />
          </div>

          <div className="flex rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-1">
            <button
              className={`btn btn-sm ${
                tab === "today"
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm font-bold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
              onClick={() => setTab("today")}
            >
              Today ({completedCount}/{totalCount})
            </button>
            <button
              className={`btn btn-sm ${
                tab === "tomorrow"
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm font-bold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
              onClick={() => setTab("tomorrow")}
            >
              Plan Tomorrow
            </button>
            <button
              className={`btn btn-sm ${
                tab === "history"
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm font-bold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
              onClick={() => setTab("history")}
            >
              <History size={14} /> Yesterday
            </button>
          </div>
        </div>
      </section>

      {/* Action Error Alert */}
      {actionError && (
        <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-300 text-xs font-bold flex items-center gap-2">
          <AlertTriangle size={16} className="text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* ── ACCOUNTABILITY ROAST CARD ────────────────────────────────────────── */}
      {roastData && (
        <section
          className={clsx(
            "rounded-2xl border p-5 shadow-xl transition-all",
            roastData.isPerfectDay
              ? "border-emerald-500/40 bg-gradient-to-r from-emerald-950/30 via-slate-900 to-slate-950"
              : "border-orange-500/30 bg-gradient-to-r from-orange-950/20 via-slate-900 to-slate-950"
          )}
        >
          <div className="flex items-start gap-4">
            <div
              className={clsx(
                "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border",
                roastData.isPerfectDay
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                  : "bg-orange-500/20 text-orange-400 border-orange-500/40"
              )}
            >
              {roastData.isPerfectDay ? <Award size={20} /> : <AlertTriangle size={20} />}
            </div>

            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-400">
                  {roastData.isPerfectDay ? "🔥 Flawless Execution" : "🔥 Forge Accountability Engine"}
                </span>
                <span className="text-xs text-slate-500">· Consistency: {roastData.consistencyScore}%</span>
              </div>
              <p className="text-sm font-semibold text-slate-200 leading-relaxed whitespace-pre-line">
                "{roastData.roast}"
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── TAB 1: TODAY'S ACTIVE EXECUTION & STUDY SCHEDULES ───────────────── */}
      {tab === "today" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Main Column */}
          <div className="space-y-6">
            {/* ── SECTION A: TODAY'S STUDY ROADMAP SCHEDULE ───────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <GraduationCap className="text-orange-400" size={20} />
                  Today's Active Study Roadmaps
                </h3>
                <span className="text-xs font-bold text-slate-400">Exact Topic Breakdown</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* 🧪 Chemistry Card */}
                {chemProgress && (
                  <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/20 via-slate-900 to-slate-950 p-5 shadow-xl space-y-3 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                          <FlaskConical size={12} /> {chemProgress.formattedDay} (30-Day Goal)
                        </span>
                        <span className="text-[11px] font-bold text-cyan-300">
                          {chemProgress.statusText}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-base font-black text-white leading-snug">
                          {chemProgress.currentTopic.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                          <span>⏱️ {chemProgress.minutesPerDay} mins target</span>
                          <span>·</span>
                          <span className="text-amber-400 font-bold">Week {chemProgress.currentTopic.weekNumber}</span>
                          {chemProgress.currentTopic.isEntrancePriority && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              HIGH ENTRANCE WEIGHT
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Small Subtopics List */}
                      <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 space-y-1.5 text-xs">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                          Today's Small Topics:
                        </span>
                        <ul className="space-y-1 text-slate-200">
                          {chemProgress.currentTopic.subtopics.map((st, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-cyan-400 font-bold">→</span>
                              <span>{st}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* 5-Part Session Architecture Breakdown */}
                      <div className="grid grid-cols-5 gap-1 text-[10px] text-center font-bold">
                        <div className="p-1 rounded bg-slate-900 border border-slate-800">
                          <div className="text-slate-400">LEARN</div>
                          <div className="text-cyan-300">{chemProgress.currentTopic.sessionBreakdown.learnMins}m</div>
                        </div>
                        <div className="p-1 rounded bg-slate-900 border border-slate-800">
                          <div className="text-slate-400">RECALL</div>
                          <div className="text-cyan-300">{chemProgress.currentTopic.sessionBreakdown.activeRecallMins}m</div>
                        </div>
                        <div className="p-1 rounded bg-slate-900 border border-slate-800">
                          <div className="text-slate-400">CARDS</div>
                          <div className="text-cyan-300">{chemProgress.currentTopic.sessionBreakdown.flashcardsMins}m</div>
                        </div>
                        <div className="p-1 rounded bg-slate-900 border border-slate-800">
                          <div className="text-slate-400">DRILL</div>
                          <div className="text-cyan-300">{chemProgress.currentTopic.sessionBreakdown.practiceMins}m</div>
                        </div>
                        <div className="p-1 rounded bg-slate-900 border border-slate-800">
                          <div className="text-slate-400">REVIEW</div>
                          <div className="text-cyan-300">{chemProgress.currentTopic.sessionBreakdown.oldTopicRecallMins}m</div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <span>🎯 {chemProgress.currentTopic.practiceTarget}</span>
                    </div>
                  </div>
                )}

                {/* 💻 5 Million Coders — JavaScript Card */}
                {jsProgress && (
                  <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/20 via-slate-900 to-slate-950 p-5 shadow-xl space-y-3 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                          <Code2 size={12} /> {jsProgress.formattedDay} (14-Day Goal)
                        </span>
                        <span className="text-[11px] font-bold text-amber-300">
                          {jsProgress.statusText}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-base font-black text-white leading-snug">
                          {jsProgress.currentLesson.module}
                        </h4>
                        <p className="text-xs font-bold text-amber-400 mt-0.5">
                          {jsProgress.currentLesson.mainTopic} ({jsProgress.currentLesson.itemRange})
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                          <span>⏱️ {jsProgress.currentLesson.targetMinutes} mins target</span>
                          <span>·</span>
                          <span className="text-slate-300 font-bold">{jsProgress.completedCount}/154 items</span>
                        </div>
                      </div>

                      {/* JavaScript Roadmap Items List */}
                      <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 space-y-1.5 text-xs max-h-48 overflow-y-auto">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                          Today's Roadmap Items:
                        </span>
                        <ul className="space-y-1 text-slate-200">
                          {jsProgress.currentLesson.subtopics.map((st, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-amber-400 font-bold">→</span>
                              <span className={clsx(st.includes("Quiz:") ? "text-amber-200 font-semibold" : "")}>{st}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <span>🎯 {jsProgress.currentLesson.learningTarget}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── SECTION B: DAILY TASK CHECKLIST ───────────────────────────────── */}
            <div className="space-y-4">
              {/* Progress Metric Bar */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-white">Daily Execution Checklist</h3>
                    <p className="text-xs text-slate-400">
                      {todayData?.isClosed ? "🔒 Window closed at 09:28 PM" : "Check items as you complete each study and workout block"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-orange-400">{completionPercentage}%</div>
                    <div className="text-[11px] text-slate-500 font-bold">
                      {completedCount} of {totalCount} completed
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-2.5 w-full rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500"
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
              </div>

              {/* Task Cards List */}
              <div className="space-y-3">
                {todayData?.tasks.map((task) => {
                  const isExpanded = Boolean(expandedTasks[task.id]);
                  const hasSubtopics = Array.isArray(task.subtopics) && task.subtopics.length > 0;

                  return (
                    <article
                      key={task.id}
                      className={clsx(
                        "rounded-2xl border p-4 transition-all flex flex-col gap-2.5",
                        task.completed
                          ? "border-emerald-500/30 bg-emerald-950/10 opacity-80"
                          : todayData?.isClosed
                          ? "border-rose-500/30 bg-rose-950/10 opacity-70"
                          : "border-[var(--border)] bg-[var(--bg-surface)] hover:border-slate-700"
                      )}
                    >
                      <div className="flex items-start gap-3.5">
                        {/* Checkbox Button */}
                        <button
                          disabled={task.completed || todayData?.isClosed || completingId === task.id}
                          onClick={() => handleToggleTask(task)}
                          className={clsx(
                            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 transition-all",
                            task.completed
                              ? "border-emerald-500 bg-emerald-500 text-black shadow-sm font-bold cursor-default"
                              : todayData?.isClosed
                              ? "border-rose-500/40 bg-rose-950 text-rose-500 cursor-not-allowed"
                              : "border-slate-700 hover:border-orange-500 bg-slate-950 text-slate-500"
                          )}
                          aria-label="Toggle task completion"
                        >
                          {completingId === task.id ? (
                            <LoaderCircle size={14} className="animate-spin text-orange-400" />
                          ) : task.completed ? (
                            <CheckCircle2 size={16} strokeWidth={3} />
                          ) : todayData?.isClosed ? (
                            <Lock size={12} />
                          ) : (
                            <Square size={14} />
                          )}
                        </button>

                        {/* Task Header & Title */}
                        <div className="flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {task.domain && (
                              <span
                                className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border"
                                style={{
                                  backgroundColor: `${task.domain.color}15`,
                                  borderColor: `${task.domain.color}35`,
                                  color: task.domain.color,
                                }}
                              >
                                {task.domain.name}
                              </span>
                            )}
                            {task.priority && (
                              <span
                                className={clsx(
                                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                                  task.priority === "HIGH"
                                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                    : "bg-slate-800 text-slate-400"
                                )}
                              >
                                {task.priority}
                              </span>
                            )}
                            {task.isEntrancePriority && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                🎯 ENTRANCE PRIORITY
                              </span>
                            )}
                            {task.plannedStartTime && (
                              <span className="text-[11px] font-mono text-slate-400">
                                🕒 {task.plannedStartTime} {task.plannedEndTime ? `- ${task.plannedEndTime}` : ""}
                              </span>
                            )}
                          </div>

                          <h4
                            className={clsx(
                              "text-sm font-bold leading-snug",
                              task.completed
                                ? "line-through text-slate-400"
                                : todayData?.isClosed
                                ? "text-slate-300"
                                : "text-white"
                            )}
                          >
                            {task.displayTitle || task.description}
                          </h4>

                          <div className="flex items-center gap-3 text-xs text-slate-400 pt-0.5">
                            <span>⏱️ {task.minutesTarget} mins</span>
                            <span>·</span>
                            <span className="text-amber-400 font-bold">+{task.xpTarget || Math.round(task.minutesTarget * 1.2)} XP</span>
                            {task.completed && (
                              <span className="text-emerald-400 font-bold text-[11px]">✓ Completed & Saved</span>
                            )}
                            {!task.completed && todayData?.isClosed && (
                              <span className="text-rose-400 font-bold text-[11px]">🔴 MISSED (Closed at 09:28 PM)</span>
                            )}
                          </div>
                        </div>

                        {/* Subtopics Toggle */}
                        {hasSubtopics && (
                          <button
                            onClick={() =>
                              setExpandedTasks((prev) => ({
                                ...prev,
                                [task.id]: !prev[task.id],
                              }))
                            }
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                            title="Toggle Subtopics"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        )}
                      </div>

                      {/* Subtopics Drawer */}
                      {hasSubtopics && isExpanded && (
                        <div className="ml-10 mt-1 rounded-xl bg-slate-950/80 border border-slate-800 p-3 text-xs space-y-1.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                            Included Subtopics & Drills:
                          </span>
                          <ul className="space-y-1 text-slate-300">
                            {task.subtopics?.map((st, idx) => (
                              <li key={idx} className="flex items-start gap-1.5">
                                <span className="text-orange-400 font-bold">→</span>
                                <span>{st}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              {/* Fast Add Task Input */}
              {!todayData?.isClosed && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Add Quick Task</h4>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="Task description (e.g. Solve 15 Chemistry Equilibrium problems)..."
                      value={newTaskText}
                      onChange={(e) => setNewTaskText(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Mins"
                      value={newTaskMinutes}
                      onChange={(e) => setNewTaskMinutes(Number(e.target.value))}
                      className="w-20 rounded-xl border border-slate-700 bg-slate-950 px-2 py-2 text-xs font-mono text-center text-white focus:border-orange-500 focus:outline-none"
                    />
                    <button
                      onClick={handleAddTaskToday}
                      disabled={addingTask || !newTaskText.trim()}
                      className="btn btn-primary btn-sm rounded-xl font-bold flex items-center gap-1 shadow-md"
                    >
                      <Plus size={14} /> Add Task
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── SIDEBAR OVERVIEW ──────────────────────────────────────────────── */}
          <aside className="space-y-4">
            {/* 300-Day Milestone Tracker */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                  <Target size={14} /> 300-Day Journey
                </span>
                <span className="text-xs font-bold font-mono text-slate-400">
                  {todayData?.day300.percentage}% Done
                </span>
              </div>

              <div className="text-center py-2">
                <div className="text-4xl font-black text-white">{todayData?.day300.dayNumber}</div>
                <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mt-1">
                  Days Completed of 300
                </div>
                <div className="text-xs text-slate-500 mt-2 font-semibold">
                  {todayData?.day300.daysRemaining} days remaining
                </div>
              </div>
            </div>

            {/* 🎯 Deadline Progress Dashboard */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-lg space-y-4">
              <span className="text-xs font-extrabold uppercase tracking-wider text-orange-400 block border-b border-[var(--border)] pb-2">
                Target Deadlines & Pacing
              </span>

              {/* JavaScript 14-Day Status */}
              {jsProgress && (
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-400">💻 JavaScript (14-Day Goal)</span>
                    <span className="text-[11px] font-bold text-slate-300">{jsProgress.formattedDay}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{jsProgress.completedCount} / 154 items done</span>
                    <span className="font-bold text-white">{jsProgress.percentage}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: `${jsProgress.percentage}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>{jsProgress.daysRemaining} days left</span>
                    <span className="font-bold text-amber-300">{jsProgress.requiredItemsPerDay} items/day</span>
                  </div>
                </div>
              )}

              {/* Chemistry 30-Day Status */}
              {chemProgress && (
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-cyan-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-cyan-400">🧪 Chemistry (30-Day Goal)</span>
                    <span className="text-[11px] font-bold text-slate-300">{chemProgress.formattedDay}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{chemProgress.completedCount} / 30 topics done</span>
                    <span className="font-bold text-white">{chemProgress.percentage}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-cyan-400" style={{ width: `${chemProgress.percentage}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>{chemProgress.daysRemaining} days left</span>
                    <span className="font-bold text-cyan-300">{chemProgress.requiredTopicsPerDay} topic/day</span>
                  </div>
                </div>
              )}
            </div>

            {/* Protocol Execution Window Info */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-2 text-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-orange-400 block">
                Execution Window Protocol
              </span>
              <ul className="space-y-1.5 text-slate-300 leading-relaxed list-disc list-inside">
                <li>Opens: <strong>05:00 AM</strong> Addis Time</li>
                <li>Closes: <strong>09:28 PM</strong> Addis Time</li>
                <li>Unsubmitted items lock as <strong>MISSED</strong> at 09:28 PM.</li>
              </ul>
            </div>
          </aside>
        </div>
      )}

      {/* ── TAB 2: PLAN TOMORROW ────────────────────────────────────────────── */}
      {tab === "tomorrow" && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 space-y-6 shadow-xl">
          <div className="border-b border-[var(--border)] pb-4 space-y-1">
            <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
              <Clock3 className="text-orange-400" size={20} />
              Night Planning: Design Tomorrow's Targets
            </h3>
            <p className="text-xs text-slate-400">
              Tomorrow's study schedule is automatically derived from the 14-day JS and 30-day Chemistry roadmaps.
            </p>
          </div>

          <div className="space-y-4">
            {tomorrowTasks.map((t, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <input
                  type="text"
                  value={t.description}
                  onChange={(e) => {
                    const copy = [...tomorrowTasks];
                    copy[idx].description = e.target.value;
                    setTomorrowTasks(copy);
                  }}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-none"
                />
                <select
                  value={t.domainName}
                  onChange={(e) => {
                    const copy = [...tomorrowTasks];
                    copy[idx].domainName = e.target.value;
                    setTomorrowTasks(copy);
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-none"
                >
                  <option value="Study">Study</option>
                  <option value="Coding">Coding</option>
                  <option value="Workout">Workout</option>
                  <option value="Reading">Reading</option>
                  <option value="Business">Business</option>
                  <option value="Faith">Faith</option>
                </select>
                <input
                  type="number"
                  value={t.minutesTarget}
                  onChange={(e) => {
                    const copy = [...tomorrowTasks];
                    copy[idx].minutesTarget = Number(e.target.value);
                    setTomorrowTasks(copy);
                  }}
                  className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-mono text-center text-white focus:border-orange-500 focus:outline-none"
                />
                <span className="text-xs text-slate-400">mins</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] pt-4">
            <button
              onClick={() =>
                setTomorrowTasks((prev) => [
                  ...prev,
                  { description: "New Focus Block", domainName: "Study", minutesTarget: 45, priority: "MEDIUM" },
                ])
              }
              className="btn btn-ghost btn-sm text-xs text-slate-300 hover:text-white flex items-center gap-1"
            >
              <Plus size={14} /> Add Another Block
            </button>

            <div className="flex items-center gap-3">
              {tomorrowSavedMessage && (
                <span className="text-xs font-bold text-emerald-400">{tomorrowSavedMessage}</span>
              )}
              <button
                onClick={handleSaveTomorrowPlan}
                disabled={savingTomorrow}
                className="btn btn-primary btn-sm font-bold shadow-lg"
              >
                {savingTomorrow ? <LoaderCircle size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Save Tomorrow's Plan
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── TAB 3: YESTERDAY'S RESULTS & MISSED HISTORY ───────────────────────── */}
      {tab === "history" && todayData?.yesterday && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 space-y-6 shadow-xl">
          <div className="border-b border-[var(--border)] pb-4 space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                <History className="text-orange-400" size={20} />
                Yesterday's Execution Results & Missed History
              </h3>
              <span className="text-xs font-mono text-slate-400 font-bold">
                {todayData.yesterday.dateFormatted}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Audit log of completed vs missed targets from the previous 05:00 AM – 09:28 PM window.
            </p>
          </div>

          <div className="space-y-3">
            {/* Workout Status */}
            <div
              className={clsx(
                "p-4 rounded-xl border flex items-center justify-between",
                todayData.yesterday.workout.status === "COMPLETED"
                  ? "border-emerald-500/30 bg-emerald-950/10 text-emerald-300"
                  : "border-rose-500/30 bg-rose-950/10 text-rose-300"
              )}
            >
              <div className="flex items-center gap-3">
                <Dumbbell size={18} />
                <div>
                  <span className="text-sm font-bold text-white">Daily Workout: {todayData.yesterday.workout.type}</span>
                  <p className="text-xs text-slate-400">Window closed at 09:28 PM</p>
                </div>
              </div>
              <span
                className={clsx(
                  "px-2.5 py-1 rounded text-xs font-black uppercase tracking-wider",
                  todayData.yesterday.workout.status === "COMPLETED"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-rose-500/20 text-rose-400"
                )}
              >
                {todayData.yesterday.workout.status === "COMPLETED" ? "🟢 Completed" : "🔴 Missed"}
              </span>
            </div>

            {/* Yesterday Tasks */}
            {todayData.yesterday.tasks.map((yt) => (
              <div
                key={yt.id}
                className={clsx(
                  "p-4 rounded-xl border flex items-center justify-between",
                  yt.completed
                    ? "border-emerald-500/20 bg-emerald-950/10"
                    : "border-rose-500/20 bg-rose-950/10"
                )}
              >
                <div className="flex items-center gap-3">
                  {yt.completed ? (
                    <CheckCircle2 size={18} className="text-emerald-400" />
                  ) : (
                    <XCircle size={18} className="text-rose-400" />
                  )}
                  <div>
                    <span className={clsx("text-sm font-bold", yt.completed ? "text-white" : "text-slate-300")}>
                      {yt.description}
                    </span>
                    <p className="text-xs text-slate-400">{yt.minutesTarget} mins planned</p>
                  </div>
                </div>

                <span
                  className={clsx(
                    "px-2.5 py-1 rounded text-xs font-black uppercase tracking-wider",
                    yt.completed ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                  )}
                >
                  {yt.completed ? "🟢 Completed" : "🔴 Missed"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
