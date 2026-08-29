"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Auth pages render without standard app navigation
  const isAuthPage =
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/");

  useEffect(() => {
    if (isAuthPage) return;

    let cancelled = false;
    const checkSession = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.status === 401 && !cancelled) {
          window.location.href = "/login?reason=terminated";
        }
      } catch {}
    };

    void checkSession();

    // Check periodically every 15 seconds and when the tab regains focus
    const interval = setInterval(checkSession, 15000);
    window.addEventListener("focus", checkSession);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", checkSession);
    };
  }, [isAuthPage, pathname]);

  if (isAuthPage) {
    return <main className="min-h-screen w-full">{children}</main>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar />
      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
