// ── Tool response envelope ──────────────────────

export interface ToolResponseMeta {
  latency_ms: number;
  data_source: "cache" | "on_demand" | "static" | "api";
  data_freshness?: string; // ISO 8601
  confidence: "high" | "medium" | "low";
  confidence_note?: string;
  degradation_reason?: string;
  cost?: {
    crawl_bytes?: number;
    db_queries?: number;
  };
}

export interface ToolResponse<T> {
  status: "success" | "partial" | "not_found" | "error";
  data: T | null;
  metadata: ToolResponseMeta;
}

export function toolSuccess<T>(
  data: T,
  meta: Partial<ToolResponseMeta>,
): ToolResponse<T> {
  return {
    status: "success",
    data,
    metadata: {
      latency_ms: 0,
      data_source: "cache",
      confidence: "high",
      ...meta,
    },
  };
}

export function toolPartial<T>(
  data: T,
  reason: string,
  meta: Partial<ToolResponseMeta>,
): ToolResponse<T> {
  return {
    status: "partial",
    data,
    metadata: {
      latency_ms: 0,
      data_source: "on_demand",
      confidence: "low",
      degradation_reason: reason,
      ...meta,
    },
  };
}

export function toolNotFound(reason: string): ToolResponse<null> {
  return {
    status: "not_found",
    data: null,
    metadata: {
      latency_ms: 0,
      data_source: "on_demand",
      confidence: "low",
      degradation_reason: reason,
    },
  };
}

export function toolError(error: string): ToolResponse<null> {
  return {
    status: "error",
    data: null,
    metadata: {
      latency_ms: 0,
      data_source: "on_demand",
      confidence: "low",
      degradation_reason: error,
    },
  };
}

// ── Crawl types ─────────────────────────────────

export interface MarketSnapshot {
  id: number;
  keyword: string;
  locale: string;
  market: string;
  timestamp: string;
  total_results: number;
  product_count: number;
  sponsored_count: number;
  fulfilled_count: number;
  avg_rating: number;
  avg_review_count: number;
  price_min: number;
  price_p25: number;
  price_median: number;
  price_p75: number;
  price_max: number;
  source: "daily_crawl" | "on_demand" | "category_crawl";
}

export interface MarketProduct {
  id?: number;
  snapshot_id: number;
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
  category_code: string | null;
}

export interface Facet {
  code: string;
  name: string;
  values: Array<{ value: string; count: number; name?: string }>;
}

export interface CrawlResult {
  snapshot: MarketSnapshot;
  products: MarketProduct[];
  facets: Facet[];
  crawl_bytes: number;
}

// ── Dedup types ─────────────────────────────────

export interface DeduplicatedProduct extends MarketProduct {
  is_variant: boolean;
  variant_group_id?: string;
}
