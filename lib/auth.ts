import type { PermissionLevel } from "@prisma/client";

export type AppPermissionLevel = PermissionLevel;

/** Get effective permission level from session user (supports both permissions and legacy role). */
export function getSessionPermissionLevel(
  user: { permissions?: string; role?: string } | null | undefined
): AppPermissionLevel | undefined {
  if (!user) return undefined;
  const level = user.permissions ?? (user as { role?: string }).role;
  return level === "Admin" || level === "User" ? level : undefined;
}

export function requirePermission(
  permissions: AppPermissionLevel | undefined | null,
  allowed: AppPermissionLevel[]
): boolean {
  if (!permissions) return false;
  return allowed.includes(permissions);
}

export function canEditProject(permissions: AppPermissionLevel | undefined | null): boolean {
  return requirePermission(permissions, ["User", "Admin"]);
}

export function canAccessAdmin(permissions: AppPermissionLevel | undefined | null): boolean {
  return requirePermission(permissions, ["Admin"]);
}

export function canUploadFloat(permissions: AppPermissionLevel | undefined | null): boolean {
  return requirePermission(permissions, ["Admin"]);
}

/** Only super users (Admin) can delete projects. */
export function canDeleteProject(permissions: AppPermissionLevel | undefined | null): boolean {
  return requirePermission(permissions, ["Admin"]);
}
