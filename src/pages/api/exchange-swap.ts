import type { APIRoute } from "astro";
import { and, eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getDb } from "../../lib/db";
import { collection, profiles } from "../../lib/schema";

const headers = { "Content-Type": "application/json" };

export const POST: APIRoute = async ({ request }) => {
  let profileId: number;
  let partnerEmail: string;
  let iGive: string[];
  let iGet: string[];

  try {
    const body = await request.json();
    profileId = Number(body.profileId);
    partnerEmail = String(body.partnerEmail ?? "").toLowerCase().trim();
    iGive = Array.isArray(body.iGive) ? (body.iGive as unknown[]).map(String) : [];
    iGet = Array.isArray(body.iGet) ? (body.iGet as unknown[]).map(String) : [];
  } catch {
    return new Response(JSON.stringify({ error: "Invalid body" }), { status: 400, headers });
  }

  if (!profileId || profileId < 1) {
    return new Response(JSON.stringify({ error: "profileId required" }), { status: 400, headers });
  }
  if (!partnerEmail.includes("@")) {
    return new Response(JSON.stringify({ error: "Valid partner email required" }), { status: 400, headers });
  }
  if (iGive.length === 0 && iGet.length === 0) {
    return new Response(JSON.stringify({ error: "Select at least one sticker" }), { status: 400, headers });
  }

  const db = getDb();
  if (!db) {
    return new Response(JSON.stringify({ error: "Database not configured" }), { status: 503, headers });
  }

  try {
    const [[user], [partner]] = await Promise.all([
      db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1),
      db.select().from(profiles).where(eq(profiles.email, partnerEmail)).limit(1),
    ]);

    if (!user) return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404, headers });
    if (!partner) return new Response(JSON.stringify({ error: "Partner not found" }), { status: 404, headers });

    // Validate: user must have repeats for every sticker they're giving
    if (iGive.length > 0) {
      const rows = await db
        .select()
        .from(collection)
        .where(and(eq(collection.profileId, profileId), inArray(collection.stickerNumber, iGive)));
      const repeatsMap: Record<string, number> = {};
      for (const r of rows) repeatsMap[r.stickerNumber] = r.repeats;
      for (const num of iGive) {
        if ((repeatsMap[num] ?? 0) < 1) {
          return new Response(
            JSON.stringify({ error: `You don't have a spare copy of ${num}` }),
            { status: 400, headers },
          );
        }
      }
    }

    // Validate: partner must have repeats for every sticker they're giving
    if (iGet.length > 0) {
      const rows = await db
        .select()
        .from(collection)
        .where(and(eq(collection.profileId, partner.id), inArray(collection.stickerNumber, iGet)));
      const repeatsMap: Record<string, number> = {};
      for (const r of rows) repeatsMap[r.stickerNumber] = r.repeats;
      for (const num of iGet) {
        if ((repeatsMap[num] ?? 0) < 1) {
          return new Response(
            JSON.stringify({ error: `${partner.email.split("@")[0]} doesn't have a spare copy of ${num}` }),
            { status: 400, headers },
          );
        }
      }
    }

    // Load partner's current state for all relevant stickers so we can compute updates
    const allNums = [...new Set([...iGive, ...iGet])];
    const partnerRows = await db
      .select()
      .from(collection)
      .where(and(eq(collection.profileId, partner.id), inArray(collection.stickerNumber, allNums)));

    const partnerState: Record<string, { owned: boolean; repeats: number }> = {};
    for (const r of partnerRows) partnerState[r.stickerNumber] = { owned: r.owned, repeats: r.repeats };

    // Build partner's updated rows:
    //   iGive → partner receives sticker (owned = true)
    //   iGet  → partner gave away a repeat (repeats--)
    const upserts: { profileId: number; stickerNumber: string; owned: boolean; repeats: number }[] = [];
    const seen = new Set<string>();

    for (const num of iGive) {
      if (seen.has(num)) continue;
      seen.add(num);
      const cur = partnerState[num] ?? { owned: false, repeats: 0 };
      upserts.push({ profileId: partner.id, stickerNumber: num, owned: true, repeats: cur.repeats });
    }
    for (const num of iGet) {
      if (seen.has(num)) continue;
      seen.add(num);
      const cur = partnerState[num] ?? { owned: false, repeats: 0 };
      upserts.push({
        profileId: partner.id,
        stickerNumber: num,
        owned: cur.owned,
        repeats: Math.max(0, cur.repeats - 1),
      });
    }

    if (upserts.length > 0) {
      await db
        .insert(collection)
        .values(upserts)
        .onDuplicateKeyUpdate({ set: { owned: sql`VALUES(owned)`, repeats: sql`VALUES(repeats)` } });
    }

    return new Response(JSON.stringify({ ok: true, gave: iGive.length, got: iGet.length }), { headers });
  } catch (err) {
    console.error("[exchange-swap] DB error:", err);
    return new Response(JSON.stringify({ error: "Database error" }), { status: 500, headers });
  }
};
