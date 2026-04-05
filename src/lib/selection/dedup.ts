/**
 * Variant deduplication for market products.
 *
 * Products are considered variants of the same base product when ALL 3 match:
 *   1. Same brand (case-insensitive)
 *   2. Price within ±5%
 *   3. Normalized title matches (strip color/size/quantity words)
 *
 * Original product data is preserved — dedup only adds metadata fields.
 * Competition metrics should use deduped (is_variant=false) products only.
 */

import type { DeduplicatedProduct, MarketProduct } from "./types";

// ── Title normalization ─────────────────────────

// Colors commonly used as variant differentiators
const COLOR_PATTERN =
  /\b(black|white|red|blue|green|pink|grey|gray|gold|silver|brown|beige|navy|purple|orange|yellow|rose|cream|ivory|teal|coral|maroon|olive|turquoise|burgundy|lavender|mint|champagne|charcoal)\b/gi;

// Size/quantity/unit patterns
const UNIT_PATTERN =
  /\b(\d+\s*(ml|l|g|kg|cm|mm|m|inch|inches|ft|oz|pcs|packs?|pieces?|sets?|count|ct|lbs?))\b/gi;

// Size words
const SIZE_PATTERN =
  /\b(small|medium|large|xl|xxl|xs|s|m|l|mini|compact|big|slim|extra\s*large|king\s*size|queen\s*size|twin|single|double|full)\b/gi;

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(COLOR_PATTERN, "")
    .replace(UNIT_PATTERN, "")
    .replace(SIZE_PATTERN, "")
    .replace(/[()[\]{}"']/g, "")  // strip brackets/quotes
    .replace(/\s*[-–—,\/|]\s*/g, " ")  // normalize separators
    .replace(/\s+/g, " ")
    .trim();
}

// ── Deduplication ───────────────────────────────

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const arr = map.get(key);
    if (arr) arr.push(item);
    else map.set(key, [item]);
  }
  return map;
}

function isPriceSimilar(a: number, b: number): boolean {
  if (a <= 0 || b <= 0) return false;
  return Math.abs(a - b) / Math.min(a, b) < 0.05;
}

/**
 * Deduplicate variant products, preserving all original data.
 *
 * Returns a new array where each product has `is_variant` and `variant_group_id`.
 * The first product encountered in each variant group is the "leader" (is_variant=false).
 */
export function deduplicateVariants(
  products: MarketProduct[],
): DeduplicatedProduct[] {
  const brandGroups = groupBy(products, (p) =>
    (p.brand || "unknown").toLowerCase(),
  );

  const result: DeduplicatedProduct[] = [];

  for (const [brand, group] of brandGroups) {
    // Sort by position (original search ranking) so the best-ranked product leads
    group.sort((a, b) => a.position - b.position);

    const assigned = new Set<number>();

    for (let i = 0; i < group.length; i++) {
      if (assigned.has(i)) continue;

      const leader = group[i];
      const normalizedLeader = normalizeTitle(leader.title);
      const groupId = `${brand}_${leader.sku}`;

      result.push({ ...leader, is_variant: false, variant_group_id: groupId });

      for (let j = i + 1; j < group.length; j++) {
        if (assigned.has(j)) continue;

        const candidate = group[j];

        if (
          isPriceSimilar(leader.price_current, candidate.price_current) &&
          normalizeTitle(candidate.title) === normalizedLeader
        ) {
          assigned.add(j);
          result.push({
            ...candidate,
            is_variant: true,
            variant_group_id: groupId,
          });
        }
      }
    }
  }

  return result;
}

/**
 * Get only unique (non-variant) products from a deduped list.
 * Use this for competition metrics like HHI and seller count.
 */
export function getUniqueProducts(
  deduped: DeduplicatedProduct[],
): DeduplicatedProduct[] {
  return deduped.filter((p) => !p.is_variant);
}
