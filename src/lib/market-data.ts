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

export async function getAvailableKeywords(): Promise<string[]> {
  const sql = getDb();

  const rows = await sql`
    SELECT DISTINCT keyword
    FROM market_snapshots
    ORDER BY keyword
  `;

  return rows.map((r) => r.keyword);
}
