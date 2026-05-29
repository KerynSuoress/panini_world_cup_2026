import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db';
import { collection } from '../../lib/schema';
import { eq } from 'drizzle-orm';

const headers = { 'Content-Type': 'application/json' };
const ok = new Response(JSON.stringify({ ok: true }), { headers });

// Single sticker update
export const PATCH: APIRoute = async ({ request }) => {
  const db = getDb();
  if (!db) return ok;

  const { profileId, stickerNumber, owned, repeats } = await request.json();
  await db
    .insert(collection)
    .values({ profileId, stickerNumber, owned: Boolean(owned), repeats: Number(repeats) || 0 })
    .onDuplicateKeyUpdate({ set: { owned: Boolean(owned), repeats: Number(repeats) || 0 } });

  return ok;
};

// Bulk replace (used by import)
export const PUT: APIRoute = async ({ request }) => {
  const db = getDb();
  if (!db) return ok;

  const { profileId, owned, repeats } = await request.json() as {
    profileId: number;
    owned: Record<string, boolean>;
    repeats: Record<string, number>;
  };

  await db.delete(collection).where(eq(collection.profileId, profileId));

  const allNumbers = new Set([...Object.keys(owned), ...Object.keys(repeats)]);
  const rows = [...allNumbers]
    .filter((n) => owned[n] || (repeats[n] ?? 0) > 0)
    .map((stickerNumber) => ({
      profileId,
      stickerNumber,
      owned: owned[stickerNumber] ?? false,
      repeats: repeats[stickerNumber] ?? 0,
    }));

  if (rows.length > 0) {
    await db.insert(collection).values(rows);
  }

  return ok;
};
