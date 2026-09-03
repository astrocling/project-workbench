/**
 * Cache-life profiles for `revalidateTag`.
 */

/**
 * Expires tagged cache entries as of the mutation instead of serving them while they
 * revalidate in the background, which the `"max"` profile does. Use it when the client
 * re-reads server props immediately after the write (read-your-own-writes); `updateTag`
 * is not available in route handlers.
 */
export const IMMEDIATE_EXPIRATION = { expire: 0 } as const;
