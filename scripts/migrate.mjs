/**
 * Applies Drizzle migrations at startup (no Railway CLI required).
 * Skips when no database URL is set (local dev without MySQL).
 * Non-fatal — app still boots even if migrations fail.
 */
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const url =
  process.env.DATABASE_URL ||
  process.env.MYSQL_URL ||
  process.env.MYSQL_PRIVATE_URL ||
  process.env.MYSQL_PUBLIC_URL ||
  process.env.DATABASE_PRIVATE_URL;

if (!url) {
  console.log("[migrate] No database URL found — skipping migrations");
  process.exit(0);
}

const foundKey = Object.keys(process.env).find((k) => process.env[k] === url);
console.log(`[migrate] Connecting via env var: ${foundKey}`);

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

// 10 second timeout — if DB is unreachable, don't block app startup.
// SSL must match src/lib/db.ts — Railway MySQL requires it.
const pool = mysql.createPool({
  uri: url,
  connectTimeout: 10000,
  connectionLimit: 1,
  ssl: { rejectUnauthorized: false },
});

try {
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder });
  console.log("[migrate] Database schema is up to date");
} catch (err) {
  console.error("[migrate] Migration failed (app will still start):", err?.message ?? err);
} finally {
  await pool.end().catch(() => {});
}
