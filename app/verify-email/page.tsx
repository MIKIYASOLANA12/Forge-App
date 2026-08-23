"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Dumbbell, CheckCircle2, AlertCircle, RefreshCw, ArrowRight } from "lucide-react";
import Link from "next/link";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Verification link is invalid or expired.");
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setStatus("success");
          setTimeout(() => {
            router.push("/");
            router.refresh();
          }, 2000);
          return;
        }

        setStatus("error");
        setErrorMessage(data.error || "Verification link is invalid or expired.");
      } catch (err: any) {
        setStatus("error");
        setErrorMessage(err?.message || "Verification link is invalid or expired.");
      }
    };

    void verifyToken();
  }, [token, router]);

  return (
    <div className="w-full max-w-md relative z-10 animate-fade-in text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-blue-600 shadow-[0_0_25px_rgba(245,158,11,0.3)] mb-4">
        <Dumbbell size={28} className="text-black" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] mb-6">
        Email verification
      </h1>

      <div className="card border-[var(--border-active)] bg-[var(--bg-surface)] p-8">
        {status === "verifying" && (
          <div className="py-6 space-y-4">
            <RefreshCw size={36} className="animate-spin text-[var(--study)] mx-auto" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Verifying your email...
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Validating your secure single-use verification link.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="py-6 space-y-4 animate-fade-in">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[rgba(34,197,94,0.15)] text-[var(--success)]">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Email verified ✓
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Your Forge account is now active. Redirecting into the authenticated workspace...
            </p>
            <div className="pt-2">
              <Link href="/" className="btn btn-primary w-full flex items-center justify-center gap-2">
                Continue to Forge <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="py-6 space-y-4 animate-fade-in">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[rgba(239,68,68,0.15)] text-[var(--danger)]">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Verification failed
            </h2>
            <p className="text-sm text-[var(--danger)]">
              {errorMessage}
            </p>
            <div className="pt-4">
              <Link href="/login" className="btn btn-ghost w-full text-sm">
                Back to Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] px-4 py-12 relative">
      <Suspense fallback={<div className="text-sm text-[var(--text-muted)]">Verifying your email...</div>}>
        <VerifyContent />
      </Suspense>
    </div>
  );
}
