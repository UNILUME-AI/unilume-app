/**
 * On-demand crawl: Noon search API via IPRoyal residential proxy.
 *
 * Fetches up to 3 pages (150 products) per keyword with an 8s hard timeout.
 * Partial results (1-2 pages before timeout) are still written to Neon.
 *
 * Concurrent requests for the same keyword+locale are deduplicated.
 */

import { ProxyAgent, fetch as undiciFetch } from "undici";
import { getDb } from "@/lib/db";
import type { CrawlResult, Facet, MarketProduct, MarketSnapshot } from "./types";

// ── Config ──────────────────────────────────────

const BASE_URL = "https://www.noon.com";
const API_PATH = "/_svc/catalog/api/v3/u/search";
const CRAWL_TIMEOUT = 8_000;
const PAGES_PER_KEYWORD = 3;
const PRODUCTS_PER_PAGE = 50;

const LOCALE_CONFIG: Record<string, { path_prefix: string; market: string; country: string }> = {
  "en-AE": { path_prefix: "uae-en", market: "UAE", country: "ae" },
  "en-SA": { path_prefix: "saudi-en", market: "KSA", country: "sa" },
};

// ── Proxy ───────────────────────────────────────

let cachedDispatcher: ProxyAgent | null = null;

function getProxyDispatcher(country: string): ProxyAgent {
  // Reuse dispatcher across requests within the same function invocation
  if (cachedDispatcher) return cachedDispatcher;

  const user = process.env.IPROYAL_USER;
  const pass = process.env.IPROYAL_PASS;
  const host = process.env.IPROYAL_HOST || "geo.iproyal.com";
  const port = process.env.IPROYAL_PORT || "12321";

  if (!user || !pass) {
    throw new Error("IPROYAL_USER / IPROYAL_PASS not configured");
  }

  const proxyUrl = `http://${user}:${pass}_country-${country}@${host}:${port}`;
  cachedDispatcher = new ProxyAgent(proxyUrl);
  return cachedDispatcher;
}

// ── URL & headers ───────────────────────────────

function buildSearchUrl(keyword: string, locale: string, page: number): string {
  const params = new URLSearchParams({
    q: keyword,
    locale,
    limit: String(PRODUCTS_PER_PAGE),
    page: String(page),
  });
  return `${BASE_URL}${API_PATH}?${params}`;
}

function buildHeaders(locale: string): Record<string, string> {
  const cfg = LOCALE_CONFIG[locale] ?? LOCALE_CONFIG["en-AE"];
  return {
    Accept: "application/json",
    "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
    Referer: `${BASE_URL}/${cfg.path_prefix}/`,
  };
}

// ── Response parsing ────────���───────────────────

function parseProducts(
  hits: Array<Record<string, unknown>>,
  page: number,
): MarketProduct[] {
  return hits.map((hit, idx) => {
    const ratingData = (hit.product_rating as Record<string, unknown>) || {};
    const flags = (hit.flags as string[]) || [];
    const catalogTag = (hit.catalogTagV2 as Record<string, unknown>) || {};

    const isSponsored =
      catalogTag.type === "sponsored" || flags.includes("sponsored");
    const isFulfilled =
      flags.includes("fbn") || flags.includes("express");

    const salePrice = Number(hit.sale_price || hit.price || 0);
    const wasPrice = hit.price && hit.sale_price && hit.price !== hit.sale_price
      ? Number(hit.price)
      : null;

    let discountPct: number | null = null;
    if (wasPrice && wasPrice > salePrice) {
      discountPct = Math.round(((wasPrice - salePrice) / wasPrice) * 100);
    }

    // Extract primary category from categories array
    const categories = (hit.categories as string[]) || [];
    const categoryCode = categories.length > 0 ? categories[categories.length - 1] : null;

    return {
      snapshot_id: 0, // filled after snapshot insert
      sku: String(hit.sku || ""),
      title: String(hit.name || ""),
      brand: String(hit.brand_code || hit.brand || ""),
      price_current: salePrice,
      price_original: wasPrice,
      discount_pct: discountPct,
      rating: ratingData.value != null ? Number(ratingData.value) : null,
      review_count: Number(ratingData.count || 0),
      seller_name: String(hit.store_name || ""),
      is_sponsored: isSponsored,
      is_fulfilled: isFulfilled,
      position: (page - 1) * PRODUCTS_PER_PAGE + idx + 1,
      image_url: hit.image_key ? `https://f.nooncdn.com/p/${hit.image_key}.jpg` : null,
      category_code: categoryCode,
    };
  });
}

function parseFacets(rawFacets: Record<string, unknown>[] | undefined): Facet[] {
  if (!rawFacets || !Array.isArray(rawFacets)) return [];
  return rawFacets.map((f) => ({
    code: String(f.code || ""),
    name: String(f.name || ""),
    values: Array.isArray(f.values)
      ? f.values.map((v: Record<string, unknown>) => ({
          value: String(v.value || ""),
          count: Number(v.count || 0),
          name: v.name ? String(v.name) : undefined,
        }))
      : [],
  }));
}

// ── Neon writes ─────────────────────────────────

function computeStats(products: MarketProduct[]) {
  const prices = products.map((p) => p.price_current).filter((p) => p > 0).sort((a, b) => a - b);
  const ratings = products.map((p) => p.rating).filter((r): r is number => r != null);
  const reviews = products.map((p) => p.review_count);

  const percentile = (arr: number[], pct: number) => {
    if (arr.length === 0) return 0;
    const i = Math.floor((arr.length - 1) * pct);
    return arr[i];
  };

  return {
    sponsored_count: products.filter((p) => p.is_sponsored).length,
    fulfilled_count: products.filter((p) => p.is_fulfilled).length,
    avg_rating: ratings.length > 0
      ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 100) / 100
      : 0,
    avg_review_count: reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r, 0) / reviews.length) * 100) / 100
      : 0,
    price_min: prices[0] || 0,
    price_p25: percentile(prices, 0.25),
    price_median: percentile(prices, 0.5),
    price_p75: percentile(prices, 0.75),
    price_max: prices[prices.length - 1] || 0,
  };
}

async function writeSnapshot(
  keyword: string,
  locale: string,
  totalResults: number,
  products: MarketProduct[],
): Promise<MarketSnapshot> {
  const sql = getDb();
  const cfg = LOCALE_CONFIG[locale] ?? LOCALE_CONFIG["en-AE"];
  const stats = computeStats(products);

  const rows = await sql`
    INSERT INTO market_snapshots (
      platform, keyword, locale, market, timestamp,
      total_results, product_count, sponsored_count, fulfilled_count,
      avg_rating, avg_review_count,
      price_min, price_p25, price_median, price_p75, price_max,
      source
    ) VALUES (
      'noon', ${keyword}, ${locale}, ${cfg.market}, NOW(),
      ${totalResults}, ${products.length}, ${stats.sponsored_count}, ${stats.fulfilled_count},
      ${stats.avg_rating}, ${stats.avg_review_count},
      ${stats.price_min}, ${stats.price_p25}, ${stats.price_median}, ${stats.price_p75}, ${stats.price_max},
      'on_demand'
    )
    RETURNING *
  `;

  return rows[0] as unknown as MarketSnapshot;
}

async function writeProducts(
  snapshotId: number,
  products: MarketProduct[],
): Promise<void> {
  if (products.length === 0) return;
  const sql = getDb();

  // Bulk insert using UNNEST — single HTTP request to Neon
  const skus = products.map((p) => p.sku);
  const titles = products.map((p) => p.title);
  const brands = products.map((p) => p.brand);
  const priceCurrents = products.map((p) => p.price_current);
  const priceOriginals = products.map((p) => p.price_original);
  const discountPcts = products.map((p) => p.discount_pct);
  const ratings = products.map((p) => p.rating);
  const reviewCounts = products.map((p) => p.review_count);
  const sellerNames = products.map((p) => p.seller_name);
  const isSponsoreds = products.map((p) => p.is_sponsored);
  const isFulfilleds = products.map((p) => p.is_fulfilled);
  const positions = products.map((p) => p.position);
  const imageUrls = products.map((p) => p.image_url);
  const categoryCodes = products.map((p) => p.category_code);

  await sql`
    INSERT INTO market_products (
      snapshot_id, sku, title, brand,
      price_current, price_original, discount_pct,
      rating, review_count, seller_name,
      is_sponsored, is_fulfilled, position,
      image_url, category_code
    )
    SELECT
      ${snapshotId}::int,
      unnest(${skus}::text[]),
      unnest(${titles}::text[]),
      unnest(${brands}::text[]),
      unnest(${priceCurrents}::real[]),
      unnest(${priceOriginals}::real[]),
      unnest(${discountPcts}::real[]),
      unnest(${ratings}::real[]),
      unnest(${reviewCounts}::int[]),
      unnest(${sellerNames}::text[]),
      unnest(${isSponsoreds}::boolean[]),
      unnest(${isFulfilleds}::boolean[]),
      unnest(${positions}::int[]),
      unnest(${imageUrls}::text[]),
      unnest(${categoryCodes}::text[])
    ON CONFLICT (snapshot_id, sku) DO NOTHING
  `;
}

// ── Core crawl logic ──────────────���─────────────

async function executeCrawl(
  keyword: string,
  locale: string,
): Promise<CrawlResult | null> {
  const cfg = LOCALE_CONFIG[locale] ?? LOCALE_CONFIG["en-AE"];
  const dispatcher = getProxyDispatcher(cfg.country);
  const headers = buildHeaders(locale);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CRAWL_TIMEOUT);

  const allProducts: MarketProduct[] = [];
  let facets: Facet[] = [];
  let totalResults = 0;
  let crawlBytes = 0;

  try {
    for (let page = 1; page <= PAGES_PER_KEYWORD; page++) {
      const url = buildSearchUrl(keyword, locale, page);

      const resp = await undiciFetch(url, {
        headers,
        dispatcher,
        signal: controller.signal,
      });

      if (!resp.ok) break;

      const text = await resp.text();
      crawlBytes += text.length;

      const data = JSON.parse(text);

      if (page === 1) {
        totalResults = data.nbHits ?? 0;
        facets = parseFacets(data.facets);
      }

      const products = parseProducts(data.hits || [], page);
      allProducts.push(...products);

      // No more pages
      if (page >= (data.nbPages ?? 0)) break;
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      // Timeout — fall through and write partial data if any
    } else {
      // Re-throw non-timeout errors only if we have no data
      if (allProducts.length === 0) return null;
    }
  } finally {
    clearTimeout(timeout);
  }

  if (allProducts.length === 0) return null;

  // Write to Neon
  const snapshot = await writeSnapshot(keyword, locale, totalResults, allProducts);
  await writeProducts(snapshot.id, allProducts);

  return {
    snapshot,
    products: allProducts.map((p) => ({ ...p, snapshot_id: snapshot.id })),
    facets,
    crawl_bytes: crawlBytes,
  };
}

// ── Concurrent dedup ──────────���─────────────────

// Deduplicates concurrent crawl requests within the same Vercel Function instance.
// With Fluid Compute, instances are reused across concurrent requests, so this
// prevents duplicate crawls from parallel tool calls in the same or nearby sessions.
// Requests hitting different instances will still start separate crawls — acceptable for v1.
const pendingCrawls = new Map<string, Promise<CrawlResult | null>>();

/**
 * On-demand crawl with concurrent request deduplication.
 *
 * If another request for the same keyword+locale is already in flight,
 * returns the same Promise instead of starting a second crawl.
 */
export function onDemandCrawl(
  keyword: string,
  locale: string,
): Promise<CrawlResult | null> {
  const key = `${keyword.toLowerCase().trim()}:${locale}`;

  const existing = pendingCrawls.get(key);
  if (existing) return existing;

  const promise = executeCrawl(keyword, locale).finally(() => {
    pendingCrawls.delete(key);
  });
  pendingCrawls.set(key, promise);
  return promise;
}
