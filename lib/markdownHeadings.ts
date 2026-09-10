/**
 * GitHub-style heading slugs so in-document markdown links (#pto-tab) match rendered ids.
 */

export type MarkdownSection = { id: string; title: string };

export function githubMarkdownHeadingSlug(text: string): string {
  // GFM order: spaces → hyphens first, then strip punctuation so " — " becomes "--".
  return text
    .trim()
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "");
}

/** Sequential ids like GitHub: duplicate headings get -1, -2, … */
export function createHeadingSlugTracker(): (text: string) => string {
  const seen = new Map<string, number>();
  return (text: string) => {
    const base = githubMarkdownHeadingSlug(text) || "section";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
}

/**
 * H2 sections with the same ids the renderer will assign (all ATX headings share the slug counter).
 */
export function extractMarkdownH2Sections(markdown: string): MarkdownSection[] {
  const nextId = createHeadingSlugTracker();
  const sections: MarkdownSection[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const match = /^(#{1,6}) (.+)$/.exec(line);
    if (!match) continue;
    const level = match[1].length;
    const title = match[2].trim();
    const id = nextId(title);
    if (level === 2) {
      sections.push({ id, title });
    }
  }
  return sections;
}
