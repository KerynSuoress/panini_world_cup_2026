import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db';
import { collection, history } from '../../lib/schema';
import { and, eq } from 'drizzle-orm';

const headers = { 'Content-Type': 'application/json' };

const ok = () => new Response(JSON.stringify({ ok: true }), { headers });

type HistoryAction = 'owned_on' | 'owned_off' | 'repeat_add' | 'repeat_remove';

function resolveHistoryAction(
  oldOwned: boolean,
  oldRepeats: number,
  newOwned: boolean,
  newRepeats: number,
): HistoryAction | null {
  if (!oldOwned && newOwned) return 'owned_on';
  if (oldOwned && !newOwned) return 'owned_off';
  if (newRepeats > oldRepeats) return 'repeat_add';
  if (newRepeats < oldRepeats) return 'repeat_remove';
  return null;
}

export const PATCH: APIRoute = async ({ request }) => {
  const db = getDb();
  if (!db) {
    return new Response(JSON.stringify({ ok: false, error: 'No database connection' }), {
      status: 503,
      headers,
    });
  }

  try {
    const { profileId, stickerNumber, owned, repeats } = await request.json();
    const pid = Number(profileId);
    const num = String(stickerNumber);
    const newOwned = Boolean(owned);
    const newRepeats = Number(repeats) || 0;

    const [existing] = await db
      .select()
      .from(collection)
      .where(and(eq(collection.profileId, pid), eq(collection.stickerNumber, num)))
      .limit(1);

    const oldOwned = existing?.owned ?? false;
    const oldRepeats = existing?.repeats ?? 0;

    await db
      .insert(collection)
      .values({ profileId: pid, stickerNumber: num, owned: newOwned, repeats: newRepeats })
      .onDuplicateKeyUpdate({ set: { owned: newOwned, repeats: newRepeats } });

    const action = resolveHistoryAction(oldOwned, oldRepeats, newOwned, newRepeats);
    if (action) {
      await db.insert(history).values({
        profileId: pid,
        stickerNumber: num,
        action,
        oldOwned,
        newOwned,
        oldRepeats,
        newRepeats,
      });
    }
  } catch (err) {
    console.error('[collection PATCH] DB error:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers });
  }

  return ok();
};

export const PUT: APIRoute = async ({ request }) => {
  const db = getDb();
  if (!db) {
    return new Response(JSON.stringify({ ok: false, error: 'No database connection' }), {
      status: 503,
      headers,
    });
  }

  try {
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
  } catch (err) {
    console.error('[collection PUT] DB error:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers });
  }

  return ok();
};
