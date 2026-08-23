"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText, Download, ArrowLeft, RefreshCw, Calendar, Award,
  Flame, TrendingUp, CheckCircle2, AlertCircle, Shield, ChevronRight
} from "lucide-react";
import { clsx } from "clsx";

interface MonthlyReportItem {
  id: string;
  year: number;
  month: number;
  totalXp: number;
  endingLevel: number;
  xpEarned: number;
  workoutRate: number;
  studyRate: number;
  codingRate: number;
  readingRate: number;
  nutritionScore: number;
  habitRate: number;
  perfectDays: number;
  missedDays: number;
  longestStreak: number;
  bestDay: string;
  weakestDay: string;
  strongestArea: string;
  weakestArea: string;
  biggestImprovement: string;
  biggestDecline: string;
  createdAt: string;
  details?: any;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function MonthlyReportsArchive() {
  const [reports, setReports] = useState<MonthlyReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<MonthlyReportItem | null>(null);

  const loadReports = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/progress/reports");
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleGenerateCurrentMonth = async () => {
    try {
      setGenerating(true);
      const now = new Date();
      await fetch("/api/progress/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: now.getFullYear(), month: now.getMonth() + 1 }),
      });
      await loadReports();
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            href="/progress"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-400 hover:text-orange-300 mb-2"
          >
            <ArrowLeft size={14} />
            Back to Progress Dashboard
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <FileText className="text-orange-500" size={30} />
            Monthly Progress Reports & PDF Archive
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Server-rendered official certified progress reports with instant PDF downloads.
          </p>
        </div>

        <button
          onClick={handleGenerateCurrentMonth}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-md transition-all self-start md:self-auto"
        >
          <RefreshCw size={14} className={clsx(generating && "animate-spin")} />
          <span>{generating ? "Generating..." : "Generate Current Month Report"}</span>
        </button>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="animate-spin text-orange-500" size={28} />
        </div>
      ) : reports.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] text-center space-y-3">
          <FileText size={40} className="mx-auto text-[var(--text-muted)]" />
          <h3 className="text-lg font-bold text-white">No Monthly Reports Generated Yet</h3>
          <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
            Click the button above to generate your first official monthly progress report and PDF.
          </p>
          <button
            onClick={handleGenerateCurrentMonth}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-orange-500 hover:bg-orange-600 text-white"
          >
            Generate Monthly Report
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List of Report Cards */}
          <div className="lg:col-span-2 space-y-4">
            {reports.map((rep) => {
              const isSelected = selectedReport?.id === rep.id;
              const monthLabel = `${MONTH_NAMES[rep.month - 1]} ${rep.year}`;

              return (
                <div
                  key={rep.id}
                  className={clsx(
                    "p-5 rounded-2xl border transition-all bg-[var(--bg-surface)]",
                    isSelected ? "border-orange-500 ring-1 ring-orange-500" : "border-[var(--border)] hover:border-slate-700"
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                          {rep.year}
                        </span>
                        <h3 className="text-lg font-bold text-white">{monthLabel}</h3>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Status: Level {rep.endingLevel} • +{rep.xpEarned.toLocaleString()} XP Earned
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedReport(rep)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] text-white border border-[var(--border)]"
                      >
                        View Details
                      </button>

                      <a
                        href={`/api/progress/reports/${rep.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-orange-500 hover:bg-orange-600 text-white shadow-sm"
                      >
                        <Download size={13} />
                        <span>Download PDF</span>
                      </a>
                    </div>
                  </div>

                  {/* Quick KPI stats row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[var(--border)] text-xs">
                    <div>
                      <span className="text-[var(--text-muted)] block text-[11px]">Workout Rate</span>
                      <span className="font-bold text-white">{rep.workoutRate}%</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] block text-[11px]">Longest Streak</span>
                      <span className="font-bold text-orange-400">{rep.longestStreak} Days</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] block text-[11px]">Perfect Days</span>
                      <span className="font-bold text-emerald-400">{rep.perfectDays} Days</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] block text-[11px]">Strongest Area</span>
                      <span className="font-bold text-white truncate block">{rep.strongestArea}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Report Detail Preview Sidebar */}
          <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-sm space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Shield size={18} className="text-orange-400" />
              Report Analysis Summary
            </h3>

            {selectedReport ? (
              <div className="space-y-3.5 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-[var(--border)]">
                  <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
                    Executive Summary
                  </span>
                  <p className="text-white mt-1 leading-relaxed">
                    {MONTH_NAMES[selectedReport.month - 1]} {selectedReport.year} completed with +{selectedReport.xpEarned} XP earned and ending Level {selectedReport.endingLevel}. Peak streak reached {selectedReport.longestStreak} days with {selectedReport.perfectDays} perfect execution days.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-[var(--border)]">
                    <span className="text-[var(--text-muted)]">Best Day</span>
                    <span className="font-semibold text-emerald-400">{selectedReport.bestDay}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--border)]">
                    <span className="text-[var(--text-muted)]">Weakest Day</span>
                    <span className="font-semibold text-rose-400">{selectedReport.weakestDay}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--border)]">
                    <span className="text-[var(--text-muted)]">Biggest Improvement</span>
                    <span className="font-semibold text-white">{selectedReport.biggestImprovement}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--border)]">
                    <span className="text-[var(--text-muted)]">Area Needing Attention</span>
                    <span className="font-semibold text-amber-400">{selectedReport.biggestDecline}</span>
                  </div>
                </div>

                <a
                  href={`/api/progress/reports/${selectedReport.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl bg-orange-500 hover:bg-orange-600 text-white shadow-md transition-all mt-4"
                >
                  <Download size={14} />
                  <span>Download Full PDF Report</span>
                </a>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">
                Select any report from the list to preview the detailed analytics.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
