import { useStore } from "@nanostores/react";
import { useMemo, useState } from "react";
import { catalog } from "../lib/catalog";
import {
  $repeats,
  decrementRepeat,
  incrementRepeat,
} from "../store/collectionStore";

export default function Repeats() {
  const repeats = useStore($repeats);
  const [query, setQuery] = useState("");

  const totalRepeats = useMemo(
    () => Object.values(repeats).reduce((a, b) => a + b, 0),
    [repeats],
  );

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.sections
      .map((section) => {
        const stickers = section.stickers.filter((s) => {
          if (q) {
            const hay = `${s.number} ${s.label ?? ""} ${section.name}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });
        const sectionRepeats = stickers.reduce(
          (sum, s) => sum + (repeats[s.number] ?? 0),
          0,
        );
        return { section, stickers, sectionRepeats };
      })
      .filter(({ stickers }) => stickers.length > 0);
  }, [repeats, query]);

  return (
    <div className="space-y-4 pb-10">
      <div className="rounded-3xl bg-[var(--color-primary)]/80 p-5 text-white shadow-lg backdrop-blur-xl ring-1 ring-white/30">
        <p className="text-sm font-medium opacity-90">Total repeats</p>
        <p className="text-4xl font-black tabular-nums drop-shadow-md">{totalRepeats}</p>
        <p className="mt-1 text-xs opacity-80">
          Stickers available for trade beyond your first copy
        </p>
      </div>

      <input
        type="search"
        placeholder="Search sticker or team..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-2xl border border-white/60 bg-white/50 px-4 py-3 text-sm shadow-sm backdrop-blur-md outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
      />

      {sections.map(({ section, stickers, sectionRepeats }) => {
        const primary = section.colors?.primary ?? "#1B3FA0";
        return (
          <section
            key={section.slug}
            className="overflow-hidden rounded-3xl bg-white/50 shadow-lg backdrop-blur-xl ring-1 ring-white/60"
          >
            <header className="flex items-center justify-between px-4 py-3 text-white"
              style={{
                background: `linear-gradient(135deg, ${primary}cc, #11111155)`,
                backdropFilter: "blur(12px)",
              }}
            >
              <h2 className="font-bold drop-shadow-md">{section.name}</h2>
              <span className="rounded-full bg-white/30 px-2 py-0.5 text-xs font-bold shadow-sm backdrop-blur-md">
                {sectionRepeats} repeats
              </span>
            </header>
            <ul className="divide-y divide-black/5">
              {stickers.map((sticker) => {
                const count = repeats[sticker.number] ?? 0;
                return (
                  <li
                    key={sticker.number}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-800">{sticker.number}</p>
                      {sticker.label && (
                        <p className="truncate text-xs text-gray-500">{sticker.label}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => decrementRepeat(sticker.number)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/60 text-lg font-bold text-gray-700 shadow-sm transition-all hover:bg-white/80 active:scale-95"
                        aria-label={`Decrease repeats for ${sticker.number}`}
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-lg font-bold tabular-nums text-gray-900">
                        {count}
                      </span>
                      <button
                        type="button"
                        onClick={() => incrementRepeat(sticker.number)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent-yellow)]/80 text-lg font-bold text-yellow-900 shadow-sm transition-all hover:bg-[var(--color-accent-yellow)] active:scale-95"
                        aria-label={`Increase repeats for ${sticker.number}`}
                      >
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
