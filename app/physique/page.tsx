"use client";

import { useEffect, useState, useRef } from "react";
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Upload,
  Sparkles,
  Info,
  Calendar,
  Layers,
  Scale,
  FileText,
  Eye,
  Trash2,
  LoaderCircle,
  HelpCircle,
  Dumbbell,
  ArrowRight,
  Maximize2,
  Flame
} from "lucide-react";
import { POSE_GUIDES, type PoseGuide } from "@/lib/physiquePosingGuide";
import { clsx } from "clsx";

type CheckinData = {
  id?: string;
  monthNumber: number;
  date?: string;
  weightKg?: number | null;
  notes?: string | null;
  frontRelaxedUrl?: string | null;
  frontBicepsUrl?: string | null;
  backWingsUrl?: string | null;
  backBicepsUrl?: string | null;
  sideTricepsUrl?: string | null;
};

type RoadmapMonth = {
  monthNumber: number;
  label: string;
  isCompleted: boolean;
  data: CheckinData | null;
};

const POSE_KEYS: Array<{ key: keyof CheckinData; id: string; label: string; muscles: string }> = [
  { key: "frontRelaxedUrl", id: "front_relaxed", label: "1. Front Relaxed", muscles: "Chest, Neck, Abs, Core" },
  { key: "frontBicepsUrl", id: "front_biceps", label: "2. Front Double Biceps", muscles: "Biceps Peaks, Forearms, Front Delts" },
  { key: "backWingsUrl", id: "back_wings", label: "3. Back Lat Spread (Wings)", muscles: "Lats Width, V-Taper, Traps" },
  { key: "backBicepsUrl", id: "back_biceps", label: "4. Back Double Biceps", muscles: "Triceps Long Head, Rear Delts, Upper Back" },
  { key: "sideTricepsUrl", id: "side_triceps", label: "5. Side Chest & Triceps", muscles: "Triceps Horseshoe, Chest Depth" },
];

export default function PhysiqueDashboard() {
  const [roadmap, setRoadmap] = useState<RoadmapMonth[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Form State for currently selected month
  const [weight, setWeight] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [photos, setPhotos] = useState<{
    frontRelaxedUrl: string | null;
    frontBicepsUrl: string | null;
    backWingsUrl: string | null;
    backBicepsUrl: string | null;
    sideTricepsUrl: string | null;
  }>({
    frontRelaxedUrl: null,
    frontBicepsUrl: null,
    backWingsUrl: null,
    backBicepsUrl: null,
    sideTricepsUrl: null,
  });

  // Active Posing Guide Tab
  const [activeGuidePoseId, setActiveGuidePoseId] = useState<string>("front_relaxed");
  const [compareMonthA, setCompareMonthA] = useState<number>(0);
  const [compareMonthB, setCompareMonthB] = useState<number>(1);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/physique");
      if (res.ok) {
        const data = await res.json();
        setRoadmap(data.roadmap || []);
      }
    } catch (err) {
      console.error("Failed to load physique roadmap:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When selected month changes, load its existing data into the form
  useEffect(() => {
    const currentMonthData = roadmap.find((r) => r.monthNumber === selectedMonth)?.data;
    if (currentMonthData) {
      setWeight(currentMonthData.weightKg ? String(currentMonthData.weightKg) : "");
      setNotes(currentMonthData.notes || "");
      setPhotos({
        frontRelaxedUrl: currentMonthData.frontRelaxedUrl || null,
        frontBicepsUrl: currentMonthData.frontBicepsUrl || null,
        backWingsUrl: currentMonthData.backWingsUrl || null,
        backBicepsUrl: currentMonthData.backBicepsUrl || null,
        sideTricepsUrl: currentMonthData.sideTricepsUrl || null,
      });
    } else {
      setWeight("");
      setNotes("");
      setPhotos({
        frontRelaxedUrl: null,
        frontBicepsUrl: null,
        backWingsUrl: null,
        backBicepsUrl: null,
        sideTricepsUrl: null,
      });
    }
  }, [selectedMonth, roadmap]);

  // Client-side image compress to high-quality lightweight base64
  const handlePhotoUpload = (key: keyof typeof photos, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setPhotos((prev) => ({ ...prev, [key]: dataUrl }));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCheckin = async () => {
    try {
      setSaving(true);
      setSaveSuccess(null);

      const res = await fetch("/api/physique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthNumber: selectedMonth,
          weightKg: weight ? parseFloat(weight) : null,
          notes,
          ...photos,
        }),
      });

      if (res.ok) {
        setSaveSuccess(`✅ Month ${selectedMonth} physical check-in saved successfully!`);
        await loadData();
        setTimeout(() => setSaveSuccess(null), 4000);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const activeGuide = POSE_GUIDES.find((p) => p.id === activeGuidePoseId) || POSE_GUIDES[0];
  const completedCount = roadmap.filter((r) => r.isCompleted).length;
  const progressPercent = Math.round((completedCount / 8) * 100);

  const monthAData = roadmap.find((r) => r.monthNumber === compareMonthA)?.data;
  const monthBData = roadmap.find((r) => r.monthNumber === compareMonthB)?.data;

  return (
    <div className="mx-auto w-full max-w-[1400px] animate-fade-in space-y-8 pb-20">
      {/* Header Bar */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded-full flex items-center gap-1">
              <Flame size={12} />
              7-Month Physical Progression Roadmap
            </span>
            <span className="text-xs text-[var(--text-muted)]">Target: Chest, Back, Triceps, Biceps, Neck, Abs, Wings</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Camera className="text-orange-500" size={32} />
            Physical Body Transformation
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Monthly 5-pose check-in studio with posture stand guides and Telegram accountability reminders.
          </p>
        </div>

        {/* Progress Badge & Compare button */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300">
            <span>Progress:</span>
            <span className="text-orange-400 font-extrabold">{completedCount}/8 Checkpoints</span>
            <span className="text-slate-500">({progressPercent}%)</span>
          </div>

          <button
            onClick={() => setIsCompareOpen(!isCompareOpen)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md transition-all"
          >
            <Layers size={14} />
            <span>{isCompareOpen ? "Close Comparison" : "Compare Months"}</span>
          </button>
        </div>
      </section>

      {/* ── 7-MONTH ROADMAP TIMELINE ────────────────────────────────────────── */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
            Select Checkpoint to Upload or View
          </span>
          <span className="text-xs text-orange-400 font-semibold">
            Month {selectedMonth === 0 ? "0 (Baseline)" : selectedMonth} Active
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {roadmap.map((m) => {
            const isSelected = selectedMonth === m.monthNumber;
            return (
              <button
                key={m.monthNumber}
                onClick={() => setSelectedMonth(m.monthNumber)}
                className={clsx(
                  "p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between",
                  isSelected
                    ? "border-orange-500 bg-orange-500/10 shadow-md ring-1 ring-orange-500"
                    : m.isCompleted
                    ? "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/70"
                    : "border-[var(--border)] bg-[var(--bg-elevated)] hover:border-slate-700"
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-extrabold text-white">
                    {m.monthNumber === 0 ? "Baseline" : `M${m.monthNumber}`}
                  </span>
                  {m.isCompleted ? (
                    <CheckCircle2 size={14} className="text-emerald-400" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-slate-600" />
                  )}
                </div>

                <div className="text-[10px] text-[var(--text-muted)] font-medium truncate">
                  {m.isCompleted ? (
                    <span className="text-emerald-400 font-semibold">Photos Uploaded</span>
                  ) : (
                    <span>Pending Check-in</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── SIDE-BY-SIDE MONTH COMPARISON DRAWER ──────────────────────────────── */}
      {isCompareOpen && (
        <section className="rounded-2xl border border-blue-500/40 bg-gradient-to-b from-slate-900 via-[#0d1322] to-slate-950 p-6 shadow-2xl space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Layers size={18} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Side-by-Side Visual Comparison</h3>
                <p className="text-xs text-slate-400">Compare your upper body transformation across any two months</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={compareMonthA}
                onChange={(e) => setCompareMonthA(Number(e.target.value))}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {roadmap.map((m) => (
                  <option key={m.monthNumber} value={m.monthNumber}>
                    {m.monthNumber === 0 ? "Month 0 (Baseline)" : `Month ${m.monthNumber}`}
                  </option>
                ))}
              </select>
              <span className="text-xs font-bold text-slate-500">VS</span>
              <select
                value={compareMonthB}
                onChange={(e) => setCompareMonthB(Number(e.target.value))}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {roadmap.map((m) => (
                  <option key={m.monthNumber} value={m.monthNumber}>
                    {m.monthNumber === 0 ? "Month 0 (Baseline)" : `Month ${m.monthNumber}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Side by side poses grid */}
          <div className="space-y-6">
            {POSE_KEYS.map((pose) => {
              const photoA = monthAData ? (monthAData as any)[pose.key] : null;
              const photoB = monthBData ? (monthBData as any)[pose.key] : null;

              return (
                <div key={pose.key} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wide text-blue-400">{pose.label}</span>
                    <span className="text-[11px] text-slate-400">{pose.muscles}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Month A */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-300">
                        {compareMonthA === 0 ? "Month 0 (Baseline)" : `Month ${compareMonthA}`}
                      </div>
                      <div className="h-72 rounded-xl border border-slate-800 bg-slate-900/50 flex items-center justify-center overflow-hidden">
                        {photoA ? (
                          <img src={photoA} alt="Month A Pose" className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-xs text-slate-500">No photo uploaded</span>
                        )}
                      </div>
                    </div>

                    {/* Month B */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-300">
                        {compareMonthB === 0 ? "Month 0 (Baseline)" : `Month ${compareMonthB}`}
                      </div>
                      <div className="h-72 rounded-xl border border-slate-800 bg-slate-900/50 flex items-center justify-center overflow-hidden">
                        {photoB ? (
                          <img src={photoB} alt="Month B Pose" className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-xs text-slate-500">No photo uploaded</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 5-POSE STANDING & POSTURE GUIDE ─────────────────────────────────── */}
      <section className="rounded-2xl border border-orange-500/30 bg-gradient-to-r from-[#121019] via-[#161220] to-[#100d17] p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-500/15 text-orange-400 border border-orange-500/30">
              <HelpCircle size={18} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Posture & Camera Stand Master Guide</h2>
              <p className="text-xs text-slate-400">Step-by-step instructions for each of your 5 monthly upper body photos</p>
            </div>
          </div>

          {/* Guide pose selectors */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {POSE_GUIDES.map((pg) => (
              <button
                key={pg.id}
                onClick={() => setActiveGuidePoseId(pg.id)}
                className={clsx(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                  activeGuidePoseId === pg.id
                    ? "bg-orange-500 text-black shadow"
                    : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                )}
              >
                Pose {pg.poseNumber}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Guide Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-1">
          <div className="space-y-3 lg:col-span-2">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-orange-400">
                Pose {activeGuide.poseNumber} Target
              </span>
              <h3 className="text-lg font-extrabold text-white">{activeGuide.title}</h3>
              <p className="text-xs text-slate-300 font-medium">{activeGuide.subtitle}</p>
            </div>

            {/* Posture steps */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-200">Execution & Flexing Steps:</span>
              <ul className="space-y-1.5">
                {activeGuide.postureSteps.map((step, idx) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="h-4 w-4 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Master cue */}
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-300 font-semibold flex items-center gap-2">
              <Sparkles size={15} className="shrink-0" />
              <span>{activeGuide.masterCue}</span>
            </div>
          </div>

          {/* Camera Stand & Focus Muscles */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-400">
                Camera Stand & Lighting Specs
              </span>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Tripod/Stand Height:</span>
                  <span className="text-slate-200 font-semibold">{activeGuide.cameraStand.height}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Distance from Camera:</span>
                  <span className="text-slate-200 font-semibold">{activeGuide.cameraStand.distance}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Lighting Angle:</span>
                  <span className="text-slate-200 font-semibold">{activeGuide.cameraStand.lighting}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 block mb-1.5">
                Target Muscle Focus:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {activeGuide.targetMuscles.map((muscle) => (
                  <span
                    key={muscle}
                    className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-300"
                  >
                    {muscle}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5-POSE PHOTO UPLOAD STUDIO FOR CURRENT MONTH ──────────────────────── */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
          <div>
            <h2 className="text-lg font-extrabold text-white">
              Month {selectedMonth === 0 ? "0 (Baseline)" : selectedMonth} Check-in Studio
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Upload your 5 upper body photos and record bodyweight for this month's check-in
            </p>
          </div>

          <button
            onClick={handleSaveCheckin}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black shadow-lg transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? <LoaderCircle size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            <span>{saving ? "Saving Checkpoint..." : "Save Month Check-in"}</span>
          </button>
        </div>

        {saveSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-400 animate-fade-in">
            {saveSuccess}
          </div>
        )}

        {/* 5 Photo Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {POSE_KEYS.map((pose) => {
            const currentImg = photos[pose.key as keyof typeof photos];
            const fileInputRef = useRef<HTMLInputElement>(null);

            return (
              <div
                key={pose.key}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3.5 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-extrabold text-white">{pose.label}</span>
                    <button
                      onClick={() => setActiveGuidePoseId(pose.id)}
                      title="View Posing Guide"
                      className="text-[10px] text-orange-400 hover:underline flex items-center gap-0.5"
                    >
                      <span>Guide</span>
                      <ChevronRight size={11} />
                    </button>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">{pose.muscles}</p>
                </div>

                {/* Photo Display / Upload Area */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative h-64 w-full rounded-xl border border-dashed border-slate-700 bg-slate-950/70 hover:border-orange-500/60 cursor-pointer overflow-hidden flex flex-col items-center justify-center transition-all group"
                >
                  {currentImg ? (
                    <>
                      <img src={currentImg} alt={pose.label} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white text-xs font-bold gap-1">
                        <Upload size={18} />
                        <span>Replace Photo</span>
                      </div>
                    </>
                  ) : (
                    <div className="p-4 text-center space-y-2">
                      <Camera size={26} className="mx-auto text-slate-500 group-hover:text-orange-400 transition-colors" />
                      <div className="text-xs font-bold text-slate-300 group-hover:text-white">Tap to Upload Photo</div>
                      <p className="text-[10px] text-slate-500">JPG, PNG up to 10MB</p>
                    </div>
                  )}

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handlePhotoUpload(pose.key as keyof typeof photos, e.target.files[0]);
                      }
                    }}
                  />
                </div>

                {/* Clear action */}
                {currentImg && (
                  <button
                    onClick={() => setPhotos((prev) => ({ ...prev, [pose.key]: null }))}
                    className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center justify-center gap-1 pt-1"
                  >
                    <Trash2 size={12} />
                    <span>Remove Photo</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Checkpoint Stats & Reflection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-[var(--border)]">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Scale size={14} className="text-orange-400" />
              <span>Body Weight (kg)</span>
            </label>
            <input
              type="number"
              step="0.1"
              placeholder="e.g. 74.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <FileText size={14} className="text-orange-400" />
              <span>Month Reflection & Muscle Notes</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Chest thickness improved, wings wider on pullups, triceps horseshoe visible after heavy push..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
