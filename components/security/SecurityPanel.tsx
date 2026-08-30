"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Clock,
  Globe,
  LoaderCircle,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Lock,
} from "lucide-react";

type Session = {
  id: string;
  device: string | null;
  location: string | null;
  ip: string | null;
  loggedInAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
};

type Attempt = {
  id: string;
  email?: string | null;
  device: string | null;
  location: string | null;
  ip: string | null;
  status: string;
  approvedAt?: string | null;
  attemptedAt: string;
};

type Feedback = { type: "success" | "error"; text: string } | null;

function parseDevice(ua?: string | null): { name: string; type: "desktop" | "mobile" | "tablet" } {
  if (!ua) return { name: "Unknown Device", type: "desktop" };

  let browser = "Browser";
  if (/chrome|crios/i.test(ua) && !/edge|opr/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/edg/i.test(ua)) browser = "Edge";
  else if (/opera|opr/i.test(ua)) browser = "Opera";

  let os = "Desktop";
  let type: "desktop" | "mobile" | "tablet" = "desktop";

  if (/windows/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) {
    os = "Android";
    type = /tablet|nexus 7|nexus 10/i.test(ua) ? "tablet" : "mobile";
  } else if (/iphone/i.test(ua)) {
    os = "iPhone";
    type = "mobile";
  } else if (/ipad/i.test(ua)) {
    os = "iPad";
    type = "tablet";
  } else if (/linux/i.test(ua)) os = "Linux";

  return { name: `${browser} · ${os}`, type };
}

function timeAgo(dateString?: string | null): string {
  if (!dateString) return "—";
  try {
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (diff < 30) return "Just now";
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(dateString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  PENDING: "Pending",
  APPROVED: "Approved",
  REVOKED: "Terminated",
};

export function SecurityPanel() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // Modal State for Terminate Confirmation
  const [sessionToTerminate, setSessionToTerminate] = useState<Session | null>(null);
  const [attemptToActOn, setAttemptToActOn] = useState<{ attempt: Attempt; action: "ALLOW" | "TERMINATE" } | null>(null);

  const fetchSecurityData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const [sessRes, actRes] = await Promise.all([
        fetch("/api/security/sessions", { cache: "no-store" }),
        fetch("/api/security/activity", { cache: "no-store" }),
      ]);

      if (sessRes.ok) {
        const sessData = await sessRes.json();
        setSessions(sessData?.sessions ?? []);
      }
      if (actRes.ok) {
        const actData = await actRes.json();
        setAttempts(actData?.attempts ?? actData?.activity ?? []);
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchSecurityData();

    const onFocus = () => void fetchSecurityData(true);
    window.addEventListener("focus", onFocus);
    window.addEventListener("forge:sessions_updated", onFocus);

    const interval = setInterval(() => void fetchSecurityData(true), 6000);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("forge:sessions_updated", onFocus);
      clearInterval(interval);
    };
  }, [fetchSecurityData]);

  const post = async (url: string, body: Record<string, unknown>) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  };

  const handleConfirmTerminate = async () => {
    if (!sessionToTerminate || runningId) return;
    const targetSession = sessionToTerminate;
    setRunningId(targetSession.id);
    setFeedback(null);
    setSessionToTerminate(null);

    try {
      // Optimistically remove from state immediately
      setSessions((prev) => prev.filter((x) => x.id !== targetSession.id));

      const { res, data } = await post("/api/security/terminate", {
        sessionId: targetSession.id,
        confirmCurrent: targetSession.isCurrent,
      });

      if (res.ok) {
        setFeedback({
          type: "success",
          text: targetSession.isCurrent
            ? "Current session terminated. Signing out..."
            : `Session for ${parseDevice(targetSession.device).name} was terminated.`,
        });

        // Re-fetch to ensure sync
        void fetchSecurityData(true);

        if (targetSession.isCurrent) {
          fetch("/api/auth/logout", { method: "POST" })
            .catch(() => {})
            .finally(() => {
              window.location.href = "/login?reason=terminated";
            });
        }
      } else {
        // Revert optimistic removal on error
        void fetchSecurityData(true);
        setFeedback({
          type: "error",
          text: data?.error || "Could not terminate this session. Please try again.",
        });
      }
    } catch {
      void fetchSecurityData(true);
      setFeedback({ type: "error", text: "Network error while terminating session." });
    } finally {
      setRunningId(null);
    }
  };

  const handleConfirmAttemptAction = async () => {
    if (!attemptToActOn || runningId) return;
    const { attempt, action } = attemptToActOn;
    const key = `${action}:${attempt.id}`;
    setRunningId(key);
    setFeedback(null);
    setAttemptToActOn(null);

    try {
      const newStatus = action === "ALLOW" ? "APPROVED" : "REVOKED";
      setAttempts((prev) =>
        prev.map((x) => (x.id === attempt.id ? { ...x, status: newStatus } : x))
      );

      const { res, data } = await post("/api/security/authorize", {
        activityId: attempt.id,
        action,
      });

      if (res.ok) {
        setFeedback({
          type: "success",
          text: action === "ALLOW" ? "Login attempt approved." : "Login attempt terminated.",
        });
        void fetchSecurityData(true);
      } else {
        void fetchSecurityData(true);
        setFeedback({ type: "error", text: data?.error || "Could not update attempt status." });
      }
    } catch {
      void fetchSecurityData(true);
      setFeedback({ type: "error", text: "Network error while updating attempt." });
    } finally {
      setRunningId(null);
    }
  };

  if (loading) {
    return (
      <div className="card flex items-center justify-center gap-2.5 py-10 text-sm text-[var(--text-muted)]">
        <LoaderCircle size={18} className="animate-spin text-[var(--study)]" />
        <span>Loading active sessions and security telemetry...</span>
      </div>
    );
  }

  const currentSession = sessions.find((s) => s.isCurrent);
  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return (
    <section className="card border-slate-800 bg-slate-950/80 backdrop-blur-sm relative">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mt-0.5">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Active Sessions & Device Security</h2>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-400">
                Server-Guarded
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400 max-w-xl">
              Inspect all devices currently authorized to access your Forge account. Terminating a session instantly revokes its access token across all pages and APIs.
            </p>
          </div>
        </div>

        <button
          onClick={() => void fetchSecurityData()}
          disabled={refreshing}
          className="btn btn-ghost btn-sm flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
          title="Refresh active sessions"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin text-blue-400" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`mt-4 p-3 rounded-xl border flex items-center justify-between text-xs font-semibold animate-fade-in ${
            feedback.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400"
              : "bg-rose-950/40 border-rose-500/30 text-rose-400"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white p-1">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── [1] ACTIVE SESSIONS LIST ────────────────────────────────────────── */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-slate-300">
              Active Sessions
            </h3>
            <span className="text-[11px] font-bold px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
              {sessions.length}
            </span>
          </div>
          <span className="text-[11px] text-slate-500">Live PostgreSQL Synchronization</span>
        </div>

        <div className="space-y-3">
          {/* Current Device Card */}
          {currentSession && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-4 transition-all duration-200">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                    <Laptop size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">
                        {parseDevice(currentSession.device).name}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Current Device
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate max-w-md font-mono">
                      {currentSession.device || "Current Browser Client"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={13} className="text-slate-500" />
                    <span>{currentSession.location || "Addis Ababa, ET"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Globe size={13} className="text-slate-500" />
                    <span className="font-mono">{currentSession.ip || "127.0.0.1"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} className="text-slate-500" />
                    <span>Active {timeAgo(currentSession.lastActiveAt)}</span>
                  </div>

                  <span className="text-[11px] font-semibold text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                    This Browser
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Other Active Devices */}
          {otherSessions.map((s) => {
            const dev = parseDevice(s.device);
            const DeviceIcon = dev.type === "mobile" ? Smartphone : dev.type === "tablet" ? Tablet : Monitor;
            const isBusy = runningId === s.id;

            return (
              <div
                key={s.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 p-4 transition-all duration-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300">
                      <DeviceIcon size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">{dev.name}</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Active
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate max-w-md font-mono">
                        {s.device || "Remote Client"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={13} className="text-slate-500" />
                      <span>{s.location || "Remote Location"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Globe size={13} className="text-slate-500" />
                      <span className="font-mono">{s.ip || "IP not logged"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={13} className="text-slate-500" />
                      <span>Active {timeAgo(s.lastActiveAt)}</span>
                    </div>

                    <button
                      onClick={() => setSessionToTerminate(s)}
                      disabled={isBusy}
                      className="btn btn-danger btn-sm text-xs font-bold px-3 py-1.5 flex items-center gap-1.5 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-transform"
                    >
                      {isBusy ? (
                        <>
                          <LoaderCircle size={13} className="animate-spin" />
                          <span>Terminating...</span>
                        </>
                      ) : (
                        <>
                          <Lock size={12} />
                          <span>Terminate</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Empty State when only current device exists */}
          {otherSessions.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-800/80 bg-slate-950/40 p-5 text-center">
              <p className="text-xs font-medium text-slate-400">
                No other active sessions. Your account is only signed in on this device.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── [2] RECENT LOGIN ACTIVITY FEED ───────────────────────────────────── */}
      <div className="mt-8 pt-6 border-t border-slate-800/80">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-slate-300">
              Recent Login Activity
            </h3>
            <span className="text-[11px] font-bold px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
              {attempts.length}
            </span>
          </div>
          <span className="text-[11px] text-slate-500">Security Audit Trail</span>
        </div>

        {attempts.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">No login history recorded yet.</p>
        ) : (
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {attempts.map((a) => {
              const dev = parseDevice(a.device);
              const isRevoked = a.status === "REVOKED";
              const isApproved = a.status === "APPROVED";
              const isPending = a.status === "PENDING";
              const canAct = isPending || a.status === "ACTIVE";

              return (
                <div
                  key={a.id}
                  className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert size={15} className={isRevoked ? "text-rose-400" : isApproved ? "text-emerald-400" : "text-amber-400"} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{dev.name}</span>
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isRevoked
                              ? "bg-rose-500/15 border border-rose-500/30 text-rose-400"
                              : isApproved
                              ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                              : isPending
                              ? "bg-amber-500/15 border border-amber-500/30 text-amber-400"
                              : "bg-blue-500/15 border border-blue-500/30 text-blue-400"
                          }`}
                        >
                          {STATUS_LABEL[a.status] || a.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {a.ip || "IP unknown"} · {a.location || "Location unknown"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-slate-400">
                    <span>{fmtDate(a.attemptedAt)}</span>

                    {canAct && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setAttemptToActOn({ attempt: a, action: "ALLOW" })}
                          className="btn btn-primary btn-sm text-[11px] px-2.5 py-1"
                        >
                          ALLOW
                        </button>
                        <button
                          onClick={() => setAttemptToActOn({ attempt: a, action: "TERMINATE" })}
                          className="btn btn-danger btn-sm text-[11px] px-2.5 py-1"
                        >
                          TERMINATE
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── [3] CONFIRMATION MODAL: TERMINATE SESSION ────────────────────────── */}
      {sessionToTerminate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Terminate this session?</h3>
                <p className="text-xs text-slate-400 mt-1">
                  This will immediately sign out <strong className="text-white">{parseDevice(sessionToTerminate.device).name}</strong> and revoke its access across all protected pages and APIs.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 text-xs space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Device:</span>
                <span className="font-semibold text-white">{parseDevice(sessionToTerminate.device).name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Location:</span>
                <span>{sessionToTerminate.location || "Addis Ababa, ET"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">IP Address:</span>
                <span className="font-mono">{sessionToTerminate.ip || "127.0.0.1"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Last Active:</span>
                <span>{timeAgo(sessionToTerminate.lastActiveAt)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setSessionToTerminate(null)}
                className="btn btn-ghost btn-sm text-xs text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleConfirmTerminate()}
                className="btn btn-danger btn-sm text-xs font-bold px-4 py-2 flex items-center gap-1.5"
              >
                <Lock size={13} />
                <span>Terminate Session</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── [4] CONFIRMATION MODAL: LOGIN ATTEMPT ACTION ────────────────────── */}
      {attemptToActOn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className={`p-3 rounded-xl border ${attemptToActOn.action === "ALLOW" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-rose-500/15 border-rose-500/30 text-rose-400"}`}>
                {attemptToActOn.action === "ALLOW" ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {attemptToActOn.action === "ALLOW" ? "Approve Login Attempt?" : "Terminate Login Attempt?"}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {attemptToActOn.action === "ALLOW"
                    ? "This will grant access and keep this device approved."
                    : "This will permanently block and terminate this login attempt."}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setAttemptToActOn(null)}
                className="btn btn-ghost btn-sm text-xs text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleConfirmAttemptAction()}
                className={`btn btn-sm text-xs font-bold px-4 py-2 ${attemptToActOn.action === "ALLOW" ? "btn-primary" : "btn-danger"}`}
              >
                <span>Confirm {attemptToActOn.action}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}