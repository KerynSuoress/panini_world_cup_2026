import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db';
import { profiles } from '../../lib/schema';
import { eq } from 'drizzle-orm';

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };

  let email: string;
  try {
    const body = await request.json();
    email = String(body.email ?? '').toLowerCase().trim();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400, headers });
  }

  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ error: 'Valid email required' }), { status: 400, headers });
  }

  const db = getDb();
  if (!db) {
    // No DB configured — local mode, use localStorage on the client
    return new Response(JSON.stringify({ profileId: -1, email, mode: 'local' }), { headers });
  }

  const existing = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
  if (existing.length > 0) {
    return new Response(JSON.stringify({ profileId: existing[0].id, email, mode: 'db' }), { headers });
  }

  const [result] = await db.insert(profiles).values({ email });
  return new Response(JSON.stringify({ profileId: Number(result.insertId), email, mode: 'db' }), { headers });
};
