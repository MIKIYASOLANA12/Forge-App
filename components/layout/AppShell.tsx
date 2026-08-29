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

    let isTerminated = false;
    const forceLogout = () => {
      if (isTerminated) return;
      isTerminated = true;
      try {
        fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      } catch {}
      window.location.replace("/login?reason=terminated");
    };

    // 1. Real-time Server-Sent Events (SSE) Stream
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/auth/session-stream");
      eventSource.addEventListener("session_revoked", () => {
        forceLogout();
      });
      eventSource.onerror = () => {
        // SSE connection dropped; heartbeat interval below acts as backup
      };
    } catch {}

    // 2. Fast 2-second Heartbeat Check
    const checkHeartbeat = async () => {
      if (isTerminated) return;
      try {
        const res = await fetch("/api/auth/heartbeat");
        if (res.status === 401) {
          forceLogout();
        }
      } catch {}
    };

    void checkHeartbeat();
    const interval = setInterval(checkHeartbeat, 2000);
    window.addEventListener("focus", checkHeartbeat);

    // 3. Global Fetch 401 Interceptor
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401 && !isAuthPage) {
        const urlStr = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url || "";
        if (!urlStr.includes("/api/auth/login") && !urlStr.includes("/api/auth/verify")) {
          forceLogout();
        }
      }
      return response;
    };

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(interval);
      window.removeEventListener("focus", checkHeartbeat);
      window.fetch = originalFetch;
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
