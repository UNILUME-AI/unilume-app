/**
 * enrich-change-report.ts
 *
 * Reads change_report.json and generates one-line Chinese summaries
 * for each modified article using Vertex AI (gemini-2.5-flash).
 *
 * Usage: npx tsx scripts/market/enrich-change-report.ts
 * Requires: GOOGLE_VERTEX_PROJECT, GOOGLE_SERVICE_ACCOUNT_KEY env vars
 */

import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";
import { generateText } from "ai";
import { createVertex } from "@ai-sdk/google-vertex";

// Load .env.local
config({ path: path.resolve(__dirname, "../.env.local") });

const PLATFORMS = [
  { name: "noon", docsDir: "noon-docs" },
  { name: "noon-ads", docsDir: "noon-ads-docs" },
];

function reportPath(docsDir: string) {
  return path.resolve(__dirname, `../src/data/${docsDir}/_metadata/change_report.json`);
}

interface ContentDiff {
  added_lines: number;
  removed_lines: number;
  excerpts: string[];
  excerpts_zh?: string[];
  summary?: string;
  /** Structured change analysis for sellers */
  change_analysis?: {
    what: string;       // 变更内容：具体改了什么
    before_after?: string; // 操作变化：旧 → 新（如适用）
    impact: string;     // 卖家影响：对卖家意味着什么
  };
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

async function enrichPlatform(platformName: string, REPORT_PATH: string, articlesDir: string, vertex: ReturnType<typeof createVertex>) {
  if (!fs.existsSync(REPORT_PATH)) {
    console.log(`No change_report.json for ${platformName}, skipping.`);
    return;
  }

  console.log(`\n=== Enriching ${platformName} ===`);
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

  const needsAnalysisCheck = report.modified.some((a) => {
    const d = diffs[a.permalink];
    return d && d.excerpts.length > 0 && !d.change_analysis;
  });

  if (toSummarize.length === 0 && !needsOverview && !needsTranslation && !needsAnalysisCheck) {
    console.log(`Nothing to enrich for ${platformName}.`);
    return;
  }

  // Also find articles needing structured analysis
  const needsAnalysis = report.modified.filter((a) => {
    const d = diffs[a.permalink];
    return d && d.excerpts.length > 0 && !d.change_analysis;
  });

  if (needsAnalysis.length > 0) {
    console.log(`Generating structured analysis for ${needsAnalysis.length} articles...`);

    // Read full article content for each
    // articlesDir passed as parameter

    for (const article of needsAnalysis) {
      const d = diffs[article.permalink];
      const filename = article.permalink.replace(/-/g, "_").slice(0, 60) + ".md";

      // Find article file recursively
      let articleContent = "";
      const findFile = (dir: string): string | null => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            const result = findFile(path.join(dir, entry.name));
            if (result) return result;
          } else if (entry.name === filename) {
            return path.join(dir, entry.name);
          }
        }
        return null;
      };
      const filePath = findFile(articlesDir);
      if (filePath) {
        articleContent = fs.readFileSync(filePath, "utf-8");
        // Truncate to first 2000 chars to save tokens
        if (articleContent.length > 2000) {
          articleContent = articleContent.slice(0, 2000) + "\n...(truncated)";
        }
      }

      const { text } = await generateText({
        model: vertex("gemini-2.5-flash"),
        prompt: `你是 Noon 电商平台的政策分析助手，需要向卖家解释帮助中心文章的变更。

## 文章标题
${article.title}

## 当前文章内容（节选）
${articleContent || "(无法获取)"}

## 本次变更的 diff（+ 为新增行，- 为删除行）
${d.excerpts.join("\n")}

请用中文生成结构化的变更分析，严格按以下 JSON 格式输出（不要添加 markdown 代码块标记）：
{
  "what": "一句话说明具体改了什么（20-40字，要具体，不要笼统）",
  "before_after": "旧：...\\n新：...（描述操作流程或内容的前后变化，如果变更不涉及流程变化则设为 null）",
  "impact": "对卖家的具体影响和建议操作（20-40字）"
}

注意：
- what 要具体到改了哪个按钮、哪个路径、哪个规则，不要说"更新了流程"这种空话
- before_after 用"旧：…新：…"格式，让卖家一眼看出区别
- impact 要说对哪类卖家有影响、需要做什么`,
      });

      try {
        // Strip markdown code block wrappers if present
        let jsonText = text.trim();
        jsonText = jsonText.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
        const analysis = JSON.parse(jsonText);
        d.change_analysis = {
          what: analysis.what,
          before_after: analysis.before_after || undefined,
          impact: analysis.impact,
        };
        d.summary = analysis.what;
        console.log(`  ${article.title}: ${analysis.what}`);
      } catch {
        console.error(`  ${article.title}: Failed to parse analysis JSON`);
        console.error(`  Raw output: ${text.slice(0, 200)}`);
      }
    }
  }

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
  console.log(`Done. Enriched report saved for ${platformName}.`);
}

async function main() {
  const projectId = process.env.GOOGLE_VERTEX_PROJECT;
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!projectId || !credentials) {
    console.log("Missing GOOGLE_VERTEX_PROJECT or GOOGLE_SERVICE_ACCOUNT_KEY, skipping.");
    return;
  }

  let jsonStr = credentials.replace(/\n/g, "\\n");
  jsonStr = jsonStr
    .replace(/\\n\s*"/g, ' "')
    .replace(/,\\n\s*/g, ", ")
    .replace(/\{\\n\s*/g, "{ ")
    .replace(/\\n\s*\}/g, " }")
    .replace(/"\\n\s*\}/g, '" }');
  const parsed = JSON.parse(jsonStr);

  const vertex = createVertex({
    project: projectId,
    location: process.env.GOOGLE_VERTEX_LOCATION ?? "us-east5",
    googleAuthOptions: { credentials: parsed },
  });

  for (const platform of PLATFORMS) {
    const rPath = reportPath(platform.docsDir);
    const aDir = path.resolve(__dirname, `../src/data/${platform.docsDir}/articles`);
    await enrichPlatform(platform.name, rPath, aDir, vertex);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
