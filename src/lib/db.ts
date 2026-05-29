import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

type DB = ReturnType<typeof drizzle<typeof schema>>;
let _db: DB | null = null;

// Safety net: a stray DB rejection should never kill the server (Node 22
// crashes on unhandled rejections by default → Railway SIGTERM restart loop).
if (typeof process !== 'undefined' && !(globalThis as any).__paniniGuards) {
  (globalThis as any).__paniniGuards = true;
  process.on('unhandledRejection', (reason) => {
    console.error('[process] Unhandled rejection (kept alive):', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('[process] Uncaught exception (kept alive):', err);
  });
}

function getConnectionUrl(): string | null {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.MYSQL_URL,
    process.env.MYSQL_PRIVATE_URL,
    process.env.MYSQL_PUBLIC_URL,
    process.env.DATABASE_PRIVATE_URL,
  ];
  return candidates.find(Boolean) ?? null;
}

export function getDb(): DB | null {
  const url = getConnectionUrl();
  if (!url) {
    console.warn('[db] No database URL found in environment');
    return null;
  }
  if (_db) return _db;
  try {
    const pool = mysql.createPool({
      uri: url,
      waitForConnections: true,
      connectionLimit: 10,
      ssl: { rejectUnauthorized: false }, // Railway MySQL requires SSL
    });
    // Without this listener a dropped idle connection crashes the whole
    // Node process (Railway recycles connections), causing SIGTERM restarts.
    pool.on('error', (err) => {
      console.error('[db] Pool error (handled, server stays up):', err.message);
    });
    _db = drizzle(pool, { schema, mode: 'default' });
    console.log('[db] MySQL pool created successfully');
  } catch (err) {
    console.error('[db] Failed to create MySQL pool:', err);
    return null;
  }
  return _db;
}
