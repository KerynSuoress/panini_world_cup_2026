import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

type DB = ReturnType<typeof drizzle<typeof schema>>;
let _db: DB | null = null;

function getConnectionUrl(): string | null {
  // Railway injects MySQL connection strings under several possible names
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
    console.warn('[db] No database URL found in environment. Checked: DATABASE_URL, MYSQL_URL, MYSQL_PRIVATE_URL, MYSQL_PUBLIC_URL, DATABASE_PRIVATE_URL');
    return null;
  }
  if (_db) return _db;
  try {
    const pool = mysql.createPool(url);
    _db = drizzle(pool, { schema, mode: 'default' });
    console.log('[db] MySQL pool created successfully');
  } catch (err) {
    console.error('[db] Failed to create MySQL pool:', err);
    return null;
  }
  return _db;
}
