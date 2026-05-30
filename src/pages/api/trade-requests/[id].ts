import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db";
import { expireStaleTrades, findTradeWithProfiles, serializeTrade } from "../../../lib/trades";

const headers = { "Content-Type": "application/json" };

export const GET: APIRoute = async ({ params, url }) => {
  const tradeId = Number(params.id);
  const profileId = Number(url.searchParams.get("profileId"));

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
    if (trade.initiatorId !== profileId && trade.partnerId !== profileId) {
      return new Response(JSON.stringify({ error: "Not authorized for this trade" }), { status: 403, headers });
    }

    return new Response(
      JSON.stringify({
        trade: serializeTrade(
          trade,
          trade.initiatorEmail,
          trade.partnerEmail,
          profileId,
        ),
      }),
      { headers },
    );
  } catch (err) {
    console.error("[trade-requests/id GET] DB error:", err);
    return new Response(JSON.stringify({ error: "Database error" }), { status: 500, headers });
  }
};
