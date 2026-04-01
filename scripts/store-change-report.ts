/**
 * store-change-report.ts
 *
 * Reads the enriched change_report.json and upserts it into the
 * change_reports table for historical browsing.
 *
 * Usage: npx tsx scripts/store-change-report.ts
 */

import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const REPORT_PATH = path.resolve(
  __dirname,
  "../src/data/noon-docs/_metadata/change_report.json"
);

async function main() {
  if (!fs.existsSync(REPORT_PATH)) {
    console.log("No change_report.json found, skipping store.");
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set, skipping store.");
    return;
  }

  const report = JSON.parse(fs.readFileSync(REPORT_PATH, "utf-8"));

  // Extract date from new_timestamp
  const newTs = report.new_timestamp ?? "";
  if (!newTs || newTs === "?" || newTs === "(first run)") {
    console.log("No valid new_timestamp, skipping store.");
    return;
  }

  const reportDate = newTs.slice(0, 10); // YYYY-MM-DD
  const sql = neon(process.env.DATABASE_URL!);

  await sql`
    INSERT INTO change_reports (report_date, platform, old_timestamp, new_timestamp, old_total, new_total, report_data)
    VALUES (
      ${reportDate},
      'noon',
      ${report.old_timestamp ?? null},
      ${report.new_timestamp ?? null},
      ${report.old_total ?? 0},
      ${report.new_total ?? 0},
      ${JSON.stringify(report)}::jsonb
    )
    ON CONFLICT (report_date)
    DO UPDATE SET
      report_data = ${JSON.stringify(report)}::jsonb,
      old_timestamp = ${report.old_timestamp ?? null},
      new_timestamp = ${report.new_timestamp ?? null},
      old_total = ${report.old_total ?? 0},
      new_total = ${report.new_total ?? 0}
  `;

  console.log(`Stored report for ${reportDate}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
