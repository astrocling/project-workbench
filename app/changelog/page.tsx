import { readFileSync } from "fs";
import { join } from "path";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeProvider";
import { MarkdownDoc } from "@/components/MarkdownDoc";

export const metadata = {
  title: "Changelog",
  description: "Release history and changes for Project Workbench",
};

function ChangelogContent() {
  const path = join(process.cwd(), "CHANGELOG.md");
  const content = readFileSync(path, "utf-8");
  return <MarkdownDoc content={content} hideH1 />;
}

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-dark-bg">
      <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-6 bg-white/80 dark:bg-dark-bg/90 backdrop-blur-md border-b border-surface-200 dark:border-dark-border">
        <Link
          href="/projects"
          className="text-body-sm text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
        >
          ← Projects
        </Link>
        <div className="flex gap-4 items-center">
          <ThemeToggle />
          <Link
            href="/api/auth/signout?callbackUrl=/login"
            className="text-body-sm text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
          >
            Sign out
          </Link>
        </div>
      </header>
      <main className="px-8 py-6 max-w-[65ch] mx-auto">
        <h1 className="text-display-md font-bold text-surface-900 dark:text-white mb-6">
          Changelog
        </h1>
        <ChangelogContent />
      </main>
    </div>
  );
}
