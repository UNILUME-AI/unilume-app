/**
 * build-index.ts
 *
 * Scans the fetched noon-docs and generates src/data/policies/index.json
 * with category metadata, keywords for routing, and document listings.
 *
 * Run fetch-docs.ts first to download articles from GitHub.
 *
 * Usage: npx tsx scripts/build-index.ts
 */

import * as fs from "fs";
import * as path from "path";

const ARTICLES_DIR = path.resolve(
  __dirname,
  "../src/data/noon-docs/articles"
);
const CATEGORIES_JSON = path.resolve(
  __dirname,
  "../src/data/noon-docs/_metadata/_file_categories.json"
);
const OUTPUT_PATH = path.resolve(
  __dirname,
  "../src/data/policies/index.json"
);

// Human-curated category descriptions and keywords for routing
const CATEGORY_META: Record<
  string,
  { description: string; keywords: string[] }
> = {
  "Finance & Payments": {
    description:
      "Payment processing, invoices, statements, fees, settlements, VAT, ZATCA integration, bank details, payment cycles",
    keywords: [
      "payment",
      "invoice",
      "statement",
      "fee",
      "fees",
      "settlement",
      "vat",
      "zatca",
      "bank",
      "finance",
      "money",
      "pay",
      "billing",
      "charge",
      "cost",
      "price",
      "收款",
      "付款",
      "结算",
      "发票",
      "费用",
    ],
  },
  "Fulfilled by noon (FBN)": {
    description:
      "Fulfilled by Noon program: FBN storage, inbound shipments, outbound fees, inventory management, warehouse operations, FBN reports",
    keywords: [
      "fbn",
      "fulfilled by noon",
      "warehouse",
      "storage",
      "inbound",
      "outbound",
      "inventory",
      "stock",
      "仓储",
      "入库",
      "出库",
      "库存",
    ],
  },
  "Fulfilled by Partner (FBP)": {
    description:
      "Fulfilled by Partner / DirectShip program: order fulfillment, shipping, delivery, picklists, returns handling, DirectShip fees and policies",
    keywords: [
      "fbp",
      "fulfilled by partner",
      "directship",
      "direct ship",
      "shipping",
      "delivery",
      "ship",
      "fulfill",
      "fulfillment",
      "order",
      "picklist",
      "物流",
      "配送",
      "发货",
      "履约",
    ],
  },
  "Fulfilled By Partner Integration": {
    description:
      "FBP Integration (FBPI): API integration for third-party fulfillment systems, technical integration guides",
    keywords: [
      "fbpi",
      "integration",
      "api",
      "third party",
      "3pl",
      "接口",
      "集成",
      "对接",
    ],
  },
  "Program Policies": {
    description:
      "Noon seller policies: referral fees, commission rates, return policies, fraud prevention, disputes, penalties, compliance, restricted items, seller code of conduct",
    keywords: [
      "policy",
      "policies",
      "rule",
      "rules",
      "return",
      "returns",
      "refund",
      "commission",
      "referral fee",
      "penalty",
      "dispute",
      "fraud",
      "compliance",
      "restricted",
      "prohibited",
      "violation",
      "退货",
      "退款",
      "佣金",
      "政策",
      "规则",
      "处罚",
      "违规",
    ],
  },
  "Product Listing": {
    description:
      "Product listing and catalog management: SKU creation, product titles, images, barcodes, brand registration, content guidelines, bulk upload, catalog quality",
    keywords: [
      "listing",
      "list",
      "product",
      "sku",
      "catalog",
      "catalogue",
      "title",
      "image",
      "photo",
      "barcode",
      "brand",
      "content",
      "upload",
      "create product",
      "上架",
      "商品",
      "产品",
      "标题",
      "图片",
      "品牌",
    ],
  },
  "Onboarding & Registration": {
    description:
      "Seller onboarding: account registration, documents required, trade license, legal entity setup, seller profile, getting started on Noon",
    keywords: [
      "onboarding",
      "register",
      "registration",
      "sign up",
      "signup",
      "account",
      "document",
      "license",
      "legal entity",
      "start selling",
      "get started",
      "new seller",
      "注册",
      "开店",
      "入驻",
      "开户",
    ],
  },
  "Price & Inventory Management": {
    description:
      "Pricing strategies, stock management, price updates, inventory control, global min/max pricing",
    keywords: [
      "price",
      "pricing",
      "inventory",
      "stock",
      "manage stock",
      "update price",
      "定价",
      "价格",
      "库存管理",
    ],
  },
  Promotions: {
    description:
      "Promotional campaigns: flash deals, mega deals, price drops, promo codes, virtual bundles, store creation, Noon promotions",
    keywords: [
      "promotion",
      "promo",
      "deal",
      "deals",
      "flash",
      "discount",
      "coupon",
      "bundle",
      "campaign",
      "offer",
      "sale",
      "促销",
      "活动",
      "折扣",
      "优惠",
    ],
  },
  "Governance & Performance Management": {
    description:
      "Seller performance metrics, account health, performance standards, seller score, governance policies, account suspension",
    keywords: [
      "performance",
      "score",
      "rating",
      "governance",
      "health",
      "suspension",
      "account health",
      "seller score",
      "绩效",
      "评分",
      "考核",
    ],
  },
  "Global Selling": {
    description:
      "Cross-border selling: international selling guidelines, global warranty, GCC cross-border, export requirements",
    keywords: [
      "global",
      "cross border",
      "cross-border",
      "international",
      "export",
      "gcc",
      "跨境",
      "国际",
    ],
  },
  "Reports & Analytics": {
    description:
      "Seller reporting tools: analytics dashboard, product insights, sales reports, performance analytics",
    keywords: [
      "report",
      "reports",
      "analytics",
      "dashboard",
      "insight",
      "data",
      "报表",
      "数据",
      "分析",
    ],
  },
  "Inventory Removal": {
    description:
      "FBN inventory removal: RTV (Return to Vendor) process, shipment tracking, inventory disposal",
    keywords: [
      "removal",
      "remove",
      "rtv",
      "return to vendor",
      "dispose",
      "disposal",
      "移除",
      "退仓",
    ],
  },
  "Support & Training": {
    description:
      "Seller support resources: training materials, help center, support contacts, seller lab guides",
    keywords: [
      "support",
      "training",
      "help",
      "guide",
      "contact",
      "learn",
      "培训",
      "帮助",
      "支持",
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
      "ads",
      "ad",
      "advertising",
      "sponsor",
      "sponsored",
      "marketing",
      "广告",
      "推广",
    ],
  },
};

interface DocumentMeta {
  id: string;
  title: string;
  filename: string;
  category_id: string;
  category_name: string;
  char_count: number;
  source_url?: string;
}

interface CategoryEntry {
  category_id: string;
  category_name: string;
  description: string;
  keywords: string[];
  article_count: number;
  total_chars: number;
  article_ids: string[];
}

interface PolicyIndex {
  total_count: number;
  last_updated: string;
  categories: CategoryEntry[];
  documents: DocumentMeta[];
}

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

function main() {
  // Check if docs have been fetched
  if (!fs.existsSync(ARTICLES_DIR)) {
    console.error(
      "Error: src/data/noon-docs/articles/ not found.\n" +
        "Run 'npm run fetch-docs' first to download articles from GitHub."
    );
    process.exit(1);
  }

  // Load file-to-category mapping
  const fileCategoriesRaw = fs.readFileSync(CATEGORIES_JSON, "utf-8");
  const fileCategories: Record<string, string> = JSON.parse(fileCategoriesRaw);

  // Scan articles directory
  const categoryDirs = fs
    .readdirSync(ARTICLES_DIR)
    .filter((d) =>
      fs.statSync(path.join(ARTICLES_DIR, d)).isDirectory()
    );

  const documents: DocumentMeta[] = [];
  const categoryMap: Record<string, CategoryEntry> = {};

  for (const dirName of categoryDirs) {
    const dirPath = path.join(ARTICLES_DIR, dirName);
    const files = fs
      .readdirSync(dirPath)
      .filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const title = extractTitle(content);

      // Determine category name from the mapping or directory name
      const categoryName =
        fileCategories[file] ||
        dirName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const categoryId = slugify(categoryName);

      const sourceUrl = extractSourceUrl(content);
      const doc: DocumentMeta = {
        id: file.replace(/\.md$/, ""),
        title,
        filename: `${dirName}/${file}`,
        category_id: categoryId,
        category_name: categoryName,
        char_count: content.length,
        ...(sourceUrl && { source_url: sourceUrl }),
      };
      documents.push(doc);

      // Build category entry
      if (!categoryMap[categoryId]) {
        const meta = CATEGORY_META[categoryName] || {
          description: categoryName,
          keywords: [categoryName.toLowerCase()],
        };
        categoryMap[categoryId] = {
          category_id: categoryId,
          category_name: categoryName,
          description: meta.description,
          keywords: meta.keywords,
          article_count: 0,
          total_chars: 0,
          article_ids: [],
        };
      }

      categoryMap[categoryId].article_count++;
      categoryMap[categoryId].total_chars += content.length;
      categoryMap[categoryId].article_ids.push(doc.id);
    }
  }

  const categories = Object.values(categoryMap).sort(
    (a, b) => b.article_count - a.article_count
  );

  const index: PolicyIndex = {
    total_count: documents.length,
    last_updated: new Date().toISOString().split("T")[0],
    categories,
    documents,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(index, null, 2), "utf-8");

  console.log(`Generated index.json:`);
  console.log(`  Total documents: ${documents.length}`);
  console.log(`  Categories: ${categories.length}`);
  for (const cat of categories) {
    console.log(
      `    ${cat.category_name}: ${cat.article_count} articles (${Math.round(cat.total_chars / 1024)}KB)`
    );
  }
}

main();
