/**
 * Banner shown only when not in production (local dev or Vercel preview).
 * Renders nothing in production.
 * Fixed at top of viewport so it does not scroll; body padding pushes all content below it.
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
      className="fixed left-0 right-0 top-0 z-[100] flex h-9 flex-shrink-0 w-full items-center justify-center bg-jblue-600 text-center text-sm font-medium text-white"
      role="status"
      aria-live="polite"
    >
      {label}
    </div>
  );
}
