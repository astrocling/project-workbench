/**
 * Float API v3 — shared types and constants.
 *
 * @see https://dev.float.com/index.html — base URL, pagination (`page`, `per-page`), list response headers.
 * @see https://dev.float.com/overview_authentication.html — Bearer token and User-Agent.
 *
 * Environment (set in `.env`; see README and `docs/TECHNICAL.md`):
 * - `FLOAT_API_TOKEN` — required for API calls (sync, etc.).
 * - `FLOAT_API_USER_AGENT_EMAIL` — optional; included in `User-Agent` as the contact per Float requirements.
 */

/** Root host; paths are `/v3/...`. */
export const FLOAT_API_DEFAULT_BASE_URL = "https://api.float.com" as const;

/** Maximum items per page per Float API docs (default API default is 50). */
export const FLOAT_LIST_MAX_PER_PAGE = 200 as const;

/** Query parameter name for page size (hyphenated, not `per_page`). */
export const FLOAT_PER_PAGE_PARAM = "per-page" as const;

/**
 * Pagination metadata returned on GET list responses (response headers).
 * @see https://dev.float.com/index.html#pagination
 */
export type FloatPaginationMeta = {
  totalCount: number;
  pageCount: number;
  currentPage: number;
  perPage: number;
};

/**
 * One page of a list endpoint: JSON body plus parsed pagination headers when present.
 */
export type FloatListPage<T> = {
  items: T[];
  pagination: FloatPaginationMeta | null;
};

export type FloatClientOptions = {
  /**
   * Bearer token from Float → Account Settings → Integrations.
   * Required for authenticated requests.
   */
  token: string;
  /**
   * Contact email included in `User-Agent` (Float requires app name + contact).
   * If omitted, the client still sends `User-Agent` with an explicit note to configure env.
   */
  userAgentEmail?: string;
  /** Defaults to {@link FLOAT_API_DEFAULT_BASE_URL}. */
  baseUrl?: string;
  /** Injected `fetch` (tests or edge overrides). */
  fetchImpl?: typeof fetch;
};

export class FloatApiError extends Error {
  readonly name = "FloatApiError";

  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
    readonly responseBody?: string
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
