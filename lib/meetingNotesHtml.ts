/**
 * Sanitization and detection for meeting notes rich text (e.g. from Teams Copilot).
 * Uses sanitize-html so server and client both run the same sanitizer without jsdom
 * (avoids ESM/CJS issues from isomorphic-dompurify → jsdom in production SSR).
 */

import sanitizeHtml from "sanitize-html";

const MEETING_NOTES_ALLOWED_TAGS = [
  "p",
  "br",
  "div",
  "ul",
  "ol",
  "li",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "span",
];

/** Reject url(), expression(), and @import in inline styles (XSS vectors). */
const SAFE_INLINE_STYLE_VALUE =
  /^(?!.*url\s*\()(?!.*expression\s*\()(?!.*@import\b)[\s\S]{0,2000}$/i;

const MEETING_NOTES_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: MEETING_NOTES_ALLOWED_TAGS,
  allowedAttributes: {
    "*": ["style"],
    a: ["href", "target", "rel", "style"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowProtocolRelative: false,
  allowedStyles: {
    "*": {
      color: [SAFE_INLINE_STYLE_VALUE],
      "background-color": [SAFE_INLINE_STYLE_VALUE],
      "font-size": [SAFE_INLINE_STYLE_VALUE],
      "font-family": [SAFE_INLINE_STYLE_VALUE],
      "font-weight": [SAFE_INLINE_STYLE_VALUE],
      "font-style": [SAFE_INLINE_STYLE_VALUE],
      "text-decoration": [SAFE_INLINE_STYLE_VALUE],
      "text-align": [SAFE_INLINE_STYLE_VALUE],
      "line-height": [SAFE_INLINE_STYLE_VALUE],
      "margin": [SAFE_INLINE_STYLE_VALUE],
      "margin-top": [SAFE_INLINE_STYLE_VALUE],
      "margin-right": [SAFE_INLINE_STYLE_VALUE],
      "margin-bottom": [SAFE_INLINE_STYLE_VALUE],
      "margin-left": [SAFE_INLINE_STYLE_VALUE],
      "padding": [SAFE_INLINE_STYLE_VALUE],
      "padding-top": [SAFE_INLINE_STYLE_VALUE],
      "padding-right": [SAFE_INLINE_STYLE_VALUE],
      "padding-bottom": [SAFE_INLINE_STYLE_VALUE],
      "padding-left": [SAFE_INLINE_STYLE_VALUE],
      "vertical-align": [SAFE_INLINE_STYLE_VALUE],
      "white-space": [SAFE_INLINE_STYLE_VALUE],
    },
  },
};

/** Sanitize HTML for meeting notes (safe to store and render). Same output on server and client. */
export function sanitizeMeetingNotesHtml(html: string): string {
  if (!html || !html.trim()) return "";
  return sanitizeHtml(html.trim(), MEETING_NOTES_SANITIZE_OPTIONS);
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
