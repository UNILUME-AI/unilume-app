/**
 * Category data queries from Neon PostgreSQL.
 *
 * Reads from 5 tables populated by unilume-market-crawler GitHub Actions:
 *   - consumer_categories  (C 端类目当前态, 主键 id_category)
 *   - seller_categories    (B 端类目, Phase 2 才填充)
 *   - category_aliases     (改名/合并 old_code → new_code)
 *   - category_mappings    (C↔B 映射, Phase 2 才填充)
 *   - category_changes     (变更事件日志, 历史解读用)
 *
 * 详细设计见 unilume-docs/architecture/crawler/09-category-data-lifecycle.md
 */

import { getDb } from "./db";

// ── Types ────────────────────────────────────────

export interface ConsumerCategory {
  id_category: number; // Noon 全平台稳定主键
  code: string; // slug 路径, 改名时更新
  name: string;
  parent_code: string | null;
  depth: number | null;
  is_active: boolean;
  is_leaf: boolean;
  seen_in_locales: string[]; // ['ae', 'sa']
  first_seen: string; // ISO date
  last_seen: string;
  liveness: "alive" | "dead" | "unknown";
}

export interface SellerCategory {
  pk: number; // Noon Seller Center 主键, 上架直接用
  code: string;
  name_en: string;
  level: "family" | "type" | "fulltype";
  parent_pk: number | null;
  is_active: boolean;
}

export type ResolveStatus = "active" | "renamed" | "removed" | "not_found";

export interface CategoryResolveResult {
  status: ResolveStatus;
  side: "consumer" | "seller";
  input_code: string;
  canonical_code: string | null; // null 当 not_found
  id?: number; // id_category (consumer) 或 pk (seller), 命中时返回
  name?: string; // 命中时返回
  as_of: string; // ISO timestamp (当前查询时刻)
}

export interface CategoryMappingResult {
  status: "ok" | "no_confirmed_mapping";
  consumer_code: string;
  seller_pk?: number;
  seller_code?: string;
  tier?: "high" | "medium";
  confidence?: number;
  mapped_at?: string;
}

// ── Helpers ─────────────────────────────────────

/** Strip dangerous LIKE wildcards from user input so we can wrap our own. */
function escapeLikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/[%_]/g, "\\$&");
}

// ── Consumer category queries ───────────────────

/**
 * Search active C 端 categories by code/name LIKE match.
 *
 * Used by:
 *   - GET /api/categories/consumer (frontend / debug)
 *   - AI tool category_lookup (Selection Agent)
 */
export async function searchConsumerCategories(
  query: string,
  opts: {
    parent?: string;
    active?: boolean;
    limit?: number;
  } = {},
): Promise<ConsumerCategory[]> {
  const sql = getDb();
  const limit = Math.min(opts.limit ?? 20, 100);
  const activeOnly = opts.active ?? true;
  const like = `%${escapeLikePattern(query.toLowerCase().trim())}%`;

  // 用 sql\`...\` 模板自动参数化, 防 SQL 注入
  const rows = await sql`
    SELECT id_category, code, name, parent_code, depth, is_active, is_leaf,
           seen_in_locales, first_seen, last_seen, liveness
    FROM consumer_categories
    WHERE (LOWER(code) LIKE ${like} OR LOWER(name) LIKE ${like})
      AND (${activeOnly}::boolean = FALSE OR is_active = TRUE)
      AND (${opts.parent ?? null}::text IS NULL OR parent_code = ${opts.parent ?? null})
    ORDER BY
      -- name 完全相等优先, 然后 code 完全相等, 然后字母序
      (LOWER(name) = ${query.toLowerCase().trim()}) DESC,
      (LOWER(code) = ${query.toLowerCase().trim()}) DESC,
      depth ASC,
      code ASC
    LIMIT ${limit}
  `;

  return rows.map(rowToConsumerCategory);
}

/** Look up a single C 端 category by exact code (active OR inactive). */
export async function getConsumerCategoryByCode(
  code: string,
): Promise<ConsumerCategory | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT id_category, code, name, parent_code, depth, is_active, is_leaf,
           seen_in_locales, first_seen, last_seen, liveness
    FROM consumer_categories
    WHERE code = ${code}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return rowToConsumerCategory(rows[0]);
}

// ── Seller category queries (Phase 2) ────────────

/**
 * Search B 端 categories. Phase 1 returns [] (table 存在但 0 行,
 * 等 Phase 2 用 partners-catalogmd-v2/get-taxonomy API 填充).
 */
export async function searchSellerCategories(
  query: string,
  opts: { level?: string; limit?: number } = {},
): Promise<SellerCategory[]> {
  const sql = getDb();
  const limit = Math.min(opts.limit ?? 20, 100);
  const like = `%${escapeLikePattern(query.toLowerCase().trim())}%`;

  const rows = await sql`
    SELECT pk, code, name_en, level, parent_pk, is_active
    FROM seller_categories
    WHERE (LOWER(code) LIKE ${like} OR LOWER(name_en) LIKE ${like})
      AND is_active = TRUE
      AND (${opts.level ?? null}::text IS NULL OR level = ${opts.level ?? null})
    ORDER BY level, code
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    pk: Number(r.pk),
    code: r.code,
    name_en: r.name_en,
    level: r.level,
    parent_pk: r.parent_pk == null ? null : Number(r.parent_pk),
    is_active: r.is_active,
  }));
}

// ── Resolve (handles renames + soft-deletes) ────

/**
 * Resolve a possibly-stale category code to its current canonical form.
 *
 * 三种情况:
 *   1. 命中 active 行 → status='active'
 *   2. 命中 inactive 行 → status='removed'
 *   3. 不命中 → 查 category_aliases (old_code), 找到 new_code 再查当前表
 *      → status='renamed' + canonical_code = new_code
 *   4. 都查不到 → status='not_found', canonical_code=null
 */
export async function resolveCategoryCode(
  side: "consumer" | "seller",
  code: string,
): Promise<CategoryResolveResult> {
  const sql = getDb();
  const now = new Date().toISOString();

  if (side === "consumer") {
    // 1. 直接查 consumer_categories
    const direct = await sql`
      SELECT id_category, code, name, is_active
      FROM consumer_categories
      WHERE code = ${code}
      LIMIT 1
    `;
    if (direct.length > 0) {
      const r = direct[0];
      return {
        status: r.is_active ? "active" : "removed",
        side: "consumer",
        input_code: code,
        canonical_code: r.code,
        id: Number(r.id_category),
        name: r.name,
        as_of: now,
      };
    }

    // 2. 查 category_aliases
    const alias = await sql`
      SELECT new_code FROM category_aliases
      WHERE side = 'consumer' AND old_code = ${code}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (alias.length > 0) {
      const newCode = alias[0].new_code;
      // 顺着 new_code 再查当前表
      const newRow = await sql`
        SELECT id_category, code, name, is_active
        FROM consumer_categories
        WHERE code = ${newCode}
        LIMIT 1
      `;
      if (newRow.length > 0 && newRow[0].is_active) {
        return {
          status: "renamed",
          side: "consumer",
          input_code: code,
          canonical_code: newRow[0].code,
          id: Number(newRow[0].id_category),
          name: newRow[0].name,
          as_of: now,
        };
      }
    }

    // 3. 都查不到
    return {
      status: "not_found",
      side: "consumer",
      input_code: code,
      canonical_code: null,
      as_of: now,
    };
  } else {
    // seller side - 同样模式 (Phase 2 seller_categories 才有数据, 但 alias 接口已就绪)
    const direct = await sql`
      SELECT pk, code, name_en, is_active
      FROM seller_categories
      WHERE code = ${code}
      LIMIT 1
    `;
    if (direct.length > 0) {
      const r = direct[0];
      return {
        status: r.is_active ? "active" : "removed",
        side: "seller",
        input_code: code,
        canonical_code: r.code,
        id: Number(r.pk),
        name: r.name_en,
        as_of: now,
      };
    }

    const alias = await sql`
      SELECT new_code FROM category_aliases
      WHERE side = 'seller' AND old_code = ${code}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (alias.length > 0) {
      const newCode = alias[0].new_code;
      const newRow = await sql`
        SELECT pk, code, name_en, is_active
        FROM seller_categories
        WHERE code = ${newCode}
        LIMIT 1
      `;
      if (newRow.length > 0 && newRow[0].is_active) {
        return {
          status: "renamed",
          side: "seller",
          input_code: code,
          canonical_code: newRow[0].code,
          id: Number(newRow[0].pk),
          name: newRow[0].name_en,
          as_of: now,
        };
      }
    }

    return {
      status: "not_found",
      side: "seller",
      input_code: code,
      canonical_code: null,
      as_of: now,
    };
  }
}

// ── Mapping (Phase 1: 永远返回 no_confirmed_mapping) ──

/**
 * Get C → B mapping for a consumer category.
 *
 * Phase 1: category_mappings 表 0 行 (Phase 2 才填充).
 *   永远返回 {status: 'no_confirmed_mapping'} — 这是合约的一部分,
 *   AI tool 看到该 status 知道走 concierge 兜底, 不臆造 seller code.
 *
 * Phase 2: 会基于 consumer_code 查 mapping (含 tier), 命中返回 status='ok'.
 */
export async function getCategoryMapping(
  consumerCode: string,
): Promise<CategoryMappingResult> {
  const sql = getDb();

  // 先把 consumer_code resolve 成 id_category (handles renames)
  const consumer = await sql`
    SELECT id_category FROM consumer_categories WHERE code = ${consumerCode} AND is_active = TRUE
    LIMIT 1
  `;
  if (consumer.length === 0) {
    // 试查 alias
    const alias = await sql`
      SELECT new_code FROM category_aliases
      WHERE side = 'consumer' AND old_code = ${consumerCode}
      ORDER BY created_at DESC LIMIT 1
    `;
    if (alias.length === 0) {
      return { status: "no_confirmed_mapping", consumer_code: consumerCode };
    }
    // 用 new_code 重试
    return getCategoryMapping(alias[0].new_code);
  }

  const idCat = Number(consumer[0].id_category);
  const mapping = await sql`
    SELECT seller_pk, seller_code, tier, confidence, mapped_at
    FROM category_mappings
    WHERE consumer_id_category = ${idCat}
    LIMIT 1
  `;
  if (mapping.length === 0) {
    return { status: "no_confirmed_mapping", consumer_code: consumerCode };
  }

  const m = mapping[0];
  return {
    status: "ok",
    consumer_code: consumerCode,
    seller_pk: Number(m.seller_pk),
    seller_code: m.seller_code,
    tier: m.tier as "high" | "medium",
    confidence: Number(m.confidence),
    mapped_at:
      typeof m.mapped_at === "string"
        ? m.mapped_at
        : (m.mapped_at as Date).toISOString(),
  };
}

// ── Row mappers ─────────────────────────────────

interface DbRow {
  id_category: number | string;
  code: string;
  name: string;
  parent_code: string | null;
  depth: number | string | null;
  is_active: boolean;
  is_leaf: boolean;
  seen_in_locales: string[] | null;
  first_seen: string | Date;
  last_seen: string | Date;
  liveness: string;
}

function rowToConsumerCategory(r: DbRow | Record<string, unknown>): ConsumerCategory {
  const row = r as DbRow;
  return {
    id_category: Number(row.id_category),
    code: row.code,
    name: row.name,
    parent_code: row.parent_code,
    depth: row.depth == null ? null : Number(row.depth),
    is_active: Boolean(row.is_active),
    is_leaf: Boolean(row.is_leaf),
    seen_in_locales: row.seen_in_locales ?? [],
    first_seen:
      typeof row.first_seen === "string"
        ? row.first_seen
        : row.first_seen.toISOString(),
    last_seen:
      typeof row.last_seen === "string"
        ? row.last_seen
        : row.last_seen.toISOString(),
    liveness: (row.liveness as "alive" | "dead" | "unknown") ?? "unknown",
  };
}
