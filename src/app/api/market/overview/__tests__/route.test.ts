import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/market-data", () => ({
  getMarketOverview: vi.fn(),
}));

import { GET } from "../route";
import { getMarketOverview } from "@/lib/market-data";

const mockGetMarketOverview = vi.mocked(getMarketOverview);

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/market/overview");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

describe("GET /api/market/overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when keyword is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/keyword/i);
  });

  it("returns 404 when no data found", async () => {
    mockGetMarketOverview.mockResolvedValue(null);

    const res = await GET(makeRequest({ keyword: "unknown" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/no data/i);
  });

  it("returns 200 with market overview data", async () => {
    const mockData = {
      keyword: "coffee maker",
      market: "UAE",
      total_results: 500,
      price_median: 120,
      price_p25: 80,
      price_p75: 200,
      price_min: 30,
      price_max: 500,
      avg_rating: 4.2,
      avg_review_count: 45,
      sponsored_pct: 20,
      fulfilled_pct: 65,
      product_count: 48,
      top_sellers: [{ name: "SellerA", count: 10 }],
      data_freshness: "2025-06-01T00:00:00Z",
    };
    mockGetMarketOverview.mockResolvedValue(mockData);

    const res = await GET(makeRequest({ keyword: "coffee maker" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.keyword).toBe("coffee maker");
    expect(body.market).toBe("UAE");
    expect(body.price_median).toBe(120);
  });

  it("passes market param to getMarketOverview", async () => {
    mockGetMarketOverview.mockResolvedValue(null);

    await GET(makeRequest({ keyword: "test", market: "KSA" }));
    expect(mockGetMarketOverview).toHaveBeenCalledWith("test", "KSA");
  });

  it("defaults market to UAE", async () => {
    mockGetMarketOverview.mockResolvedValue(null);

    await GET(makeRequest({ keyword: "test" }));
    expect(mockGetMarketOverview).toHaveBeenCalledWith("test", "UAE");
  });
});
