import { describe, expect, it } from "vitest";
import { FloatClient } from "@/lib/float/client";
import { FLOAT_LIST_MAX_PER_PAGE, FLOAT_PER_PAGE_PARAM } from "@/lib/float/types";

function mockFetchSequence(
  responses: Array<{
    json: unknown;
    headers?: Record<string, string>;
    status?: number;
  }>
): typeof fetch {
  let i = 0;
  return (async (input) => {
    const r = responses[i++];
    if (!r) throw new Error("unexpected fetch call");
    const headers = new Headers(r.headers ?? {});
    return new Response(JSON.stringify(r.json), {
      status: r.status ?? 200,
      headers,
    });
  }) as typeof fetch;
}

describe("FloatClient", () => {
  it("listAllPages follows X-Pagination headers across pages", async () => {
    const fetchImpl = mockFetchSequence([
      {
        json: [{ id: 1 }],
        headers: {
          "X-Pagination-Total-Count": "2",
          "X-Pagination-Page-Count": "2",
          "X-Pagination-Current-Page": "1",
          "X-Pagination-Per-Page": String(FLOAT_LIST_MAX_PER_PAGE),
        },
      },
      {
        json: [{ id: 2 }],
        headers: {
          "X-Pagination-Total-Count": "2",
          "X-Pagination-Page-Count": "2",
          "X-Pagination-Current-Page": "2",
          "X-Pagination-Per-Page": String(FLOAT_LIST_MAX_PER_PAGE),
        },
      },
    ]);

    const client = new FloatClient({
      token: "test-token",
      userAgentEmail: "dev@example.com",
      fetchImpl,
    });

    const rows = await client.listAllPages<{ id: number }>("/v3/people");
    expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("listPage sends page and per-page query params", async () => {
    let seenUrl = "";
    const fetchImpl: typeof fetch = async (input) => {
      seenUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      return new Response(JSON.stringify([]), { status: 200 });
    };

    const client = new FloatClient({
      token: "t",
      fetchImpl,
    });

    await client.listPage("/v3/projects", 3, { perPage: 200 });
    const u = new URL(seenUrl);
    expect(u.searchParams.get("page")).toBe("3");
    expect(u.searchParams.get(FLOAT_PER_PAGE_PARAM)).toBe("200");
  });
});
