import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

type DB = ReturnType<typeof drizzle<typeof schema>>;
let _db: DB | null = null;

export function getDb(): DB | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (_db) return _db;
  const pool = mysql.createPool(url);
  _db = drizzle(pool, { schema, mode: 'default' });
  return _db;
}
