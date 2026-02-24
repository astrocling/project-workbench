/**
 * Normalizes DATABASE_URL for pg/Prisma so we use sslmode=verify-full
 * when the URL has prefer/require/verify-ca, avoiding the security warning
 * from pg-connection-string about future libpq semantics.
 * See: https://www.postgresql.org/docs/current/libpq-ssl.html
 */
export function normalizeDatabaseUrl(url: string): string {
  return url
    .replace(/\bsslmode=prefer\b/, "sslmode=verify-full")
    .replace(/\bsslmode=require\b/, "sslmode=verify-full")
    .replace(/\bsslmode=verify-ca\b/, "sslmode=verify-full");
}
