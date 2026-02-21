import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeProvider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-dark-bg">
      <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-6 bg-white/80 dark:bg-dark-bg/90 backdrop-blur-md border-b border-surface-200 dark:border-dark-border">
        <nav className="flex gap-6">
          <Link
            href="/projects"
            className="text-body-sm text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
          >
            ← Projects
          </Link>
          <Link
            href="/admin/float-import"
            className="text-body-sm text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
          >
            Float Import
          </Link>
          <Link
            href="/admin/roles"
            className="text-body-sm text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
          >
            Roles
          </Link>
          <Link
            href="/admin/users"
            className="text-body-sm text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
          >
            Users
          </Link>
        </nav>
        <ThemeToggle />
      </header>
      <div className="px-8 py-6 max-w-[1440px] mx-auto">{children}</div>
    </div>
  );
}
