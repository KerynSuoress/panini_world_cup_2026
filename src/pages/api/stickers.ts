import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db';
import { collection } from '../../lib/schema';
import { eq } from 'drizzle-orm';

export const GET: APIRoute = async ({ url }) => {
  const headers = { 'Content-Type': 'application/json' };
  const profileId = Number(url.searchParams.get('profileId'));
  const empty = JSON.stringify({ owned: {}, repeats: {} });

  if (!profileId || profileId < 0) {
    return new Response(empty, { headers });
  }

  const db = getDb();
  if (!db) return new Response(empty, { headers });

  const rows = await db.select().from(collection).where(eq(collection.profileId, profileId));

  const owned: Record<string, boolean> = {};
  const repeats: Record<string, number> = {};
  for (const row of rows) {
    if (row.owned) owned[row.stickerNumber] = true;
    if (row.repeats > 0) repeats[row.stickerNumber] = row.repeats;
  }

  return new Response(JSON.stringify({ owned, repeats }), { headers });
};
