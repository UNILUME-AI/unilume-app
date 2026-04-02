import { createVertex } from "@ai-sdk/google-vertex";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

/**
 * Load Google service account credentials.
 * - Local dev: reads service-account.json file from project root
 * - Production (Vercel): parses GOOGLE_SERVICE_ACCOUNT_KEY env var
 */
function loadCredentials(): Record<string, unknown> {
  const filePath = join(process.cwd(), "service-account.json");
  if (existsSync(filePath)) {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  }
  return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}");
}

export const vertex = createVertex({
  project: process.env.GOOGLE_VERTEX_PROJECT,
  location: process.env.GOOGLE_VERTEX_LOCATION ?? "us-east5",
  googleAuthOptions: {
    credentials: loadCredentials(),
  },
});
