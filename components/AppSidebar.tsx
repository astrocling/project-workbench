"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeProvider";

const navItems = [
  { href: "/pm-dashboard", label: "PM Dashboard", active: true },
  { href: "/pgm-dashboard", label: "PGM Dashboard", active: false },
  { href: "/cad-dashboard", label: "CAD Dashboard", active: false },
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

export function AppSidebar({
  userDisplayName,
  isAdmin,
}: {
  userDisplayName: string | null;
  isAdmin: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-surface-200 bg-surface-100 dark:border-dark-border dark:bg-dark-raised">
      <div className="flex h-14 items-center gap-2 border-b border-surface-200 px-4 dark:border-dark-border">
        <span className="text-title-md font-semibold text-surface-900 dark:text-white">
          Project Workbench
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label="Main">
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
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-body-sm font-medium transition-colors ${
                  isActive
                    ? "bg-jblue-500 text-white dark:bg-jblue-600 dark:text-white"
                    : "text-surface-700 hover:bg-surface-200 dark:text-surface-200 dark:hover:bg-dark-muted"
                }`}
              >
                {item.href === "/projects" ? (
                  <FolderIcon className={isActive ? "text-white" : ""} />
                ) : (
                  <GridIcon className={isActive ? "text-white" : ""} />
                )}
                {item.label}
              </Link>
            );
          }
          return (
            <span
              key={item.href}
              title="Coming soon"
              className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2.5 text-body-sm font-medium text-surface-400 opacity-60 dark:text-surface-500"
            >
              {item.href.startsWith("/pgm") ? (
                <GridIcon />
              ) : (
                <GridIcon />
              )}
              {item.label}
            </span>
          );
        })}
      </nav>
      <div className="border-t border-surface-200 p-2 dark:border-dark-border">
        <div className="flex items-center gap-2 rounded-md px-3 py-2">
          <ThemeToggle />
        </div>
        {userDisplayName && (
          <div className="px-3 py-1.5">
            <p className="text-body-sm font-medium text-surface-800 dark:text-surface-100 truncate">
              {userDisplayName}
            </p>
          </div>
        )}
        {isAdmin && (
          <Link
            href="/admin/float-import"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-body-sm text-jblue-500 hover:bg-surface-200 dark:text-jblue-400 dark:hover:bg-dark-muted"
          >
            Admin
          </Link>
        )}
        <Link
          href="/api/auth/signout"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-body-sm text-surface-700 hover:bg-surface-200 dark:text-surface-200 dark:hover:bg-dark-muted"
        >
          Sign out
        </Link>
      </div>
    </aside>
  );
}
