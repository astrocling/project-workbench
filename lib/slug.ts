/**
 * Slug utilities for project URL slugs (name-based, unique).
 */

import { prisma } from "@/lib/prisma";

/**
 * Resolve project id from URL segment (id or slug). Returns null if not found.
 */
export async function getProjectId(idOrSlug: string): Promise<string | null> {
  const project = await prisma.project.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true },
  });
  return project?.id ?? null;
}

/**
 * Slugify a string: lowercase, replace non-alphanumeric with hyphens, collapse dashes, trim.
 */
export function slugify(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "project";
}

/**
 * Return a unique slug. If base slug is taken, try base-2, base-3, etc.
 * Caller should pass existing slugs excluding the current project's when updating.
 */
export function ensureUniqueSlug(baseSlug: string, existingSlugs: Set<string>): string {
  const base = baseSlug || "project";
  let slug = base;
  let n = 2;
  while (existingSlugs.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}
