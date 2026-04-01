/**
 * Typed HTTP client for Float API v3.
 *
 * - `Authorization: Bearer <FLOAT_API_TOKEN>`
 * - `User-Agent`: app name + contact (use `FLOAT_API_USER_AGENT_EMAIL` for the email part)
 * - List endpoints: `page` (1-based), `per-page` (max 200); see {@link listAllPages}
 *
 * Env vars: see `lib/float/types.ts` and `.env.example`.
 */

import { APP_VERSION } from "@/lib/version";
import {
  FLOAT_API_DEFAULT_BASE_URL,
  FLOAT_LIST_MAX_PER_PAGE,
  FLOAT_PER_PAGE_PARAM,
  type FloatClientOptions,
  type FloatListPage,
  type FloatPaginationMeta,
  FloatApiError,
} from "@/lib/float/types";

const DEFAULT_ACCEPT = "application/json";

function buildUserAgent(userAgentEmail: string | undefined): string {
  const app = `Project-Workbench/${APP_VERSION}`;
  const contact =
    userAgentEmail?.trim() ||
    "set FLOAT_API_USER_AGENT_EMAIL for contact";
  return `${app} (${contact})`;
}

function parsePaginationMeta(headers: Headers): FloatPaginationMeta | null {
  const total = headers.get("X-Pagination-Total-Count");
  const pageCount = headers.get("X-Pagination-Page-Count");
  const current = headers.get("X-Pagination-Current-Page");
  const perPage = headers.get("X-Pagination-Per-Page");
  if (total == null && pageCount == null && current == null && perPage == null) {
    return null;
  }
  return {
    totalCount: total != null ? Number(total) : 0,
    pageCount: pageCount != null ? Number(pageCount) : 0,
    currentPage: current != null ? Number(current) : 0,
    perPage: perPage != null ? Number(perPage) : 0,
  };
}

function mergeSearchParams(
  url: URL,
  params: Record<string, string | number | boolean | undefined> | undefined
): void {
  if (!params) return;
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    url.searchParams.set(key, String(value));
  }
}

export class FloatClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly userAgent: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: FloatClientOptions) {
    if (!options.token?.trim()) {
      throw new Error("FloatClient requires a non-empty token");
    }
    this.token = options.token.trim();
    this.baseUrl = (options.baseUrl ?? FLOAT_API_DEFAULT_BASE_URL).replace(/\/$/, "");
    this.userAgent = buildUserAgent(options.userAgentEmail);
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  /**
   * Perform GET JSON request for a path under the configured host (e.g. `/v3/people`).
   * Does not add pagination params unless you pass them in `searchParams`.
   */
  async getJson<T>(
    path: string,
    searchParams?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    const url = new URL(path.startsWith("/") ? path : `/${path}`, `${this.baseUrl}/`);
    mergeSearchParams(url, searchParams);
    const res = await this.fetchImpl(url.toString(), {
      method: "GET",
      headers: this.buildHeaders(),
    });
    await this.throwIfNotOk(res);
    return (await res.json()) as T;
  }

  /**
   * GET a single page of a list endpoint with pagination query params and parsed `X-Pagination-*` headers.
   */
  async listPage<T>(
    path: string,
    page: number,
    options?: {
      perPage?: number;
      searchParams?: Record<string, string | number | boolean | undefined>;
    }
  ): Promise<FloatListPage<T>> {
    const perPage = Math.min(
      options?.perPage ?? FLOAT_LIST_MAX_PER_PAGE,
      FLOAT_LIST_MAX_PER_PAGE
    );
    const url = new URL(path.startsWith("/") ? path : `/${path}`, `${this.baseUrl}/`);
    mergeSearchParams(url, {
      ...options?.searchParams,
      page,
      [FLOAT_PER_PAGE_PARAM]: perPage,
    });
    const res = await this.fetchImpl(url.toString(), {
      method: "GET",
      headers: this.buildHeaders(),
    });
    await this.throwIfNotOk(res);
    const raw = await res.json();
    const items = Array.isArray(raw) ? (raw as T[]) : [];
    return {
      items,
      pagination: parsePaginationMeta(res.headers),
    };
  }

  /**
   * Fetch all pages for a GET list endpoint using max page size (200).
   * Stops using `X-Pagination-*` when present; otherwise stops when a page returns fewer than `perPage` items.
   */
  async listAllPages<T>(
    path: string,
    searchParams?: Record<string, string | number | boolean | undefined>,
    options?: { perPage?: number }
  ): Promise<T[]> {
    const perPage = Math.min(
      options?.perPage ?? FLOAT_LIST_MAX_PER_PAGE,
      FLOAT_LIST_MAX_PER_PAGE
    );
    const out: T[] = [];
    let page = 1;
    /** Guard against infinite loops if headers are missing or malformed. */
    const maxPages = 10_000;

    for (;;) {
      if (page > maxPages) {
        throw new Error(
          `Float listAllPages: exceeded ${maxPages} pages for ${path}; check API response headers.`
        );
      }
      const { items, pagination } = await this.listPage<T>(path, page, {
        perPage,
        searchParams,
      });
      out.push(...items);

      if (pagination && pagination.pageCount > 0) {
        if (pagination.currentPage >= pagination.pageCount) {
          break;
        }
        page += 1;
        continue;
      }

      if (items.length < perPage) {
        break;
      }
      page += 1;
    }

    return out;
  }

  private buildHeaders(): HeadersInit {
    return {
      Accept: DEFAULT_ACCEPT,
      Authorization: `Bearer ${this.token}`,
      "User-Agent": this.userAgent,
    };
  }

  private async throwIfNotOk(res: Response): Promise<void> {
    if (res.ok) return;
    let body: string | undefined;
    try {
      body = await res.text();
    } catch {
      body = undefined;
    }
    throw new FloatApiError(
      `Float API error ${res.status} ${res.statusText}`,
      res.status,
      res.url,
      body
    );
  }
}

/**
 * Build a client from environment:
 * - `FLOAT_API_TOKEN` (required)
 * - `FLOAT_API_USER_AGENT_EMAIL` (optional, recommended)
 */
export function floatClientFromEnv(): FloatClient {
  const token = process.env.FLOAT_API_TOKEN;
  if (!token?.trim()) {
    throw new Error(
      "FLOAT_API_TOKEN is required for Float API access (e.g. sync). Set it in the environment."
    );
  }
  return new FloatClient({
    token: token.trim(),
    userAgentEmail: process.env.FLOAT_API_USER_AGENT_EMAIL?.trim(),
  });
}
