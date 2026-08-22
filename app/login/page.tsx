"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Dumbbell,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activationNotice, setActivationNotice] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setActivationNotice(false);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Authentication failed. Please verify your credentials.");
        setLoading(false);
        return;
      }

      if (data.requiresActivation) {
        setActivationNotice(true);
        setLoading(false);
        return;
      }

      if (data.success) {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected network error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (res.ok) {
        setForgotSent(true);
      } else {
        setError(data.error || "Failed to send reset link.");
      }
    } catch (err: any) {
      setError(err?.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md relative z-10 animate-fade-in">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-blue-600 shadow-[0_0_25px_rgba(245,158,11,0.3)] mb-4">
          <Dumbbell size={28} className="text-black" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
          FORGE
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1.5 font-medium">
          Your personal growth OS.
        </p>
      </div>

      {/* Card Container */}
      <div className="card border-[var(--border-active)] bg-[var(--bg-surface)]/90 backdrop-blur-xl shadow-2xl p-6 sm:p-8">
        {/* Activation Notice Screen */}
        {activationNotice ? (
          <div className="text-center py-4 animate-fade-in">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[rgba(245,158,11,0.15)] text-[var(--xp-gold)] mb-4">
              <Mail size={24} />
            </div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Check your email
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
              We sent a secure activation link to:
              <br />
              <span className="font-semibold text-[var(--text-primary)]">{email}</span>
            </p>
            <div className="mt-6 p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-xs text-[var(--text-muted)] text-left flex items-start gap-2">
              <Sparkles size={16} className="text-[var(--xp-gold)] shrink-0 mt-0.5" />
              <span>Click the activation link in your email to enable your Forge session.</span>
            </div>
            <button
              type="button"
              onClick={() => setActivationNotice(false)}
              className="btn btn-ghost w-full mt-6 text-sm"
            >
              Back to Sign In
            </button>
          </div>
        ) : mode === "login" ? (
          /* Login Form */
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Sign In
              </h2>
              <span className="text-xs text-[var(--study)] font-mono">AUTHORIZED ONLY</span>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.25)] text-[var(--danger)] text-xs flex items-start gap-2 animate-fade-in">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="input pl-10 w-full text-sm"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setError("");
                  }}
                  className="text-xs text-[var(--study)] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="input pl-10 pr-10 w-full text-sm font-mono"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full mt-2 font-bold flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Authenticating...
                </>
              ) : (
                <>
                  Sign In <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        ) : (
          /* Forgot Password Form */
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Reset Password
              </h2>
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setForgotSent(false);
                  setError("");
                }}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Back to login
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.25)] text-[var(--danger)] text-xs flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {forgotSent ? (
              <div className="py-4 text-center space-y-3">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[rgba(34,197,94,0.15)] text-[var(--success)]">
                  <CheckCircle2 size={20} />
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  If this email address is authorized, a password reset link has been dispatched to your inbox.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setForgotSent(false);
                  }}
                  className="btn btn-ghost w-full text-xs mt-2"
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Enter your authorized Forge email. We will send you a secure, one-time password reset link.
                </p>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@gmail.com"
                      className="input pl-10 w-full text-sm"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary w-full mt-2 font-bold"
                >
                  {loading ? "Dispatching link..." : "Send Reset Link"}
                </button>
              </>
            )}
          </form>
        )}
      </div>

      {/* Footer info */}
      <div className="text-center mt-6">
        <p className="text-xs text-[var(--text-muted)]">
          FORGE Security Protected · Single-User Identity OS
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] px-4 py-12 relative overflow-hidden">
      {/* Ambient background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.12),transparent_70%)] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.1),transparent_70%)] pointer-events-none" />

      <Suspense fallback={<div className="text-sm text-[var(--text-muted)]">Loading FORGE...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
