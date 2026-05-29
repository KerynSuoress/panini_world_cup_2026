import { useStore } from "@nanostores/react";
import { useEffect, useMemo, useState } from "react";
import { catalog, computeSectionStats } from "../lib/catalog";
import {
  $activeFilter,
  $activeSection,
  $owned,
  $repeats,
  incrementSticker,
  decrementSticker,
} from "../store/collectionStore";
import StickerCell from "./StickerCell";

export default function StickerGrid() {
  const owned = useStore($owned);
  const repeats = useStore($repeats);
  const filter = useStore($activeFilter);
  const activeSection = useStore($activeSection);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    if (!activeSection) return;
    const el = document.getElementById(`section-${activeSection}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    setShowBackToTop(true);
  }, [activeSection]);

  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY < 100) setShowBackToTop(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const sections = useMemo(() => {
    return catalog.sections.map((section) => {
      const stats = computeSectionStats(section, owned, repeats);
      const stickers = section.stickers.filter((sticker) => {
        const isOwned = owned[sticker.number] ?? false;
        if (filter === "owned") return isOwned;
        if (filter === "missing") return !isOwned;
        return true;
      });
      return { section, stats, stickers };
    });
  }, [owned, repeats, filter]);

  return (
    <div className="space-y-6">
      <FilterBar />
      <SectionSelect />

      {showBackToTop && (
        <button
          type="button"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            setShowBackToTop(false);
          }}
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-xl ring-2 ring-white/40 transition-all hover:scale-110 active:scale-95"
          aria-label="Back to top"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </button>
      )}

      {sections.map(({ section, stats, stickers }) => {
        if (stickers.length === 0) return null;
        const primary = section.colors?.primary ?? "#1B3FA0";
        const accent = section.colors?.accent ?? "#E8233A";

        return (
          <section
            key={section.slug}
            id={`section-${section.slug}`}
            className="overflow-hidden rounded-3xl bg-white/50 backdrop-blur-xl shadow-lg ring-1 ring-white/60"
          >
            <header
              className="px-4 py-3 text-white"
              style={{
                background: `linear-gradient(135deg, ${primary}cc, ${accent}cc)`,
                backdropFilter: "blur(12px)",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold leading-tight drop-shadow-md">{section.name}</h2>
                  <p className="text-xs opacity-90 drop-shadow-md">
                    {section.type === "team" && section.group
                      ? `Group ${section.group}`
                      : "Special section"}
                    {" · "}
                    {stats.owned}/{stats.total} owned
                  </p>
                </div>
                <span className="rounded-full bg-white/30 px-2 py-0.5 text-xs font-bold shadow-sm backdrop-blur-md">
                  {stats.percent}%
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/20 shadow-inner">
                <div
                  className="h-full rounded-full bg-white transition-all shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                  style={{ width: `${stats.percent}%` }}
                />
              </div>
            </header>

            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 p-3">
              {stickers.map((sticker) => {
                const isOwned = owned[sticker.number] ?? false;
                const rCount = repeats[sticker.number] ?? 0;
                const count = isOwned ? 1 + rCount : 0;
                return (
                  <StickerCell
                    key={sticker.number}
                    number={sticker.number}
                    type={sticker.type}
                    wide={sticker.wide}
                    label={sticker.label}
                    count={count}
                    onIncrement={() => incrementSticker(sticker.number)}
                    onDecrement={() => decrementSticker(sticker.number)}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function FilterBar() {
  const filter = useStore($activeFilter);
  const filters = [
    { id: "all" as const, label: "All" },
    { id: "owned" as const, label: "Owned" },
    { id: "missing" as const, label: "Missing" },
  ];

  return (
    <div className="flex gap-2 rounded-2xl bg-white/40 backdrop-blur-md p-1 shadow-sm ring-1 ring-white/60">
      {filters.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => $activeFilter.set(f.id)}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
            filter === f.id
              ? "bg-[var(--color-primary)] text-white shadow-md"
              : "text-gray-700 hover:bg-white/60"
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

function SectionSelect() {
  const active = useStore($activeSection);

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 drop-shadow-sm">
        Jump to section
      </span>
      <select
        value={active}
        onChange={(e) => $activeSection.set(e.target.value)}
        className="w-full rounded-2xl border border-white/60 bg-white/50 backdrop-blur-md px-4 py-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
      >
        <option value="">All sections</option>
        {catalog.sections.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.name}
            {s.group ? ` (Group ${s.group})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
