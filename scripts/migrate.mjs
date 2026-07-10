/**
 * Applies Drizzle migrations at startup (no Railway CLI required).
 * Skips when no database URL is set (local dev without MySQL).
 * With MIGRATE_STRICT=1, exits non-zero if migrations fail.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

const HISTORY_MIGRATION = {
  tag: "0002_history",
  when: 1752112800000,
};

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

async function tableExists(name) {
  const [rows] = await pool.query(`SHOW TABLES LIKE ?`, [name]);
  return Array.isArray(rows) && rows.length > 0;
}

async function applySqlFile(relativePath) {
  const filePath = join(migrationsFolder, relativePath);
  const raw = await readFile(filePath, "utf8");
  const statements = raw
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await pool.query(statement);
  }

  const hash = createHash("sha256").update(raw).digest("hex");
  await pool.query(
    `INSERT INTO \`__drizzle_migrations\` (\`hash\`, \`created_at\`)
     SELECT ?, ?
     WHERE NOT EXISTS (SELECT 1 FROM \`__drizzle_migrations\` WHERE \`hash\` = ?)`,
    [hash, HISTORY_MIGRATION.when, hash],
  );
}

async function ensureHistoryTable() {
  if (await tableExists("history")) return;

  console.warn("[migrate] history table missing after migrate — applying fallback");
  await applySqlFile(`${HISTORY_MIGRATION.tag}.sql`);
  console.log("[migrate] history table created via fallback");
}

try {
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder });
  await ensureHistoryTable();
  console.log("[migrate] Database schema is up to date");
} catch (err) {
  console.error("[migrate] Migration failed:", err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  if (process.env.MIGRATE_STRICT === "1") process.exit(1);
} finally {
  await pool.end().catch(() => {});
}
