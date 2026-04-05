/**
 * store-change-report.ts
 *
 * Reads enriched change_report.json for each platform and upserts
 * into the change_reports table for historical browsing.
 *
 * Usage: npx tsx scripts/market/store-change-report.ts
 */

import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const PLATFORMS = [
  { name: "noon", docsDir: "noon-docs" },
  { name: "noon-ads", docsDir: "noon-ads-docs" },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set, skipping store.");
    return;
  }

  const sql = neon(process.env.DATABASE_URL!);

  for (const platform of PLATFORMS) {
    const reportPath = path.resolve(
      __dirname,
      `../src/data/${platform.docsDir}/_metadata/change_report.json`
    );

    if (!fs.existsSync(reportPath)) {
      console.log(`No change_report.json for ${platform.name}, skipping.`);
      continue;
    }

    const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));

    const newTs = report.new_timestamp ?? "";
    if (!newTs || newTs === "?" || newTs === "(first run)") {
      console.log(`No valid new_timestamp for ${platform.name}, skipping.`);
      continue;
    }

    const reportDate = newTs.slice(0, 10);
    const reportJson = JSON.stringify(report);

    // Check if DB already has a richer version (with change_analysis)
    const existing = await sql`
      SELECT report_data->'content_diffs' is not null
        AND jsonb_typeof(report_data->'content_diffs') = 'object'
        AND EXISTS (
          SELECT 1 FROM jsonb_each(report_data->'content_diffs') cd
          WHERE (cd.value->'change_analysis') is not null
        ) as has_analysis
      FROM change_reports
      WHERE report_date = ${reportDate} AND platform = ${platform.name}
    `;

    const dbHasAnalysis = existing.length > 0 && existing[0].has_analysis === true;
    const newHasAnalysis = report.content_diffs &&
      Object.values(report.content_diffs as Record<string, { change_analysis?: unknown }>)
        .some((d) => d.change_analysis);

    if (dbHasAnalysis && !newHasAnalysis) {
      console.log(`Skipping ${platform.name} ${reportDate} — DB has richer data`);
      continue;
    }

    await sql`
      INSERT INTO change_reports (report_date, platform, old_timestamp, new_timestamp, old_total, new_total, report_data)
      VALUES (
        ${reportDate},
        ${platform.name},
        ${report.old_timestamp ?? null},
        ${report.new_timestamp ?? null},
        ${report.old_total ?? 0},
        ${report.new_total ?? 0},
        ${reportJson}::jsonb
      )
      ON CONFLICT (report_date, platform)
      DO UPDATE SET
        report_data = ${reportJson}::jsonb,
        old_timestamp = ${report.old_timestamp ?? null},
        new_timestamp = ${report.new_timestamp ?? null},
        old_total = ${report.old_total ?? 0},
        new_total = ${report.new_total ?? 0}
    `;

    console.log(`Stored ${platform.name} report for ${reportDate}`);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
