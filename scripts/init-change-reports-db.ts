/**
 * init-change-reports-db.ts
 *
 * Creates the change_reports table for storing daily policy change reports.
 *
 * Usage: npx tsx scripts/init-change-reports-db.ts
 */

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  await sql`
    CREATE TABLE IF NOT EXISTS change_reports (
      id SERIAL PRIMARY KEY,
      report_date DATE NOT NULL,
      platform TEXT NOT NULL DEFAULT 'noon',
      old_timestamp TIMESTAMPTZ,
      new_timestamp TIMESTAMPTZ,
      old_total INTEGER DEFAULT 0,
      new_total INTEGER DEFAULT 0,
      report_data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(report_date, platform)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_change_reports_date
    ON change_reports(report_date DESC)
  `;

  console.log("change_reports table created");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
