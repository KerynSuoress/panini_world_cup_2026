import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { computeExchange } from "../../lib/exchange";
import { getDb } from "../../lib/db";
import { profiles } from "../../lib/schema";
import { getEffectiveCollectionState, loadCollectionState } from "../../lib/trades";

const headers = { "Content-Type": "application/json" };

export const POST: APIRoute = async ({ request }) => {
  let profileId: number;
  let partnerEmail: string;

  try {
    const body = await request.json();
    profileId = Number(body.profileId);
    partnerEmail = String(body.partnerEmail ?? "")
      .toLowerCase()
      .trim();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid body" }), {
      status: 400,
      headers,
    });
  }

  if (!profileId || profileId < 1) {
    return new Response(JSON.stringify({ error: "profileId required" }), {
      status: 400,
      headers,
    });
  }

  if (!partnerEmail || !partnerEmail.includes("@")) {
    return new Response(JSON.stringify({ error: "Valid partner email required" }), {
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
    const [you] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);
    if (!you) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers,
      });
    }

    if (you.email === partnerEmail) {
      return new Response(
        JSON.stringify({ error: "Enter someone else's email, not your own" }),
        { status: 400, headers },
      );
    }

    const [partner] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.email, partnerEmail))
      .limit(1);
    if (!partner) {
      return new Response(
        JSON.stringify({
          error: "No user found with that email. They need to sign in once first.",
        }),
        { status: 404, headers },
      );
    }

    const [yoursEffective, partnerEffective] = await Promise.all([
      getEffectiveCollectionState(db, profileId),
      loadCollectionState(db, partner.id),
    ]);

    if (!yoursEffective || !partnerEffective) {
      return new Response(JSON.stringify({ error: "Could not load collections" }), {
        status: 500,
        headers,
      });
    }

    const { youGive, youGet } = computeExchange(yoursEffective, partnerEffective);

    return new Response(
      JSON.stringify({
        partnerEmail: partner.email,
        youGive,
        youGet,
        summary: {
          youGiveCount: youGive.length,
          youGetCount: youGet.length,
          // Realistic 1-for-1 swaps = the smaller pile.
          // If you have 229 to give but they have 0 to give back, 0 trades
          // can actually happen symmetrically.
          mutualCount: Math.min(youGive.length, youGet.length),
        },
      }),
      { headers },
    );
  } catch (err) {
    console.error("[exchange] DB error:", err);
    return new Response(JSON.stringify({ error: "Database error" }), {
      status: 500,
      headers,
    });
  }
};
