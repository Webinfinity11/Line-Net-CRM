import { config } from "dotenv";
// An explicit database URL (for isolated QA) must never load production env files.
if (!process.env.DATABASE_URL) config({ path: [".env.local", ".env"] });
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/linenet_crm",
  },
});
