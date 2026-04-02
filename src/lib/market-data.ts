/**
 * Market data queries from Neon PostgreSQL.
 *
 * Reads market_snapshots, market_products, and market_sku_index tables
 * populated by the unilume-market-crawler GitHub Actions pipeline.
 */

import { getDb } from "./db";

// ── Types ────────────────────────────────────────

export interface MarketOverview {
  keyword: string;
  market: string;
  total_results: number;
  price_median: number;
  price_p25: number;
  price_p75: number;
  price_min: number;
  price_max: number;
  avg_rating: number;
  avg_review_count: number;
  sponsored_pct: number;
  fulfilled_pct: number;
  product_count: number;
  top_sellers: { name: string; count: number }[];
  data_freshness: string; // ISO timestamp of latest snapshot
}

export interface PriceTrendPoint {
  date: string;
  median: number;
  p25: number | null;
  p75: number | null;
}

export interface PriceTrend {
  keyword: string;
  days: number;
  data_points: number;
  daily: PriceTrendPoint[];
  direction: "rising" | "falling" | "stable" | "unknown";
  change_pct: number | null;
  latest_median: number;
}

export interface CompetitionAnalysis {
  keyword: string;
  total_products: number;
  unique_sellers: number;
  top10_sellers: { name: string; count: number; avg_price: number }[];
  top10_share_pct: number;
  avg_rating: number;
  avg_review_count: number;
  sponsored_pct: number;
  entry_barrier: "low" | "medium" | "high";
}

export interface KeywordInfo {
  keyword: string;
  markets: string[];
  last_updated: string;
}

export interface CrossMarketComparison {
  keyword: string;
  uae: MarketOverview | null;
  ksa: MarketOverview | null;
  deltas: {
    price_median: number | null;
    total_results: number | null;
    avg_rating: number | null;
    sponsored_pct: number | null;
  };
  recommendation: string;
}

export interface ProductListItem {
  sku: string;
  title: string;
  brand: string;
  price_current: number;
  price_original: number | null;
  discount_pct: number | null;
  rating: number | null;
  review_count: number;
  seller_name: string;
  is_sponsored: boolean;
  is_fulfilled: boolean;
  position: number;
  image_url: string | null;
}

export interface BrandShare {
  brand: string;
  count: number;
  share_pct: number;
  avg_price: number;
}

export interface BrandDistribution {
  keyword: string;
  market: string;
  total_products: number;
  brands: BrandShare[];
}

export interface PriceBucket {
  range_start: number;
  range_end: number;
  label: string;
  count: number;
}

export interface PriceDistribution {
  keyword: string;
  market: string;
  total_products: number;
  buckets: PriceBucket[];
  min_price: number;
  max_price: number;
}

export interface KeywordCategory {
  category: string;
  keywords: string[];
  count: number;
}

// ── Queries ──────────────────────────────────────

export async function getMarketOverview(
  keyword: string,
  market: string = "UAE"
): Promise<MarketOverview | null> {
  const sql = getDb();

  // Get latest snapshot for this keyword
  const snapshots = await sql`
    SELECT * FROM market_snapshots
    WHERE keyword = ${keyword} AND market = ${market}
    ORDER BY timestamp DESC
    LIMIT 1
  `;

  if (snapshots.length === 0) return null;

  const snap = snapshots[0];

  // Get top sellers from the latest snapshot's products
  const sellers = await sql`
    SELECT seller_name, COUNT(*) as count
    FROM market_products
    WHERE snapshot_id = ${snap.id} AND seller_name != ''
    GROUP BY seller_name
    ORDER BY count DESC
    LIMIT 10
  `;

  const sponsored_pct =
    snap.product_count > 0
      ? Math.round((snap.sponsored_count / snap.product_count) * 100)
      : 0;

  const fulfilled_pct =
    snap.product_count > 0
      ? Math.round((snap.fulfilled_count / snap.product_count) * 100)
      : 0;

  return {
    keyword,
    market,
    total_results: snap.total_results,
    price_median: snap.price_median,
    price_p25: snap.price_p25,
    price_p75: snap.price_p75,
    price_min: snap.price_min,
    price_max: snap.price_max,
    avg_rating: snap.avg_rating,
    avg_review_count: snap.avg_review_count,
    sponsored_pct,
    fulfilled_pct,
    product_count: snap.product_count,
    top_sellers: sellers.map((s) => ({ name: s.seller_name, count: Number(s.count) })),
    data_freshness: snap.timestamp,
  };
}

export async function getPriceTrend(
  keyword: string,
  days: number = 7
): Promise<PriceTrend> {
  const sql = getDb();

  const rows = await sql`
    SELECT date(timestamp) as date,
           AVG(price_median) as median,
           AVG(price_p25) as p25,
           AVG(price_p75) as p75
    FROM market_snapshots
    WHERE keyword = ${keyword}
      AND timestamp >= now() - ${days + " days"}::interval
    GROUP BY date(timestamp)
    ORDER BY date(timestamp)
  `;

  const daily: PriceTrendPoint[] = rows.map((r) => ({
    date: r.date,
    median: Number(r.median),
    p25: r.p25 ? Number(r.p25) : null,
    p75: r.p75 ? Number(r.p75) : null,
  }));

  const medians = daily.map((d) => d.median).filter((m) => m > 0);

  let direction: PriceTrend["direction"] = "unknown";
  let change_pct: number | null = null;

  if (medians.length >= 2) {
    const first = medians[0];
    const last = medians[medians.length - 1];
    change_pct = Math.round(((last - first) / first) * 1000) / 10;
    if (change_pct > 5) direction = "rising";
    else if (change_pct < -5) direction = "falling";
    else direction = "stable";
  }

  return {
    keyword,
    days,
    data_points: daily.length,
    daily,
    direction,
    change_pct,
    latest_median: medians.length > 0 ? medians[medians.length - 1] : 0,
  };
}

export async function getCompetitionAnalysis(
  keyword: string
): Promise<CompetitionAnalysis | null> {
  const sql = getDb();

  // Get latest snapshot
  const snapshots = await sql`
    SELECT id, product_count, sponsored_count, avg_rating, avg_review_count
    FROM market_snapshots
    WHERE keyword = ${keyword}
    ORDER BY timestamp DESC
    LIMIT 1
  `;

  if (snapshots.length === 0) return null;

  const snap = snapshots[0];

  // Top sellers with avg price
  const sellers = await sql`
    SELECT seller_name,
           COUNT(*) as count,
           AVG(price_current) as avg_price
    FROM market_products
    WHERE snapshot_id = ${snap.id} AND seller_name != ''
    GROUP BY seller_name
    ORDER BY count DESC
    LIMIT 10
  `;

  const uniqueSellersResult = await sql`
    SELECT COUNT(DISTINCT seller_name) as cnt
    FROM market_products
    WHERE snapshot_id = ${snap.id} AND seller_name != ''
  `;

  const unique_sellers = Number(uniqueSellersResult[0]?.cnt || 0);
  const top10_count = sellers.reduce((sum, s) => sum + Number(s.count), 0);
  const top10_share_pct =
    snap.product_count > 0
      ? Math.round((top10_count / snap.product_count) * 100)
      : 0;

  const sponsored_pct =
    snap.product_count > 0
      ? Math.round((snap.sponsored_count / snap.product_count) * 100)
      : 0;

  // Entry barrier heuristic
  let entry_barrier: CompetitionAnalysis["entry_barrier"] = "medium";
  if (snap.avg_rating >= 4.5 && snap.avg_review_count >= 100 && top10_share_pct >= 60) {
    entry_barrier = "high";
  } else if (snap.avg_rating < 4.2 || snap.avg_review_count < 30 || top10_share_pct < 30) {
    entry_barrier = "low";
  }

  return {
    keyword,
    total_products: snap.product_count,
    unique_sellers,
    top10_sellers: sellers.map((s) => ({
      name: s.seller_name,
      count: Number(s.count),
      avg_price: Math.round(Number(s.avg_price) * 100) / 100,
    })),
    top10_share_pct,
    avg_rating: snap.avg_rating,
    avg_review_count: snap.avg_review_count,
    sponsored_pct,
    entry_barrier,
  };
}

export async function getAvailableKeywords(): Promise<KeywordInfo[]> {
  const sql = getDb();

  const rows = await sql`
    SELECT keyword,
           array_agg(DISTINCT market) as markets,
           MAX(timestamp) as last_updated
    FROM market_snapshots
    GROUP BY keyword
    ORDER BY keyword
  `;

  return rows.map((r) => ({
    keyword: r.keyword,
    markets: r.markets,
    last_updated: r.last_updated,
  }));
}

// ── New query functions ─────────────────────────────

export async function getCrossMarketComparison(
  keyword: string
): Promise<CrossMarketComparison> {
  const [uae, ksa] = await Promise.all([
    getMarketOverview(keyword, "UAE"),
    getMarketOverview(keyword, "KSA"),
  ]);

  const deltas = {
    price_median:
      uae && ksa
        ? Math.round((uae.price_median - ksa.price_median) * 100) / 100
        : null,
    total_results:
      uae && ksa ? uae.total_results - ksa.total_results : null,
    avg_rating:
      uae && ksa
        ? Math.round((uae.avg_rating - ksa.avg_rating) * 100) / 100
        : null,
    sponsored_pct:
      uae && ksa
        ? Math.round((uae.sponsored_pct - ksa.sponsored_pct) * 100) / 100
        : null,
  };

  let recommendation: string;
  if (!uae && !ksa) {
    recommendation = "No data available for either market.";
  } else if (!uae) {
    recommendation = "Only KSA data available. Consider entering the UAE market.";
  } else if (!ksa) {
    recommendation = "Only UAE data available. Consider entering the KSA market.";
  } else {
    // Prefer the market with lower competition (fewer results, lower sponsored %)
    const uaeScore = uae.total_results + uae.sponsored_pct * 10;
    const ksaScore = ksa.total_results + ksa.sponsored_pct * 10;
    recommendation =
      uaeScore <= ksaScore
        ? "UAE appears to have lower competition."
        : "KSA appears to have lower competition.";
  }

  return { keyword, uae, ksa, deltas, recommendation };
}

const VALID_SORT_COLUMNS = [
  "position",
  "price_current",
  "rating",
  "review_count",
  "discount_pct",
] as const;

type SortColumn = (typeof VALID_SORT_COLUMNS)[number];

export async function getProductList(
  keyword: string,
  market: string = "UAE",
  sortBy: string = "position",
  limit: number = 48
): Promise<ProductListItem[]> {
  const sql = getDb();

  // Validate sortBy against allowlist
  const safeSortBy: SortColumn = VALID_SORT_COLUMNS.includes(
    sortBy as SortColumn
  )
    ? (sortBy as SortColumn)
    : "position";

  // Clamp limit
  const safeLimit = Math.min(Math.max(1, limit), 100);

  // Get latest snapshot
  const snapshots = await sql`
    SELECT id FROM market_snapshots
    WHERE keyword = ${keyword} AND market = ${market}
    ORDER BY timestamp DESC
    LIMIT 1
  `;

  if (snapshots.length === 0) return [];

  const snapshotId = snapshots[0].id;

  // Use conditional queries to prevent SQL injection with dynamic column names
  let rows;
  if (safeSortBy === "price_current") {
    rows = await sql`
      SELECT sku, title, brand, price_current, price_original, discount_pct,
             rating, review_count, seller_name, is_sponsored, is_fulfilled,
             position, image_url
      FROM market_products
      WHERE snapshot_id = ${snapshotId}
      ORDER BY price_current ASC
      LIMIT ${safeLimit}
    `;
  } else if (safeSortBy === "rating") {
    rows = await sql`
      SELECT sku, title, brand, price_current, price_original, discount_pct,
             rating, review_count, seller_name, is_sponsored, is_fulfilled,
             position, image_url
      FROM market_products
      WHERE snapshot_id = ${snapshotId}
      ORDER BY rating DESC NULLS LAST
      LIMIT ${safeLimit}
    `;
  } else if (safeSortBy === "review_count") {
    rows = await sql`
      SELECT sku, title, brand, price_current, price_original, discount_pct,
             rating, review_count, seller_name, is_sponsored, is_fulfilled,
             position, image_url
      FROM market_products
      WHERE snapshot_id = ${snapshotId}
      ORDER BY review_count DESC
      LIMIT ${safeLimit}
    `;
  } else if (safeSortBy === "discount_pct") {
    rows = await sql`
      SELECT sku, title, brand, price_current, price_original, discount_pct,
             rating, review_count, seller_name, is_sponsored, is_fulfilled,
             position, image_url
      FROM market_products
      WHERE snapshot_id = ${snapshotId}
      ORDER BY discount_pct DESC NULLS LAST
      LIMIT ${safeLimit}
    `;
  } else {
    // Default: position
    rows = await sql`
      SELECT sku, title, brand, price_current, price_original, discount_pct,
             rating, review_count, seller_name, is_sponsored, is_fulfilled,
             position, image_url
      FROM market_products
      WHERE snapshot_id = ${snapshotId}
      ORDER BY position ASC
      LIMIT ${safeLimit}
    `;
  }

  return rows.map((r) => ({
    sku: r.sku,
    title: r.title,
    brand: r.brand || "",
    price_current: Number(r.price_current),
    price_original: r.price_original ? Number(r.price_original) : null,
    discount_pct: r.discount_pct ? Number(r.discount_pct) : null,
    rating: r.rating ? Number(r.rating) : null,
    review_count: Number(r.review_count || 0),
    seller_name: r.seller_name || "",
    is_sponsored: Boolean(r.is_sponsored),
    is_fulfilled: Boolean(r.is_fulfilled),
    position: Number(r.position),
    image_url: r.image_url || null,
  }));
}

export async function getBrandDistribution(
  keyword: string,
  market: string = "UAE"
): Promise<BrandDistribution | null> {
  const sql = getDb();

  const snapshots = await sql`
    SELECT id, product_count FROM market_snapshots
    WHERE keyword = ${keyword} AND market = ${market}
    ORDER BY timestamp DESC
    LIMIT 1
  `;

  if (snapshots.length === 0) return null;

  const snap = snapshots[0];

  const rows = await sql`
    SELECT COALESCE(NULLIF(brand, ''), 'Unbranded') as brand,
           COUNT(*) as count,
           AVG(price_current) as avg_price
    FROM market_products
    WHERE snapshot_id = ${snap.id}
    GROUP BY COALESCE(NULLIF(brand, ''), 'Unbranded')
    ORDER BY count DESC
  `;

  const totalProducts = Number(snap.product_count) || rows.reduce((s, r) => s + Number(r.count), 0);

  const brands: BrandShare[] = rows.map((r) => ({
    brand: r.brand,
    count: Number(r.count),
    share_pct:
      totalProducts > 0
        ? Math.round((Number(r.count) / totalProducts) * 1000) / 10
        : 0,
    avg_price: Math.round(Number(r.avg_price) * 100) / 100,
  }));

  return {
    keyword,
    market,
    total_products: totalProducts,
    brands,
  };
}

export async function getPriceDistribution(
  keyword: string,
  market: string = "UAE",
  bucketCount: number = 10
): Promise<PriceDistribution | null> {
  const sql = getDb();

  const snapshots = await sql`
    SELECT id FROM market_snapshots
    WHERE keyword = ${keyword} AND market = ${market}
    ORDER BY timestamp DESC
    LIMIT 1
  `;

  if (snapshots.length === 0) return null;

  const snapshotId = snapshots[0].id;

  const rows = await sql`
    SELECT price_current
    FROM market_products
    WHERE snapshot_id = ${snapshotId} AND price_current > 0
    ORDER BY price_current ASC
  `;

  if (rows.length === 0) {
    return {
      keyword,
      market,
      total_products: 0,
      buckets: [],
      min_price: 0,
      max_price: 0,
    };
  }

  const prices = rows.map((r) => Number(r.price_current));
  const minPrice = prices[0];
  const maxPrice = prices[prices.length - 1];
  const safeBucketCount = Math.max(1, Math.min(bucketCount, 50));
  const bucketSize = (maxPrice - minPrice) / safeBucketCount || 1;

  const buckets: PriceBucket[] = [];
  for (let i = 0; i < safeBucketCount; i++) {
    const rangeStart = Math.round((minPrice + i * bucketSize) * 100) / 100;
    const rangeEnd =
      i === safeBucketCount - 1
        ? maxPrice
        : Math.round((minPrice + (i + 1) * bucketSize) * 100) / 100;
    const count = prices.filter((p) =>
      i === safeBucketCount - 1
        ? p >= rangeStart && p <= rangeEnd
        : p >= rangeStart && p < rangeEnd
    ).length;
    buckets.push({
      range_start: rangeStart,
      range_end: rangeEnd,
      label: `${rangeStart.toFixed(0)}–${rangeEnd.toFixed(0)}`,
      count,
    });
  }

  return {
    keyword,
    market,
    total_products: prices.length,
    buckets,
    min_price: minPrice,
    max_price: maxPrice,
  };
}

export async function getKeywordCategories(): Promise<KeywordCategory[]> {
  const sql = getDb();

  const rows = await sql`
    SELECT COALESCE(NULLIF(mp.category_code, ''), 'uncategorized') as category,
           array_agg(DISTINCT ms.keyword) as keywords,
           COUNT(DISTINCT ms.keyword) as count
    FROM market_products mp
    JOIN market_snapshots ms ON mp.snapshot_id = ms.id
    GROUP BY COALESCE(NULLIF(mp.category_code, ''), 'uncategorized')
    ORDER BY count DESC
  `;

  return rows.map((r) => ({
    category: r.category,
    keywords: r.keywords,
    count: Number(r.count),
  }));
}
