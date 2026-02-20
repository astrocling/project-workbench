import type { UserRole } from "@prisma/client";

export type AppUserRole = UserRole;

export function requireRole(
  userRole: AppUserRole | undefined | null,
  allowed: AppUserRole[]
): boolean {
  if (!userRole) return false;
  return allowed.includes(userRole);
}

export function canEditProject(userRole: AppUserRole | undefined | null): boolean {
  return requireRole(userRole, ["Admin", "Editor"]);
}

export function canAccessAdmin(userRole: AppUserRole | undefined | null): boolean {
  return requireRole(userRole, ["Admin"]);
}

export function canUploadFloat(userRole: AppUserRole | undefined | null): boolean {
  return requireRole(userRole, ["Admin"]);
}
