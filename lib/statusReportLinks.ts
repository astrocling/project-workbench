/**
 * Parses status report plain text into segments for rendering with links.
 * Supports: bare URLs (https?://...) and [link text](url).
 */

export type LinkSegment =
  | { type: "text"; content: string }
  | { type: "link"; content: string; href: string };

/** Markdown-style link: [text](url) — URL can be anything up to closing paren */
const MARKDOWN_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
/** Bare URL: http:// or https://, then non-whitespace */
const BARE_URL_RE = /https?:\/\/[^\s]+/g;

/**
 * Splits a line of text into segments (plain text and links).
 * Markdown-style [text](url) takes precedence over bare URL detection.
 */
export function parseLinkSegments(text: string): LinkSegment[] {
  if (!text) return [];

  const segments: LinkSegment[] = [];
  let lastEnd = 0;

  /** Collect all matches of both patterns with their start index, then sort by start */
  const markdownMatches: { index: number; length: number; text: string; url: string }[] = [];
  let m: RegExpExecArray | null;
  MARKDOWN_LINK_RE.lastIndex = 0;
  while ((m = MARKDOWN_LINK_RE.exec(text)) !== null) {
    markdownMatches.push({
      index: m.index,
      length: m[0].length,
      text: m[1],
      url: m[2].trim(),
    });
  }

  const bareMatches: { index: number; length: number; url: string }[] = [];
  BARE_URL_RE.lastIndex = 0;
  while ((m = BARE_URL_RE.exec(text)) !== null) {
    bareMatches.push({ index: m.index, length: m[0].length, url: m[0] });
  }

  /** Merge and sort by index; for overlapping ranges, markdown wins (we skip bare URLs that fall inside a markdown link) */
  type Match = { index: number; end: number; kind: "markdown"; text: string; url: string } | { index: number; end: number; kind: "bare"; url: string };
  const all: Match[] = [
    ...markdownMatches.map((x) => ({ index: x.index, end: x.index + x.length, kind: "markdown" as const, text: x.text, url: x.url })),
    ...bareMatches.map((x) => ({ index: x.index, end: x.index + x.length, kind: "bare" as const, url: x.url })),
  ].sort((a, b) => a.index - b.index);

  /** Drop bare URL matches that overlap any markdown link */
  const markdownRanges = markdownMatches.map((x) => ({ start: x.index, end: x.index + x.length }));
  const filtered: Match[] = all.filter((match) => {
    if (match.kind === "markdown") return true;
    const overlaps = markdownRanges.some(
      (r) => !(match.end <= r.start || match.index >= r.end)
    );
    return !overlaps;
  });

  for (const match of filtered) {
    if (match.index > lastEnd) {
      segments.push({ type: "text", content: text.slice(lastEnd, match.index) });
    }
    if (match.kind === "markdown") {
      segments.push({ type: "link", content: match.text, href: match.url });
    } else {
      segments.push({ type: "link", content: match.url, href: match.url });
    }
    lastEnd = match.end;
  }

  if (lastEnd < text.length) {
    segments.push({ type: "text", content: text.slice(lastEnd) });
  }

  return segments;
}
