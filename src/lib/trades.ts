import { and, eq, inArray, lt, or } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { findSectionForSticker } from "./catalog";
import type * as schema from "./schema";
import { collection, profiles, tradeRequests } from "./schema";
import type { CollectionState, TradeSummary, TradeSummarySticker } from "./types";

/**
 * AUTHORIZATION MODEL — accepted risk for v1.
 *
 * This app has no real auth: identity is the integer `profileId` from
 * localStorage, sent in each request body (same trust model as every other
 * route, e.g. /api/collection, /api/stickers). The trade endpoints only check
 * that the supplied profileId matches the trade's initiator/partner — they do
 * NOT verify the caller actually owns that profileId, because the server has no
 * session/token to verify against.
 *
 * Consequence: someone who knows another user's profileId could act on their
 * behalf. We accept this for a small, invite-by-email hobby app. Hardening this
 * properly requires introducing real sessions/tokens across the whole app,
 * which is intentionally out of scope here. If the user base grows, add a
 * signed session cookie and derive profileId from it instead of the body.
 */

// Accept either a top-level db handle or the transaction object Drizzle passes
// into db.transaction(tx => ...). Deriving the tx type from the db keeps this
// correct across drizzle-orm versions without guessing internal generics.
type DrizzleDb = MySql2Database<typeof schema>;
type DrizzleTx = Parameters<Parameters<DrizzleDb["transaction"]>[0]>[0];
type Db = DrizzleDb | DrizzleTx;

export type { TradeSummary, TradeSummarySticker };

export class TradeValidationError extends Error {
  readonly code = "TRADE_VALIDATION";
  constructor(message: string) {
    super(message);
    this.name = "TradeValidationError";
  }
}

export function tradeExpiresAt(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + TRADE_EXPIRY_DAYS);
  return d;
}

function stickerMeta(number: string): Omit<TradeSummarySticker, "quantity"> {
  const section = findSectionForSticker(number);
  return {
    number,
    label: section?.stickers.find((s) => s.number === number)?.label,
    section: section?.name ?? "Unknown",
    sectionSlug: section?.slug ?? "unknown",
  };
}

export function buildStickerList(numbers: string[]): TradeSummarySticker[] {
  return numbers.map((number) => ({ ...stickerMeta(number), quantity: 1 }));
}

export function buildTradeSummary(
  initiatorGives: string[],
  initiatorGets: string[],
  initiatorEmail: string,
  partnerEmail: string,
): TradeSummary {
  const youGive = buildStickerList(initiatorGives);
  const youGet = buildStickerList(initiatorGets);
  return {
    initiatorEmail,
    partnerEmail,
    youGive,
    youGet,
    giveCount: youGive.length,
    getCount: youGet.length,
  };
}

export async function expireStaleTrades(db: Db): Promise<number> {
  const now = new Date();
  const result = await db
    .update(tradeRequests)
    .set({ status: "expired", resolvedAt: now })
    .where(and(eq(tradeRequests.status, "pending"), lt(tradeRequests.expiresAt, now)));
  return result[0]?.affectedRows ?? 0;
}

export async function getReservedRepeats(
  db: Db,
  profileId: number,
): Promise<Record<string, number>> {
  const pending = await db
    .select({ initiatorGives: tradeRequests.initiatorGives })
    .from(tradeRequests)
    .where(and(eq(tradeRequests.initiatorId, profileId), eq(tradeRequests.status, "pending")));

  const reserved: Record<string, number> = {};
  for (const row of pending) {
    for (const num of row.initiatorGives) {
      reserved[num] = (reserved[num] ?? 0) + 1;
    }
  }
  return reserved;
}

export function applyReservations(
  repeats: Record<string, number>,
  reserved: Record<string, number>,
): Record<string, number> {
  const effective: Record<string, number> = { ...repeats };
  for (const [num, count] of Object.entries(reserved)) {
    const current = effective[num] ?? 0;
    effective[num] = Math.max(0, current - count);
    if (effective[num] === 0) delete effective[num];
  }
  return effective;
}

export async function loadCollectionState(
  db: Db,
  profileId: number,
): Promise<CollectionState> {
  const rows = await db
    .select()
    .from(collection)
    .where(eq(collection.profileId, profileId));

  const owned: Record<string, boolean> = {};
  const repeats: Record<string, number> = {};
  for (const row of rows) {
    if (row.owned) owned[row.stickerNumber] = true;
    if (row.repeats > 0) repeats[row.stickerNumber] = row.repeats;
  }
  return { owned, repeats };
}

export async function getEffectiveCollectionState(
  db: Db,
  profileId: number,
): Promise<CollectionState> {
  const [state, reserved] = await Promise.all([
    loadCollectionState(db, profileId),
    getReservedRepeats(db, profileId),
  ]);
  return {
    owned: state.owned,
    repeats: applyReservations(state.repeats, reserved),
  };
}

async function loadProfileStates(
  db: Db,
  profileId: number,
  stickerNumbers: string[],
  forUpdate = false,
): Promise<Record<string, { owned: boolean; repeats: number }>> {
  if (stickerNumbers.length === 0) return {};
  const base = db
    .select()
    .from(collection)
    .where(and(eq(collection.profileId, profileId), inArray(collection.stickerNumber, stickerNumbers)));
  // FOR UPDATE locks the matched rows for the duration of the transaction so
  // two concurrent accepts can't both read the same repeat and double-decrement.
  const rows = await (forUpdate ? base.for("update") : base);

  const state: Record<string, { owned: boolean; repeats: number }> = {};
  for (const r of rows) state[r.stickerNumber] = { owned: r.owned, repeats: r.repeats };
  return state;
}

export interface TradeRow {
  id: number;
  initiatorId: number;
  partnerId: number;
  status: string;
  initiatorGives: string[];
  initiatorGets: string[];
  summaryJson: TradeSummary;
  reminderPending: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
  expiresAt: Date;
  resolvedAt: Date | null;
}

export async function executeTrade(
  db: Db,
  trade: Pick<TradeRow, "initiatorId" | "partnerId" | "initiatorGives" | "initiatorGets">,
  { lockRows = true }: { lockRows?: boolean } = {},
): Promise<void> {
  const { initiatorId, partnerId, initiatorGives, initiatorGets } = trade;
  const allNums = [...new Set([...initiatorGives, ...initiatorGets])];

  // Sequential (not Promise.all): these run on a single transaction connection,
  // and FOR UPDATE locks must be acquired in order without overlapping queries.
  const initiatorState = await loadProfileStates(db, initiatorId, allNums, lockRows);
  const partnerState = await loadProfileStates(db, partnerId, allNums, lockRows);

  for (const num of initiatorGives) {
    if ((initiatorState[num]?.repeats ?? 0) < 1) {
      throw new TradeValidationError(`Initiator no longer has a spare copy of ${num}`);
    }
  }
  for (const num of initiatorGets) {
    if ((partnerState[num]?.repeats ?? 0) < 1) {
      throw new TradeValidationError(`Partner no longer has a spare copy of ${num}`);
    }
  }

  const upserts: {
    profileId: number;
    stickerNumber: string;
    owned: boolean;
    repeats: number;
  }[] = [];
  const seen = new Set<string>();

  // Initiator gives → repeats--
  for (const num of initiatorGives) {
    if (seen.has(`i:${num}`)) continue;
    seen.add(`i:${num}`);
    const cur = initiatorState[num] ?? { owned: false, repeats: 0 };
    upserts.push({
      profileId: initiatorId,
      stickerNumber: num,
      owned: cur.owned,
      repeats: Math.max(0, cur.repeats - 1),
    });
  }

  // Initiator gets → owned = true
  for (const num of initiatorGets) {
    if (seen.has(`ig:${num}`)) continue;
    seen.add(`ig:${num}`);
    const cur = initiatorState[num] ?? { owned: false, repeats: 0 };
    upserts.push({
      profileId: initiatorId,
      stickerNumber: num,
      owned: true,
      repeats: cur.repeats,
    });
  }

  // Partner receives initiator gives → owned = true
  for (const num of initiatorGives) {
    if (seen.has(`p:${num}`)) continue;
    seen.add(`p:${num}`);
    const cur = partnerState[num] ?? { owned: false, repeats: 0 };
    upserts.push({
      profileId: partnerId,
      stickerNumber: num,
      owned: true,
      repeats: cur.repeats,
    });
  }

  // Partner gives initiator gets → repeats--
  for (const num of initiatorGets) {
    if (seen.has(`pg:${num}`)) continue;
    seen.add(`pg:${num}`);
    const cur = partnerState[num] ?? { owned: false, repeats: 0 };
    upserts.push({
      profileId: partnerId,
      stickerNumber: num,
      owned: cur.owned,
      repeats: Math.max(0, cur.repeats - 1),
    });
  }

  if (upserts.length === 0) return;

  await db
    .insert(collection)
    .values(upserts)
    .onDuplicateKeyUpdate({
      set: { owned: sql`VALUES(owned)`, repeats: sql`VALUES(repeats)` },
    });
}

export async function validateInitiatorCanCreate(
  db: Db,
  initiatorId: number,
  partnerId: number,
  initiatorGives: string[],
  initiatorGets: string[],
): Promise<string | null> {
  if (initiatorGives.length === 0 && initiatorGets.length === 0) {
    return "Select at least one sticker";
  }

  const reserved = await getReservedRepeats(db, initiatorId);
  const state = await loadCollectionState(db, initiatorId);

  for (const num of initiatorGives) {
    const available = (state.repeats[num] ?? 0) - (reserved[num] ?? 0);
    if (available < 1) {
      if ((reserved[num] ?? 0) > 0) {
        return `${num} is already reserved in another pending trade`;
      }
      return `You don't have a spare copy of ${num}`;
    }
  }

  // Block overlapping pending outgoing trades on same sticker
  const pending = await db
    .select({ initiatorGives: tradeRequests.initiatorGives })
    .from(tradeRequests)
    .where(
      and(
        eq(tradeRequests.initiatorId, initiatorId),
        eq(tradeRequests.partnerId, partnerId),
        eq(tradeRequests.status, "pending"),
      ),
    );

  for (const row of pending) {
    const overlap = initiatorGives.some((n) => row.initiatorGives.includes(n));
    if (overlap) {
      return "You already have a pending trade with this partner involving one of these stickers";
    }
  }

  if (initiatorGets.length > 0) {
    const partnerRows = await db
      .select()
      .from(collection)
      .where(
        and(eq(collection.profileId, partnerId), inArray(collection.stickerNumber, initiatorGets)),
      );
    const partnerRepeats: Record<string, number> = {};
    for (const r of partnerRows) partnerRepeats[r.stickerNumber] = r.repeats;
    for (const num of initiatorGets) {
      if ((partnerRepeats[num] ?? 0) < 1) {
        const [partner] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.id, partnerId))
          .limit(1);
        const name = partner?.email.split("@")[0] ?? "Partner";
        return `${name} doesn't have a spare copy of ${num}`;
      }
    }
  }

  return null;
}

export function serializeTrade(
  row: typeof tradeRequests.$inferSelect,
  initiatorEmail: string,
  partnerEmail: string,
  viewerProfileId: number,
) {
  const isIncoming = row.partnerId === viewerProfileId;
  return {
    id: row.id,
    status: row.status,
    direction: isIncoming ? ("incoming" as const) : ("outgoing" as const),
    initiatorEmail,
    partnerEmail,
    summary: row.summaryJson,
    reminderPending: row.reminderPending,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    resolvedAt: row.resolvedAt,
    giveCount: row.summaryJson.giveCount,
    getCount: row.summaryJson.getCount,
  };
}

export async function findTradeWithProfiles(
  db: Db,
  tradeId: number,
): Promise<
  | (typeof tradeRequests.$inferSelect & {
      initiatorEmail: string;
      partnerEmail: string;
    })
  | null
> {
  const [row] = await db
    .select()
    .from(tradeRequests)
    .where(eq(tradeRequests.id, tradeId))
    .limit(1);
  if (!row) return null;

  const [[initiator], [partner]] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.id, row.initiatorId)).limit(1),
    db.select().from(profiles).where(eq(profiles.id, row.partnerId)).limit(1),
  ]);
  if (!initiator || !partner) return null;

  return {
    ...row,
    initiatorEmail: initiator.email,
    partnerEmail: partner.email,
  };
}

export async function listTradesForProfile(db: Db, profileId: number) {
  const rows = await db
    .select()
    .from(tradeRequests)
    .where(
      or(eq(tradeRequests.initiatorId, profileId), eq(tradeRequests.partnerId, profileId)),
    );

  const profileIds = new Set<number>();
  for (const r of rows) {
    profileIds.add(r.initiatorId);
    profileIds.add(r.partnerId);
  }

  const profileRows =
    profileIds.size > 0
      ? await db
          .select()
          .from(profiles)
          .where(inArray(profiles.id, [...profileIds]))
      : [];

  const emailById = new Map(profileRows.map((p) => [p.id, p.email]));

  const pending = rows.filter((r) => r.status === "pending");
  const recent = rows
    .filter((r) => r.status !== "pending")
    .sort((a, b) => {
      const aTime = a.resolvedAt?.getTime() ?? a.updatedAt?.getTime() ?? 0;
      const bTime = b.resolvedAt?.getTime() ?? b.updatedAt?.getTime() ?? 0;
      return bTime - aTime;
    })
    .slice(0, 10);

  const mapRow = (r: typeof tradeRequests.$inferSelect) =>
    serializeTrade(
      r,
      emailById.get(r.initiatorId) ?? "",
      emailById.get(r.partnerId) ?? "",
      profileId,
    );

  const incoming = pending.filter((r) => r.partnerId === profileId).map(mapRow);
  const outgoing = pending.filter((r) => r.initiatorId === profileId).map(mapRow);
  const incomingReminders = incoming.filter((t) => t.reminderPending).length;

  return {
    incoming,
    outgoing,
    recent: recent.map(mapRow),
    counts: {
      incomingPending: incoming.length,
      outgoingPending: outgoing.length,
      incomingReminders,
    },
  };
}
