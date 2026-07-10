import type { APIRoute } from "astro";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../lib/db";
import { collection, history } from "../../../lib/schema";

const headers = { "Content-Type": "application/json" };

export const POST: APIRoute = async ({ request }) => {
  let profileId: number;
  let historyId: number;

  try {
    const body = await request.json();
    profileId = Number(body.profileId);
    historyId = Number(body.historyId);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid body" }), { status: 400, headers });
  }

  if (!profileId || profileId < 1 || !historyId || historyId < 1) {
    return new Response(JSON.stringify({ error: "profileId and historyId required" }), {
      status: 400,
      headers,
    });
  }

  const db = getDb();
  if (!db) {
    return new Response(JSON.stringify({ error: "Database not configured" }), {
      status: 503,
      headers,
    });
  }

  try {
    const [entry] = await db
      .select()
      .from(history)
      .where(
        and(
          eq(history.id, historyId),
          eq(history.profileId, profileId),
          isNull(history.undoneAt),
        ),
      )
      .limit(1);

    if (!entry) {
      return new Response(
        JSON.stringify({ error: "Entry not found or already undone" }),
        { status: 404, headers },
      );
    }

    await db
      .insert(collection)
      .values({
        profileId,
        stickerNumber: entry.stickerNumber,
        owned: entry.oldOwned,
        repeats: entry.oldRepeats,
      })
      .onDuplicateKeyUpdate({
        set: { owned: entry.oldOwned, repeats: entry.oldRepeats },
      });

    await db
      .update(history)
      .set({ undoneAt: new Date() })
      .where(eq(history.id, historyId));

    return new Response(
      JSON.stringify({
        ok: true,
        stickerNumber: entry.stickerNumber,
        owned: entry.oldOwned,
        repeats: entry.oldRepeats,
      }),
      { headers },
    );
  } catch (err) {
    console.error("[history undo] DB error:", err);
    return new Response(JSON.stringify({ error: "Database error" }), {
      status: 500,
      headers,
    });
  }
};
