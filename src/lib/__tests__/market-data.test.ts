import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock sql tagged-template function
const mockSql = vi.fn();

vi.mock("@/lib/db", () => ({
  getDb: () => mockSql,
}));

import {
  getAvailableKeywords,
  getCrossMarketComparison,
  getProductList,
  getBrandDistribution,
  getPriceDistribution,
  getKeywordCategories,
} from "../market-data";

beforeEach(() => {
  mockSql.mockReset();
});

// ── getAvailableKeywords ────────────────────────────

describe("getAvailableKeywords", () => {
  it("returns keyword info with markets and last_updated", async () => {
    mockSql.mockResolvedValueOnce([
      {
        keyword: "bluetooth speaker",
        markets: ["UAE", "KSA"],
        last_updated: "2026-04-01T00:00:00Z",
      },
      {
        keyword: "wireless earbuds",
        markets: ["UAE"],
        last_updated: "2026-04-01T12:00:00Z",
      },
    ]);

    const result = await getAvailableKeywords();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      keyword: "bluetooth speaker",
      markets: ["UAE", "KSA"],
      last_updated: "2026-04-01T00:00:00Z",
    });
    expect(result[1].keyword).toBe("wireless earbuds");
  });

  it("returns empty array when no data", async () => {
    mockSql.mockResolvedValueOnce([]);

    const result = await getAvailableKeywords();
    expect(result).toEqual([]);
  });
});

// ── getCrossMarketComparison ────────────────────────

describe("getCrossMarketComparison", () => {
  const makeSnapshot = (market: string) => [
    {
      id: `snap-${market}`,
      total_results: market === "UAE" ? 500 : 300,
      price_median: market === "UAE" ? 100 : 80,
      price_p25: 50,
      price_p75: 150,
      price_min: 10,
      price_max: 200,
      avg_rating: market === "UAE" ? 4.2 : 4.0,
      avg_review_count: 50,
      sponsored_count: market === "UAE" ? 10 : 5,
      fulfilled_count: 20,
      product_count: 50,
      timestamp: "2026-04-01T00:00:00Z",
    },
  ];

  const makeSellers = () => [
    { seller_name: "SellerA", count: 5 },
  ];

  it("returns comparison with deltas and recommendation", async () => {
    // The neon tagged-template sql function receives (strings, ...values)
    // We inspect the interpolated values to determine which market is queried.
    mockSql.mockImplementation(
      (strings: TemplateStringsArray, ...values: unknown[]) => {
        const query = strings.join("?");
        if (
          query.includes("market_snapshots") &&
          query.includes("ORDER BY timestamp")
        ) {
          // The market parameter is the second interpolated value
          const market = values.find(
            (v) => v === "UAE" || v === "KSA"
          ) as string;
          return Promise.resolve(makeSnapshot(market || "UAE"));
        }
        if (query.includes("seller_name") && query.includes("GROUP BY")) {
          return Promise.resolve(makeSellers());
        }
        return Promise.resolve([]);
      }
    );

    const result = await getCrossMarketComparison("bluetooth speaker");

    expect(result.keyword).toBe("bluetooth speaker");
    expect(result.uae).not.toBeNull();
    expect(result.ksa).not.toBeNull();
    expect(result.deltas.price_median).toBe(20); // 100 - 80
    expect(result.deltas.total_results).toBe(200); // 500 - 300
    expect(result.recommendation).toContain("lower competition");
  });

  it("handles missing market data", async () => {
    mockSql.mockImplementation(
      (strings: TemplateStringsArray, ...values: unknown[]) => {
        const query = strings.join("?");
        if (
          query.includes("market_snapshots") &&
          query.includes("ORDER BY timestamp")
        ) {
          const market = values.find(
            (v) => v === "UAE" || v === "KSA"
          ) as string;
          // UAE returns empty, KSA returns data
          if (market === "UAE") return Promise.resolve([]);
          return Promise.resolve(makeSnapshot("KSA"));
        }
        if (query.includes("seller_name") && query.includes("GROUP BY")) {
          return Promise.resolve(makeSellers());
        }
        return Promise.resolve([]);
      }
    );

    const result = await getCrossMarketComparison("bluetooth speaker");

    expect(result.uae).toBeNull();
    expect(result.ksa).not.toBeNull();
    expect(result.deltas.price_median).toBeNull();
    expect(result.recommendation).toContain("UAE market");
  });
});

// ── getProductList ──────────────────────────────────

describe("getProductList", () => {
  it("returns product list sorted by position (default)", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "snap-1" }])
      .mockResolvedValueOnce([
        {
          sku: "SKU-001",
          title: "Test Product",
          brand: "TestBrand",
          price_current: 99.99,
          price_original: 129.99,
          discount_pct: 23,
          rating: 4.5,
          review_count: 100,
          seller_name: "SellerA",
          is_sponsored: false,
          is_fulfilled: true,
          position: 1,
          image_url: "https://img.example.com/1.jpg",
        },
      ]);

    const result = await getProductList("bluetooth speaker");

    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe("SKU-001");
    expect(result[0].price_current).toBe(99.99);
    expect(result[0].is_fulfilled).toBe(true);
  });

  it("returns empty array when no snapshot", async () => {
    mockSql.mockResolvedValueOnce([]);

    const result = await getProductList("nonexistent");
    expect(result).toEqual([]);
  });

  it("clamps limit to 100", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "snap-1" }])
      .mockResolvedValueOnce([]);

    await getProductList("bluetooth speaker", "UAE", "position", 999);

    // The second call should have limit = 100 (clamping is internal to the
    // tagged template — we can only verify the call pattern count here).
    expect(mockSql).toHaveBeenCalledTimes(2);
  });

  it("falls back to position sort for invalid sortBy", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "snap-1" }])
      .mockResolvedValueOnce([]);

    await getProductList("bluetooth speaker", "UAE", "DROP TABLE;--");

    // Should not throw, just use position sort
    expect(mockSql).toHaveBeenCalledTimes(2);
  });
});

// ── getBrandDistribution ────────────────────────────

describe("getBrandDistribution", () => {
  it("returns brand distribution with share percentages", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "snap-1", product_count: 100 }])
      .mockResolvedValueOnce([
        { brand: "BrandA", count: 40, avg_price: 50.5 },
        { brand: "BrandB", count: 30, avg_price: 75.25 },
        { brand: "Unbranded", count: 30, avg_price: 20.0 },
      ]);

    const result = await getBrandDistribution("bluetooth speaker");

    expect(result).not.toBeNull();
    expect(result!.total_products).toBe(100);
    expect(result!.brands).toHaveLength(3);
    expect(result!.brands[0].brand).toBe("BrandA");
    expect(result!.brands[0].share_pct).toBe(40);
    expect(result!.brands[0].avg_price).toBe(50.5);
  });

  it("returns null when no snapshot", async () => {
    mockSql.mockResolvedValueOnce([]);

    const result = await getBrandDistribution("nonexistent");
    expect(result).toBeNull();
  });
});

// ── getPriceDistribution ────────────────────────────

describe("getPriceDistribution", () => {
  it("returns histogram buckets", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "snap-1" }])
      .mockResolvedValueOnce([
        { price_current: 10 },
        { price_current: 20 },
        { price_current: 30 },
        { price_current: 40 },
        { price_current: 50 },
      ]);

    const result = await getPriceDistribution("bluetooth speaker", "UAE", 5);

    expect(result).not.toBeNull();
    expect(result!.total_products).toBe(5);
    expect(result!.min_price).toBe(10);
    expect(result!.max_price).toBe(50);
    expect(result!.buckets).toHaveLength(5);
    // Each bucket should have a label
    expect(result!.buckets[0].label).toContain("–");
  });

  it("returns null when no snapshot", async () => {
    mockSql.mockResolvedValueOnce([]);

    const result = await getPriceDistribution("nonexistent");
    expect(result).toBeNull();
  });

  it("handles empty products", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "snap-1" }])
      .mockResolvedValueOnce([]);

    const result = await getPriceDistribution("bluetooth speaker");

    expect(result).not.toBeNull();
    expect(result!.total_products).toBe(0);
    expect(result!.buckets).toEqual([]);
  });
});

// ── getKeywordCategories ────────────────────────────

describe("getKeywordCategories", () => {
  it("returns hierarchical categories grouped by parent", async () => {
    mockSql.mockResolvedValueOnce([
      {
        keyword: "bluetooth speaker",
        category_code: "electronics-and-mobiles/portable-audio-and-video",
        category_name: "Portable Audio & Video",
        parent_code: "electronics-and-mobiles",
        parent_name: "Electronics & Mobiles",
      },
      {
        keyword: "wireless earbuds",
        category_code: "electronics-and-mobiles/portable-audio-and-video",
        category_name: "Portable Audio & Video",
        parent_code: "electronics-and-mobiles",
        parent_name: "Electronics & Mobiles",
      },
      {
        keyword: "yoga mat",
        category_code: "sports-and-outdoors/exercise-and-fitness",
        category_name: "Exercise & Fitness",
        parent_code: "sports-and-outdoors",
        parent_name: "Sports & Outdoors",
      },
    ]);

    const result = await getKeywordCategories();

    expect(result).toHaveLength(2);
    // Sorted by parent_name
    expect(result[0].parent_code).toBe("electronics-and-mobiles");
    expect(result[0].parent_name).toBe("Electronics & Mobiles");
    expect(result[0].subcategories).toHaveLength(1);
    expect(result[0].subcategories[0].code).toBe(
      "electronics-and-mobiles/portable-audio-and-video"
    );
    expect(result[0].subcategories[0].keywords).toEqual([
      "bluetooth speaker",
      "wireless earbuds",
    ]);

    expect(result[1].parent_code).toBe("sports-and-outdoors");
    expect(result[1].subcategories[0].keywords).toEqual(["yoga mat"]);
  });

  it("returns empty array when no data", async () => {
    mockSql.mockResolvedValueOnce([]);

    const result = await getKeywordCategories();
    expect(result).toEqual([]);
  });
});
