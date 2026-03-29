/**
 * build-embeddings.ts
 *
 * Generates vector embeddings for all knowledge base articles using
 * Google Vertex AI's text-embedding model. Outputs embeddings.json
 * for runtime semantic search.
 *
 * Requires: GOOGLE_VERTEX_PROJECT, GOOGLE_SERVICE_ACCOUNT_KEY env vars
 * (load via .env.local or set in shell)
 *
 * Usage: npx tsx scripts/build-embeddings.ts
 */

import * as fs from "fs";
import * as path from "path";
import { GoogleAuth } from "google-auth-library";

const ARTICLES_DIR = path.resolve(__dirname, "../src/data/noon-docs/articles");
const INDEX_PATH = path.resolve(__dirname, "../src/data/policies/index.json");
const OUTPUT_PATH = path.resolve(__dirname, "../src/data/policies/embeddings.json");

const EMBEDDING_MODEL = "text-embedding-005";
const BATCH_SIZE = 5; // articles per API call to avoid rate limits

interface DocMeta {
  id: string;
  title: string;
  filename: string;
  category_id: string;
  source_url?: string;
}

interface EmbeddingEntry {
  id: string;
  title: string;
  filename: string;
  category_id: string;
  source_url?: string;
  embedding: number[];
}

async function getAccessToken(): Promise<string> {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}");
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
    content: text.slice(0, 10000), // truncate to ~10K chars for embedding
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
  return data.predictions.map((p: { embeddings: { values: number[] } }) => p.embeddings.values);
}

async function main() {
  // Load .env.local if available
  const envPath = path.resolve(__dirname, "../.env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value.trim();
        }
      }
    }
  }

  if (!process.env.GOOGLE_VERTEX_PROJECT || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.error("Error: GOOGLE_VERTEX_PROJECT and GOOGLE_SERVICE_ACCOUNT_KEY are required.");
    console.error("Set them in .env.local or as environment variables.");
    process.exit(1);
  }

  // Load index
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
  const documents: DocMeta[] = index.documents;

  console.log(`Generating embeddings for ${documents.length} articles...`);

  const token = await getAccessToken();
  const entries: EmbeddingEntry[] = [];
  let processed = 0;

  // Process in batches
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    const texts: string[] = [];

    for (const doc of batch) {
      const filePath = path.join(ARTICLES_DIR, doc.filename);
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        // Combine title + content for better embedding
        texts.push(`${doc.title}\n\n${content}`);
      } catch {
        console.warn(`  Skipping ${doc.filename} (file not found)`);
        texts.push(doc.title); // fallback to title only
      }
    }

    try {
      const embeddings = await embedTexts(texts, token);
      for (let j = 0; j < batch.length; j++) {
        entries.push({
          id: batch[j].id,
          title: batch[j].title,
          filename: batch[j].filename,
          category_id: batch[j].category_id,
          source_url: batch[j].source_url,
          embedding: embeddings[j],
        });
      }
    } catch (error) {
      console.error(`  Error embedding batch ${i / BATCH_SIZE + 1}:`, error);
      // Skip failed batch
      continue;
    }

    processed += batch.length;
    console.log(`  ${processed}/${documents.length} articles embedded`);

    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < documents.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Write output
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(entries), "utf-8");
  const sizeMB = (Buffer.byteLength(JSON.stringify(entries)) / 1024 / 1024).toFixed(1);
  console.log(`\nGenerated embeddings.json: ${entries.length} entries, ${sizeMB}MB`);
}

main().catch(console.error);
