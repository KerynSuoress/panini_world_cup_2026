import { useStore } from "@nanostores/react";
import { useCallback, useMemo, useState } from "react";
import {
  groupExchangeBySection,
  formatExchangeShareText,
  formatExchangeCsv,
  downloadTextFile,
  type ExchangeSticker,
} from "../lib/exchange";
import { catalog } from "../lib/catalog";
import { $session } from "../store/profileStore";
import { $owned, decrementRepeat } from "../store/collectionStore";

type SubTab = "give" | "get" | "match";

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

const PARTNER_EMAIL_KEY = "panini-exchange-partner";

function sectionColor(slug: string): string {
  return (
    catalog.sections.find((s) => s.slug === slug)?.colors?.primary ?? "#1B3FA0"
  );
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

// ─── Swap Studio (match tab) ─────────────────────────────────────────────────

function SwapStudio({
  youGive,
  youGet,
  profileId,
  partnerEmail,
  partnerName,
  onSwapSuccess,
}: {
  youGive: ExchangeSticker[];
  youGet: ExchangeSticker[];
  profileId: number;
  partnerEmail: string;
  partnerName: string;
  onSwapSuccess: () => void;
}) {
  const [selectedGive, setSelectedGive] = useState<Set<string>>(new Set());
  const [selectedGet, setSelectedGet] = useState<Set<string>>(new Set());
  const [swapping, setSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapDone, setSwapDone] = useState<{ gave: number; got: number } | null>(null);

  const toggleGive = (num: string) =>
    setSelectedGive((prev) => {
      const next = new Set(prev);
      next.has(num) ? next.delete(num) : next.add(num);
      return next;
    });

  const toggleGet = (num: string) =>
    setSelectedGet((prev) => {
      const next = new Set(prev);
      next.has(num) ? next.delete(num) : next.add(num);
      return next;
    });

  const executeSwap = async () => {
    if (selectedGive.size === 0 && selectedGet.size === 0) return;
    setSwapping(true);
    setSwapError(null);
    setSwapDone(null);

    try {
      const res = await fetch("/api/exchange-swap", {
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
        setSwapError(data.error ?? "Swap failed. Try again.");
        return;
      }

      // Update local collection stores — the persistence layer auto-saves
      // each setKey call to the DB via PATCH /api/collection.
      const owned = $owned.get();
      for (const num of selectedGet) {
        if (!owned[num]) $owned.setKey(num, true);
      }
      for (const num of selectedGive) {
        decrementRepeat(num);
      }

      setSwapDone({ gave: data.gave as number, got: data.got as number });
      setSelectedGive(new Set());
      setSelectedGet(new Set());

      // Refresh the exchange comparison so lists reflect updated repeats
      onSwapSuccess();
    } catch {
      setSwapError("Could not connect. Try again.");
    } finally {
      setSwapping(false);
    }
  };

  const hasSelection = selectedGive.size > 0 || selectedGet.size > 0;

  return (
    <div className="space-y-3">
      {/* Two-column chip picker */}
      <div className="overflow-hidden rounded-3xl shadow-lg ring-1 ring-white/60">
        <div className="grid grid-cols-2 divide-x divide-black/5">
          {/* Left: I can give you */}
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

          {/* Right: You can give me */}
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

      {swapError && (
        <p className="rounded-2xl bg-[var(--color-accent-red)]/10 px-4 py-3 text-sm font-medium text-[var(--color-accent-red)] ring-1 ring-[var(--color-accent-red)]/20">
          {swapError}
        </p>
      )}

      {swapDone && (
        <p className="rounded-2xl bg-[var(--color-accent-green)]/15 px-4 py-3 text-sm font-semibold text-[var(--color-accent-green)] ring-1 ring-[var(--color-accent-green)]/25">
          ✓ Swapped! You gave {swapDone.gave} and received {swapDone.got} sticker
          {swapDone.got !== 1 ? "s" : ""}. Both albums updated.
        </p>
      )}

      {hasSelection && (
        <button
          type="button"
          onClick={executeSwap}
          disabled={swapping}
          className="w-full rounded-2xl bg-[var(--color-primary)] py-4 text-base font-black text-white shadow-xl ring-2 ring-[var(--color-primary)]/20 transition-all active:scale-[0.98] disabled:opacity-60"
        >
          {swapping
            ? "Swapping…"
            : `Swap ${selectedGive.size} ↔ ${selectedGet.size}`}
        </button>
      )}

      {!hasSelection && (
        <p className="text-center text-xs text-gray-400">
          Tap stickers from either side to build your swap, then hit Swap.
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function Exchange() {
  const session = useStore($session);
  const [partnerEmail, setPartnerEmail] = useState("");
  const [subTab, setSubTab] = useState<SubTab>("match");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExchangeResponse | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  // Restore last-used partner email
  useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(PARTNER_EMAIL_KEY);
      if (saved) setPartnerEmail(saved);
    }
  });

  const runExchange = useCallback(async () => {
    if (!session) return;
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
      setSubTab("match");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }, [session, partnerEmail]);

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

  const subTabs: { id: SubTab; label: string; count?: number }[] = result
    ? [
        {
          id: "match",
          label: "Swap",
          count: result.summary.youGiveCount + result.summary.youGetCount,
        },
        {
          id: "give",
          label: "I can give you",
          count: result.summary.youGiveCount,
        },
        {
          id: "get",
          label: "You can give me",
          count: result.summary.youGetCount,
        },
      ]
    : [];

  const partnerName = result?.partnerEmail.split("@")[0] ?? "them";

  return (
    <div className="space-y-4 pb-10">
      <div className="rounded-3xl bg-[var(--color-primary)]/80 p-5 text-white shadow-lg backdrop-blur-xl ring-1 ring-white/30">
        <p className="text-sm font-medium opacity-90">Sticker exchange</p>
        <p className="mt-1 text-xs opacity-80">
          Enter a friend&apos;s email to see what you can give each other
        </p>
      </div>

      {/* Wrapping in a form makes both Enter key and the button work natively */}
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
          disabled={loading || !session}
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

      {result && (
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

          <div className="flex gap-1 rounded-2xl bg-white/40 p-1 ring-1 ring-white/60">
            {subTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`flex-1 rounded-xl px-2 py-2.5 text-xs font-bold transition-colors sm:text-sm ${
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

          {subTab === "match" && session && (
            <SwapStudio
              youGive={result.youGive}
              youGet={result.youGet}
              profileId={session.profileId}
              partnerEmail={result.partnerEmail}
              partnerName={partnerName}
              onSwapSuccess={runExchange}
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

      {!result && !error && !loading && (
        <p className="text-center text-sm text-gray-400">
          Both of you need to use the app with your own email first.
        </p>
      )}
    </div>
  );
}
