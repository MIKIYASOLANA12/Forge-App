"use client";

import { useEffect, useState } from "react";
import {
  Monitor,
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Clock,
  Globe,
  LoaderCircle,
  XCircle,
  CheckCircle2,
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
  const [runningId, setRunningId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/security/sessions").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/security/activity").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([sessData, actData]) => {
        if (cancelled) return;
        setSessions(sessData?.sessions ?? []);
        setAttempts(actData?.attempts ?? []);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const post = async (url: string, body: Record<string, unknown>) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  };
  const terminateSession = async (s: Session, confirmed = false) => {
    if (runningId) return; // no double-click
    setRunningId(s.id);
    setFeedback(null);
    try {
      const { res, data } = await post("/api/security/terminate", {
        sessionId: s.id,
        confirmCurrent: confirmed,
      });
      if (res.ok) {
        setFeedback({ type: "success", text: "Session terminated." });
        // Remove from the dashboard — the session is no longer active server-side.
        setSessions((prev) => prev.filter((x) => x.id !== s.id));
        // Refresh login activity to show REVOKED status
        fetch("/api/security/activity")
          .then((r) => (r.ok ? r.json() : null))
          .then((actData) => {
            if (actData?.attempts) setAttempts(actData.attempts);
            else if (actData?.activity) setAttempts(actData.activity);
          })
          .catch(() => {});

        if (s.isCurrent) {
          // We terminated our own device.
          fetch("/api/auth/logout", { method: "POST" })
            .catch(() => {})
            .finally(() => {
              window.location.href = "/login";
            });
        }
      } else if (data?.code === "CONFIRM_CURRENT") {
        const ok = window.confirm(
          "This is your CURRENT DEVICE. Terminating it signs you out of this browser immediately. Continue?"
        );
        if (ok) {
          setRunningId(null);
          await terminateSession(s, true);
        }
      } else {
        setFeedback({ type: "error", text: "Could not terminate this session." });
        console.error("Terminate failed:", data);
      }
    } catch (err) {
      setFeedback({ type: "error", text: "Could not terminate this session." });
      console.error("Terminate error:", err);
    } finally {
      setRunningId(null);
    }
  };

  const actOnAttempt = async (a: Attempt, action: "ALLOW" | "TERMINATE") => {
    if (runningId) return;
    const key = `${action}:${a.id}`;
    setRunningId(key);
    setFeedback(null);
    try {
      const { res, data } = await post("/api/security/authorize", {
        activityId: a.id,
        action,
      });
      if (res.ok) {
        const newStatus = action === "ALLOW" ? "APPROVED" : "REVOKED";
        setAttempts((prev) =>
          prev.map((x) => (x.id === a.id ? { ...x, status: newStatus } : x))
        );
        setFeedback({
          type: "success",
          text: action === "ALLOW" ? "Attempt approved." : "Attempt terminated.",
        });
        // If terminated, also refresh active sessions list
        if (action === "TERMINATE") {
          fetch("/api/security/sessions")
            .then((r) => (r.ok ? r.json() : null))
            .then((sessData) => {
              if (sessData?.sessions) setSessions(sessData.sessions);
            })
            .catch(() => {});
        }
      } else {
        setFeedback({ type: "error", text: "Could not update this attempt." });
        console.error("Authorize failed:", data);
      }
    } catch (err) {
      setFeedback({ type: "error", text: "Could not update this attempt." });
      console.error("Authorize error:", err);
    } finally {
      setRunningId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] py-6">
        <LoaderCircle size={16} className="animate-spin" /> Loading security data...
      </div>
    );
  }

  return (
    <section className="card border-[rgba(59,130,246,0.25)]">
      <div className="flex items-start gap-3">
        <ShieldCheck size={20} className="mt-0.5 text-[var(--study)]" />
        <div className="w-full">
          <h2 className="text-lg font-bold">Security</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Active logins and recent login activity. Terminating a session immediately blocks the
            device from protected pages and API routes.
          </p>
        </div>
      </div>

      {feedback && (
        <p
          className={`mt-4 text-sm font-semibold flex items-center gap-1.5 ${
            feedback.type === "success" ? "text-[var(--success)]" : "text-[var(--danger)]"
          }`}
        >
          {feedback.type === "success" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {feedback.text}
        </p>
      )}

      {/* Active Sessions */}
      <div className="mt-6">
        <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-secondary)]">
          Active Sessions
        </h3>
        {sessions.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">No active sessions.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {sessions.map((s) => {
              const busy = runningId === s.id;
              return (
                <li
                  key={s.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Monitor size={16} className="text-[var(--study)]" />
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {s.device || "Unknown device"}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          s.isCurrent
                            ? "text-[var(--success)] bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.25)]"
                            : "text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border)]"
                        }`}
                      >
                        {s.isCurrent ? "CURRENT DEVICE" : "OTHER DEVICE"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {s.location || "Unknown location"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Globe size={12} /> {s.ip || "IP not tracked"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> Logged in {fmtDate(s.loggedInAt)}
                      </span>
                      <button
                        onClick={() => void terminateSession(s)}
                        disabled={busy || runningId !== null}
                        className="btn btn-danger btn-sm flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {busy ? (
                          <>
                            <LoaderCircle size={13} className="animate-spin" /> Terminating session...
                          </>
                        ) : (
                          <>TERMINATE</>
                        )}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
{/* Login Activity */}
      <div className="mt-8">
        <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-secondary)]">
          Login Activity
        </h3>
        {attempts.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">No login activity recorded.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {attempts.map((a) => {
              const canAct = a.status === "ACTIVE" || a.status === "PENDING";
              const allowBusy = runningId === `ALLOW:${a.id}`;
              const termBusy = runningId === `TERMINATE:${a.id}`;
              return (
                <li
                  key={a.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <ShieldAlert size={15} className="text-[var(--study)]" />
                      <span className="font-semibold text-[var(--text-primary)]">
                        {a.device || "Unknown device"}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          a.status === "REVOKED"
                            ? "text-[var(--danger)] bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.25)]"
                            : a.status === "APPROVED"
                              ? "text-[var(--success)] bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.25)]"
                              : "text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border)]"
                        }`}
                      >
                        {STATUS_LABEL[a.status] || a.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {a.location || "Unknown location"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Globe size={12} /> {a.ip || "IP not tracked"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {fmtDate(a.attemptedAt)}
                      </span>
                    </div>
                  </div>
                  {canAct && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => void actOnAttempt(a, "ALLOW")}
                        disabled={allowBusy || runningId !== null}
                        className="btn btn-primary btn-sm flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {allowBusy ? (
                          <>
                            <LoaderCircle size={13} className="animate-spin" /> Approving...
                          </>
                        ) : (
                          <>ALLOW</>
                        )}
                      </button>
                      <button
                        onClick={() => void actOnAttempt(a, "TERMINATE")}
                        disabled={termBusy || runningId !== null}
                        className="btn btn-danger btn-sm flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {termBusy ? (
                          <>
                            <LoaderCircle size={13} className="animate-spin" /> Terminating...
                          </>
                        ) : (
                          <>TERMINATE</>
                        )}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}