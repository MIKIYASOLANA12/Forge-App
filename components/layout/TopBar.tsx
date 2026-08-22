"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Calendar, LogOut, User as UserIcon } from "lucide-react";
import { format } from "date-fns";

export function TopBar() {
  const now = new Date();
  const router = useRouter();
  const [userName, setUserName] = useState<string>("Mikiyas Olana");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.name) {
          setUserName(data.user.name);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b border-[var(--border)] bg-[var(--bg-surface)] flex-shrink-0">
      {/* Date / greeting */}
      <div className="ml-10 md:ml-0">
        <div className="flex items-center gap-2">
          <Calendar size={13} className="text-[var(--text-muted)]" />
          <span className="text-sm text-[var(--text-secondary)] font-medium">
            {format(now, "EEEE, MMMM d")}
          </span>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-xs text-[var(--text-secondary)]">
          <UserIcon size={13} className="text-[var(--study)]" />
          <span className="font-semibold text-[var(--text-primary)]">{userName}</span>
        </div>

        <button
          id="notification-bell"
          className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          aria-label="Notifications"
        >
          <Bell size={16} />
        </button>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[var(--danger)] hover:bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.2)] transition-colors"
          title="Sign Out"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
