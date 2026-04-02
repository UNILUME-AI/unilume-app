import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/market-data", () => ({
  getCrossMarketComparison: vi.fn(),
}));

import { GET } from "../route";
import { getCrossMarketComparison } from "@/lib/market-data";

const mockGetCrossMarketComparison = vi.mocked(getCrossMarketComparison);

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/market/compare");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

describe("GET /api/market/compare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when keyword is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/keyword/i);
  });

  it("returns 200 with comparison data", async () => {
    const mockData = {
      keyword: "coffee maker",
      uae: null,
      ksa: null,
      deltas: {
        price_median: null,
        total_results: null,
        avg_rating: null,
        sponsored_pct: null,
      },
      recommendation: "No data available for either market.",
    };
    mockGetCrossMarketComparison.mockResolvedValue(mockData);

    const res = await GET(makeRequest({ keyword: "coffee maker" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.keyword).toBe("coffee maker");
    expect(body).toHaveProperty("deltas");
    expect(body).toHaveProperty("recommendation");
  });

  it("calls getCrossMarketComparison with keyword", async () => {
    mockGetCrossMarketComparison.mockResolvedValue({
      keyword: "test",
      uae: null,
      ksa: null,
      deltas: {
        price_median: null,
        total_results: null,
        avg_rating: null,
        sponsored_pct: null,
      },
      recommendation: "No data available for either market.",
    });

    await GET(makeRequest({ keyword: "test" }));
    expect(mockGetCrossMarketComparison).toHaveBeenCalledWith("test");
  });
});
