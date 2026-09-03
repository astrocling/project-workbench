export function rejectNonAdminPlanEnabledPatch(
  permissions: string | undefined,
  body: unknown
): { error: string; status: 403 } | null {
  if (
    body != null &&
    typeof body === "object" &&
    Object.prototype.hasOwnProperty.call(body, "planEnabled") &&
    permissions !== "Admin"
  ) {
    return {
      error: "Only admins can enable or disable the Plan tab",
      status: 403,
    };
  }
  return null;
}
