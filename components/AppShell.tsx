"use client";

import { useCallback, useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";

const SIDEBAR_COLLAPSED_KEY = "project-workbench-sidebar-collapsed";

export function AppShell({
  userDisplayName,
  isAdmin,
  pmSlugs,
  asOfDateLabel,
  children,
}: {
  userDisplayName: string | null;
  isAdmin: boolean;
  pmSlugs: string[];
  asOfDateLabel: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <div className="flex min-h-screen bg-surface-50 dark:bg-dark-bg">
      <AppSidebar
        userDisplayName={userDisplayName}
        isAdmin={isAdmin}
        pmSlugs={pmSlugs}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
      />
      <div
        className={`flex min-h-screen min-w-0 flex-1 flex-col transition-[margin] duration-200 ease-out motion-reduce:transition-none ${
          collapsed ? "ml-16" : "ml-[240px]"
        }`}
      >
        <header className="sticky top-[var(--env-banner-height,0px)] z-30 flex h-14 shrink-0 items-center justify-between border-b border-surface-200 bg-white/80 px-6 backdrop-blur-md dark:border-dark-border dark:bg-dark-bg/90">
          <h1 className="text-display-md font-bold text-surface-900 dark:text-white">
            Project Workbench
          </h1>
          <span className="text-label-md text-surface-500 dark:text-surface-400">
            As-of: {asOfDateLabel}
          </span>
        </header>
        <main className="flex-1 px-8 py-6">
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
