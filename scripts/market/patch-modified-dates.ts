/**
 * patch-modified-dates.ts
 *
 * Fetches modifiedTime from Noon's Zoho Desk API and patches existing
 * markdown articles with a `> Modified: <ISO8601>` header line.
 *
 * Usage: npx tsx scripts/market/patch-modified-dates.ts
 */

import * as fs from "fs";
import * as path from "path";

const PORTAL_ID =
  "edbsn0e29d0f52ed6629cfe53eab34575edb2d02261c45722538f694331b4d163392c";
const BASE_API = "https://support.noon.partners/portal/api";
const ARTICLES_DIR = path.resolve(__dirname, "../src/data/noon-docs/articles");

interface ApiArticle {
  permalink: string;
  modifiedTime: string;
  webUrl: string;
}

async function fetchAllArticles(): Promise<ApiArticle[]> {
  const articles: ApiArticle[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const url = `${BASE_API}/kbArticles?portalId=${PORTAL_ID}&limit=${limit}&from=${offset}&sortBy=modifiedTime`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`API error: ${res.status}`);
      break;
    }
    const json = await res.json();
    const batch = json.data || json;
    if (!Array.isArray(batch) || batch.length === 0) break;
    articles.push(...batch);
    offset += limit;
    if (batch.length < limit) break;
  }

  console.log(`Fetched ${articles.length} articles from Noon API`);
  return articles;
}

function buildPermalinkMap(
  articles: ApiArticle[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const a of articles) {
    if (a.permalink && a.modifiedTime) {
      map.set(a.permalink, a.modifiedTime);
    }
  }
  return map;
}

function extractPermalink(content: string): string | null {
  const match = content.match(
    />\s*Source:\s*https?:\/\/[^/]+\/portal\/\w+\/kb\/articles\/([^\s]+)/m
  );
  return match ? match[1] : null;
}

function patchFile(filePath: string, modifiedTime: string): boolean {
  const content = fs.readFileSync(filePath, "utf-8");

  // Already has Modified line — update it
  if (/^>\s*Modified:/m.test(content)) {
    const updated = content.replace(
      /^>\s*Modified:.*$/m,
      `> Modified: ${modifiedTime}`
    );
    if (updated !== content) {
      fs.writeFileSync(filePath, updated, "utf-8");
      return true;
    }
    return false;
  }

  // Insert after `> Category:` line
  const updated = content.replace(
    /^(>\s*Category:.*\n)/m,
    `$1> Modified: ${modifiedTime}\n`
  );
  if (updated !== content) {
    fs.writeFileSync(filePath, updated, "utf-8");
    return true;
  }

  return false;
}

async function main() {
  if (!fs.existsSync(ARTICLES_DIR)) {
    console.error("Articles directory not found. Run fetch-docs first.");
    process.exit(1);
  }

  const apiArticles = await fetchAllArticles();
  const permalinkMap = buildPermalinkMap(apiArticles);

  let patched = 0;
  let skipped = 0;
  let noMatch = 0;

  // Walk all .md files
  const dirs = fs.readdirSync(ARTICLES_DIR).filter((d) =>
    fs.statSync(path.join(ARTICLES_DIR, d)).isDirectory()
  );

  for (const dir of dirs) {
    const dirPath = path.join(ARTICLES_DIR, dir);
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const permalink = extractPermalink(content);

      if (!permalink) {
        skipped++;
        continue;
      }

      const modifiedTime = permalinkMap.get(permalink);
      if (!modifiedTime) {
        noMatch++;
        continue;
      }

      if (patchFile(filePath, modifiedTime)) {
        patched++;
      } else {
        skipped++;
      }
    }
  }

  console.log(`\nResults:`);
  console.log(`  Patched: ${patched}`);
  console.log(`  Skipped (already up-to-date): ${skipped}`);
  console.log(`  No API match: ${noMatch}`);
}

main().catch(console.error);
