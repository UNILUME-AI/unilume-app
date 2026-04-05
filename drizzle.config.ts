import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // DDL 不能走连接池，必须用直连
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
});
