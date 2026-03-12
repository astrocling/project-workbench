/**
 * Sanitization and detection for meeting notes rich text (e.g. from Teams Copilot).
 * Use in client components only (DOMPurify requires DOM).
 */

const MEETING_NOTES_ALLOWED_TAGS = [
  "p", "br", "div", "ul", "ol", "li", "strong", "b", "em", "i", "u",
  "a", "h1", "h2", "h3", "h4", "span",
];
// style: allow so pasted content (e.g. Teams <span style="font-weight:bold">) keeps formatting; DOMPurify sanitizes style values
const MEETING_NOTES_ALLOWED_ATTRS = ["href", "target", "rel", "style"];

let sanitizeFn: ((dirty: string) => string) | null = null;

function getSanitize(): (dirty: string) => string {
  if (sanitizeFn) return sanitizeFn;
  if (typeof window === "undefined") {
    return (dirty: string) => dirty.replace(/<[^>]+>/g, "");
  }
  const DOMPurify = require("dompurify");
  sanitizeFn = (dirty: string) =>
    DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: MEETING_NOTES_ALLOWED_TAGS,
      ALLOWED_ATTR: MEETING_NOTES_ALLOWED_ATTRS,
      ADD_ATTR: ["target", "rel"],
    });
  return sanitizeFn;
}

/** Sanitize HTML for meeting notes (safe to store and render). Call only in browser. */
export function sanitizeMeetingNotesHtml(html: string): string {
  if (!html || !html.trim()) return "";
  return getSanitize()(html.trim());
}

/** True if content looks like HTML (e.g. contains tags). */
export function isMeetingNotesHtml(value: string | null | undefined): boolean {
  if (!value || !value.trim()) return false;
  return /<[a-z][\s\S]*>/i.test(value);
}

/** Strip HTML to plain text (e.g. for React-PDF). Preserves line breaks from block elements. */
export function meetingNotesHtmlToPlainText(html: string | null | undefined): string {
  if (!html || !html.trim()) return "";
  if (typeof document === "undefined") {
    return html
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  const div = document.createElement("div");
  div.innerHTML = html;
  const blockTags = /^(P|DIV|LI|H[1-6]|BR|TR)$/i;
  const walk = (node: Node, parts: string[]): void => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent) {
      parts.push(node.textContent);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName;
    if (tag === "BR") {
      parts.push("\n");
      return;
    }
    if (blockTags.test(tag)) {
      parts.push("\n");
    }
    for (let i = 0; i < node.childNodes.length; i++) {
      walk(node.childNodes[i], parts);
    }
    if (blockTags.test(tag)) {
      parts.push("\n");
    }
  };
  const parts: string[] = [];
  for (let i = 0; i < div.childNodes.length; i++) {
    walk(div.childNodes[i], parts);
  }
  return parts
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
