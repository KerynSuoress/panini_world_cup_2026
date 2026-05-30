import { useStore } from "@nanostores/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  groupExchangeBySection,
  formatExchangeShareText,
  formatExchangeCsv,
  downloadTextFile,
  type ExchangeSticker,
} from "../lib/exchange";
import { catalog } from "../lib/catalog";
import type { TradeSummary } from "../lib/types";
import { $session } from "../store/profileStore";
import { reloadCollection } from "../store/persistence";

type SubTab = "give" | "get" | "match" | "trades";

interface ExchangeResponse {
  partnerEmail: string;
  youGive: ExchangeSticker[];
  youGet: ExchangeSticker[];
  summary: {
    youGiveCount: number;
    youGetCount: number;
    mutualCount: number;
  };
}

interface TradeListItem {
  id: number;
  status: string;
  direction: "incoming" | "outgoing";
  initiatorEmail: string;
  partnerEmail: string;
  summary: TradeSummary;
  reminderPending: boolean;
  createdAt: string | null;
  expiresAt: string;
  resolvedAt: string | null;
  giveCount: number;
  getCount: number;
}

interface TradesResponse {
  incoming: TradeListItem[];
  outgoing: TradeListItem[];
  recent: TradeListItem[];
  counts: {
    incomingPending: number;
    outgoingPending: number;
    incomingReminders: number;
  };
}

const PARTNER_EMAIL_KEY = "panini-exchange-partner";
const POPUP_DISMISSED_KEY = "panini-trade-popup-dismissed";

function sectionColor(slug: string): string {
  return (
    catalog.sections.find((s) => s.slug === slug)?.colors?.primary ?? "#1B3FA0"
  );
}

function formatAge(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function filterSelected(stickers: ExchangeSticker[], selected: Set<string>): ExchangeSticker[] {
  return stickers.filter((s) => selected.has(s.number)).map((s) => ({ ...s, quantity: 1 }));
}

// ─── Sticker chip used in SwapStudio ────────────────────────────────────────

function StickerChip({
  sticker,
  selected,
  onToggle,
}: {
  sticker: ExchangeSticker;
  selected: boolean;
  onToggle: (num: string) => void;
}) {
  const dot = sectionColor(sticker.sectionSlug);
  return (
    <button
      type="button"
      onClick={() => onToggle(sticker.number)}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-all active:scale-95 ${
        selected
          ? "bg-[var(--color-primary)] text-white shadow-md"
          : "bg-white/80 text-gray-700 shadow-sm ring-1 ring-black/5 hover:bg-white"
      }`}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: dot }}
      />
      {sticker.number}
      {selected && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}

// ─── Trade review summary ─────────────────────────────────────────────────────

function TradeReviewSummary({
  partnerName,
  youGive,
  youGet,
}: {
  partnerName: string;
  youGive: ExchangeSticker[];
  youGet: ExchangeSticker[];
}) {
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-3xl shadow-lg ring-1 ring-white/60">
        <div className="grid grid-cols-2 divide-x divide-black/5">
          <div className="bg-white/70 p-3">
            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-[var(--color-accent-green)]">
              You give ({youGive.length})
            </p>
            {youGive.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Nothing</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {youGive.map((s) => (
                  <span
                    key={s.number}
                    className="rounded-lg bg-[var(--color-accent-green)]/15 px-2 py-1 text-[11px] font-bold text-gray-800"
                  >
                    {s.number}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white/70 p-3">
            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#b45309]">
              You receive ({youGet.length})
            </p>
            {youGet.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Nothing</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {youGet.map((s) => (
                  <span
                    key={s.number}
                    className="rounded-lg bg-[var(--color-accent-yellow)]/40 px-2 py-1 text-[11px] font-bold text-yellow-900"
                  >
                    {s.number}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl shadow-lg ring-1 ring-white/60">
        <div className="grid grid-cols-2 divide-x divide-black/5">
          <div className="bg-white/50 p-3">
            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-500">
              {partnerName} receives ({youGive.length})
            </p>
            <p className="text-xs text-gray-600">
              Same stickers you are giving — added to their album on accept.
            </p>
          </div>
          <div className="bg-white/50 p-3">
            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-500">
              {partnerName} gives ({youGet.length})
            </p>
            <p className="text-xs text-gray-600">
              They must approve before these move to your album.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Swap Studio (match tab) ─────────────────────────────────────────────────

type SwapStage = "select" | "review" | "sent";

function SwapStudio({
  youGive,
  youGet,
  profileId,
  partnerEmail,
  partnerName,
  onTradeSent,
  onStageChange,
}: {
  youGive: ExchangeSticker[];
  youGet: ExchangeSticker[];
  profileId: number;
  partnerEmail: string;
  partnerName: string;
  onTradeSent: () => void;
  onStageChange?: (stage: SwapStage) => void;
}) {
  const [selectedGive, setSelectedGive] = useState<Set<string>>(new Set());
  const [selectedGet, setSelectedGet] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<"select" | "review">("select");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendDone, setSendDone] = useState(false);

  useEffect(() => {
    onStageChange?.(sendDone ? "sent" : step);
  }, [step, sendDone, onStageChange]);

  const toggleGive = (num: string) => {
    setSendDone(false);
    setSelectedGive((prev) => {
      const next = new Set(prev);
      next.has(num) ? next.delete(num) : next.add(num);
      return next;
    });
  };

  const toggleGet = (num: string) => {
    setSendDone(false);
    setSelectedGet((prev) => {
      const next = new Set(prev);
      next.has(num) ? next.delete(num) : next.add(num);
      return next;
    });
  };

  const reviewGive = useMemo(
    () => filterSelected(youGive, selectedGive),
    [youGive, selectedGive],
  );
  const reviewGet = useMemo(
    () => filterSelected(youGet, selectedGet),
    [youGet, selectedGet],
  );

  const sendForApproval = async () => {
    if (selectedGive.size === 0 && selectedGet.size === 0) return;
    setSending(true);
    setSendError(null);
    setSendDone(false);

    try {
      const res = await fetch("/api/trade-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          partnerEmail,
          iGive: [...selectedGive],
          iGet: [...selectedGet],
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSendError(data.error ?? "Could not send trade request.");
        return;
      }

      setSendDone(true);
      setSelectedGive(new Set());
      setSelectedGet(new Set());
      setStep("select");
      onTradeSent();
    } catch {
      setSendError("Could not connect. Try again.");
    } finally {
      setSending(false);
    }
  };

  const hasSelection = selectedGive.size > 0 || selectedGet.size > 0;

  if (step === "review") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-bold text-gray-800">Review before sending</p>
        <TradeReviewSummary
          partnerName={partnerName}
          youGive={reviewGive}
          youGet={reviewGet}
        />
        <p className="text-xs text-gray-500">
          Your repeats will be reserved until {partnerName} accepts, declines, or the
          request expires in 3 days.
        </p>

        {sendError && (
          <p className="rounded-2xl bg-[var(--color-accent-red)]/10 px-4 py-3 text-sm font-medium text-[var(--color-accent-red)] ring-1 ring-[var(--color-accent-red)]/20">
            {sendError}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setStep("select")}
            disabled={sending}
            className="rounded-2xl bg-white/70 py-3 text-sm font-bold text-gray-700 ring-1 ring-black/5 transition-all active:scale-[0.98] disabled:opacity-60"
          >
            Back
          </button>
          <button
            type="button"
            onClick={sendForApproval}
            disabled={sending}
            className="rounded-2xl bg-[var(--color-primary)] py-3 text-sm font-black text-white shadow-xl ring-2 ring-[var(--color-primary)]/20 transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send for approval"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-3xl shadow-lg ring-1 ring-white/60">
        <div className="grid grid-cols-2 divide-x divide-black/5">
          <div className="bg-white/70 p-3">
            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-[var(--color-accent-green)]">
              I can give you
              {selectedGive.size > 0 && (
                <span className="ml-1 text-[var(--color-primary)]">
                  · {selectedGive.size} selected
                </span>
              )}
            </p>
            {youGive.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Nothing to give</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {youGive.map((s) => (
                  <StickerChip
                    key={s.number}
                    sticker={s}
                    selected={selectedGive.has(s.number)}
                    onToggle={toggleGive}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="bg-white/70 p-3">
            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#b45309]">
              {partnerName} can give me
              {selectedGet.size > 0 && (
                <span className="ml-1 text-[var(--color-primary)]">
                  · {selectedGet.size} selected
                </span>
              )}
            </p>
            {youGet.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Nothing to give</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {youGet.map((s) => (
                  <StickerChip
                    key={s.number}
                    sticker={s}
                    selected={selectedGet.has(s.number)}
                    onToggle={toggleGet}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {sendError && (
        <p className="rounded-2xl bg-[var(--color-accent-red)]/10 px-4 py-3 text-sm font-medium text-[var(--color-accent-red)] ring-1 ring-[var(--color-accent-red)]/20">
          {sendError}
        </p>
      )}

      {sendDone && (
        <p className="rounded-2xl bg-[var(--color-accent-green)]/15 px-4 py-3 text-sm font-semibold text-[var(--color-accent-green)] ring-1 ring-[var(--color-accent-green)]/25">
          ✓ Sent to {partnerName} for approval. Your stickers are reserved until they
          respond.
        </p>
      )}

      {hasSelection && (
        <button
          type="button"
          onClick={() => setStep("review")}
          className="w-full rounded-2xl bg-[var(--color-primary)] py-4 text-base font-black text-white shadow-xl ring-2 ring-[var(--color-primary)]/20 transition-all active:scale-[0.98]"
        >
          Review swap {selectedGive.size} ↔ {selectedGet.size}
        </button>
      )}

      {!hasSelection && (
        <p className="text-center text-xs text-gray-400">
          Tap stickers from either side to build your swap, then review and send.
        </p>
      )}
    </div>
  );
}

// ─── Full list (give / get tabs) ─────────────────────────────────────────────

function ExchangeList({
  stickers,
  emptyMessage,
  badgeLabel,
}: {
  stickers: ExchangeSticker[];
  emptyMessage: string;
  badgeLabel: (quantity: number) => string;
}) {
  const grouped = useMemo(() => groupExchangeBySection(stickers), [stickers]);

  if (stickers.length === 0) {
    return (
      <p className="rounded-2xl bg-white/50 px-4 py-8 text-center text-sm text-gray-500 ring-1 ring-white/60">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map(({ name, slug, stickers: sectionStickers }) => {
        const primary = sectionColor(slug);
        return (
          <section
            key={slug}
            className="overflow-hidden rounded-3xl bg-white/50 shadow-lg ring-1 ring-white/60"
          >
            <header
              className="flex items-center justify-between px-4 py-3 text-white"
              style={{ background: `linear-gradient(135deg, ${primary}cc, #11111155)` }}
            >
              <h3 className="font-bold">{name}</h3>
              <span className="rounded-full bg-white/30 px-2 py-0.5 text-xs font-bold shadow-sm">
                {sectionStickers.length}
              </span>
            </header>
            <ul className="divide-y divide-black/5">
              {sectionStickers.map((sticker) => (
                <li
                  key={sticker.number}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">
                      {sticker.number}
                    </p>
                    {sticker.label && (
                      <p className="truncate text-xs text-gray-500">{sticker.label}</p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--color-accent-yellow)]/80 px-2.5 py-0.5 text-xs font-bold text-yellow-900">
                    {badgeLabel(sticker.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// ─── Trades panel ────────────────────────────────────────────────────────────

function TradeDetailPanel({
  trade,
  profileId,
  onAction,
}: {
  trade: TradeListItem;
  profileId: number;
  onAction: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionDone, setActionDone] = useState<string | null>(null);

  const otherEmail =
    trade.direction === "incoming" ? trade.initiatorEmail : trade.partnerEmail;
  const otherName = otherEmail.split("@")[0] ?? "them";

  const runAction = async (path: string, successMsg: string) => {
    setLoading(true);
    setActionError(null);
    setActionDone(null);
    try {
      const res = await fetch(`/api/trade-requests/${trade.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Action failed.");
        return;
      }
      setActionDone(successMsg);
      onAction();
    } catch {
      setActionError("Could not connect. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const youGive =
    trade.direction === "incoming"
      ? trade.summary.youGet.map((s) => ({ ...s, quantity: 1 }))
      : trade.summary.youGive.map((s) => ({ ...s, quantity: 1 }));
  const youGet =
    trade.direction === "incoming"
      ? trade.summary.youGive.map((s) => ({ ...s, quantity: 1 }))
      : trade.summary.youGet.map((s) => ({ ...s, quantity: 1 }));

  return (
    <div className="mt-3 space-y-3 rounded-3xl bg-white/60 p-4 ring-1 ring-white/60">
      <TradeReviewSummary partnerName={otherName} youGive={youGive} youGet={youGet} />

      {trade.direction === "outgoing" && (
        <p className="text-xs text-gray-500">
          {trade.giveCount} sticker{trade.giveCount !== 1 ? "s" : ""} reserved until they
          respond · expires {new Date(trade.expiresAt).toLocaleDateString()}
        </p>
      )}

      {actionError && (
        <p className="rounded-2xl bg-[var(--color-accent-red)]/10 px-4 py-3 text-sm font-medium text-[var(--color-accent-red)] ring-1 ring-[var(--color-accent-red)]/20">
          {actionError}
        </p>
      )}
      {actionDone && (
        <p className="rounded-2xl bg-[var(--color-accent-green)]/15 px-4 py-3 text-sm font-semibold text-[var(--color-accent-green)] ring-1 ring-[var(--color-accent-green)]/25">
          {actionDone}
        </p>
      )}

      {trade.direction === "incoming" && trade.status === "pending" && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => runAction("decline", "Trade declined.")}
            className="rounded-2xl bg-[var(--color-accent-red)]/10 py-3 text-sm font-bold text-[var(--color-accent-red)] ring-1 ring-[var(--color-accent-red)]/20 disabled:opacity-60"
          >
            Decline
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => runAction("accept", "Trade accepted! Albums updated.")}
            className="rounded-2xl bg-[var(--color-accent-green)] py-3 text-sm font-black text-white shadow-md disabled:opacity-60"
          >
            {loading ? "Accepting…" : "Accept"}
          </button>
        </div>
      )}

      {trade.direction === "outgoing" && trade.status === "pending" && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => runAction("cancel", "Trade cancelled. Stickers released.")}
            className="rounded-2xl bg-white/70 py-3 text-sm font-bold text-gray-700 ring-1 ring-black/5 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => runAction("remind", "Reminder sent — they'll see a popup.")}
            className="rounded-2xl bg-[var(--color-accent-teal)]/20 py-3 text-sm font-bold text-teal-800 ring-1 ring-[var(--color-accent-teal)]/30 disabled:opacity-60"
          >
            Remind
          </button>
        </div>
      )}
    </div>
  );
}

function TradeRow({
  trade,
  selected,
  onSelect,
}: {
  trade: TradeListItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const otherEmail =
    trade.direction === "incoming" ? trade.initiatorEmail : trade.partnerEmail;
  const otherName = otherEmail.split("@")[0] ?? "them";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl px-4 py-3 text-left transition-all ring-1 ${
        selected
          ? "bg-[var(--color-primary)]/10 ring-[var(--color-primary)]/30"
          : "bg-white/50 ring-white/60 hover:bg-white/70"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-gray-900">{otherName}</p>
          <p className="text-xs text-gray-500">
            Give {trade.direction === "outgoing" ? trade.giveCount : trade.getCount} · Get{" "}
            {trade.direction === "outgoing" ? trade.getCount : trade.giveCount} ·{" "}
            {formatAge(trade.createdAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {trade.reminderPending && trade.direction === "incoming" && (
            <span className="rounded-full bg-[var(--color-accent-teal)]/20 px-2 py-0.5 text-[10px] font-bold text-teal-800">
              Reminder
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
              trade.status === "pending"
                ? "bg-[var(--color-accent-yellow)]/40 text-yellow-900"
                : "bg-gray-200 text-gray-600"
            }`}
          >
            {trade.status}
          </span>
        </div>
      </div>
    </button>
  );
}

function TradesPanel({
  profileId,
  refreshKey,
  selectedTradeId,
  onSelectTrade,
  onTradesLoaded,
  onTradeUpdated,
}: {
  profileId: number;
  refreshKey: number;
  selectedTradeId: number | null;
  onSelectTrade: (id: number | null) => void;
  onTradesLoaded: (data: TradesResponse) => void;
  onTradeUpdated: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TradesResponse | null>(null);

  const loadTrades = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trade-requests?profileId=${profileId}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not load trades.");
        return;
      }
      setData(json as TradesResponse);
      onTradesLoaded(json as TradesResponse);
      await reloadCollection(profileId);
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      setLoading(false);
    }
  }, [profileId, onTradesLoaded]);

  useEffect(() => {
    loadTrades();
  }, [loadTrades, refreshKey]);

  const selectedTrade = useMemo(() => {
    if (!data || selectedTradeId == null) return null;
    return (
      [...data.incoming, ...data.outgoing, ...data.recent].find((t) => t.id === selectedTradeId) ??
      null
    );
  }, [data, selectedTradeId]);

  if (loading) {
    return <p className="text-center text-sm text-gray-400">Loading trades…</p>;
  }
  if (error) {
    return (
      <p className="rounded-2xl bg-[var(--color-accent-red)]/10 px-4 py-3 text-sm font-medium text-[var(--color-accent-red)] ring-1 ring-[var(--color-accent-red)]/20">
        {error}
      </p>
    );
  }
  if (!data) return null;

  const pendingCount = data.incoming.length + data.outgoing.length;

  if (pendingCount === 0 && data.recent.length === 0) {
    return (
      <p className="rounded-2xl bg-white/50 px-4 py-8 text-center text-sm text-gray-500 ring-1 ring-white/60">
        No trade requests yet. Build a swap and send it for approval.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {data.incoming.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-[var(--color-accent-teal)]">
            Needs your OK ({data.incoming.length})
          </h3>
          {data.incoming.map((trade) => (
            <div key={trade.id}>
              <TradeRow
                trade={trade}
                selected={selectedTradeId === trade.id}
                onSelect={() =>
                  onSelectTrade(selectedTradeId === trade.id ? null : trade.id)
                }
              />
              {selectedTradeId === trade.id && selectedTrade && (
                <TradeDetailPanel
                  trade={selectedTrade}
                  profileId={profileId}
                  onAction={() => {
                    loadTrades();
                    onTradeUpdated();
                  }}
                />
              )}
            </div>
          ))}
        </section>
      )}

      {data.outgoing.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-[var(--color-primary)]">
            Waiting for them ({data.outgoing.length})
          </h3>
          {data.outgoing.map((trade) => (
            <div key={trade.id}>
              <TradeRow
                trade={trade}
                selected={selectedTradeId === trade.id}
                onSelect={() =>
                  onSelectTrade(selectedTradeId === trade.id ? null : trade.id)
                }
              />
              {selectedTradeId === trade.id && selectedTrade && (
                <TradeDetailPanel
                  trade={selectedTrade}
                  profileId={profileId}
                  onAction={() => {
                    loadTrades();
                    onTradeUpdated();
                  }}
                />
              )}
            </div>
          ))}
        </section>
      )}

      {data.recent.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-500">
            Recent
          </h3>
          {data.recent.map((trade) => (
            <TradeRow
              key={trade.id}
              trade={trade}
              selected={false}
              onSelect={() => onSelectTrade(trade.id)}
            />
          ))}
        </section>
      )}
    </div>
  );
}

// ─── Partner popup ───────────────────────────────────────────────────────────

function TradeRequestPopup({
  trade,
  onView,
  onLater,
}: {
  trade: TradeListItem;
  onView: () => void;
  onLater: () => void;
}) {
  const name = trade.initiatorEmail.split("@")[0] ?? "Someone";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-3xl bg-white/95 p-5 shadow-2xl ring-1 ring-white/60 backdrop-blur-xl">
        <p className="text-sm font-medium text-[var(--color-accent-teal)]">Trade request</p>
        <p className="mt-2 text-lg font-black text-gray-900">
          {name} sent you a trade
          {trade.reminderPending ? " (reminder)" : ""}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          They want to give you {trade.giveCount} sticker
          {trade.giveCount !== 1 ? "s" : ""} and receive {trade.getCount}.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onLater}
            className="rounded-2xl bg-white/70 py-3 text-sm font-bold text-gray-700 ring-1 ring-black/5"
          >
            Later
          </button>
          <button
            type="button"
            onClick={onView}
            className="rounded-2xl bg-[var(--color-primary)] py-3 text-sm font-black text-white shadow-md"
          >
            View trade
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Exchange() {
  const session = useStore($session);
  const [partnerEmail, setPartnerEmail] = useState("");
  const [subTab, setSubTab] = useState<SubTab>("match");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExchangeResponse | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [tradesRefreshKey, setTradesRefreshKey] = useState(0);
  const [tradeCounts, setTradeCounts] = useState({ incomingPending: 0, outgoingPending: 0 });
  const [selectedTradeId, setSelectedTradeId] = useState<number | null>(null);
  const [popupTrade, setPopupTrade] = useState<TradeListItem | null>(null);
  const [popupDismissed, setPopupDismissed] = useState(false);
  const [matchStage, setMatchStage] = useState<SwapStage>("select");

  useEffect(() => {
    const saved = localStorage.getItem(PARTNER_EMAIL_KEY);
    if (saved) setPartnerEmail(saved);
    setPopupDismissed(sessionStorage.getItem(POPUP_DISMISSED_KEY) === "1");
  }, []);

  const handleTradesLoaded = useCallback((data: TradesResponse) => {
    setTradeCounts({
      incomingPending: data.counts.incomingPending,
      outgoingPending: data.counts.outgoingPending,
    });
    window.dispatchEvent(
      new CustomEvent("panini-trade-counts", {
        detail: { incomingPending: data.counts.incomingPending },
      }),
    );

    const highlighted =
      data.incoming.find((t) => t.reminderPending) ?? data.incoming[0] ?? null;
    if (!highlighted) return;
    if (highlighted.reminderPending) {
      setPopupTrade(highlighted);
      return;
    }
    if (!popupDismissed) setPopupTrade(highlighted);
  }, [popupDismissed]);

  // Counts-only update used by TradesPanel — avoids re-firing the popup
  // while the user is actively managing trades in the panel.
  const handleTradesLoadedForPanel = useCallback((data: TradesResponse) => {
    setTradeCounts({
      incomingPending: data.counts.incomingPending,
      outgoingPending: data.counts.outgoingPending,
    });
    window.dispatchEvent(
      new CustomEvent("panini-trade-counts", {
        detail: { incomingPending: data.counts.incomingPending },
      }),
    );
  }, []);

  const fetchTradesForPopup = useCallback(async () => {
    if (!session?.profileId) return;
    try {
      const res = await fetch(`/api/trade-requests?profileId=${session.profileId}`);
      const data = await res.json();
      if (res.ok) handleTradesLoaded(data as TradesResponse);
    } catch {
      /* ignore */
    }
  }, [session?.profileId, handleTradesLoaded]);

  useEffect(() => {
    fetchTradesForPopup();
  }, [fetchTradesForPopup]);

  // Re-hydrate when the tab regains focus. There's no realtime sync, so a
  // partner accepting a trade while this tab was backgrounded would otherwise
  // leave the album and trade lists stale until a full reload.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (session?.profileId) reloadCollection(session.profileId);
      fetchTradesForPopup();
      setTradesRefreshKey((k) => k + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [session?.profileId, fetchTradesForPopup]);

  const ackReminders = async () => {
    if (!session) return;
    await fetch("/api/trade-requests/ack-reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: session.profileId }),
    });
  };

  const dismissPopup = () => {
    setPopupTrade(null);
    setPopupDismissed(true);
    sessionStorage.setItem(POPUP_DISMISSED_KEY, "1");
    ackReminders();
  };

  const viewPopupTrade = () => {
    if (!popupTrade) return;
    setSelectedTradeId(popupTrade.id);
    setSubTab("trades");
    setPopupTrade(null);
    ackReminders();
  };

  const runExchange = useCallback(async (resetTab = true) => {
    if (!session) {
      setError("Session not ready yet — wait a second and try again.");
      return;
    }
    const email = partnerEmail.trim().toLowerCase();
    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: session.profileId, partnerEmail: email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(null);
        setError(data.error ?? "Something went wrong.");
        return;
      }
      localStorage.setItem(PARTNER_EMAIL_KEY, email);
      setResult(data as ExchangeResponse);
      if (resetTab) setSubTab("match");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }, [session, partnerEmail]);

  const onTradeSent = useCallback(async () => {
    setTradesRefreshKey((k) => k + 1);
    await runExchange(true);
  }, [runExchange]);

  const onTradeUpdated = useCallback(async () => {
    setTradesRefreshKey((k) => k + 1);
    // Don't reset tab — user is on Trades tab and wants to stay there
    if (result) await runExchange(false);
  }, [result, runExchange]);

  const shareText = useMemo(() => {
    if (!result || !session) return "";
    return formatExchangeShareText(
      session.email,
      result.partnerEmail,
      result.youGive,
      result.youGet,
    );
  }, [result, session]);

  const copyShareText = useCallback(async () => {
    if (!shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }, [shareText]);

  const shareViaWhatsApp = useCallback(() => {
    if (!shareText) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
  }, [shareText]);

  const downloadCsv = useCallback(() => {
    if (!result) return;
    const slug = result.partnerEmail.split("@")[0] ?? "partner";
    downloadTextFile(`panini-exchange-${slug}.csv`, formatExchangeCsv(result.youGive, result.youGet), "text/csv;charset=utf-8;");
  }, [result]);

  const pendingTradesCount = tradeCounts.incomingPending + tradeCounts.outgoingPending;

  const subTabs: { id: SubTab; label: string; count?: number }[] = [
    ...(result
      ? [
          {
            id: "match" as const,
            label: "Swap",
            count: result.summary.youGiveCount + result.summary.youGetCount,
          },
          {
            id: "give" as const,
            label: "I can give you",
            count: result.summary.youGiveCount,
          },
          {
            id: "get" as const,
            label: "You can give me",
            count: result.summary.youGetCount,
          },
        ]
      : []),
    {
      id: "trades" as const,
      label: "Trades",
      count: pendingTradesCount > 0 ? pendingTradesCount : undefined,
    },
  ];

  const partnerName = result?.partnerEmail.split("@")[0] ?? "them";

  return (
    <div className="space-y-4 pb-10">
      {popupTrade && (
        <TradeRequestPopup
          trade={popupTrade}
          onView={viewPopupTrade}
          onLater={dismissPopup}
        />
      )}

      <div className="rounded-3xl bg-[var(--color-primary)]/80 p-5 text-white shadow-lg backdrop-blur-xl ring-1 ring-white/30">
        <p className="text-sm font-medium opacity-90">Sticker exchange</p>
        <p className="mt-1 text-xs opacity-80">
          Enter a friend&apos;s email to see what you can give each other
        </p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); runExchange(); }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <input
          type="email"
          placeholder="friend@email.com"
          value={partnerEmail}
          onChange={(e) => setPartnerEmail(e.target.value)}
          className="min-w-0 flex-1 rounded-2xl border border-white/60 bg-white/50 px-4 py-3 text-sm shadow-sm backdrop-blur-md outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          autoComplete="email"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-2xl bg-[var(--color-primary)] px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "Checking…" : "Compare"}
        </button>
      </form>

      {error && (
        <p className="rounded-2xl bg-[var(--color-accent-red)]/10 px-4 py-3 text-sm font-medium text-[var(--color-accent-red)] ring-1 ring-[var(--color-accent-red)]/20">
          {error}
        </p>
      )}

      {subTabs.length > 0 && (
        <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white/40 p-1 ring-1 ring-white/60">
          {subTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`shrink-0 rounded-xl px-2 py-2.5 text-xs font-bold transition-colors sm:flex-1 sm:text-sm ${
                subTab === tab.id
                  ? "bg-[var(--color-primary)] text-white shadow-md"
                  : "text-gray-600 hover:bg-white/60"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1 opacity-80">({tab.count})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {subTab === "trades" && session && (
        <TradesPanel
          profileId={session.profileId}
          refreshKey={tradesRefreshKey}
          selectedTradeId={selectedTradeId}
          onSelectTrade={setSelectedTradeId}
          onTradesLoaded={handleTradesLoadedForPanel}
          onTradeUpdated={onTradeUpdated}
        />
      )}

      {result && subTab !== "trades" && (
        <>
          <div className="rounded-2xl bg-white/50 px-4 py-3 text-sm text-gray-600 ring-1 ring-white/60">
            Trading with{" "}
            <span className="font-semibold text-gray-900">{partnerName}</span>
            <span className="text-gray-400"> · {result.partnerEmail}</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-[var(--color-accent-green)]/15 px-3 py-3 text-center ring-1 ring-[var(--color-accent-green)]/25">
              <p className="text-2xl font-black tabular-nums text-[var(--color-accent-green)]">
                {result.summary.youGiveCount}
              </p>
              <p className="text-xs font-semibold text-gray-600">I can give you</p>
            </div>
            <div className="rounded-2xl bg-[var(--color-accent-teal)]/15 px-3 py-3 text-center ring-1 ring-[var(--color-accent-teal)]/25">
              <p className="text-2xl font-black tabular-nums text-[var(--color-accent-teal)]">
                {result.summary.mutualCount}
              </p>
              <p className="text-xs font-semibold text-gray-600">Can swap</p>
            </div>
            <div className="rounded-2xl bg-[var(--color-accent-yellow)]/25 px-3 py-3 text-center ring-1 ring-[var(--color-accent-yellow)]/40">
              <p className="text-2xl font-black tabular-nums text-yellow-800">
                {result.summary.youGetCount}
              </p>
              <p className="text-xs font-semibold text-gray-600">You can give me</p>
            </div>
          </div>

          {!(subTab === "match" && matchStage !== "select") && (
            <div className="rounded-3xl bg-white/50 p-4 shadow-lg backdrop-blur-xl ring-1 ring-white/60">
              <p className="mb-3 text-sm font-bold text-gray-800">Share trade list</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={copyShareText}
                  className="rounded-2xl bg-[var(--color-primary)]/10 px-4 py-3 text-sm font-bold text-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/20 transition-all hover:bg-[var(--color-primary)]/15 active:scale-[0.98]"
                >
                  {copyStatus === "copied" ? "Copied!" : "Copy text"}
                </button>
                <button
                  type="button"
                  onClick={shareViaWhatsApp}
                  className="rounded-2xl bg-[#25D366]/15 px-4 py-3 text-sm font-bold text-[#128C7E] ring-1 ring-[#25D366]/30 transition-all hover:bg-[#25D366]/25 active:scale-[0.98]"
                >
                  Send on WhatsApp
                </button>
                <button
                  type="button"
                  onClick={downloadCsv}
                  className="rounded-2xl bg-white/70 px-4 py-3 text-sm font-bold text-gray-700 ring-1 ring-black/5 transition-all hover:bg-white active:scale-[0.98]"
                >
                  Download CSV
                </button>
              </div>
            </div>
          )}

          {subTab === "match" && session && (
            <SwapStudio
              youGive={result.youGive}
              youGet={result.youGet}
              profileId={session.profileId}
              partnerEmail={result.partnerEmail}
              partnerName={partnerName}
              onTradeSent={onTradeSent}
              onStageChange={setMatchStage}
            />
          )}

          {subTab === "give" && (
            <ExchangeList
              stickers={result.youGive}
              emptyMessage="I have no repeats you're still missing."
              badgeLabel={(q) => `×${q} I have`}
            />
          )}

          {subTab === "get" && (
            <ExchangeList
              stickers={result.youGet}
              emptyMessage="You have no repeats I'm still missing."
              badgeLabel={(q) => `×${q} you have`}
            />
          )}
        </>
      )}

      {!result && subTab !== "trades" && !error && !loading && (
        <p className="text-center text-sm text-gray-400">
          Both of you need to use the app with your own email first.
        </p>
      )}
    </div>
  );
}
