/**
 * fetch-docs.ts
 *
 * Downloads articles and metadata from private doc repos via GitHub API.
 * Supports multiple platforms (noon, noon-ads).
 *
 * Usage: npx tsx scripts/fetch-docs.ts
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const REPO_OWNER = "unilume-ai";
const BRANCH = "main";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const REPOS = [
  { name: "unilume-noon-docs", outputDir: path.resolve(__dirname, "../src/data/noon-docs") },
  { name: "unilume-noon-ads-docs", outputDir: path.resolve(__dirname, "../src/data/noon-ads-docs") },
];

async function fetchRepo(repoName: string, outputDir: string) {
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
    return false;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(tarPath, buffer);
  console.log(`Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB`);

  // tarPath is a controlled path (not user input), safe to use with execSync
  console.log("Extracting...");
  execSync(`tar -xzf "${tarPath}" -C "${tmpDir}"`, { stdio: "inherit" });

  const extractedDirs = fs
    .readdirSync(tmpDir)
    .filter((d) => fs.statSync(path.join(tmpDir, d)).isDirectory());

  if (extractedDirs.length === 0) {
    console.error("No directory found after extraction");
    return false;
  }

  const extractedRoot = path.join(tmpDir, extractedDirs[0]);

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const articlesSrc = path.join(extractedRoot, "articles");
  const metadataSrc = path.join(extractedRoot, "_metadata");

  if (fs.existsSync(articlesSrc)) {
    copyDirRecursive(articlesSrc, path.join(outputDir, "articles"));
    console.log("Copied articles/");
  } else {
    console.error(`Warning: articles/ directory not found in ${repoName}`);
  }

  if (fs.existsSync(metadataSrc)) {
    copyDirRecursive(metadataSrc, path.join(outputDir, "_metadata"));
    console.log("Copied _metadata/");
  } else {
    console.error(`Warning: _metadata/ directory not found in ${repoName}`);
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });

  const articleCount = countFiles(path.join(outputDir, "articles"), ".md");
  console.log(`Done! ${articleCount} articles downloaded to ${path.relative(process.cwd(), outputDir)}/`);
  return true;
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

async function main() {
  if (!GITHUB_TOKEN) {
    const allExist = REPOS.every((r) => fs.existsSync(r.outputDir + "/articles"));
    if (allExist) {
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

  for (const repo of REPOS) {
    await fetchRepo(repo.name, repo.outputDir);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
