import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../lib/db";
import { expireStaleTrades, findTradeWithProfiles } from "../../../../lib/trades";
import { tradeRequests } from "../../../../lib/schema";

const headers = { "Content-Type": "application/json" };

export const POST: APIRoute = async ({ params, request }) => {
  const tradeId = Number(params.id);
  let profileId: number;

  try {
    const body = await request.json();
    profileId = Number(body.profileId);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid body" }), { status: 400, headers });
  }

  if (!tradeId || tradeId < 1) {
    return new Response(JSON.stringify({ error: "Invalid trade id" }), { status: 400, headers });
  }
  if (!profileId || profileId < 1) {
    return new Response(JSON.stringify({ error: "profileId required" }), { status: 400, headers });
  }

  const db = getDb();
  if (!db) {
    return new Response(JSON.stringify({ error: "Database not configured" }), { status: 503, headers });
  }

  try {
    await expireStaleTrades(db);
    const trade = await findTradeWithProfiles(db, tradeId);
    if (!trade) {
      return new Response(JSON.stringify({ error: "Trade not found" }), { status: 404, headers });
    }
    if (trade.initiatorId !== profileId) {
      return new Response(JSON.stringify({ error: "Only the initiator can cancel this trade" }), {
        status: 403,
        headers,
      });
    }
    if (trade.status !== "pending") {
      return new Response(JSON.stringify({ error: `Trade is already ${trade.status}` }), {
        status: 400,
        headers,
      });
    }

    await db
      .update(tradeRequests)
      .set({ status: "cancelled", resolvedAt: new Date(), reminderPending: false })
      .where(and(eq(tradeRequests.id, tradeId), eq(tradeRequests.status, "pending")));

    return new Response(JSON.stringify({ ok: true }), { headers });
  } catch (err) {
    console.error("[trade-requests cancel] DB error:", err);
    return new Response(JSON.stringify({ error: "Database error" }), { status: 500, headers });
  }
};
