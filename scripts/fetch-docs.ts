/**
 * fetch-docs.ts
 *
 * Downloads articles and metadata from the private unilume-noon-docs repo
 * via GitHub API. Requires GITHUB_TOKEN with repo read access.
 *
 * Usage: npx tsx scripts/fetch-docs.ts
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const REPO_OWNER = "unilume-ai";
const REPO_NAME = "unilume-noon-docs";
const BRANCH = "main";
const OUTPUT_DIR = path.resolve(__dirname, "../src/data/noon-docs");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function main() {
  if (!GITHUB_TOKEN) {
    // In local dev, docs may already exist from a previous fetch
    if (fs.existsSync(OUTPUT_DIR + "/articles")) {
      console.log("GITHUB_TOKEN not set, but docs already exist. Skipping fetch.");
      return;
    }
    console.error(
      "Error: GITHUB_TOKEN env var is required.\n" +
        "Create a GitHub Personal Access Token with 'repo' scope:\n" +
        "https://github.com/settings/tokens"
    );
    process.exit(1);
  }

  console.log(`Fetching docs from ${REPO_OWNER}/${REPO_NAME}@${BRANCH}...`);

  // Download repo tarball via GitHub API
  const tarballUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/tarball/${BRANCH}`;
  const tmpDir = path.resolve(__dirname, "../.tmp-docs");
  const tarPath = path.join(tmpDir, "repo.tar.gz");

  // Clean up
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  // Download tarball
  console.log("Downloading tarball...");
  const response = await fetch(tarballUrl, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    console.error(`GitHub API error: ${response.status} ${response.statusText}`);
    const body = await response.text();
    console.error(body);
    process.exit(1);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(tarPath, buffer);
  console.log(`Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB`);

  // Extract tarball
  console.log("Extracting...");
  execSync(`tar -xzf "${tarPath}" -C "${tmpDir}"`, { stdio: "inherit" });

  // Find extracted directory (GitHub adds a prefix like "owner-repo-sha/")
  const extractedDirs = fs
    .readdirSync(tmpDir)
    .filter((d) => fs.statSync(path.join(tmpDir, d)).isDirectory());

  if (extractedDirs.length === 0) {
    console.error("No directory found after extraction");
    process.exit(1);
  }

  const extractedRoot = path.join(tmpDir, extractedDirs[0]);

  // Copy articles/ and _metadata/ to output
  const articlesSrc = path.join(extractedRoot, "articles");
  const metadataSrc = path.join(extractedRoot, "_metadata");

  // Only wipe output if the tarball actually contains articles
  // (prevents losing cached articles when repo temporarily lacks them)
  if (fs.existsSync(articlesSrc)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    copyDirRecursive(articlesSrc, path.join(OUTPUT_DIR, "articles"));
    console.log("Copied articles/");
  } else {
    console.warn("Warning: articles/ not found in repo tarball — keeping existing articles");
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  if (fs.existsSync(metadataSrc)) {
    // Always update metadata
    const metaDest = path.join(OUTPUT_DIR, "_metadata");
    fs.rmSync(metaDest, { recursive: true, force: true });
    copyDirRecursive(metadataSrc, metaDest);
    console.log("Copied _metadata/");
  } else {
    console.warn("Warning: _metadata/ not found in repo tarball");
  }

  // Clean up tmp
  fs.rmSync(tmpDir, { recursive: true, force: true });

  // Count results
  const articleCount = countFiles(path.join(OUTPUT_DIR, "articles"), ".md");
  console.log(`\nDone! ${articleCount} articles downloaded to src/data/noon-docs/`);
}

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

function countFiles(dir: string, ext: string): number {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name), ext);
    } else if (entry.name.endsWith(ext)) {
      count++;
    }
  }
  return count;
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
