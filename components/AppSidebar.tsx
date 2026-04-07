"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { CalendarOff, Network, Users } from "lucide-react";

function OpenTabsIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 3v18" />
      <path d="M3 9h4" />
      <path d="M3 15h4" />
    </svg>
  );
}

const navItems = [
  { href: "/pm-dashboard", label: "PM Dashboard", active: true },
  { href: "/pgm-dashboard", label: "PGM Dashboard", active: true },
  { href: "/cad-dashboard", label: "CAD Dashboard", active: true },
  { href: "/pto-holidays", label: "PTO & Holidays", active: true },
  { href: "/projects", label: "Projects", active: true },
] as const;

function GridIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

/** First token of a display name, or best-effort from email local-part before @. */
function firstNameFromDisplay(displayName: string | null | undefined): string | null {
  if (!displayName?.trim()) return null;
  const t = displayName.trim();
  if (t.includes("@")) {
    const local = t.split("@")[0] ?? "";
    const raw = local.split(/[._-]/)[0] ?? local;
    if (!raw) return null;
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  }
  const first = t.split(/\s+/)[0];
  return first || null;
}

export function AppSidebar({
  userDisplayName,
  isAdmin,
  pmSlugs: pmSlugsFromServer,
  collapsed = false,
  onToggleCollapse,
}: {
  userDisplayName: string | null;
  isAdmin: boolean;
  /** When provided (from layout), sidebar skips client fetch for "Open my projects". */
  pmSlugs?: string[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const [pmSlugsFetched, setPmSlugsFetched] = useState<string[] | null>(null);
  const pmSlugs =
    pmSlugsFromServer ?? (pmSlugsFetched !== null ? pmSlugsFetched : null);

  useEffect(() => {
    if (pmSlugsFromServer != null) return;
    let cancelled = false;
    fetch("/api/projects/my-pm-slugs")
      .then((res) => (res.ok ? res.json() : { slugs: [] }))
      .then((data: { slugs?: string[] }) => {
        if (!cancelled && Array.isArray(data.slugs)) setPmSlugsFetched(data.slugs);
      })
      .catch(() => {
        if (!cancelled) setPmSlugsFetched([]);
      });
    return () => {
      cancelled = true;
    };
  }, [pmSlugsFromServer]);

  function openMyProjectsInNewWindow() {
    if (!pmSlugs?.length || typeof document === "undefined") return;
    const origin = window.location.origin;
    const base = `${origin}/projects`;
    // Use temporary <a target="_blank"> and .click() so the browser allows multiple new tabs
    // from one user gesture (popup blockers often allow link clicks but block multiple window.open).
    for (const slug of pmSlugs) {
      const a = document.createElement("a");
      a.href = `${base}/${slug}`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  const openPmTitle =
    pmSlugs === null
      ? "Loading project count…"
      : `Open all projects where you are PM in new tabs (${pmSlugs.length} project${pmSlugs.length === 1 ? "" : "s"})`;

  const firstName = firstNameFromDisplay(userDisplayName);
  const sidebarGreeting = firstName ? `Hi ${firstName}` : "Hi";

  return (
    <aside
      className={`fixed left-0 top-[var(--env-banner-height,0px)] z-20 flex h-[calc(100vh-var(--env-banner-height,0px))] flex-col overflow-y-auto overflow-x-hidden border-r border-surface-200 bg-surface-100 transition-[width] duration-200 ease-out motion-reduce:transition-none dark:border-dark-border dark:bg-dark-raised ${
        collapsed ? "w-16" : "w-[240px]"
      }`}
      aria-label="Application"
    >
      <div
        className={`flex h-14 shrink-0 items-center border-b border-surface-200 dark:border-dark-border ${
          collapsed ? "justify-center px-1" : "gap-2 px-2"
        }`}
      >
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            aria-controls="app-sidebar-nav"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-surface-600 transition-colors hover:bg-surface-200 dark:text-surface-300 dark:hover:bg-dark-muted"
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
        )}
        {!collapsed && (
          <span
            className="min-w-0 truncate text-title-md font-semibold text-surface-900 dark:text-white"
            title={sidebarGreeting}
          >
            {sidebarGreeting}
          </span>
        )}
      </div>
      <nav
        id="app-sidebar-nav"
        className={`flex flex-1 flex-col gap-0.5 ${collapsed ? "items-center px-1 py-2" : "p-2"}`}
        aria-label="Main"
      >
        <button
          type="button"
          onClick={openMyProjectsInNewWindow}
          disabled={pmSlugs === null}
          title={openPmTitle}
          className={`flex items-center rounded-md text-body-sm font-medium text-surface-700 transition-colors hover:bg-surface-200 disabled:opacity-60 dark:text-surface-200 dark:hover:bg-dark-muted ${
            collapsed
              ? "w-10 shrink-0 justify-center px-0 py-2.5"
              : "w-full gap-3 px-3 py-2.5"
          }`}
        >
          <OpenTabsIcon className="shrink-0" />
          <span className={collapsed ? "sr-only" : ""}>
            {pmSlugs === null
              ? "Loading…"
              : pmSlugs.length === 0
                ? "Open my projects (0)"
                : `Open my projects (${pmSlugs.length})`}
          </span>
        </button>
        {navItems.map((item) => {
          const isActive =
            item.active &&
            (item.href === "/projects"
              ? pathname === "/projects" || pathname.startsWith("/projects/")
              : pathname === item.href);
          if (item.active) {
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex items-center rounded-md text-body-sm font-medium transition-colors ${
                  collapsed ? "w-10 shrink-0 justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
                } ${
                  isActive
                    ? "bg-jblue-500 text-white dark:bg-jblue-600 dark:text-white"
                    : "text-surface-700 hover:bg-surface-200 dark:text-surface-200 dark:hover:bg-dark-muted"
                }`}
              >
                {item.href === "/projects" ? (
                  <FolderIcon className={`shrink-0 ${isActive ? "text-white" : ""}`} />
                ) : item.href === "/pgm-dashboard" ? (
                  <Network className={`h-5 w-5 shrink-0 ${isActive ? "text-white" : ""}`} aria-hidden strokeWidth={2} />
                ) : item.href === "/cad-dashboard" ? (
                  <Users className={`h-5 w-5 shrink-0 ${isActive ? "text-white" : ""}`} aria-hidden strokeWidth={2} />
                ) : item.href === "/pto-holidays" ? (
                  <CalendarOff className={`h-5 w-5 shrink-0 ${isActive ? "text-white" : ""}`} aria-hidden strokeWidth={2} />
                ) : (
                  <GridIcon className={`shrink-0 ${isActive ? "text-white" : ""}`} />
                )}
                <span className={collapsed ? "sr-only" : ""}>{item.label}</span>
              </Link>
            );
          }
          return (
            <span
              key={item.href}
              title="Coming soon"
              className={`flex cursor-not-allowed items-center rounded-md text-body-sm font-medium text-surface-400 opacity-60 dark:text-surface-500 ${
                collapsed ? "w-10 shrink-0 justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
              }`}
            >
              {item.href === "/pgm-dashboard" ? (
                <Network className="h-5 w-5 shrink-0" aria-hidden strokeWidth={2} />
              ) : item.href === "/cad-dashboard" ? (
                <Users className="h-5 w-5 shrink-0" aria-hidden strokeWidth={2} />
              ) : item.href === "/pto-holidays" ? (
                <CalendarOff className="h-5 w-5 shrink-0" aria-hidden strokeWidth={2} />
              ) : item.href.startsWith("/pgm") ? (
                <GridIcon className="shrink-0" />
              ) : (
                <GridIcon className="shrink-0" />
              )}
              <span className={collapsed ? "sr-only" : ""}>{item.label}</span>
            </span>
          );
        })}
      </nav>
      <div
        className={`border-t border-surface-200 dark:border-dark-border ${
          collapsed ? "flex flex-col items-center gap-1 p-1.5" : "p-2"
        }`}
      >
        <div className={`flex items-center rounded-md ${collapsed ? "justify-center py-1" : "gap-2 px-3 py-2"}`}>
          <ThemeToggle />
        </div>
        {userDisplayName && !collapsed && (
          <div className="px-3 py-1.5">
            <p className="truncate text-body-sm font-medium text-surface-800 dark:text-surface-100" title={userDisplayName}>
              {userDisplayName}
            </p>
          </div>
        )}
        {userDisplayName && collapsed && (
          <span className="sr-only" aria-live="polite">
            Signed in as {userDisplayName}
          </span>
        )}
        <Link
          href="/account"
          title="Account"
          className={`flex items-center rounded-md text-body-sm text-surface-700 hover:bg-surface-200 dark:text-surface-200 dark:hover:bg-dark-muted ${
            collapsed ? "w-10 justify-center py-2" : "gap-2 px-3 py-2"
          }`}
        >
          <UserIcon className="shrink-0" />
          <span className={collapsed ? "sr-only" : ""}>Account</span>
        </Link>
        {isAdmin && (
          <Link
            href="/admin/float-sync"
            title="Admin"
            className={`flex items-center rounded-md text-body-sm text-jblue-500 hover:bg-surface-200 dark:text-jblue-400 dark:hover:bg-dark-muted ${
              collapsed ? "w-10 justify-center py-2" : "gap-2 px-3 py-2"
            }`}
          >
            <ShieldIcon className="shrink-0" />
            <span className={collapsed ? "sr-only" : ""}>Admin</span>
          </Link>
        )}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Sign out"
          className={`flex items-center rounded-md text-body-sm text-surface-700 hover:bg-surface-200 dark:text-surface-200 dark:hover:bg-dark-muted ${
            collapsed ? "w-full justify-center py-2" : "w-full gap-2 px-3 py-2 text-left"
          }`}
        >
          <LogOutIcon className="shrink-0" />
          <span className={collapsed ? "sr-only" : ""}>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
