import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/categories-data", () => ({
  searchSellerCategories: vi.fn(),
}));

import { GET } from "../route";
import { searchSellerCategories } from "@/lib/categories-data";

const mockSearch = vi.mocked(searchSellerCategories);

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/categories/seller");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

describe("GET /api/categories/seller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when q is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/q/i);
  });

  it("returns 200 with note when empty (Phase 1)", async () => {
    mockSearch.mockResolvedValue([]);

    const res = await GET(makeRequest({ q: "phone" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(0);
    expect(body.results).toEqual([]);
    expect(body.note).toMatch(/Phase 2/);
  });

  it("returns 200 without note when results present (Phase 2 future)", async () => {
    mockSearch.mockResolvedValue([
      {
        pk: 45,
        code: "tuxedo_suit",
        name_en: "Tuxedo Suit",
        level: "fulltype",
        parent_pk: 12,
        is_active: true,
      },
    ]);

    const res = await GET(makeRequest({ q: "tuxedo" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(1);
    expect(body.results[0].code).toBe("tuxedo_suit");
    expect(body.note).toBeUndefined();
  });

  it("passes level filter", async () => {
    mockSearch.mockResolvedValue([]);

    await GET(makeRequest({ q: "apparel", level: "family", limit: "5" }));
    expect(mockSearch).toHaveBeenCalledWith("apparel", {
      level: "family",
      limit: 5,
    });
  });

  it("returns 400 when level is invalid", async () => {
    const res = await GET(makeRequest({ q: "phone", level: "garbage" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/level/i);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("returns 400 when limit is not a positive integer", async () => {
    const res = await GET(makeRequest({ q: "phone", limit: "abc" }));
    expect(res.status).toBe(400);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("returns 500 on data layer error", async () => {
    mockSearch.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest({ q: "test" }));
    expect(res.status).toBe(500);
  });
});
