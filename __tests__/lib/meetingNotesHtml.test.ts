import { describe, expect, it } from "vitest";
import { isMeetingNotesHtml, sanitizeMeetingNotesHtml } from "@/lib/meetingNotesHtml";

describe("meetingNotesHtml", () => {
  it("sanitizeMeetingNotesHtml strips scripts and keeps allowed tags", () => {
    const out = sanitizeMeetingNotesHtml(
      '<p class="x">a</p><script>evil()</script><a href="https://example.com" target="_blank" rel="noopener">l</a>'
    );
    expect(out).not.toMatch(/script/i);
    expect(out).toContain("<p>");
    expect(out).toContain("https://example.com");
  });

  it("isMeetingNotesHtml detects simple tags", () => {
    expect(isMeetingNotesHtml("hello")).toBe(false);
    expect(isMeetingNotesHtml("<p>x</p>")).toBe(true);
  });
});
