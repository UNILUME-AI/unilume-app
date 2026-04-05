/**
 * E2E test: on-demand crawl → Neon write → dedup verification
 *
 * Usage: npx tsx scripts/crawl/test-crawl-e2e.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { onDemandCrawl } from "../../src/lib/selection/crawl";
import { deduplicateVariants, getUniqueProducts } from "../../src/lib/selection/dedup";

const TEST_KEYWORDS = [
  "portable fan",
  "kitchen storage",
  "wireless earbuds",
];

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("=== E2E Test: on-demand crawl + Neon write + dedup ===\n");

  for (const keyword of TEST_KEYWORDS) {
    console.log(`--- ${keyword} ---`);
    const start = Date.now();

    const result = await onDemandCrawl(keyword, "en-AE");
    const elapsed = Date.now() - start;

    if (!result) {
      console.log(`  ❌ Crawl returned null (${elapsed}ms)\n`);
      continue;
    }

    console.log(`  Crawl: ${elapsed}ms, ${result.products.length} products, ${result.crawl_bytes} bytes`);
    console.log(`  Snapshot ID: ${result.snapshot.id}`);
    console.log(`  nbHits: ${result.snapshot.total_results}`);
    console.log(`  Facets: ${result.facets.length}`);

    // Verify in DB
    const dbSnap = await sql`
      SELECT id, keyword, source, product_count, price_median
      FROM market_snapshots WHERE id = ${result.snapshot.id}
    `;
    console.log(`  DB snapshot: source=${dbSnap[0]?.source}, products=${dbSnap[0]?.product_count}`);

    const dbCount = await sql`
      SELECT COUNT(*) as cnt FROM market_products WHERE snapshot_id = ${result.snapshot.id}
    `;
    console.log(`  DB products: ${dbCount[0]?.cnt} rows`);

    // Dedup test
    const deduped = deduplicateVariants(result.products);
    const unique = getUniqueProducts(deduped);
    const variants = deduped.filter((p) => p.is_variant);
    console.log(`  Dedup: ${unique.length} unique, ${variants.length} variants (${deduped.length} total)`);

    // Show a few variant groups
    const groups = new Map<string, number>();
    for (const p of deduped) {
      if (p.variant_group_id) {
        groups.set(p.variant_group_id, (groups.get(p.variant_group_id) || 0) + 1);
      }
    }
    const multiGroups = [...groups.entries()]
      .filter(([, count]) => count > 1)
      .slice(0, 3);
    if (multiGroups.length > 0) {
      console.log(`  Variant groups (sample):`);
      for (const [groupId, count] of multiGroups) {
        const members = deduped.filter((p) => p.variant_group_id === groupId);
        console.log(`    ${groupId}: ${count} items`);
        for (const m of members.slice(0, 2)) {
          console.log(`      ${m.is_variant ? "  variant" : "  leader "}: ${m.title.slice(0, 60)} (${m.price_current} AED)`);
        }
      }
    }

    // Check < 8s requirement
    if (elapsed > 8000) {
      console.log(`  ⚠️ SLOW: ${elapsed}ms exceeds 8s timeout`);
    } else {
      console.log(`  ✅ ${elapsed}ms (< 8s)`);
    }
    console.log();
  }

  // Cleanup: delete test snapshots
  console.log("--- Cleanup ---");
  const deleted = await sql`
    DELETE FROM market_snapshots
    WHERE source = 'on_demand'
      AND keyword = ANY(${TEST_KEYWORDS})
      AND timestamp > NOW() - INTERVAL '5 minutes'
    RETURNING id
  `;
  console.log(`  Deleted ${deleted.length} test snapshots (cascade deletes products)`);
}

main().catch(console.error);
