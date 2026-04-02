import { neon } from "@neondatabase/serverless";

// ── Types ──────────────────────────────────────────────

export interface DocumentMeta {
  id: string;
  title: string;
  filename: string;
  category_id: string;
  category_name: string;
  char_count: number;
  source_url?: string;
  modified_time?: string;
}

export interface CategoryMeta {
  category_id: string;
  category_name: string;
  description: string;
  keywords: string[];
  article_count: number;
  total_chars: number;
}

export interface SourceRef {
  index: number;
  title: string;
  url: string;
  modifiedTime?: string;
}

// ── Constants ─────────────────────────────────────────

const MAX_INJECTION_CHARS = 300_000;
const MAX_CATEGORIES = 3;

// ── Public API ────────────────────────────────────────

export async function getCategoryList(): Promise<CategoryMeta[]> {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT c.category_id, c.category_name, c.description, c.keywords,
           COUNT(a.id)::int AS article_count,
           COALESCE(SUM(a.char_count), 0)::int AS total_chars
    FROM knowledge_categories c
    LEFT JOIN knowledge_articles a ON a.category_id = c.category_id
    GROUP BY c.category_id, c.category_name, c.description, c.keywords
    ORDER BY article_count DESC
  `;
  return rows as CategoryMeta[];
}

/**
 * Route a user query to 1-3 relevant categories.
 *
 * Strategy:
 * 1. If explicit categories provided (from Claude tool params), use them directly
 * 2. Keyword matching against category keywords
 * 3. If 0 matches or >3 matches, fall back to returning top matches by keyword score
 */
export async function routeToCategories(
  query: string,
  explicitCategories?: string[]
): Promise<string[]> {
  // If Claude explicitly specified categories, use them
  if (explicitCategories && explicitCategories.length > 0) {
    return explicitCategories.slice(0, MAX_CATEGORIES);
  }

  const categories = await getCategoryList();

  // Keyword matching
  const queryLower = query.toLowerCase();
  const scores: { categoryId: string; score: number }[] = [];

  for (const cat of categories) {
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
    // No keyword match → return the largest category as fallback
    return [categories[0].category_id];
  }

  // Return top matches, up to MAX_CATEGORIES
  return scores.slice(0, MAX_CATEGORIES).map((s) => s.categoryId);
}

/**
 * Load all articles from specified categories, formatted for context injection.
 * Respects token budget by truncating if necessary.
 */
export async function loadArticles(
  categoryIds: string[],
  market?: string
): Promise<{
  formatted: string;
  articleCount: number;
  categoryNames: string[];
  failedCount: number;
  sources: SourceRef[];
}> {
  const sql = neon(process.env.DATABASE_URL!);
  const catIds = categoryIds.slice(0, MAX_CATEGORIES);

  const rows = await sql`
    SELECT id, title, content, category_id, category_name, char_count, source_url, modified_time
    FROM knowledge_articles
    WHERE category_id = ANY(${catIds})
    ORDER BY category_id, title
  `;

  // Group by category
  const byCategory = new Map<string, typeof rows>();
  for (const row of rows) {
    const catId = row.category_id as string;
    if (!byCategory.has(catId)) byCategory.set(catId, []);
    byCategory.get(catId)!.push(row);
  }

  const parts: string[] = [];
  const sources: SourceRef[] = [];
  let totalChars = 0;
  let articleCount = 0;
  let sourceIndex = 1;
  const categoryNames: string[] = [];

  for (const catId of catIds) {
    const docs = byCategory.get(catId);
    if (!docs || docs.length === 0) continue;

    const categoryName = docs[0].category_name as string;
    categoryNames.push(categoryName);

    const filteredDocs = market
      ? docs.filter((d) => {
          const titleLower = (d.title as string).toLowerCase();
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
      `\n[${docsToLoad.length} documents from category "${categoryName}"]`
    );

    for (const doc of docsToLoad) {
      const content = doc.content as string;

      if (totalChars + content.length > MAX_INJECTION_CHARS) {
        catParts.push(
          `\n--- (remaining articles in "${categoryName}" truncated due to context limit) ---`
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
        sources.push({
          index: sourceIndex,
          title: doc.title as string,
          url: doc.source_url as string,
          modifiedTime: doc.modified_time as string | undefined,
        });
      }

      totalChars += content.length;
      articleCount++;
      sourceIndex++;
    }

    parts.push(catParts.join("\n"));
  }

  return {
    formatted: parts.join("\n\n"),
    articleCount,
    categoryNames,
    failedCount: 0,
    sources,
  };
}

// ── Semantic search ──────────────────────────────────

/**
 * Find the top K most relevant articles using vector similarity.
 * Returns article IDs sorted by relevance.
 */
export async function semanticSearch(
  queryEmbedding: number[],
  topK: number = 8,
  market?: string
): Promise<
  {
    id: string;
    title: string;
    filename: string;
    source_url?: string;
    score: number;
  }[]
> {
  const sql = neon(process.env.DATABASE_URL!);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;
  const fetchLimit = topK * 2;

  const rows = await sql`
    SELECT id, title, filename, source_url,
           1 - (embedding <=> ${embeddingStr}::vector) AS score
    FROM knowledge_articles
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${fetchLimit}
  `;

  let candidates = rows;

  // Optional market filter on document titles
  if (market) {
    const marketLower = market.toLowerCase();
    candidates = rows.filter((r) => {
      const titleLower = (r.title as string).toLowerCase();
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

  return candidates.slice(0, topK).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    filename: r.filename as string,
    source_url: r.source_url as string | undefined,
    score: Number(r.score),
  }));
}

/**
 * Load specific articles by their IDs, formatted for context injection.
 * Each article is numbered [1], [2], etc. for citation reference.
 */
export async function loadArticlesByIds(
  articleIds: {
    id: string;
    title: string;
    filename: string;
    source_url?: string;
  }[]
): Promise<{
  formatted: string;
  articleCount: number;
  failedCount: number;
  sources: SourceRef[];
}> {
  const sql = neon(process.env.DATABASE_URL!);
  const ids = articleIds.map((a) => a.id);

  const rows = await sql`
    SELECT id, title, content, category_name, source_url, modified_time
    FROM knowledge_articles
    WHERE id = ANY(${ids})
  `;

  // Build a map for O(1) lookup, preserving input order
  const rowMap = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    rowMap.set(row.id as string, row);
  }

  const parts: string[] = [];
  const sources: SourceRef[] = [];
  let totalChars = 0;
  let articleCount = 0;
  let failedCount = 0;
  let sourceIndex = 1;

  parts.push(`[${articleIds.length} most relevant documents]`);

  for (const article of articleIds) {
    const row = rowMap.get(article.id);
    if (!row) {
      failedCount++;
      continue;
    }

    const content = row.content as string;

    if (totalChars + content.length > MAX_INJECTION_CHARS) {
      parts.push("\n--- (remaining articles truncated due to context limit) ---");
      break;
    }

    const urlLine = row.source_url ? ` | URL: ${row.source_url}` : "";
    parts.push(`\n=== [Source ${sourceIndex}] "${row.title}"${urlLine} ===`);
    parts.push(content);
    parts.push("=== END ===");

    if (row.source_url) {
      sources.push({
        index: sourceIndex,
        title: row.title as string,
        url: row.source_url as string,
        modifiedTime: row.modified_time as string | undefined,
      });
    }

    totalChars += content.length;
    articleCount++;
    sourceIndex++;
  }

  if (failedCount > 0) {
    console.warn(`[knowledge-base] ${failedCount} article(s) not found in DB`);
  }

  return { formatted: parts.join("\n"), articleCount, failedCount, sources };
}

export async function hasEmbeddings(): Promise<boolean> {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT EXISTS(SELECT 1 FROM knowledge_articles WHERE embedding IS NOT NULL) AS has
  `;
  return rows[0].has as boolean;
}
