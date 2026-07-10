import { useStore } from "@nanostores/react";
import { useCallback, useEffect, useState } from "react";
import { catalog } from "../lib/catalog";
import { $owned, $repeats } from "../store/collectionStore";
import { $session } from "../store/profileStore";

type HistoryFilter = "all" | "owned_on" | "owned_off" | "repeats";

interface HistoryEntry {
  id: number;
  stickerNumber: string;
  label: string;
  section: string;
  sectionSlug: string;
  action: "owned_on" | "owned_off" | "repeat_add" | "repeat_remove";
  oldOwned: boolean;
  newOwned: boolean;
  oldRepeats: number;
  newRepeats: number;
  occurredAt: string;
}

const filters: { id: HistoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "owned_on", label: "Recently Added" },
  { id: "repeats", label: "Repeat Changes" },
  { id: "owned_off", label: "Recently Removed" },
];

function sectionColor(slug: string): string {
  return (
    catalog.sections.find((s) => s.slug === slug)?.colors?.primary ?? "#1B3FA0"
  );
}

function actionLabel(action: HistoryEntry["action"]): string {
  switch (action) {
    case "owned_on":
      return "Added to collection";
    case "owned_off":
      return "Removed from collection";
    case "repeat_add":
      return "Added a repeat";
    case "repeat_remove":
      return "Removed a repeat";
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function History() {
  const session = useStore($session);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<number | null>(null);

  const loadHistory = useCallback(async () => {
    if (!session?.profileId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/history?profileId=${session.profileId}&filter=${filter}&limit=100`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not load history.");
        setEntries([]);
        return;
      }
      if (data.setupRequired) {
        setError(
          "History is setting up — redeploy the app or ask the admin to run the DB migration.",
        );
      }
      setEntries(data.entries ?? []);
    } catch {
      setError("Could not reach the server.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [session?.profileId, filter]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const undoEntry = async (entry: HistoryEntry) => {
    if (!session?.profileId) return;
    setUndoingId(entry.id);
    setError(null);

    try {
      const res = await fetch("/api/collection", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: session.profileId,
          stickerNumber: entry.stickerNumber,
          owned: entry.oldOwned,
          repeats: entry.oldRepeats,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Undo failed.");
        return;
      }

      $owned.setKey(entry.stickerNumber, entry.oldOwned);
      if (entry.oldRepeats > 0) {
        $repeats.setKey(entry.stickerNumber, entry.oldRepeats);
      } else {
        const repeats = { ...$repeats.get() };
        delete repeats[entry.stickerNumber];
        $repeats.set(repeats);
      }

      await loadHistory();
    } catch {
      setError("Could not undo. Try again.");
    } finally {
      setUndoingId(null);
    }
  };

  return (
    <div className="space-y-4 pb-10">
      <div className="rounded-3xl bg-[var(--color-primary)]/80 p-5 text-white shadow-lg ring-1 ring-white/30">
        <p className="text-sm font-medium opacity-90">Change history</p>
        <p className="mt-1 text-xs opacity-80">
          Recent sticker updates with undo — fix mistakes in one tap
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white/80 p-1 shadow-sm ring-1 ring-white/60">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition-colors sm:text-sm ${
              filter === f.id
                ? "bg-[var(--color-primary)] text-white shadow-md"
                : "text-gray-600 hover:bg-white/60"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-2xl bg-[var(--color-accent-red)]/10 px-4 py-3 text-sm font-medium text-[var(--color-accent-red)] ring-1 ring-[var(--color-accent-red)]/20">
          {error}
        </p>
      )}

      {loading && (
        <p className="text-center text-sm text-gray-400 py-8">Loading…</p>
      )}

      {!loading && entries.length === 0 && (
        <p className="rounded-2xl bg-white/50 px-4 py-8 text-center text-sm text-gray-500 ring-1 ring-white/60">
          No changes yet. Mark stickers in the album to see them here.
        </p>
      )}

      {!loading && entries.length > 0 && (
        <ul className="space-y-2">
          {entries.map((entry) => {
            const dot = sectionColor(entry.sectionSlug);
            return (
              <li
                key={entry.id}
                className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-sm ring-1 ring-white/60"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: dot }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800">
                    {entry.stickerNumber}
                    {entry.label && (
                      <span className="font-normal text-gray-500">
                        {" "}
                        · {entry.label}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {actionLabel(entry.action)} · {entry.section} ·{" "}
                    {timeAgo(entry.occurredAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => undoEntry(entry)}
                  disabled={undoingId === entry.id}
                  className="shrink-0 rounded-xl bg-black/5 px-3 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-black/10 disabled:opacity-50"
                >
                  {undoingId === entry.id ? "…" : "Undo"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
