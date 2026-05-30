import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { getDb } from "../../lib/db";
import { profiles } from "../../lib/schema";
import {
  buildTradeSummary,
  expireStaleTrades,
  listTradesForProfile,
  tradeExpiresAt,
  validateInitiatorCanCreate,
} from "../../lib/trades";
import { tradeRequests } from "../../lib/schema";

const headers = { "Content-Type": "application/json" };

export const GET: APIRoute = async ({ url }) => {
  const profileId = Number(url.searchParams.get("profileId"));
  if (!profileId || profileId < 1) {
    return new Response(JSON.stringify({ error: "profileId required" }), { status: 400, headers });
  }

  const db = getDb();
  if (!db) {
    return new Response(JSON.stringify({ error: "Database not configured" }), { status: 503, headers });
  }

  try {
    await expireStaleTrades(db);
    const data = await listTradesForProfile(db, profileId);
    return new Response(JSON.stringify(data), { headers });
  } catch (err) {
    console.error("[trade-requests GET] DB error:", err);
    return new Response(JSON.stringify({ error: "Database error" }), { status: 500, headers });
  }
};

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

  const db = getDb();
  if (!db) {
    return new Response(JSON.stringify({ error: "Database not configured" }), { status: 503, headers });
  }

  try {
    await expireStaleTrades(db);

    const [[user], [partner]] = await Promise.all([
      db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1),
      db.select().from(profiles).where(eq(profiles.email, partnerEmail)).limit(1),
    ]);

    if (!user) {
      return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404, headers });
    }
    if (!partner) {
      return new Response(
        JSON.stringify({ error: "No user found with that email. They need to sign in once first." }),
        { status: 404, headers },
      );
    }
    if (user.id === partner.id) {
      return new Response(JSON.stringify({ error: "Enter someone else's email, not your own" }), {
        status: 400,
        headers,
      });
    }

    const validationError = await validateInitiatorCanCreate(db, user.id, partner.id, iGive, iGet);
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), { status: 400, headers });
    }

    const summaryJson = buildTradeSummary(iGive, iGet, user.email, partner.email);
    const expiresAt = tradeExpiresAt();

    const [insertResult] = await db.insert(tradeRequests).values({
      initiatorId: user.id,
      partnerId: partner.id,
      status: "pending",
      initiatorGives: iGive,
      initiatorGets: iGet,
      summaryJson,
      reminderPending: false,
      expiresAt,
    });

    const tradeId = Number(insertResult.insertId);

    return new Response(
      JSON.stringify({
        ok: true,
        tradeId,
        expiresAt,
        summary: summaryJson,
      }),
      { headers },
    );
  } catch (err) {
    console.error("[trade-requests POST] DB error:", err);
    return new Response(JSON.stringify({ error: "Database error" }), { status: 500, headers });
  }
};
