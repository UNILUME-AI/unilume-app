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
  excerpts_zh?: string[];
  summary?: string;
}

interface ArticleChange {
  permalink: string;
  title: string;
  category: string;
  old_title?: string;
}

interface ChangeReport {
  added: ArticleChange[];
  removed: ArticleChange[];
  modified: ArticleChange[];
  renamed?: ArticleChange[];
  content_diffs?: Record<string, ContentDiff>;
  overview?: string;
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

  const needsOverview = !report.overview &&
    (report.modified.length > 0 || (report.added ?? []).length > 0 ||
     (report.removed ?? []).length > 0 || (report.renamed ?? []).length > 0);

  const needsTranslation = report.modified.some((a) => {
    const d = diffs[a.permalink];
    return d && d.excerpts.length > 0 && !d.excerpts_zh;
  });

  if (toSummarize.length === 0 && !needsOverview && !needsTranslation) {
    console.log("Nothing to enrich.");
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

  if (toSummarize.length > 0) {
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

  } // end if toSummarize

  // Generate Chinese translations of excerpts
  const toTranslate = report.modified.filter((a) => {
    const d = diffs[a.permalink];
    return d && d.excerpts.length > 0 && !d.excerpts_zh;
  });

  if (toTranslate.length > 0) {
    console.log(`Translating excerpts for ${toTranslate.length} articles...`);

    // Collect all excerpt lines with article index markers
    const allLines: string[] = [];
    const lineMap: { articleIdx: number; lineIdx: number }[] = [];
    for (let ai = 0; ai < toTranslate.length; ai++) {
      const d = diffs[toTranslate[ai].permalink];
      for (let li = 0; li < d.excerpts.length; li++) {
        allLines.push(d.excerpts[li]);
        lineMap.push({ articleIdx: ai, lineIdx: li });
      }
    }

    const numbered = allLines.map((l, i) => `[${i + 1}] ${l}`).join("\n");
    const translateResult = await generateText({
      model: vertex("gemini-2.5-flash"),
      prompt: `将以下变更行翻译为中文。保留行首的 + 或 - 符号和序号格式。
每行格式：[序号] + 或 - 中文翻译内容
不要添加其他解释。

${numbered}`,
    });

    // Parse translations and assign back
    const initArrays: Record<number, string[]> = {};
    for (let ai = 0; ai < toTranslate.length; ai++) {
      initArrays[ai] = new Array(diffs[toTranslate[ai].permalink].excerpts.length).fill("");
    }

    for (const line of translateResult.text.trim().split("\n")) {
      const match = line.match(/^\[(\d+)\]\s*(.+)/);
      if (!match) continue;
      const idx = parseInt(match[1]) - 1;
      if (idx < 0 || idx >= lineMap.length) continue;
      const { articleIdx, lineIdx } = lineMap[idx];
      initArrays[articleIdx][lineIdx] = match[2].trim();
    }

    for (let ai = 0; ai < toTranslate.length; ai++) {
      const permalink = toTranslate[ai].permalink;
      // Only set if we got valid translations
      if (initArrays[ai].some((t) => t.length > 0)) {
        diffs[permalink].excerpts_zh = initArrays[ai];
        console.log(`  ${toTranslate[ai].title}: ${initArrays[ai].length} lines translated`);
      }
    }
  }

  report.content_diffs = diffs;

  // Generate overall overview
  if (!report.overview) {
    console.log("Generating overall overview...");

    const renamed = (report.renamed ?? []) as ArticleChange[];
    const added = report.added ?? [];
    const removed = report.removed ?? [];
    const metadataOnly = report.modified.filter((a) => {
      const d = diffs[a.permalink];
      return d && d.excerpts.length === 0;
    });
    const contentModified = report.modified.filter((a) => {
      const d = diffs[a.permalink];
      return !d || d.excerpts.length > 0;
    });

    // Build context for overview
    const parts: string[] = [];
    if (renamed.length > 0)
      parts.push(`重命名 ${renamed.length} 篇: ${renamed.map((a) => `${a.old_title} → ${a.title}`).join("、")}`);
    if (added.length > 0)
      parts.push(`新增 ${added.length} 篇: ${added.map((a) => a.title).join("、")}`);
    if (contentModified.length > 0) {
      const summaryLines = contentModified
        .map((a) => `${a.title}: ${diffs[a.permalink]?.summary ?? "内容更新"}`)
        .join("\n");
      parts.push(`内容修改 ${contentModified.length} 篇:\n${summaryLines}`);
    }
    if (removed.length > 0)
      parts.push(`删除 ${removed.length} 篇: ${removed.map((a) => a.title).join("、")}`);
    if (metadataOnly.length > 0)
      parts.push(`仅元数据更新 ${metadataOnly.length} 篇`);

    const overviewResult = await generateText({
      model: vertex("gemini-2.5-flash"),
      prompt: `你是 Noon 电商平台的政策分析助手。以下是今日帮助中心的变更汇总：

${parts.join("\n\n")}

请生成一段变更概览，格式如下（严格遵守）：
第一行：一句话总结本次变更的整体情况（20-40字）
之后每行以"- "开头，分点列出关键变更（3-5条，每条15-25字）

只输出概览内容，不要添加标题或其他格式。`,
    });

    report.overview = overviewResult.text.trim();
    console.log("Overview:\n" + report.overview);
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log("Done. Enriched report saved.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
