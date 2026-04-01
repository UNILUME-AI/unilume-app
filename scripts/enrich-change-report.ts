/**
 * enrich-change-report.ts
 *
 * Reads change_report.json and generates one-line Chinese summaries
 * for each modified article using Vertex AI (gemini-2.5-flash).
 *
 * Usage: npx tsx scripts/enrich-change-report.ts
 * Requires: GOOGLE_VERTEX_PROJECT, GOOGLE_SERVICE_ACCOUNT_KEY env vars
 */

import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";
import { generateText } from "ai";
import { createVertex } from "@ai-sdk/google-vertex";

// Load .env.local
config({ path: path.resolve(__dirname, "../.env.local") });

const REPORT_PATH = path.resolve(
  __dirname,
  "../src/data/noon-docs/_metadata/change_report.json"
);

interface ContentDiff {
  added_lines: number;
  removed_lines: number;
  excerpts: string[];
  summary?: string;
}

interface ChangeReport {
  modified: { permalink: string; title: string; category: string }[];
  content_diffs?: Record<string, ContentDiff>;
  [key: string]: unknown;
}

async function main() {
  if (!fs.existsSync(REPORT_PATH)) {
    console.log("No change_report.json found, skipping enrichment.");
    return;
  }

  const report: ChangeReport = JSON.parse(
    fs.readFileSync(REPORT_PATH, "utf-8")
  );
  const diffs = report.content_diffs ?? {};

  // Find modified articles that have excerpts but no summary yet
  const toSummarize = report.modified.filter((a) => {
    const d = diffs[a.permalink];
    return d && d.excerpts.length > 0 && !d.summary;
  });

  if (toSummarize.length === 0) {
    console.log("No articles need summarization.");
    return;
  }

  const projectId = process.env.GOOGLE_VERTEX_PROJECT;
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!projectId || !credentials) {
    console.log(
      "Missing GOOGLE_VERTEX_PROJECT or GOOGLE_SERVICE_ACCOUNT_KEY, skipping."
    );
    return;
  }

  // dotenv expands \n → real newlines. To JSON.parse the service account key,
  // re-escape newlines only inside JSON string values (e.g. private_key PEM).
  // Strategy: escape ALL newlines, then selectively unescape structural ones.
  let jsonStr = credentials.replace(/\n/g, "\\n");
  // Structural newlines are outside of quotes: after { , : and before }
  // Simplest reliable way: iteratively fix non-string newlines
  jsonStr = jsonStr
    .replace(/\\n\s*"/g, ' "')          // \n before a key quote
    .replace(/,\\n\s*/g, ", ")          // ,\n between properties
    .replace(/\{\\n\s*/g, "{ ")         // {\n opening
    .replace(/\\n\s*\}/g, " }")         // \n} closing
    .replace(/"\\n\s*\}/g, '" }');      // "\n} end of last value

  const parsed = JSON.parse(jsonStr);

  const vertex = createVertex({
    project: projectId,
    location: process.env.GOOGLE_VERTEX_LOCATION ?? "us-east5",
    googleAuthOptions: {
      credentials: parsed,
    },
  });

  console.log(`Generating summaries for ${toSummarize.length} articles...`);

  // Batch all articles into a single LLM call for efficiency
  const articlesBlock = toSummarize
    .map((a, i) => {
      const d = diffs[a.permalink];
      return `[${i + 1}] ${a.title}\n${d.excerpts.join("\n")}`;
    })
    .join("\n\n");

  const { text } = await generateText({
    model: vertex("gemini-2.5-flash"),
    prompt: `你是 Noon 电商平台的政策分析助手。以下是若干篇帮助中心文章的内容变更摘录（+ 为新增行，- 为删除行）。

请为每篇文章生成一句简短的中文变更总结（15-30字），说明改了什么。
格式：每行一条，以 [序号] 开头，与输入对应。不要添加其他内容。

${articlesBlock}`,
  });

  // Parse summaries
  const lines = text.trim().split("\n");
  for (const line of lines) {
    const match = line.match(/^\[(\d+)\]\s*(.+)/);
    if (!match) continue;
    const idx = parseInt(match[1]) - 1;
    if (idx < 0 || idx >= toSummarize.length) continue;
    const permalink = toSummarize[idx].permalink;
    if (diffs[permalink]) {
      diffs[permalink].summary = match[2].trim();
      console.log(`  ${toSummarize[idx].title}: ${diffs[permalink].summary}`);
    }
  }

  report.content_diffs = diffs;
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log("Done. Enriched report saved.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
