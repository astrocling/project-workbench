import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  createHeadingSlugTracker,
  extractMarkdownH2Sections,
  githubMarkdownHeadingSlug,
} from "@/lib/markdownHeadings";

describe("githubMarkdownHeadingSlug", () => {
  it("matches existing USER_GUIDE.md anchors for em-dash headings", () => {
    expect(githubMarkdownHeadingSlug("Overview — Post week to Slack")).toBe(
      "overview--post-week-to-slack"
    );
  });

  it("slugifies tab headings used as in-doc links", () => {
    expect(githubMarkdownHeadingSlug("PTO tab")).toBe("pto-tab");
    expect(githubMarkdownHeadingSlug("Resourcing tab")).toBe("resourcing-tab");
    expect(githubMarkdownHeadingSlug("CDA tab")).toBe("cda-tab");
    expect(githubMarkdownHeadingSlug("Status Reports tab")).toBe("status-reports-tab");
  });

  it("strips parentheses so Float sync anchors match", () => {
    expect(githubMarkdownHeadingSlug("Float sync (Admin only)")).toBe(
      "float-sync-admin-only"
    );
  });

  it("handles CDA refresh heading used in troubleshooting links", () => {
    expect(githubMarkdownHeadingSlug("Refresh milestones (CDA) (editors only)")).toBe(
      "refresh-milestones-cda-editors-only"
    );
  });
});

describe("extractMarkdownH2Sections", () => {
  it("collects ## headings only and ignores ###", () => {
    const md = `# Title

## Getting started

Intro.

### Logging in

## Projects list

### Sorting

## Troubleshooting
`;
    expect(extractMarkdownH2Sections(md)).toEqual([
      { id: "getting-started", title: "Getting started" },
      { id: "projects-list", title: "Projects list" },
      { id: "troubleshooting", title: "Troubleshooting" },
    ]);
  });

  it("disambiguates duplicate H2 slugs", () => {
    const md = `## Overview\n\n## Overview\n`;
    expect(extractMarkdownH2Sections(md).map((s) => s.id)).toEqual([
      "overview",
      "overview-1",
    ]);
  });

  it("lists H2 chapters from the shipped user guide", () => {
    const md = readFileSync(join(process.cwd(), "docs/USER_GUIDE.md"), "utf-8");
    const ids = extractMarkdownH2Sections(md).map((s) => s.id);
    expect(ids[0]).toBe("getting-started");
    expect(ids).toContain("status-reports-tab");
    expect(ids).toContain("troubleshooting");
  });

  it("resolves in-document anchors in USER_GUIDE.md to heading ids", () => {
    const md = readFileSync(join(process.cwd(), "docs/USER_GUIDE.md"), "utf-8");
    const nextId = createHeadingSlugTracker();
    const ids = new Set<string>();
    for (const line of md.split(/\r?\n/)) {
      const match = /^(#{1,6}) (.+)$/.exec(line);
      if (match) ids.add(nextId(match[2].trim()));
    }
    const anchors = [...md.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1]);
    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) {
      expect(ids.has(anchor), `#${anchor}`).toBe(true);
    }
  });
});
