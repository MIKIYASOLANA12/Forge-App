"use client";

import { Bell, Calendar } from "lucide-react";
import { format } from "date-fns";

export function TopBar() {
  const now = new Date();

  return (
    <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b border-[var(--border)] bg-[var(--bg-surface)] flex-shrink-0">
      {/* Date / greeting */}
      <div className="ml-10 md:ml-0">
        <div className="flex items-center gap-2">
          <Calendar size={13} className="text-[var(--text-muted)]" />
          <span className="text-sm text-[var(--text-secondary)]">
            {format(now, "EEEE, MMMM d")}
          </span>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <button
          id="notification-bell"
          className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          aria-label="Notifications"
        >
          <Bell size={17} />
        </button>
      </div>
    </header>
  );
}
