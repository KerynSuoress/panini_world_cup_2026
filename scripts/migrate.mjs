/**
 * Applies Drizzle migrations at startup (no Railway CLI required).
 * Skips when DATABASE_URL is unset (local dev without MySQL).
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
console.log("[migrate] Using connection from env var:", Object.keys(process.env).find(k => process.env[k] === url));

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");
const pool = mysql.createPool(url);

try {
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder });
  console.log("[migrate] Database schema is up to date");
} catch (err) {
  console.error("[migrate] Failed:", err);
  process.exit(1);
} finally {
  await pool.end();
}
