import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/categories-data", () => ({
  getCategoryMapping: vi.fn(),
}));

import { GET } from "../route";
import { getCategoryMapping } from "@/lib/categories-data";

const mockMap = vi.mocked(getCategoryMapping);

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/categories/map");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

describe("GET /api/categories/map", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when consumer_code missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/consumer_code/i);
  });

  it("returns no_confirmed_mapping in Phase 1 (table empty)", async () => {
    mockMap.mockResolvedValue({
      status: "no_confirmed_mapping",
      consumer_code: "home-and-kitchen",
    });

    const res = await GET(makeRequest({ consumer_code: "home-and-kitchen" }));
    expect(res.status).toBe(200); // valid response, not 404
    const body = await res.json();
    expect(body.status).toBe("no_confirmed_mapping");
    expect(body.consumer_code).toBe("home-and-kitchen");
  });

  it("returns ok with mapping when found (Phase 2 future)", async () => {
    mockMap.mockResolvedValue({
      status: "ok",
      consumer_code: "home-and-kitchen/cookware",
      seller_pk: 42,
      seller_code: "cookware_sets",
      tier: "high",
      confidence: 0.92,
      mapped_at: "2026-06-15T00:00:00Z",
    });

    const res = await GET(
      makeRequest({ consumer_code: "home-and-kitchen/cookware" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.tier).toBe("high");
    expect(body.seller_code).toBe("cookware_sets");
  });

  it("returns 500 on data layer error", async () => {
    mockMap.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest({ consumer_code: "x" }));
    expect(res.status).toBe(500);
  });
});
