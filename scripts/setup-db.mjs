/**
 * Prepare a fresh database (for example a Neon branch):
 *   DATABASE_URL="postgresql://..." npm run db:setup
 *
 * Runs every migration, then the service catalogue. Accounts are seeded separately
 * with `SEED_ACCOUNTS_ONLY=1 npm run db:seed` so demo clients and orders stay out.
 */
import { execFileSync } from "node:child_process";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const safe = url.replace(/(:\/\/[^:]+:)[^@]+@/, "$1***@");
console.log(`target: ${safe}\n`);

const run = (cmd, args, env = {}) => execFileSync(cmd, args, { stdio: "inherit", env: { ...process.env, ...env } });

console.log("→ migrations");
run("npx", ["drizzle-kit", "migrate"]);
console.log("\n→ service catalogue");
run("node", ["scripts/seed-services.mjs"]);
console.log("\n→ accounts");
run("node", ["--import", "tsx", "db/seed.ts"], { SEED_ACCOUNTS_ONLY: "1" });
console.log("\ndone");
