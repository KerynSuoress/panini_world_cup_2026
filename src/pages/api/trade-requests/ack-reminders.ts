import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../lib/db";
import { expireStaleTrades } from "../../lib/trades";
import { tradeRequests } from "../../lib/schema";

const headers = { "Content-Type": "application/json" };

export const POST: APIRoute = async ({ request }) => {
  let profileId: number;

  try {
    const body = await request.json();
    profileId = Number(body.profileId);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid body" }), { status: 400, headers });
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
    await db
      .update(tradeRequests)
      .set({ reminderPending: false })
      .where(
        and(eq(tradeRequests.partnerId, profileId), eq(tradeRequests.status, "pending")),
      );

    return new Response(JSON.stringify({ ok: true }), { headers });
  } catch (err) {
    console.error("[trade-requests ack-reminders] DB error:", err);
    return new Response(JSON.stringify({ error: "Database error" }), { status: 500, headers });
  }
};
