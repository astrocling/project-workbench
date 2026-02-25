/**
 * Banner shown only when not in production (local dev or Vercel preview).
 * Renders nothing in production.
 */
export function EnvironmentBanner() {
  const vercelEnv = process.env.VERCEL_ENV;
  const nodeEnv = process.env.NODE_ENV;

  const isProduction =
    vercelEnv === "production" || (nodeEnv === "production" && !vercelEnv);

  if (isProduction) return null;

  const label =
    vercelEnv === "preview"
      ? "Preview"
      : vercelEnv === "development"
        ? "Development"
        : nodeEnv === "development"
          ? "Local development"
          : "Non-production";

  return (
    <div
      className="sticky top-0 z-50 flex items-center justify-center bg-jblue-600 px-3 py-1.5 text-center text-sm font-medium text-white"
      role="status"
      aria-live="polite"
    >
      {label}
    </div>
  );
}
