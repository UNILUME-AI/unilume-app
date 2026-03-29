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
  source_url?: string;
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

interface EmbeddingEntry {
  id: string;
  title: string;
  filename: string;
  category_id: string;
  source_url?: string;
  embedding: number[];
}

// ── Paths ──────────────────────────────────────────────

const DATA_DIR = path.resolve(process.cwd(), "src/data");
const INDEX_PATH = path.join(DATA_DIR, "policies/index.json");
const EMBEDDINGS_PATH = path.join(DATA_DIR, "policies/embeddings.json");
const ARTICLES_DIR = path.join(DATA_DIR, "noon-docs/articles");

// ── Singleton state ────────────────────────────────────

let index: PolicyIndex | null = null;
let embeddings: EmbeddingEntry[] | null = null;
const articleCache: Map<string, string> = new Map();
const MAX_CACHE_SIZE = 200;

// ── Token budget ───────────────────────────────────────
// 200K context, reserve ~120K for system prompt + conversation + reply
const MAX_INJECTION_CHARS = 300_000; // ~75K tokens at ~4 chars/token
const MAX_CATEGORIES = 3;

// ── Public API ─────────────────────────────────────────

export function loadAll(): PolicyIndex {
  if (index) return index;
  try {
    const raw = fs.readFileSync(INDEX_PATH, "utf-8");
    index = JSON.parse(raw) as PolicyIndex;
    console.log(
      `[knowledge-base] Loaded index: ${index.total_count} articles, ${index.categories.length} categories`
    );
    return index;
  } catch (error) {
    console.error("[knowledge-base] Failed to load index:", error);
    throw new Error("Knowledge base index unavailable");
  }
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
): { formatted: string; articleCount: number; categoryNames: string[]; failedCount: number; sources: SourceRef[] } {
  const idx = loadAll();
  const parts: string[] = [];
  const sources: SourceRef[] = [];
  let totalChars = 0;
  let articleCount = 0;
  let failedCount = 0;
  let sourceIndex = 1;
  const categoryNames: string[] = [];

  for (const catId of categoryIds.slice(0, MAX_CATEGORIES)) {
    const category = idx.categories.find((c) => c.category_id === catId);
    if (!category) continue;

    categoryNames.push(category.category_name);

    const docs = idx.documents.filter((d) => d.category_id === catId);

    const filteredDocs = market
      ? docs.filter((d) => {
          const titleLower = d.title.toLowerCase();
          const marketLower = market.toLowerCase();
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
      if (!content) {
        failedCount++;
        continue;
      }

      if (totalChars + content.length > MAX_INJECTION_CHARS) {
        catParts.push(
          `\n--- (remaining articles in "${category.category_name}" truncated due to context limit) ---`
        );
        break;
      }

      const urlLine = doc.source_url ? ` | URL: ${doc.source_url}` : "";
      catParts.push(
        `\n=== [Source ${sourceIndex}] "${doc.title}" (Category: ${doc.category_name}${urlLine}) ===`
      );
      catParts.push(content);
      catParts.push("=== END ===");

      if (doc.source_url) {
        sources.push({ index: sourceIndex, title: doc.title, url: doc.source_url });
      }

      totalChars += content.length;
      articleCount++;
      sourceIndex++;
    }

    parts.push(catParts.join("\n"));
  }

  if (failedCount > 0) {
    console.warn(
      `[knowledge-base] ${failedCount} article(s) failed to load`
    );
  }

  return {
    formatted: parts.join("\n\n"),
    articleCount,
    categoryNames,
    failedCount,
    sources,
  };
}

// ── Semantic search ───────────────────────────────────

function loadEmbeddings(): EmbeddingEntry[] {
  if (embeddings) return embeddings;
  try {
    const raw = fs.readFileSync(EMBEDDINGS_PATH, "utf-8");
    embeddings = JSON.parse(raw) as EmbeddingEntry[];
    console.log(`[knowledge-base] Loaded ${embeddings.length} embeddings`);
    return embeddings;
  } catch {
    console.warn("[knowledge-base] embeddings.json not found, falling back to keyword search");
    return [];
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find the top K most relevant articles using vector similarity.
 * Returns article IDs sorted by relevance.
 */
export function semanticSearch(
  queryEmbedding: number[],
  topK: number = 8,
  market?: string
): { id: string; title: string; filename: string; source_url?: string; score: number }[] {
  const entries = loadEmbeddings();
  if (entries.length === 0) return [];

  const idx = loadAll();
  let candidates = entries;

  // Optional market filter on document titles
  if (market) {
    const marketLower = market.toLowerCase();
    candidates = entries.filter((e) => {
      const doc = idx.documents.find((d) => d.id === e.id);
      if (!doc) return true;
      const titleLower = doc.title.toLowerCase();
      return (
        titleLower.includes(marketLower) ||
        (!titleLower.includes("ksa") &&
          !titleLower.includes("uae") &&
          !titleLower.includes("egypt") &&
          !titleLower.includes("saudi") &&
          !titleLower.includes("emirates"))
      );
    });
  }

  const scored = candidates.map((entry) => ({
    id: entry.id,
    title: entry.title,
    filename: entry.filename,
    source_url: entry.source_url,
    score: cosineSimilarity(queryEmbedding, entry.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

export interface SourceRef {
  index: number;
  title: string;
  url: string;
}

/**
 * Load specific articles by their IDs, formatted for context injection.
 * Each article is numbered [1], [2], etc. for citation reference.
 */
export function loadArticlesByIds(
  articleIds: { id: string; title: string; filename: string; source_url?: string }[]
): { formatted: string; articleCount: number; failedCount: number; sources: SourceRef[] } {
  const parts: string[] = [];
  const sources: SourceRef[] = [];
  let totalChars = 0;
  let articleCount = 0;
  let failedCount = 0;
  let sourceIndex = 1;

  parts.push(`[${articleIds.length} most relevant documents]`);

  for (const article of articleIds) {
    const content = loadArticleContent(article.filename);
    if (!content) {
      failedCount++;
      continue;
    }

    if (totalChars + content.length > MAX_INJECTION_CHARS) {
      parts.push("\n--- (remaining articles truncated due to context limit) ---");
      break;
    }

    const urlLine = article.source_url ? ` | URL: ${article.source_url}` : "";
    parts.push(`\n=== [Source ${sourceIndex}] "${article.title}"${urlLine} ===`);
    parts.push(content);
    parts.push("=== END ===");

    if (article.source_url) {
      sources.push({ index: sourceIndex, title: article.title, url: article.source_url });
    }

    totalChars += content.length;
    articleCount++;
    sourceIndex++;
  }

  if (failedCount > 0) {
    console.warn(`[knowledge-base] ${failedCount} article(s) failed to load`);
  }

  return { formatted: parts.join("\n"), articleCount, failedCount, sources };
}

export function hasEmbeddings(): boolean {
  return loadEmbeddings().length > 0;
}

// ── Internal helpers ───────────────────────────────────

function loadArticleContent(filename: string): string | null {
  if (articleCache.has(filename)) {
    return articleCache.get(filename)!;
  }

  const filePath = path.join(ARTICLES_DIR, filename);
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    if (articleCache.size >= MAX_CACHE_SIZE) {
      const oldest = articleCache.keys().next().value;
      if (oldest) articleCache.delete(oldest);
    }
    articleCache.set(filename, content);
    return content;
  } catch (error) {
    console.warn(`[knowledge-base] Failed to load article: ${filename}`, error);
    return null;
  }
}
