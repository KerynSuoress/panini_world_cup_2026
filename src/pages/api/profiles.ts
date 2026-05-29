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
    console.error('[profiles] No database configured — DATABASE_URL is required');
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 503, headers });
  }

  try {
    const existing = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
    if (existing.length > 0) {
      return new Response(JSON.stringify({ profileId: existing[0].id, email }), { headers });
    }

    const [result] = await db.insert(profiles).values({ email });
    return new Response(JSON.stringify({ profileId: Number(result.insertId), email }), { headers });
  } catch (err) {
    console.error('[profiles] DB error:', err);
    return new Response(JSON.stringify({ error: 'Database error' }), { status: 500, headers });
  }
};
