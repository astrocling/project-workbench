"use client";

import { useEffect, useState } from "react";
import type { MarkdownSection } from "@/lib/markdownHeadings";

export function UserGuideNav({
  sections,
  variant,
}: {
  sections: MarkdownSection[];
  variant: "jump" | "toc";
}) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const el = document.getElementById(hash);
    if (!el) return;
    if (sections.some((s) => s.id === hash)) setActiveId(hash);
    el.scrollIntoView({ block: "start" });
  }, [sections]);

  useEffect(() => {
    if (variant !== "toc") return;
    const headings = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el != null);
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const id = visible[0]?.target.id;
        if (id) setActiveId(id);
      },
      { rootMargin: "-96px 0px -55% 0px", threshold: 0 }
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [sections, variant]);

  function jumpTo(id: string) {
    setActiveId(id);
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  }

  if (variant === "jump") {
    return (
      <div className="mb-6 md:hidden">
        <label htmlFor="user-guide-jump" className="mb-1 block text-label-md text-surface-500 dark:text-surface-400">
          Jump to section
        </label>
        <select
          id="user-guide-jump"
          className="w-full rounded-md border border-surface-200 bg-white px-3 py-2 text-body-sm text-surface-800 dark:border-dark-border dark:bg-dark-raised dark:text-surface-100"
          value={activeId}
          onChange={(e) => jumpTo(e.target.value)}
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <nav aria-label="On this page">
      <p className="mb-2 text-label-md font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
        On this page
      </p>
      <ul className="space-y-1 border-l border-surface-200 dark:border-dark-border">
        {sections.map((s) => {
          const current = s.id === activeId;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  jumpTo(s.id);
                }}
                className={`-ml-px block border-l-2 py-1 pl-3 text-body-sm ${
                  current
                    ? "border-jblue-500 font-medium text-jblue-500 dark:border-jblue-400 dark:text-jblue-400"
                    : "border-transparent text-surface-600 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-100"
                }`}
              >
                {s.title}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
