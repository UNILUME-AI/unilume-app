/**
 * PoC: Node.js fetch + IPRoyal proxy → Noon search API
 *
 * Tests whether undici ProxyAgent can pass Noon's Akamai Bot Manager
 * through IPRoyal residential proxy.
 *
 * Usage:
 *   npx tsx scripts/crawl/poc-noon-crawl.ts
 *
 * Expected: >90% success rate across 10 keywords
 */

import { ProxyAgent, fetch as undiciFetch } from "undici";
import { config } from "dotenv";

config({ path: ".env.local" });

// ── Config ──────────────────────────────────────

const PROXY_USER = process.env.IPROYAL_USER!;
const PROXY_PASS = process.env.IPROYAL_PASS!;
const PROXY_HOST = process.env.IPROYAL_HOST || "geo.iproyal.com";
const PROXY_PORT = process.env.IPROYAL_PORT || "12321";

const BASE_URL = "https://www.noon.com";
const API_PATH = "/_svc/catalog/api/v3/u/search";

const TEST_KEYWORDS = [
  "portable fan",
  "kitchen storage",
  "phone case",
  "water bottle",
  "led lights",
  "baby stroller",
  "laptop stand",
  "air fryer",
  "yoga mat",
  "wireless earbuds",
];

// ── Helpers ─────────────────────────────────────

function buildSearchUrl(keyword: string, locale: string, page: number): string {
  const params = new URLSearchParams({
    q: keyword,
    locale,
    limit: "50",
    page: String(page),
  });
  return `${BASE_URL}${API_PATH}?${params}`;
}

function buildHeaders(locale: string): Record<string, string> {
  const market = locale.startsWith("en-AE") ? "uae-en" : "saudi-en";
  return {
    Accept: "application/json",
    "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
    Referer: `${BASE_URL}/${market}/`,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  };
}

function createProxyAgent(country: string): ProxyAgent {
  // IPRoyal format: user:pass_country-{cc}@host:port
  const proxyUrl = `http://${PROXY_USER}:${PROXY_PASS}_country-${country}@${PROXY_HOST}:${PROXY_PORT}`;
  return new ProxyAgent(proxyUrl);
}

// ── Test runner ─────────────────────────────────

interface TestResult {
  keyword: string;
  success: boolean;
  status?: number;
  nbHits?: number;
  productCount?: number;
  latencyMs: number;
  error?: string;
  bodySnippet?: string;
}

async function testKeyword(
  keyword: string,
  locale: string,
  dispatcher: ProxyAgent,
): Promise<TestResult> {
  const url = buildSearchUrl(keyword, locale, 1);
  const headers = buildHeaders(locale);
  const start = Date.now();

  try {
    const resp = await undiciFetch(url, {
      headers,
      dispatcher,
      signal: AbortSignal.timeout(15_000),
    });

    const latencyMs = Date.now() - start;
    const text = await resp.text();

    if (resp.status !== 200) {
      return {
        keyword,
        success: false,
        status: resp.status,
        latencyMs,
        error: `HTTP ${resp.status}`,
        bodySnippet: text.slice(0, 200),
      };
    }

    // Check for block signatures
    const lower = text.toLowerCase();
    if (
      lower.includes("access denied") ||
      lower.includes("robot check") ||
      lower.includes("reference #")
    ) {
      return {
        keyword,
        success: false,
        status: 200,
        latencyMs,
        error: "Akamai block page (200)",
        bodySnippet: text.slice(0, 200),
      };
    }

    // Check for JS challenge
    if (text.length < 5000 && (lower.includes("_abck") || lower.includes("bmak"))) {
      return {
        keyword,
        success: false,
        status: 200,
        latencyMs,
        error: "Akamai JS challenge",
        bodySnippet: text.slice(0, 200),
      };
    }

    // Parse JSON
    const data = JSON.parse(text);
    if (!("hits" in data) && !("nbHits" in data)) {
      return {
        keyword,
        success: false,
        status: 200,
        latencyMs,
        error: "No hits/nbHits in response",
        bodySnippet: text.slice(0, 200),
      };
    }

    return {
      keyword,
      success: true,
      status: 200,
      nbHits: data.nbHits,
      productCount: data.hits?.length ?? 0,
      latencyMs,
    };
  } catch (err) {
    return {
      keyword,
      success: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Main ────────────────────────────────────────

async function main() {
  console.log("=== PoC: Node.js fetch + IPRoyal → Noon Search API ===\n");
  console.log(`Proxy: ${PROXY_HOST}:${PROXY_PORT}`);
  console.log(`Keywords: ${TEST_KEYWORDS.length}`);
  console.log();

  if (!PROXY_USER || !PROXY_PASS) {
    console.error("ERROR: IPROYAL_USER / IPROYAL_PASS not set in .env.local");
    process.exit(1);
  }

  const locale = "en-AE";
  const dispatcher = createProxyAgent("ae");

  // Test sequentially to avoid triggering rate limits
  const results: TestResult[] = [];
  for (const kw of TEST_KEYWORDS) {
    process.stdout.write(`  ${kw.padEnd(20)} ... `);
    const result = await testKeyword(kw, locale, dispatcher);
    results.push(result);

    if (result.success) {
      console.log(
        `✅ ${result.latencyMs}ms  nbHits=${result.nbHits}  products=${result.productCount}`,
      );
    } else {
      console.log(`❌ ${result.latencyMs}ms  ${result.error}`);
      if (result.bodySnippet) {
        console.log(`     body: ${result.bodySnippet.slice(0, 100)}...`);
      }
    }

    // Small delay between requests
    await new Promise((r) => setTimeout(r, 500));
  }

  // Summary
  const passed = results.filter((r) => r.success).length;
  const total = results.length;
  const avgLatency = Math.round(
    results.reduce((s, r) => s + r.latencyMs, 0) / total,
  );

  console.log("\n=== Summary ===");
  console.log(`Pass rate: ${passed}/${total} (${Math.round((passed / total) * 100)}%)`);
  console.log(`Avg latency: ${avgLatency}ms`);

  if (passed / total >= 0.9) {
    console.log("\n✅ PASS — Node.js + IPRoyal proxy works for Noon search API");
  } else {
    console.log("\n❌ FAIL — Need alternative approach (Python Function or external service)");

    // If failures are Akamai blocks, try without User-Agent to see if proxy handles it
    const blockFailures = results.filter(
      (r) => !r.success && r.error?.includes("Akamai"),
    );
    if (blockFailures.length > 0) {
      console.log(
        `\n  ${blockFailures.length} Akamai blocks detected.`,
        "\n  Consider: IPRoyal super proxy (port 32325) or Vercel Python Function with curl_cffi.",
      );
    }
  }

  // Close the dispatcher
  await dispatcher.close();
}

main().catch(console.error);
