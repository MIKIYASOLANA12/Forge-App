"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  LoaderCircle,
  Save,
  ShieldAlert,
  Send,
  CheckCircle2,
  Unlink,
  MessageSquare,
} from "lucide-react";
import { SecurityPanel } from "@/components/security/SecurityPanel";
import { useEffect, useState } from "react";

type Settings = {
  examDate: string;
  planStartDate: string;
  totalXp: number;
  level: number;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
};

type TelegramStatus = {
  linked: boolean;
  telegramId?: string;
  username?: string;
  verifiedAt?: string;
};

const dateInput = (value: string) => new Date(value).toISOString().slice(0, 10);

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus>({ linked: false });
  const [examDate, setExamDate] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [telegramMsg, setTelegramMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data: Settings) => {
        setSettings(data);
        setExamDate(dateInput(data.examDate));
      })
      .catch(() => {});

    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.telegram) {
          setTelegramStatus({
            linked: true,
            telegramId: data.user.telegram.telegramId,
            username: data.user.telegram.username,
            verifiedAt: data.user.telegram.verifiedAt,
          });
        }
      })
      .catch(() => {});
  }, []);

  const saveExamDate = async () => {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examDate }),
    });
    if (res.ok) {
      setSettings(await res.json());
      setEditing(false);
      setMessage("Exam date saved");
      window.setTimeout(() => setMessage(""), 2200);
    }
    setSaving(false);
  };

  const reset = async () => {
    if (confirmation !== "RESET") return;
    setSaving(true);
    const res = await fetch("/api/settings/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation }),
    });
    setMessage(res.ok ? "All logged progress was reset" : "Reset failed");
    setConfirmation("");
    setSaving(false);
  };

  const handleUnlinkTelegram = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/telegram/link", { method: "DELETE" });
      if (res.ok) {
        setTelegramStatus({ linked: false });
        setTelegramMsg({ type: "success", text: "Telegram account unlinked." });
      }
    } catch {
      setTelegramMsg({ type: "error", text: "Failed to unlink Telegram." });
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] p-6">
        <LoaderCircle size={16} className="animate-spin" /> Loading settings...
      </div>
    );
  }

  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(settings.planStartDate).getTime()) / 86400000));

  return (
    <div className="mx-auto w-full max-w-[1000px] animate-fade-in pb-10">
      <section className="mb-8 border-b border-[var(--border)] pb-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
          Settings / Control Room
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">Keep the system honest.</h1>
        <p className="mt-2 max-w-xl text-sm text-[var(--text-secondary)]">
          Update the inputs that shape your priorities and integrations. Everything else stays earned.
        </p>
      </section>

      <div className="space-y-5">
        {/* Telegram Assistant Section */}
        <section className="card border-[rgba(59,130,246,0.25)] bg-[linear-gradient(135deg,rgba(59,130,246,0.08),var(--bg-surface)_60%)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Send size={18} className="text-[var(--study)]" />
                <h2 className="text-lg font-bold">Telegram Assistant</h2>
              </div>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Connect your verified Telegram identity for real-time reminders, AI check-ins, and commands (/today, /progress, /workout).
              </p>
            </div>
            {telegramStatus.linked && (
              <span className="flex items-center gap-1 text-xs font-bold text-[var(--success)] bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.25)] px-2.5 py-1 rounded-full">
                <CheckCircle2 size={13} /> Active
              </span>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-[var(--border)]">
            {telegramStatus.linked ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    Linked: @{telegramStatus.username || telegramStatus.telegramId}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    Verified ID: {telegramStatus.telegramId}
                  </div>
                </div>
                <button
                  onClick={handleUnlinkTelegram}
                  disabled={saving}
                  className="btn btn-ghost btn-sm text-[var(--danger)] hover:bg-[rgba(239,68,68,0.1)] flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Unlink size={14} /> Disconnect
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[var(--text-secondary)]">
                  Use your bot <strong className="text-[var(--text-primary)]">@ForgeAppBot</strong> directly in Telegram. Send <code className="text-[var(--study)] font-mono">/start</code> to initialize commands.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="https://t.me/ForgeAppBot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm flex items-center gap-2"
                  >
                    <MessageSquare size={14} /> Open Forge in Telegram
                  </a>
                </div>
              </div>
            )}

            {telegramMsg && (
              <p
                className={`text-xs font-semibold mt-3 ${
                  telegramMsg.type === "success" ? "text-[var(--success)]" : "text-[var(--danger)]"
                }`}
              >
                {telegramMsg.text}
              </p>
            )}
          </div>
        </section>

        {/* Exam Date */}
        <section className="card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Grade 12 Entrance Exam Date</h2>
              <p className="mt-1 text-sm text-[var(--text-primary)]">
                {new Date(settings.examDate).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Changing this date updates your study priority curve and live countdown across the Command Center.
              </p>
            </div>
            <CalendarDays size={20} className="text-[var(--study)]" />
          </div>
          {editing ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                className="input w-48"
                type="date"
                value={examDate}
                onChange={(event) => setExamDate(event.target.value)}
              />
              <button className="btn btn-primary btn-sm" onClick={() => void saveExamDate()} disabled={saving}>
                <Save size={14} /> Save date
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button className="btn btn-ghost btn-sm mt-4" onClick={() => setEditing(true)}>
              Edit exam date
            </button>
          )}
        </section>

        {/* Challenges & Fixed Schedule Target Overview */}
        <section className="card border-slate-800 bg-slate-950/60">
          <h2 className="text-lg font-bold text-white mb-1">Active Protocols & Target Schedules</h2>
          <p className="text-xs text-slate-400 mb-4">Timezone: Africa/Addis_Ababa · Programmed targets and challenges</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-amber-500/20 bg-amber-950/15 p-4">
              <div className="text-xs font-black uppercase text-amber-400">🔥 7-Month Body Transformation</div>
              <div className="text-sm font-bold text-white mt-1">August 31, 2026 → March 10, 2027</div>
              <div className="text-xs text-slate-400 mt-1">Exact Challenge End Date: Wednesday, March 10, 2027</div>
            </div>

            <div className="rounded-xl border border-rose-500/20 bg-rose-950/15 p-4">
              <div className="text-xs font-black uppercase text-rose-400">🏡 16-Day Holiday Home Workout</div>
              <div className="text-sm font-bold text-white mt-1">August 31, 2026 → September 15, 2026</div>
              <div className="text-xs text-slate-400 mt-1">Auto-switches to bodyweight routines & reverts on completion</div>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-950/15 p-4">
              <div className="text-xs font-black uppercase text-blue-400">☀️ Daily Fixed Wake-Up Target</div>
              <div className="text-sm font-bold text-white mt-1">11:00 AM (Daily)</div>
              <div className="text-xs text-slate-400 mt-1">Daily Telegram wake-up alert dispatched at 11:00 AM</div>
            </div>

            <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/15 p-4">
              <div className="text-xs font-black uppercase text-indigo-400">🌙 Daily Target Sleep & Close</div>
              <div className="text-sm font-bold text-white mt-1">Close: 09:28 PM · Sleep: 11:00 PM</div>
              <div className="text-xs text-slate-400 mt-1">Daily cutoff passes at 09:28 PM · 8-hour sleep window</div>
            </div>
          </div>
        </section>

        {/* Plan Overview */}
        <section className="card">
          <h2 className="text-lg font-bold">Plan Overview</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-4">
            <Stat
              label="Plan started"
              value={new Date(settings.planStartDate).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            />
            <Stat label="Days elapsed" value={String(elapsed)} />
            <Stat label="Total XP" value={settings.totalXp.toLocaleString()} />
            <Stat label="Current level" value={String(settings.level)} />
          </div>
        </section>

        {/* Nutrition Targets */}
        <section className="card">
          <h2 className="text-lg font-bold">Nutrition Targets</h2>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Calories" value={`${settings.targetCalories} kcal`} />
            <Stat label="Protein" value={`${settings.targetProtein}g`} />
            <Stat label="Carbs" value={`${settings.targetCarbs}g`} />
            <Stat label="Fat" value={`${settings.targetFat}g`} />
          </div>
          <Link className="btn btn-ghost btn-sm mt-5 inline-block" href="/meals">
            Edit targets in Nutrition
          </Link>
        </section>

        {/* Security & Active Sessions */}
        <div id="security">
          <SecurityPanel />
        </div>

        {/* Danger Zone */}
        <section className="card border-[rgba(239,68,68,0.25)]">
          <div className="flex items-start gap-3">
            <ShieldAlert size={20} className="mt-0.5 text-[var(--danger)]" />
            <div>
              <h2 className="text-lg font-bold text-[var(--danger)]">Danger Zone</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                This permanently resets all logged session progress, logs, and XP to zero. Seeded structure (domains, exercises, lessons) is preserved.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <input
                  className="input max-w-xs text-sm"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder="Type RESET to confirm"
                  aria-label="Type RESET to confirm"
                />
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => void reset()}
                  disabled={confirmation !== "RESET" || saving}
                >
                  <AlertTriangle size={14} /> Reset all data
                </button>
              </div>
            </div>
          </div>
        </section>

        {message && <p className="text-sm font-semibold text-[var(--success)]">{message}</p>}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-block">
      <span className="stat-label">{label}</span>
      <span className="stat-value text-base">{value}</span>
    </div>
  );
}
