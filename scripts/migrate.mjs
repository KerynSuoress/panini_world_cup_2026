/**
 * Applies Drizzle migrations at startup (no Railway CLI required).
 * Skips when DATABASE_URL is unset (local dev without MySQL).
 */
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[migrate] No DATABASE_URL — skipping");
  process.exit(0);
}

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
