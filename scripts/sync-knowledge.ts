/**
 * sync-knowledge.ts
 *
 * Unified script that downloads docs from GitHub, parses articles,
 * generates embeddings via Google Vertex AI, and upserts everything
 * into Neon PostgreSQL.
 *
 * Replaces: fetch-docs.ts, build-index.ts, build-embeddings.ts
 *
 * Env vars:
 *   DATABASE_URL              (required)
 *   GITHUB_TOKEN              (required)
 *   DOCS_BRANCH               (optional, default "main")
 *   GOOGLE_VERTEX_PROJECT     (required unless --skip-embeddings)
 *   GOOGLE_SERVICE_ACCOUNT_KEY(required unless --skip-embeddings)
 *   GOOGLE_VERTEX_LOCATION    (optional, default "us-east5")
 *
 * Usage:
 *   npx tsx scripts/sync-knowledge.ts
 *   npx tsx scripts/sync-knowledge.ts --skip-embeddings
 *   npx tsx scripts/sync-knowledge.ts --dry-run
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process"; // execSync on controlled paths only (same as fetch-docs.ts)
import { neon } from "@neondatabase/serverless";
import { GoogleAuth } from "google-auth-library";

// ─── Load .env.local ────────────────────────────────────────────────────────
// Use Node's built-in --env-file if available, otherwise parse manually.
// Manual parsing handles: comments, quotes stripping, \n → newline in quoted values.
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)/);
    if (!match) continue;
    const key = match[1].trim();
    let value = match[2].trim();
    if (process.env[key]) continue; // don't override existing env
    // Strip surrounding quotes and interpret escape sequences (like dotenv)
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
      if (value.includes("\\n")) {
        value = value.replace(/\\n/g, "\n");
      }
    }
    process.env[key] = value;
  }
}

// ─── CLI flags ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const SKIP_EMBEDDINGS = args.includes("--skip-embeddings");
const DRY_RUN = args.includes("--dry-run");

// ─── Config ──────────────────────────────────────────────────────────────────
const REPO_OWNER = "unilume-ai";
const BRANCH = process.env.DOCS_BRANCH || "main";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const EMBEDDING_MODEL = "text-embedding-005";
const BATCH_SIZE = 5;

const REPOS: { name: string; platform: string }[] = [
  { name: "unilume-noon-docs", platform: "noon" },
  { name: "unilume-noon-ads-docs", platform: "noon-ads" },
];

// ─── Category metadata (copied from build-index.ts) ─────────────────────────
const CATEGORY_META: Record<string, { description: string; keywords: string[] }> = {
  "Finance & Payments": {
    description:
      "Payment processing, invoices, statements, fees, settlements, VAT, ZATCA integration, bank details, payment cycles",
    keywords: [
      "payment", "invoice", "statement", "fee", "fees", "settlement",
      "vat", "zatca", "bank", "finance", "money", "pay", "billing",
      "charge", "cost", "price", "收款", "付款", "结算", "发票", "费用",
    ],
  },
  "Fulfilled by noon (FBN)": {
    description:
      "Fulfilled by Noon program: FBN storage, inbound shipments, outbound fees, inventory management, warehouse operations, FBN reports",
    keywords: [
      "fbn", "fulfilled by noon", "warehouse", "storage", "inbound",
      "outbound", "inventory", "stock", "仓储", "入库", "出库", "库存",
    ],
  },
  "Fulfilled by Partner (FBP)": {
    description:
      "Fulfilled by Partner / DirectShip program: order fulfillment, shipping, delivery, picklists, returns handling, DirectShip fees and policies",
    keywords: [
      "fbp", "fulfilled by partner", "directship", "direct ship",
      "shipping", "delivery", "ship", "fulfill", "fulfillment", "order",
      "picklist", "物流", "配送", "发货", "履约",
    ],
  },
  "Fulfilled By Partner Integration": {
    description:
      "FBP Integration (FBPI): API integration for third-party fulfillment systems, technical integration guides",
    keywords: [
      "fbpi", "integration", "api", "third party", "3pl", "接口", "集成", "对接",
    ],
  },
  "Program Policies": {
    description:
      "Noon seller policies: referral fees, commission rates, return policies, fraud prevention, disputes, penalties, compliance, restricted items, seller code of conduct",
    keywords: [
      "policy", "policies", "rule", "rules", "return", "returns", "refund",
      "commission", "referral fee", "penalty", "dispute", "fraud",
      "compliance", "restricted", "prohibited", "violation",
      "退货", "退款", "佣金", "政策", "规则", "处罚", "违规",
    ],
  },
  "Product Listing": {
    description:
      "Product listing and catalog management: SKU creation, product titles, images, barcodes, brand registration, content guidelines, bulk upload, catalog quality",
    keywords: [
      "listing", "list", "product", "sku", "catalog", "catalogue", "title",
      "image", "photo", "barcode", "brand", "content", "upload",
      "create product", "上架", "商品", "产品", "标题", "图片", "品牌",
    ],
  },
  "Onboarding & Registration": {
    description:
      "Seller onboarding: account registration, documents required, trade license, legal entity setup, seller profile, getting started on Noon",
    keywords: [
      "onboarding", "register", "registration", "sign up", "signup",
      "account", "document", "license", "legal entity", "start selling",
      "get started", "new seller", "注册", "开店", "入驻", "开户",
    ],
  },
  "Price & Inventory Management": {
    description:
      "Pricing strategies, stock management, price updates, inventory control, global min/max pricing",
    keywords: [
      "price", "pricing", "inventory", "stock", "manage stock",
      "update price", "定价", "价格", "库存管理",
    ],
  },
  Promotions: {
    description:
      "Promotional campaigns: flash deals, mega deals, price drops, promo codes, virtual bundles, store creation, Noon promotions",
    keywords: [
      "promotion", "promo", "deal", "deals", "flash", "discount",
      "coupon", "bundle", "campaign", "offer", "sale",
      "促销", "活动", "折扣", "优惠",
    ],
  },
  "Governance & Performance Management": {
    description:
      "Seller performance metrics, account health, performance standards, seller score, governance policies, account suspension",
    keywords: [
      "performance", "score", "rating", "governance", "health",
      "suspension", "account health", "seller score", "绩效", "评分", "考核",
    ],
  },
  "Global Selling": {
    description:
      "Cross-border selling: international selling guidelines, global warranty, GCC cross-border, export requirements",
    keywords: [
      "global", "cross border", "cross-border", "international", "export",
      "gcc", "跨境", "国际",
    ],
  },
  "Reports & Analytics": {
    description:
      "Seller reporting tools: analytics dashboard, product insights, sales reports, performance analytics",
    keywords: [
      "report", "reports", "analytics", "dashboard", "insight", "data",
      "报表", "数据", "分析",
    ],
  },
  "Inventory Removal": {
    description:
      "FBN inventory removal: RTV (Return to Vendor) process, shipment tracking, inventory disposal",
    keywords: [
      "removal", "remove", "rtv", "return to vendor", "dispose",
      "disposal", "移除", "退仓",
    ],
  },
  "Support & Training": {
    description:
      "Seller support resources: training materials, help center, support contacts, seller lab guides",
    keywords: [
      "support", "training", "help", "guide", "contact", "learn",
      "培训", "帮助", "支持",
    ],
  },
  Supermall: {
    description:
      "Supermall program: deal management, offers, Supermall-specific policies and requirements",
    keywords: ["supermall", "super mall"],
  },
  JUMP: {
    description:
      "JUMP program: Noon's seller acceleration program, growth tools",
    keywords: ["jump", "acceleration"],
  },
  "noon ads": {
    description:
      "Noon advertising platform: sponsored products, ad campaigns, marketing tools, advertising fees",
    keywords: [
      "ads", "ad", "advertising", "sponsor", "sponsored", "marketing",
      "广告", "推广",
    ],
  },
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface ParsedArticle {
  id: string;
  platform: string;
  title: string;
  filename: string;
  content: string;
  category_id: string;
  category_name: string;
  char_count: number;
  source_url: string | null;
  modified_time: string | null;
  embedding?: number[];
}

interface CategoryRecord {
  category_id: string;
  platform: string;
  category_name: string;
  description: string;
  keywords: string[];
}

// ─── Helpers (from fetch-docs.ts) ────────────────────────────────────────────

function copyDirRecursive(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function downloadRepo(repoName: string): Promise<string | null> {
  console.log(`\nFetching ${REPO_OWNER}/${repoName}@${BRANCH}...`);

  const tarballUrl = `https://api.github.com/repos/${REPO_OWNER}/${repoName}/tarball/${BRANCH}`;
  const tmpDir = path.resolve(__dirname, `../.tmp-${repoName}`);
  const tarPath = path.join(tmpDir, "repo.tar.gz");

  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  console.log("Downloading tarball...");
  const response = await fetch(tarballUrl, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    console.error(`GitHub API error for ${repoName}: ${response.status} ${response.statusText}`);
    const body = await response.text();
    console.error(body);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return null;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(tarPath, buffer);
  console.log(`Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB`);

  // NOTE: execSync on controlled paths only — tarPath and tmpDir are derived
  // from __dirname constants, not user input. Same pattern as fetch-docs.ts.
  console.log("Extracting...");
  execSync(`tar -xzf "${tarPath}" -C "${tmpDir}"`, { stdio: "inherit" });

  const extractedDirs = fs
    .readdirSync(tmpDir)
    .filter((d) => fs.statSync(path.join(tmpDir, d)).isDirectory());

  if (extractedDirs.length === 0) {
    console.error("No directory found after extraction");
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return null;
  }

  const extractedRoot = path.join(tmpDir, extractedDirs[0]);
  const outputDir = path.resolve(__dirname, `../.tmp-extracted-${repoName}`);

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const articlesSrc = path.join(extractedRoot, "articles");
  const metadataSrc = path.join(extractedRoot, "_metadata");

  if (fs.existsSync(articlesSrc)) {
    copyDirRecursive(articlesSrc, path.join(outputDir, "articles"));
    console.log("Copied articles/");
  } else {
    console.warn(`Warning: articles/ directory not found in ${repoName}`);
  }

  if (fs.existsSync(metadataSrc)) {
    copyDirRecursive(metadataSrc, path.join(outputDir, "_metadata"));
    console.log("Copied _metadata/");
  } else {
    console.warn(`Warning: _metadata/ directory not found in ${repoName}`);
  }

  // Clean up tarball temp dir
  fs.rmSync(tmpDir, { recursive: true, force: true });

  return outputDir;
}

// ─── Helpers (from build-index.ts) ───────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[&]/g, "and")
    .replace(/[()]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .trim();
}

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match) return match[1].trim();
  const lines = content.split("\n").filter((l) => l.trim());
  return lines[0]?.replace(/^#+\s*/, "").trim() || "Untitled";
}

function extractSourceUrl(content: string): string | null {
  const match = content.match(/>\s*Source:\s*(https?:\/\/[^\s]+)/m);
  return match ? match[1] : null;
}

function extractModifiedTime(content: string): string | null {
  const match = content.match(/>\s*Modified:\s*(\S+)/m);
  return match ? match[1] : null;
}

function parseArticles(outputDir: string, platform: string): {
  articles: ParsedArticle[];
  categories: CategoryRecord[];
} {
  const articlesDir = path.join(outputDir, "articles");
  if (!fs.existsSync(articlesDir)) {
    console.warn(`No articles/ directory in ${outputDir}`);
    return { articles: [], categories: [] };
  }

  // Load file-to-category mapping
  const categoriesJsonPath = path.join(outputDir, "_metadata/_file_categories.json");
  let fileCategories: Record<string, string> = {};
  if (fs.existsSync(categoriesJsonPath)) {
    fileCategories = JSON.parse(fs.readFileSync(categoriesJsonPath, "utf-8"));
  } else {
    console.warn(`Warning: _file_categories.json not found for ${platform}`);
  }

  const categoryDirs = fs
    .readdirSync(articlesDir)
    .filter((d) => fs.statSync(path.join(articlesDir, d)).isDirectory());

  const articles: ParsedArticle[] = [];
  const categoryMap: Record<string, CategoryRecord> = {};

  for (const dirName of categoryDirs) {
    const dirPath = path.join(articlesDir, dirName);
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const title = extractTitle(content);

      const mapped = fileCategories[file];
      const categoryName =
        mapped && mapped !== "Unknown"
          ? mapped
          : dirName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const categoryId = slugify(categoryName);

      const sourceUrl = extractSourceUrl(content);
      const modifiedTime = extractModifiedTime(content);
      const filenameStem = file.replace(/\.md$/, "");

      // Prefix ID with platform to avoid collisions between noon and noon-ads
      const articleId = `${platform}_${filenameStem}`;

      articles.push({
        id: articleId,
        platform,
        title,
        filename: `${dirName}/${file}`,
        content,
        category_id: categoryId,
        category_name: categoryName,
        char_count: content.length,
        source_url: sourceUrl,
        modified_time: modifiedTime,
      });

      if (!categoryMap[categoryId]) {
        const meta = CATEGORY_META[categoryName] || {
          description: categoryName,
          keywords: [categoryName.toLowerCase()],
        };
        categoryMap[categoryId] = {
          category_id: categoryId,
          platform,
          category_name: categoryName,
          description: meta.description,
          keywords: meta.keywords,
        };
      }
    }
  }

  return { articles, categories: Object.values(categoryMap) };
}

// ─── Embedding helpers (from build-embeddings.ts) ────────────────────────────

async function getAccessToken(): Promise<string> {
  // After .env.local parsing, the value has real newlines (from \n replacement).
  // private_key's PEM newlines are also real newlines now, which breaks JSON.parse.
  // Fix: re-escape newlines that are inside JSON string values.
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}";
  const fixed = raw.replace(/"-----BEGIN[\s\S]*?-----END PRIVATE KEY-----\\?\n?"/g, (match) =>
    match.replace(/\n/g, "\\n"),
  );
  const credentials = JSON.parse(fixed);
  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token!;
}

async function embedTexts(texts: string[], token: string): Promise<number[][]> {
  const project = process.env.GOOGLE_VERTEX_PROJECT;
  const location = process.env.GOOGLE_VERTEX_LOCATION ?? "us-east5";
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${EMBEDDING_MODEL}:predict`;

  const instances = texts.map((text) => ({
    content: text.slice(0, 10000),
    task_type: "RETRIEVAL_DOCUMENT",
  }));

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ instances }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Embedding API error ${resp.status}: ${body}`);
  }

  const data = await resp.json();
  return data.predictions.map(
    (p: { embeddings: { values: number[] } }) => p.embeddings.values,
  );
}

async function generateEmbeddings(articles: ParsedArticle[]): Promise<void> {
  if (!process.env.GOOGLE_VERTEX_PROJECT || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.error(
      "Error: GOOGLE_VERTEX_PROJECT and GOOGLE_SERVICE_ACCOUNT_KEY are required for embeddings.",
    );
    console.error("Set them in .env.local or pass --skip-embeddings.");
    process.exit(1);
  }

  console.log(`\nGenerating embeddings for ${articles.length} articles...`);
  const token = await getAccessToken();
  let processed = 0;

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const texts = batch.map((a) => `${a.title}\n\n${a.content}`.slice(0, 10000));

    try {
      const embeddings = await embedTexts(texts, token);
      for (let j = 0; j < batch.length; j++) {
        batch[j].embedding = embeddings[j];
      }
    } catch (error) {
      console.error(`  Error embedding batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
      // Skip failed batch — articles in this batch will have no embedding
      continue;
    }

    processed += batch.length;
    console.log(`  ${processed}/${articles.length} articles embedded`);

    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < articles.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

// ─── Database upsert ─────────────────────────────────────────────────────────

function vectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

async function upsertToNeon(
  articles: ParsedArticle[],
  categories: CategoryRecord[],
): Promise<void> {
  const sql = neon(process.env.DATABASE_URL!);

  // 1. Upsert categories
  console.log(`\nUpserting ${categories.length} categories...`);
  for (const cat of categories) {
    await sql`
      INSERT INTO knowledge_categories (category_id, platform, category_name, description, keywords)
      VALUES (${cat.category_id}, ${cat.platform}, ${cat.category_name}, ${cat.description}, ${cat.keywords})
      ON CONFLICT (category_id) DO UPDATE SET
        platform = EXCLUDED.platform,
        category_name = EXCLUDED.category_name,
        description = EXCLUDED.description,
        keywords = EXCLUDED.keywords,
        updated_at = NOW()
    `;
  }

  // 2. Upsert articles
  console.log(`Upserting ${articles.length} articles...`);
  for (const article of articles) {
    if (article.embedding) {
      await sql`
        INSERT INTO knowledge_articles (
          id, platform, title, filename, content, category_id, category_name,
          char_count, source_url, modified_time, embedding
        ) VALUES (
          ${article.id}, ${article.platform}, ${article.title}, ${article.filename},
          ${article.content}, ${article.category_id}, ${article.category_name},
          ${article.char_count}, ${article.source_url}, ${article.modified_time},
          ${vectorLiteral(article.embedding)}::vector
        )
        ON CONFLICT (id) DO UPDATE SET
          platform = EXCLUDED.platform,
          title = EXCLUDED.title,
          filename = EXCLUDED.filename,
          content = EXCLUDED.content,
          category_id = EXCLUDED.category_id,
          category_name = EXCLUDED.category_name,
          char_count = EXCLUDED.char_count,
          source_url = EXCLUDED.source_url,
          modified_time = EXCLUDED.modified_time,
          embedding = EXCLUDED.embedding,
          updated_at = NOW()
      `;
    } else {
      // No embedding — upsert without touching the embedding column
      await sql`
        INSERT INTO knowledge_articles (
          id, platform, title, filename, content, category_id, category_name,
          char_count, source_url, modified_time
        ) VALUES (
          ${article.id}, ${article.platform}, ${article.title}, ${article.filename},
          ${article.content}, ${article.category_id}, ${article.category_name},
          ${article.char_count}, ${article.source_url}, ${article.modified_time}
        )
        ON CONFLICT (id) DO UPDATE SET
          platform = EXCLUDED.platform,
          title = EXCLUDED.title,
          filename = EXCLUDED.filename,
          content = EXCLUDED.content,
          category_id = EXCLUDED.category_id,
          category_name = EXCLUDED.category_name,
          char_count = EXCLUDED.char_count,
          source_url = EXCLUDED.source_url,
          modified_time = EXCLUDED.modified_time,
          updated_at = NOW()
      `;
    }
  }

  // 3. Delete articles that no longer exist in source repos
  const allIds = articles.map((a) => a.id);
  if (allIds.length > 0) {
    const deleted = await sql`
      DELETE FROM knowledge_articles
      WHERE id != ALL(${allIds})
      RETURNING id
    `;
    if (deleted.length > 0) {
      console.log(`Deleted ${deleted.length} stale articles from DB.`);
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Validate required env vars
  if (!GITHUB_TOKEN) {
    console.error(
      "Error: GITHUB_TOKEN env var is required.\n" +
        "Create a GitHub Personal Access Token with 'repo' scope:\n" +
        "https://github.com/settings/tokens",
    );
    process.exit(1);
  }

  if (!DRY_RUN && !process.env.DATABASE_URL) {
    console.error("Error: DATABASE_URL env var is required.");
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log("=== DRY RUN MODE — no DB writes will be made ===\n");
  }

  // Step 1: Download repos
  const allArticles: ParsedArticle[] = [];
  const allCategories: CategoryRecord[] = [];
  const tmpDirs: string[] = [];

  for (const repo of REPOS) {
    const outputDir = await downloadRepo(repo.name);
    if (!outputDir) {
      console.error(`Failed to download ${repo.name}, skipping.`);
      continue;
    }
    tmpDirs.push(outputDir);

    // Step 2: Parse articles
    const { articles, categories } = parseArticles(outputDir, repo.platform);
    allArticles.push(...articles);
    allCategories.push(...categories);

    console.log(`  ${repo.platform}: ${articles.length} articles, ${categories.length} categories`);
  }

  console.log(`\nTotal: ${allArticles.length} articles, ${allCategories.length} categories`);

  if (allArticles.length === 0) {
    console.log("No articles found. Nothing to sync.");
    return;
  }

  // Step 3: Generate embeddings (unless --skip-embeddings)
  if (!SKIP_EMBEDDINGS) {
    await generateEmbeddings(allArticles);
    const withEmbeddings = allArticles.filter((a) => a.embedding).length;
    console.log(`Embeddings generated: ${withEmbeddings}/${allArticles.length}`);
  } else {
    console.log("\nSkipping embedding generation (--skip-embeddings).");
  }

  // Step 4: Upsert to Neon (unless --dry-run)
  if (DRY_RUN) {
    console.log("\n=== DRY RUN summary ===");
    console.log(`Would upsert ${allCategories.length} categories:`);
    for (const cat of allCategories) {
      console.log(`  [${cat.platform}] ${cat.category_name} (${cat.category_id})`);
    }
    console.log(`Would upsert ${allArticles.length} articles:`);
    for (const art of allArticles) {
      console.log(
        `  [${art.platform}] ${art.id}: ${art.title} (${art.char_count} chars)${art.embedding ? " +embedding" : ""}`,
      );
    }
    console.log("Would delete articles not in the above list.");
  } else {
    await upsertToNeon(allArticles, allCategories);
    console.log("\nSync complete!");
  }

  // Clean up temp directories
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
