import * as fs from "fs";
import * as path from "path";

// ── Types ──────────────────────────────────────────────

interface DocumentMeta {
  id: string;
  title: string;
  filename: string;
  category_id: string;
  category_name: string;
  char_count: number;
}

interface CategoryMeta {
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
  categories: CategoryMeta[];
  documents: DocumentMeta[];
}

// ── Paths ──────────────────────────────────────────────

const DATA_DIR = path.resolve(process.cwd(), "src/data");
const INDEX_PATH = path.join(DATA_DIR, "policies/index.json");
const ARTICLES_DIR = path.join(DATA_DIR, "noon-docs/articles");

// ── Singleton state ────────────────────────────────────

let index: PolicyIndex | null = null;
const articleCache: Map<string, string> = new Map();

// ── Token budget ───────────────────────────────────────
// 200K context, reserve ~120K for system prompt + conversation + reply
const MAX_INJECTION_CHARS = 300_000; // ~75K tokens at ~4 chars/token
const MAX_CATEGORIES = 3;

// ── Public API ─────────────────────────────────────────

export function loadAll(): PolicyIndex {
  if (index) return index;
  const raw = fs.readFileSync(INDEX_PATH, "utf-8");
  index = JSON.parse(raw) as PolicyIndex;
  return index;
}

export function getCategoryList(): CategoryMeta[] {
  const idx = loadAll();
  return idx.categories;
}

/**
 * Route a user query to 1-3 relevant categories.
 *
 * Strategy:
 * 1. If explicit categories provided (from Claude tool params), use them directly
 * 2. Keyword matching against category keywords
 * 3. If 0 matches or >3 matches, fall back to returning top matches by keyword score
 */
export function routeToCategories(
  query: string,
  explicitCategories?: string[]
): string[] {
  const idx = loadAll();

  // If Claude explicitly specified categories, use them
  if (explicitCategories && explicitCategories.length > 0) {
    return explicitCategories.slice(0, MAX_CATEGORIES);
  }

  // Keyword matching
  const queryLower = query.toLowerCase();
  const scores: { categoryId: string; score: number }[] = [];

  for (const cat of idx.categories) {
    let score = 0;
    for (const keyword of cat.keywords) {
      if (queryLower.includes(keyword.toLowerCase())) {
        // Longer keyword matches are more specific → higher score
        score += keyword.length;
      }
    }
    if (score > 0) {
      scores.push({ categoryId: cat.category_id, score });
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  if (scores.length === 0) {
    // No keyword match → return the largest category (Program Policies) as fallback
    return [idx.categories[0].category_id];
  }

  // Return top matches, up to MAX_CATEGORIES
  return scores.slice(0, MAX_CATEGORIES).map((s) => s.categoryId);
}

/**
 * Load all articles from specified categories, formatted for context injection.
 * Respects token budget by truncating if necessary.
 */
export function loadArticles(
  categoryIds: string[],
  market?: string
): { formatted: string; articleCount: number; categoryNames: string[] } {
  const idx = loadAll();
  const parts: string[] = [];
  let totalChars = 0;
  let articleCount = 0;
  const categoryNames: string[] = [];

  for (const catId of categoryIds.slice(0, MAX_CATEGORIES)) {
    const category = idx.categories.find((c) => c.category_id === catId);
    if (!category) continue;

    categoryNames.push(category.category_name);

    // Get documents for this category
    const docs = idx.documents.filter((d) => d.category_id === catId);

    // Optional market filter
    const filteredDocs = market
      ? docs.filter((d) => {
          const titleLower = d.title.toLowerCase();
          const marketLower = market.toLowerCase();
          // Include docs that mention the market or are general (no market specified)
          return (
            titleLower.includes(marketLower) ||
            titleLower.includes("all") ||
            (!titleLower.includes("ksa") &&
              !titleLower.includes("uae") &&
              !titleLower.includes("egypt") &&
              !titleLower.includes("saudi") &&
              !titleLower.includes("emirates"))
          );
        })
      : docs;

    const docsToLoad = filteredDocs.length > 0 ? filteredDocs : docs;

    const catParts: string[] = [];
    catParts.push(
      `\n[${docsToLoad.length} documents from category "${category.category_name}"]`
    );

    for (const doc of docsToLoad) {
      const content = loadArticleContent(doc.filename);
      if (!content) continue;

      // Check budget
      if (totalChars + content.length > MAX_INJECTION_CHARS) {
        catParts.push(
          `\n--- (remaining articles in "${category.category_name}" truncated due to context limit) ---`
        );
        break;
      }

      catParts.push(
        `\n=== "${doc.title}" (Category: ${doc.category_name}) ===`
      );
      catParts.push(content);
      catParts.push("=== END ===");

      totalChars += content.length;
      articleCount++;
    }

    parts.push(catParts.join("\n"));
  }

  return {
    formatted: parts.join("\n\n"),
    articleCount,
    categoryNames,
  };
}

// ── Internal helpers ───────────────────────────────────

function loadArticleContent(filename: string): string | null {
  // Check cache
  if (articleCache.has(filename)) {
    return articleCache.get(filename)!;
  }

  const filePath = path.join(ARTICLES_DIR, filename);
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    articleCache.set(filename, content);
    return content;
  } catch {
    return null;
  }
}
