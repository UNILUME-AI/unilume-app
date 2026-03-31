import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  // Search snapshots — one row per keyword per crawl
  await sql`
    CREATE TABLE IF NOT EXISTS market_snapshots (
      id SERIAL PRIMARY KEY,
      platform TEXT NOT NULL,
      keyword TEXT NOT NULL,
      locale TEXT NOT NULL DEFAULT 'en-AE',
      market TEXT NOT NULL DEFAULT 'UAE',
      timestamp TIMESTAMPTZ NOT NULL,
      total_results INTEGER DEFAULT 0,
      product_count INTEGER DEFAULT 0,
      sponsored_count INTEGER DEFAULT 0,
      fulfilled_count INTEGER DEFAULT 0,
      avg_rating REAL DEFAULT 0,
      avg_review_count REAL DEFAULT 0,
      price_min REAL,
      price_p25 REAL,
      price_median REAL,
      price_p75 REAL,
      price_max REAL,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(platform, keyword, timestamp)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_market_snapshots_lookup
    ON market_snapshots(platform, keyword, timestamp)
  `;

  console.log("✅ market_snapshots table created");

  // Products — one row per product per snapshot
  await sql`
    CREATE TABLE IF NOT EXISTS market_products (
      id SERIAL PRIMARY KEY,
      snapshot_id INTEGER NOT NULL REFERENCES market_snapshots(id),
      sku TEXT NOT NULL,
      title TEXT,
      brand TEXT DEFAULT '',
      price_current REAL,
      price_original REAL,
      discount_pct REAL,
      rating REAL,
      review_count INTEGER DEFAULT 0,
      seller_name TEXT DEFAULT '',
      is_sponsored BOOLEAN DEFAULT false,
      is_fulfilled BOOLEAN DEFAULT false,
      position INTEGER DEFAULT 0,
      image_url TEXT DEFAULT '',
      category_code TEXT DEFAULT '',
      raw_json TEXT
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_market_products_snapshot
    ON market_products(snapshot_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_market_products_sku
    ON market_products(sku)
  `;

  console.log("✅ market_products table created");

  // SKU index — deduplicated, latest state per SKU
  await sql`
    CREATE TABLE IF NOT EXISTS market_sku_index (
      sku TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      title TEXT,
      brand TEXT DEFAULT '',
      seller_name TEXT DEFAULT '',
      category_code TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      first_seen TIMESTAMPTZ NOT NULL,
      last_seen TIMESTAMPTZ NOT NULL,
      last_price REAL,
      last_rating REAL,
      last_review_count INTEGER DEFAULT 0,
      observation_count INTEGER DEFAULT 1
    )
  `;

  console.log("✅ market_sku_index table created");
  console.log("\nAll market tables ready.");
}

main().catch(console.error);
