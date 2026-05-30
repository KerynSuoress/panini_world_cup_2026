import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../lib/db";
import {
  executeTrade,
  expireStaleTrades,
  findTradeWithProfiles,
  loadCollectionState,
  TradeValidationError,
} from "../../../../lib/trades";
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
    if (trade.partnerId !== profileId) {
      return new Response(JSON.stringify({ error: "Only the partner can accept this trade" }), {
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

    await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(tradeRequests)
        .where(and(eq(tradeRequests.id, tradeId), eq(tradeRequests.status, "pending")))
        .limit(1);

      if (!locked) throw new Error("Trade is no longer pending");

      await executeTrade(tx, locked);
      await tx
        .update(tradeRequests)
        .set({ status: "accepted", resolvedAt: new Date(), reminderPending: false })
        .where(eq(tradeRequests.id, tradeId));
    });

    const collection = await loadCollectionState(db, profileId);

    return new Response(
      JSON.stringify({
        ok: true,
        gave: trade.initiatorGets.length,
        got: trade.initiatorGives.length,
        collection,
      }),
      { headers },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Accept failed";
    console.error("[trade-requests accept] error:", err);
    const status = err instanceof TradeValidationError ? 400 : 500;
    return new Response(JSON.stringify({ error: message }), { status, headers });
  }
};
