import type { APIRoute } from "astro";
import { and, desc, eq, inArray } from "drizzle-orm";
import { findSectionForSticker } from "../../lib/catalog";
import { getDb } from "../../lib/db";
import { history } from "../../lib/schema";

const headers = { "Content-Type": "application/json" };

type FilterParam = "all" | "owned_on" | "owned_off" | "repeats";

export const GET: APIRoute = async ({ url }) => {
  const profileId = Number(url.searchParams.get("profileId"));
  const filter = (url.searchParams.get("filter") ?? "all") as FilterParam;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 200);

  if (!profileId || profileId < 1) {
    return new Response(JSON.stringify({ error: "profileId required" }), {
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
    let actionFilter: string[] | null = null;
    if (filter === "owned_on") actionFilter = ["owned_on"];
    else if (filter === "owned_off") actionFilter = ["owned_off"];
    else if (filter === "repeats") actionFilter = ["repeat_add", "repeat_remove"];

    const rows = actionFilter
      ? await db
          .select()
          .from(history)
          .where(
            and(
              eq(history.profileId, profileId),
              inArray(history.action, actionFilter as ("owned_on" | "owned_off" | "repeat_add" | "repeat_remove")[]),
            ),
          )
          .orderBy(desc(history.occurredAt))
          .limit(limit)
      : await db
          .select()
          .from(history)
          .where(eq(history.profileId, profileId))
          .orderBy(desc(history.occurredAt))
          .limit(limit);

    const entries = rows.map((row) => {
      const section = findSectionForSticker(row.stickerNumber);
      const sticker = section?.stickers.find((s) => s.number === row.stickerNumber);
      return {
        id: row.id,
        stickerNumber: row.stickerNumber,
        label: sticker?.label ?? "",
        section: section?.name ?? "Unknown",
        sectionSlug: section?.slug ?? "unknown",
        action: row.action,
        oldOwned: row.oldOwned,
        newOwned: row.newOwned,
        oldRepeats: row.oldRepeats,
        newRepeats: row.newRepeats,
        occurredAt: row.occurredAt,
      };
    });

    return new Response(JSON.stringify({ entries }), { headers });
  } catch (err) {
    console.error("[history GET] DB error:", err);
    return new Response(JSON.stringify({ error: "Database error" }), {
      status: 500,
      headers,
    });
  }
};
