/**
 * Applies Drizzle migrations at startup (no Railway CLI required).
 * Skips when no database URL is set (local dev without MySQL).
 * With MIGRATE_STRICT=1, exits non-zero if migrations fail or schema is incomplete.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

const REQUIRED_TABLES = ["profiles", "collection", "trade_requests", "history"];

const url =
  process.env.DATABASE_URL ||
  process.env.MYSQL_URL ||
  process.env.MYSQL_PRIVATE_URL ||
  process.env.MYSQL_PUBLIC_URL ||
  process.env.DATABASE_PRIVATE_URL;

if (!url) {
  console.log("[migrate] No database URL found — skipping migrations");
  console.log("[migrate] Set DATABASE_URL (Railway MySQL → Variables) or use a .env file with:");
  console.log("[migrate]   npm run db:migrate:run");
  process.exit(process.env.MIGRATE_STRICT === "1" ? 1 : 0);
}

const foundKey = Object.keys(process.env).find((k) => process.env[k] === url);
console.log(`[migrate] Connecting via env var: ${foundKey}`);

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

const pool = mysql.createPool({
  uri: url,
  connectTimeout: 10000,
  connectionLimit: 1,
  ssl: { rejectUnauthorized: false },
});

async function assertRequiredTables() {
  for (const table of REQUIRED_TABLES) {
    const [rows] = await pool.query(`SHOW TABLES LIKE ?`, [table]);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error(`Required table missing after migrate: ${table}`);
    }
  }
}

try {
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder });
  await assertRequiredTables();
  console.log("[migrate] Database schema is up to date");
} catch (err) {
  console.error("[migrate] Migration failed:", err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
} finally {
  await pool.end().catch(() => {});
}
