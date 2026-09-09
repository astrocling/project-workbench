import type { PlanItemType } from "@/lib/plan/types";
import { getWeekStartDate } from "@/lib/weekUtils";
import { projectTabUrl } from "@/lib/workbenchUrls";

export function slackMrkdwnEscape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function utcDateKey(d: Date | string): string {
  if (typeof d === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
    const parsed = new Date(d);
    if (Number.isNaN(parsed.getTime())) return d.slice(0, 10);
    return parsed.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

export function getWeekBounds(now: Date): {
  weekStart: Date;
  weekEnd: Date;
  weekStartKey: string;
  weekEndKey: string;
} {
  const weekStart = getWeekStartDate(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(0, 0, 0, 0);
  return {
    weekStart,
    weekEnd,
    weekStartKey: utcDateKey(weekStart),
    weekEndKey: utcDateKey(weekEnd),
  };
}

export function dateKeyInWeek(
  dateKey: string,
  weekStartKey: string,
  weekEndKey: string
): boolean {
  return dateKey >= weekStartKey && dateKey <= weekEndKey;
}

export type WeeklyPersonInput = {
  personId: string;
  name: string;
  slackUserId: string | null;
  roleName: string | null;
  plannedHours: number;
  floatHours: number;
};

export type WeeklyPerson = WeeklyPersonInput & { notInPlan: boolean };

export function collectWeeklyPeople(input: {
  planned: Array<{ personId: string; hours: number }>;
  float: Array<{ personId: string; hours: number }>;
  people: Record<
    string,
    { name: string; slackUserId: string | null; roleName: string | null }
  >;
}): WeeklyPerson[] {
  const plannedByPerson = new Map<string, number>();
  for (const row of input.planned) {
    plannedByPerson.set(
      row.personId,
      (plannedByPerson.get(row.personId) ?? 0) + Number(row.hours)
    );
  }
  const floatByPerson = new Map<string, number>();
  for (const row of input.float) {
    floatByPerson.set(
      row.personId,
      (floatByPerson.get(row.personId) ?? 0) + Number(row.hours)
    );
  }
  const ids = new Set([...plannedByPerson.keys(), ...floatByPerson.keys()]);
  const result: WeeklyPerson[] = [];
  for (const personId of ids) {
    const plannedHours = plannedByPerson.get(personId) ?? 0;
    const floatHours = floatByPerson.get(personId) ?? 0;
    if (plannedHours <= 0 && floatHours <= 0) continue;
    const info = input.people[personId];
    result.push({
      personId,
      name: info?.name ?? "Unknown",
      slackUserId: info?.slackUserId ?? null,
      roleName: info?.roleName ?? null,
      plannedHours,
      floatHours,
      notInPlan: floatHours > 0 && plannedHours <= 0,
    });
  }
  result.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  return result;
}

export function formatPersonLine(person: WeeklyPerson): string {
  const sid = person.slackUserId?.trim();
  const name = sid
    ? `<@${sid}>`
    : slackMrkdwnEscape(person.name || "Unknown");
  const notInPlan = person.notInPlan ? " (Not in Plan)" : "";
  const role = person.roleName
    ? ` — ${slackMrkdwnEscape(person.roleName)}`
    : "";
  return `• ${name}${notInPlan}${role}`;
}

export type DatedItemSource = "plan" | "timeline";

export type DatedItemInput = {
  source: DatedItemSource;
  type?: PlanItemType | "marker" | "bar";
  label: string;
  startDateKey: string;
  endDateKey: string;
  scheduledTime?: string | null;
};

export type DatedItemHit = DatedItemInput & { sortKey: string };

export function itemsStartingOrEndingInWeek(
  items: DatedItemInput[],
  weekStartKey: string,
  weekEndKey: string
): DatedItemHit[] {
  const hits: DatedItemHit[] = [];
  for (const item of items) {
    const startIn = dateKeyInWeek(item.startDateKey, weekStartKey, weekEndKey);
    const endIn = dateKeyInWeek(item.endDateKey, weekStartKey, weekEndKey);
    if (!startIn && !endIn) continue;
    hits.push({
      ...item,
      sortKey: startIn ? item.startDateKey : item.endDateKey,
    });
  }
  hits.sort((a, b) => {
    const byDate = a.sortKey.localeCompare(b.sortKey);
    if (byDate !== 0) return byDate;
    return a.label.localeCompare(b.label, "en", { sensitivity: "base" });
  });
  return hits;
}

const PLAN_TYPE_LABEL: Record<PlanItemType, string> = {
  task: "Task",
  milestone: "Milestone",
  sign_off: "Sign-off",
  hard_deadline: "Deadline",
  waiting_on_client: "Waiting on client",
  meeting: "Meeting",
};

export function formatUtcWeekdayShort(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return dateKey;
  const weekday = d.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
  const rest = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${weekday} ${rest}`;
}

export function formatWeekRangeLabel(weekStartKey: string, weekEndKey: string): string {
  const start = new Date(`${weekStartKey}T12:00:00.000Z`);
  const end = new Date(`${weekEndKey}T12:00:00.000Z`);
  const startMonth = start.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const year = end.getUTCFullYear();
  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}–${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay}–${endMonth} ${endDay}, ${year}`;
}

export function formatDatedItemLine(item: DatedItemHit): string {
  const datePart = formatUtcWeekdayShort(item.sortKey);
  let typeLabel: string;
  if (item.source === "timeline") {
    typeLabel = "Timeline";
  } else {
    typeLabel = item.type && item.type in PLAN_TYPE_LABEL
      ? PLAN_TYPE_LABEL[item.type as PlanItemType]
      : "Plan";
  }
  const time =
    item.scheduledTime != null && item.scheduledTime.trim() !== ""
      ? ` (${item.scheduledTime.trim()})`
      : "";
  return `• ${datePart} — ${typeLabel}: ${slackMrkdwnEscape(item.label)}${slackMrkdwnEscape(time)}`;
}

export type PosterUser = {
  slackUserId: string | null;
  firstName: string | null;
  lastName: string | null;
};

export function posterMention(user: PosterUser): string {
  const sid = user.slackUserId?.trim();
  if (sid) return `<@${sid}>`;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return slackMrkdwnEscape(name || "Unknown");
}

export function buildWeeklyLookaheadBlocks(input: {
  projectName: string;
  projectSlug: string;
  weekStartKey: string;
  weekEndKey: string;
  people: WeeklyPerson[];
  items: DatedItemHit[];
  poster: PosterUser;
}): { blocks: Record<string, unknown>[]; fallbackText: string } {
  const weekLabel = formatWeekRangeLabel(input.weekStartKey, input.weekEndKey);
  const headerPrefix = "Weekly look-ahead — ";
  const maxHeader = 150;
  const budget = maxHeader - headerPrefix.length;
  const truncatedName =
    input.projectName.length > budget
      ? `${input.projectName.slice(0, Math.max(0, budget - 1))}…`
      : input.projectName;

  const peopleLines =
    input.people.length > 0
      ? input.people.map(formatPersonLine).join("\n")
      : "_No one has hours this week._";
  const itemLines =
    input.items.length > 0
      ? input.items.map(formatDatedItemLine).join("\n")
      : "_No meetings or deadlines this week._";

  const overviewUrl = projectTabUrl(input.projectSlug, "overview");
  const posterLine = `Posted by ${posterMention(input.poster)} · <${overviewUrl}|View project →>`;

  const blocks: Record<string, unknown>[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `${headerPrefix}${truncatedName}`, emoji: true },
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: slackMrkdwnEscape(weekLabel) }],
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Team this week*\n${peopleLines}` },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*This week*\n${itemLines}` },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: posterLine },
    },
  ];

  return {
    blocks,
    fallbackText: `Weekly look-ahead — ${input.projectName}`,
  };
}
