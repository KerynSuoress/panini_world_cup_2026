import { useStore } from "@nanostores/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { catalog, findSectionForSticker, getAllStickers } from "../lib/catalog";
import {
  $owned,
  $repeats,
  decrementSticker,
  incrementSticker,
} from "../store/collectionStore";

const MAX_RESULTS = 30;

function sectionColor(slug: string): string {
  return (
    catalog.sections.find((s) => s.slug === slug)?.colors?.primary ?? "#1B3FA0"
  );
}

export default function StickerSearch() {
  const owned = useStore($owned);
  const repeats = useStore($repeats);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const matches = getAllStickers().filter((sticker) => {
      const num = sticker.number.toLowerCase();
      const label = (sticker.label ?? "").toLowerCase();
      return num.includes(q) || label.includes(q);
    });

    return matches.slice(0, MAX_RESULTS).map((sticker) => {
      const section = findSectionForSticker(sticker.number);
      const isOwned = owned[sticker.number] ?? false;
      const rCount = repeats[sticker.number] ?? 0;
      return {
        sticker,
        sectionName: section?.name ?? "Unknown",
        sectionSlug: section?.slug ?? "unknown",
        isOwned,
        rCount,
        count: isOwned ? 1 + rCount : 0,
      };
    });
  }, [query, owned, repeats]);

  const grouped = useMemo(() => {
    const bySlug = new Map<
      string,
      { name: string; slug: string; items: typeof results }
    >();
    for (const item of results) {
      const existing = bySlug.get(item.sectionSlug);
      if (existing) {
        existing.items.push(item);
      } else {
        bySlug.set(item.sectionSlug, {
          name: item.sectionName,
          slug: item.sectionSlug,
          items: [item],
        });
      }
    }
    const order = catalog.sections.map((s) => s.slug);
    return [...bySlug.values()].sort(
      (a, b) => order.indexOf(a.slug) - order.indexOf(b.slug),
    );
  }, [results]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const stateLabel = (count: number) => {
    if (count === 0) return { text: "Missing", className: "bg-gray-200 text-gray-600" };
    if (count === 1) return { text: "Owned", className: "bg-[var(--color-accent-green)]/80 text-green-900" };
    return { text: `×${count}`, className: "bg-[var(--color-accent-yellow)]/80 text-yellow-900" };
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-left text-sm text-gray-500 shadow-sm ring-1 ring-white/60 transition-colors hover:bg-white"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-gray-400"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        Search by sticker code or name…
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end sm:justify-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={close}
            aria-label="Close search"
          />

          <div className="relative mx-auto flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-black/5 sm:rounded-3xl">
            <div className="border-b border-black/5 p-4">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. FWC-8 or Messi"
                  className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={close}
                  className="shrink-0 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-100"
                >
                  Close
                </button>
              </div>
              {query.trim() && (
                <p className="mt-2 text-xs text-gray-400">
                  {results.length === 0
                    ? "No matches"
                    : `${results.length} match${results.length === 1 ? "" : "es"}${results.length >= MAX_RESULTS ? " (showing first 30)" : ""}`}
                </p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {!query.trim() && (
                <p className="text-center text-sm text-gray-400 py-8">
                  Type a sticker number or player name
                </p>
              )}

              {query.trim() && results.length === 0 && (
                <p className="text-center text-sm text-gray-500 py-8">
                  No stickers found for &ldquo;{query}&rdquo;
                </p>
              )}

              <div className="space-y-4">
                {grouped.map(({ name, slug, items }) => (
                  <section key={slug}>
                    <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: sectionColor(slug) }}
                      />
                      {name}
                    </h3>
                    <ul className="space-y-2">
                      {items.map(({ sticker, count }) => {
                        const state = stateLabel(count);
                        return (
                          <li
                            key={sticker.number}
                            className="flex items-center gap-2 rounded-2xl bg-gray-50 px-3 py-2.5 ring-1 ring-black/5"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-gray-800">
                                {sticker.number}
                              </p>
                              {sticker.label && (
                                <p className="truncate text-xs text-gray-500">
                                  {sticker.label}
                                </p>
                              )}
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${state.className}`}
                            >
                              {state.text}
                            </span>
                            <div className="flex shrink-0 gap-1">
                              {count > 0 && (
                                <button
                                  type="button"
                                  onClick={() => decrementSticker(sticker.number)}
                                  className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-gray-700 hover:bg-black/10 active:scale-95"
                                  aria-label={`Remove one ${sticker.number}`}
                                >
                                  −
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => incrementSticker(sticker.number)}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-white hover:opacity-90 active:scale-95"
                                aria-label={`Mark ${sticker.number} owned or add repeat`}
                              >
                                +
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
