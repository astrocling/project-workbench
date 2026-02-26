import { readFileSync } from "fs";
import { join } from "path";
import Link from "next/link";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ThemeToggle } from "@/components/ThemeProvider";

export const metadata = {
  title: "Changelog | Project Workbench",
  description: "Release history and changes for Project Workbench",
};

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-display-md font-bold text-surface-900 dark:text-white mt-8 mb-4 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-title-lg font-semibold text-surface-800 dark:text-surface-100 mt-6 mb-3">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mt-4 mb-2">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-body-md text-surface-700 dark:text-surface-200 mb-3">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside text-body-md text-surface-700 dark:text-surface-200 mb-4 space-y-1">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside text-body-md text-surface-700 dark:text-surface-200 mb-4 space-y-1">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="ml-2">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 underline"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-surface-900 dark:text-surface-100">{children}</strong>
  ),
};

function ChangelogContent() {
  const path = join(process.cwd(), "CHANGELOG.md");
  const content = readFileSync(path, "utf-8");
  return (
    <article>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </article>
  );
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
            href="/api/auth/signout"
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
