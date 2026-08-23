"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Home, BarChart3, Target, BookOpen, UtensilsCrossed,
  Library, Heart, MessageSquare, BookMarked, Settings,
  Zap, X, Menu, Dumbbell, CalendarDays, TrendingUp,
} from "lucide-react";
import { clsx } from "clsx";

const NAV_ITEMS = [
  { href: "/", label: "Today", icon: Home },
  { href: "/workout", label: "Workout", icon: Dumbbell },
  { href: "/plans", label: "Plans", icon: CalendarDays },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/habits", label: "Habits", icon: Target },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/meals", label: "Nutrition", icon: UtensilsCrossed },
  { href: "/books", label: "Books", icon: Library },
  { href: "/faith", label: "Faith", icon: Heart },
  { href: "/agent", label: "Agent", icon: MessageSquare },
  { href: "/journal", label: "Journal", icon: BookMarked },
  { href: "/settings", label: "Settings", icon: Settings },
];

const DOMAIN_COLORS: Record<string, string> = {
  Workout: "#f97316",
  Study: "#3b82f6",
  Coding: "#22c55e",
  Reading: "#a855f7",
  Business: "#eab308",
  Faith: "#e2e8f0",
};

interface SidebarProps {
  totalXp?: number;
  level?: number;
  levelProgress?: number;
  examDaysLeft?: number;
}

export function Sidebar({
  totalXp = 0,
  level = 1,
  levelProgress = 0,
  examDaysLeft,
}: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-blue-600 flex items-center justify-center">
            <Dumbbell size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">FORGE</span>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-1">Personal Growth OS</p>
      </div>

      {/* XP / Level widget */}
      <div className="p-4 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Zap size={13} className="text-[var(--xp-gold)]" />
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Level {level}</span>
          </div>
          <span className="text-xs text-[var(--text-secondary)]">{totalXp.toLocaleString()} XP</span>
        </div>
        <div className="progress-bar">
          <div
            className="xp-bar-fill progress-fill"
            style={{ width: `${Math.round(levelProgress * 100)}%` }}
          />
        </div>
      </div>

      {/* Exam countdown */}
      {examDaysLeft !== undefined && examDaysLeft > 0 && (
        <div className="mx-3 mt-3 p-3 rounded-10 bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.2)] rounded-xl">
          <div className="text-xs font-semibold text-[var(--study)] uppercase tracking-wider mb-0.5">Exam Countdown</div>
          <div className="text-2xl font-bold text-[var(--text-primary)] leading-none">{examDaysLeft}</div>
          <div className="text-xs text-[var(--text-muted)]">days remaining</div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-active)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              )}
            >
              <Icon size={16} className={active ? "text-[var(--study)]" : ""} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Domain dots */}
      <div className="p-4 border-t border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)] mb-2 uppercase tracking-wider font-semibold">Domains</p>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(DOMAIN_COLORS).map(([name, color]) => (
            <div key={name} title={name} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-[var(--text-muted)]">{name.slice(0, 3)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="md:hidden fixed top-3.5 left-4 z-50 p-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)]"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle sidebar"
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside className={clsx(
        "hidden md:flex flex-col sidebar-width h-full bg-[var(--bg-surface)] border-r border-[var(--border)]",
      )}>
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      <aside className={clsx(
        "md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-[var(--bg-surface)] border-r border-[var(--border)] transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {sidebarContent}
      </aside>
    </>
  );
}
