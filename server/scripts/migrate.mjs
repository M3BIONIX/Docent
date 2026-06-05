// Applies db/schema.sql to the Supabase Postgres via the direct connection string.
// No Supabase CLI. Usage: DATABASE_URL=... node scripts/migrate.mjs
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "db", "schema.sql"), "utf8");

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  console.log("migrate: schema applied ✓");
} catch (e) {
  console.error("migrate failed:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
