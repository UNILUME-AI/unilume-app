import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/market-data", () => ({
  getProductList: vi.fn(),
}));

import { GET } from "../route";
import { getProductList } from "@/lib/market-data";

const mockGetProductList = vi.mocked(getProductList);

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/market/products");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

describe("GET /api/market/products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when keyword is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/keyword/i);
  });

  it("returns 200 with correct shape", async () => {
    const mockProducts = [
      {
        sku: "SKU001",
        title: "Coffee Maker Pro",
        brand: "BrandA",
        price_current: 99.99,
        price_original: 129.99,
        discount_pct: 23,
        rating: 4.5,
        review_count: 120,
        seller_name: "SellerA",
        is_sponsored: false,
        is_fulfilled: true,
        position: 1,
        image_url: "https://example.com/img.jpg",
      },
    ];
    mockGetProductList.mockResolvedValue(mockProducts);

    const res = await GET(makeRequest({ keyword: "coffee maker" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.keyword).toBe("coffee maker");
    expect(body.market).toBe("UAE");
    expect(body.count).toBe(1);
    expect(body.products).toHaveLength(1);
    expect(body.products[0].sku).toBe("SKU001");
  });

  it("passes all params to getProductList", async () => {
    mockGetProductList.mockResolvedValue([]);

    await GET(
      makeRequest({
        keyword: "test",
        market: "KSA",
        sortBy: "price_current",
        limit: "10",
      })
    );

    expect(mockGetProductList).toHaveBeenCalledWith("test", "KSA", "price_current", 10);
  });

  it("defaults market=UAE, sortBy=position, limit=20", async () => {
    mockGetProductList.mockResolvedValue([]);

    await GET(makeRequest({ keyword: "test" }));
    expect(mockGetProductList).toHaveBeenCalledWith("test", "UAE", "position", 20);
  });

  it("clamps limit to 100", async () => {
    mockGetProductList.mockResolvedValue([]);

    await GET(makeRequest({ keyword: "test", limit: "999" }));
    expect(mockGetProductList).toHaveBeenCalledWith("test", "UAE", "position", 100);
  });
});
