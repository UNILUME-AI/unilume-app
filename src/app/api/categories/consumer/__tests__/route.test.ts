import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/categories-data", () => ({
  searchConsumerCategories: vi.fn(),
}));

import { GET } from "../route";
import { searchConsumerCategories } from "@/lib/categories-data";

const mockSearch = vi.mocked(searchConsumerCategories);

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/categories/consumer");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

describe("GET /api/categories/consumer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when q is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/q/i);
  });

  it("returns 400 when q is empty string", async () => {
    const res = await GET(makeRequest({ q: "   " }));
    expect(res.status).toBe(400);
  });

  it("returns 200 with results", async () => {
    mockSearch.mockResolvedValue([
      {
        id_category: 31234,
        code: "home-and-kitchen",
        name: "Home & Kitchen",
        parent_code: null,
        depth: 1,
        is_active: true,
        is_leaf: false,
        seen_in_locales: ["ae", "sa"],
        first_seen: "2026-05-28",
        last_seen: "2026-05-28",
        liveness: "alive" as const,
      },
    ]);

    const res = await GET(makeRequest({ q: "home" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.query).toBe("home");
    expect(body.count).toBe(1);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].code).toBe("home-and-kitchen");
  });

  it("returns 200 with empty results when no match", async () => {
    mockSearch.mockResolvedValue([]);

    const res = await GET(makeRequest({ q: "nonexistent" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(0);
    expect(body.results).toEqual([]);
  });

  it("passes parent / active / limit params correctly", async () => {
    mockSearch.mockResolvedValue([]);

    await GET(
      makeRequest({ q: "phone", parent: "electronics", active: "false", limit: "5" }),
    );
    expect(mockSearch).toHaveBeenCalledWith("phone", {
      parent: "electronics",
      active: false,
      limit: 5,
    });
  });

  it("defaults active=true when active param missing", async () => {
    mockSearch.mockResolvedValue([]);

    await GET(makeRequest({ q: "phone" }));
    expect(mockSearch).toHaveBeenCalledWith("phone", {
      parent: undefined,
      active: true,
      limit: undefined,
    });
  });

  it("treats active='true' as true (not just string truthy)", async () => {
    mockSearch.mockResolvedValue([]);
    await GET(makeRequest({ q: "phone", active: "true" }));
    expect(mockSearch).toHaveBeenCalledWith(
      "phone",
      expect.objectContaining({ active: true }),
    );
  });

  it("returns 400 when limit is not a positive integer", async () => {
    const res = await GET(makeRequest({ q: "phone", limit: "abc" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/limit/i);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("returns 400 when limit is zero or negative", async () => {
    const res = await GET(makeRequest({ q: "phone", limit: "0" }));
    expect(res.status).toBe(400);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("returns 500 on data layer error", async () => {
    mockSearch.mockRejectedValue(new Error("DB connection failed"));

    const res = await GET(makeRequest({ q: "test" }));
    expect(res.status).toBe(500);
  });
});
