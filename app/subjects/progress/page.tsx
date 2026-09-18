"use client";

import React, { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  Zap,
  Target,
  Award,
  AlertTriangle,
  Flame,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

type TimeRange = "7D" | "30D" | "90D" | "180D" | "ALL";
type ActiveMetric =
  | "studyMinutes"
  | "topicsCompleted"
  | "questionsAttempted"
  | "questionAccuracy"
  | "consistencyScore"
  | "xpEarned";

export default function SubjectProgressPage() {
  const [range, setRange] = useState<TimeRange>("30D");
  const [metric, setMetric] = useState<ActiveMetric>("studyMinutes");
  const [timeSeries, setTimeSeries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectOverview, setSubjectOverview] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [progRes, overRes] = await Promise.all([
          fetch(`/api/subjects/progress?range=${range}`),
          fetch("/api/subjects"),
        ]);
        const progData = await progRes.json();
        const overData = await overRes.json();
        setTimeSeries(progData.timeSeries || []);
        setSubjectOverview(overData);
      } catch (err) {
        console.error("Error loading progress graph:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [range]);

  const getMetricConfig = () => {
    switch (metric) {
      case "studyMinutes":
        return {
          title: "Study Minutes",
          unit: "min",
          color: "#38bdf8",
          gradient: "url(#colorStudy)",
          description: "Total active focused study duration in Addis Ababa window.",
        };
      case "topicsCompleted":
        return {
          title: "Topics Completed",
          unit: "topics",
          color: "#4ade80",
          gradient: "url(#colorTopics)",
          description: "Curriculum roadmap topics fully studied & mastered.",
        };
      case "questionsAttempted":
        return {
          title: "Questions Attempted",
          unit: "questions",
          color: "#a855f7",
          gradient: "url(#colorQuestions)",
          description: "Number of academic entrance questions answered.",
        };
      case "questionAccuracy":
        return {
          title: "Question Accuracy",
          unit: "%",
          color: "#f59e0b",
          gradient: "url(#colorAccuracy)",
          description: "Percentage of correct answers on first attempt.",
        };
      case "consistencyScore":
        return {
          title: "Daily Consistency Score",
          unit: "%",
          color: "#22c55e",
          gradient: "url(#colorConsistency)",
          description: "Composite index of study, testing, and todo completion.",
        };
      case "xpEarned":
        return {
          title: "XP Earned",
          unit: "XP",
          color: "#eab308",
          gradient: "url(#colorXp)",
          description: "Academic & focus experience points accumulated.",
        };
    }
  };

  const currentMetricConfig = getMetricConfig();

  // Aggregate totals for the active range
  const totalValue = timeSeries.reduce((acc, curr) => acc + (curr[metric] || 0), 0);
  const averageValue =
    timeSeries.length > 0 ? Math.round(totalValue / timeSeries.length) : 0;

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-white p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <Link
            href="/subjects"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 mb-2 transition"
          >
            <ArrowLeft size={14} />
            BACK TO SUBJECTS DASHBOARD
          </Link>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
            <TrendingUp className="text-cyan-400" />
            Real-Time Academic Progress
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Persisted multi-dimensional analytics: study time, topic completions, question accuracy, and mastery curves.
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 self-start sm:self-auto">
          {(["7D", "30D", "90D", "180D", "ALL"] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                range === r
                  ? "bg-cyan-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Selector Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { key: "studyMinutes", label: "Study Minutes", icon: Clock },
          { key: "topicsCompleted", label: "Topics Done", icon: CheckCircle2 },
          { key: "questionsAttempted", label: "Questions", icon: Target },
          { key: "questionAccuracy", label: "Accuracy %", icon: Award },
          { key: "consistencyScore", label: "Consistency", icon: Flame },
          { key: "xpEarned", label: "XP Earned", icon: Zap },
        ].map((item) => {
          const Icon = item.icon;
          const isSelected = metric === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setMetric(item.key as ActiveMetric)}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                isSelected
                  ? "border-cyan-500 bg-cyan-950/30 text-white shadow-lg shadow-cyan-950/50"
                  : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <Icon size={16} className={isSelected ? "text-cyan-400" : "text-slate-500"} />
              <div className="mt-2">
                <span className="text-xs font-bold block">{item.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Large Interactive Chart Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400">
              {range} TIMELINE VIEW
            </span>
            <h2 className="text-xl font-black text-white">
              {currentMetricConfig.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {currentMetricConfig.description}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg">
              <span className="text-slate-400">Total: </span>
              <span className="font-bold text-white">
                {totalValue} {currentMetricConfig.unit}
              </span>
            </div>
            <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg">
              <span className="text-slate-400">Avg/Day: </span>
              <span className="font-bold text-white">
                {averageValue} {currentMetricConfig.unit}
              </span>
            </div>
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="h-80 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorStudy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorTopics" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4ade80" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorQuestions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorConsistency" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorXp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#eab308" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                fontSize={10}
                tickFormatter={(d) => d.slice(5)}
              />
              <YAxis stroke="#64748b" fontSize={10} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#334155",
                  borderRadius: "0.75rem",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey={metric}
                stroke={currentMetricConfig.color}
                strokeWidth={2}
                fillOpacity={1}
                fill={currentMetricConfig.gradient}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weak Areas & Mastery Breakdown Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strong & Improving Areas */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <h3 className="text-base font-bold text-white">Mastered & Strong Areas</h3>
          </div>
          <div className="space-y-2">
            {subjectOverview?.allSubjects
              .flatMap((s: any) => s.strongAreas)
              .slice(0, 5).length > 0 ? (
              subjectOverview.allSubjects
                .flatMap((s: any) => s.strongAreas)
                .slice(0, 5)
                .map((area: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800"
                  >
                    <span className="text-xs font-semibold text-slate-200">
                      {area.topicTitle}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {area.accuracy}%
                    </span>
                  </div>
                ))
            ) : (
              <p className="text-xs text-slate-500 py-4">
                No strong areas recorded yet. Begin your Chemistry study to build mastery data.
              </p>
            )}
          </div>
        </div>

        {/* Weak Areas & Next Focus */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-rose-400" />
            <h3 className="text-base font-bold text-white">Weak Areas & Targeted Focus</h3>
          </div>
          <div className="space-y-2">
            {subjectOverview?.allSubjects
              .flatMap((s: any) => s.weakAreas)
              .slice(0, 5).length > 0 ? (
              subjectOverview.allSubjects
                .flatMap((s: any) => s.weakAreas)
                .slice(0, 5)
                .map((area: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800"
                  >
                    <span className="text-xs font-semibold text-slate-200">
                      {area.topicTitle}
                    </span>
                    <span className="text-xs font-mono font-bold text-rose-400">
                      {area.accuracy}%
                    </span>
                  </div>
                ))
            ) : (
              <p className="text-xs text-slate-500 py-4">
                No weak areas flagged. Focus sessions and test attempts will track your weakness profile.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
