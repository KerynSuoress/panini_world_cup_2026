import { useStore } from "@nanostores/react";
import { catalog } from "../lib/catalog";
import { $owned, $repeats } from "../store/collectionStore";
import { importCollection } from "../store/persistence";
import { useRef } from "react";

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function DataSync() {
  const owned = useStore($owned);
  const repeats = useStore($repeats);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportFull = () => {
    const rows = [["number", "section", "type", "owned", "repeats"]];
    for (const section of catalog.sections) {
      for (const sticker of section.stickers) {
        rows.push([
          sticker.number,
          section.name,
          sticker.type,
          (owned[sticker.number] ?? false) ? "yes" : "no",
          repeats[sticker.number] ?? 0,
        ]);
      }
    }
    const csv = rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
    download("panini-collection-full.csv", csv);
  };

  const exportMissing = () => {
    const rows = [["number", "section", "type"]];
    for (const section of catalog.sections) {
      for (const sticker of section.stickers) {
        if (!(owned[sticker.number] ?? false)) {
          rows.push([sticker.number, section.name, sticker.type]);
        }
      }
    }
    const csv = rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
    download("panini-missing.csv", csv);
  };

  const exportRepeats = () => {
    const rows = [["number", "section", "repeats"]];
    for (const section of catalog.sections) {
      for (const sticker of section.stickers) {
        const count = repeats[sticker.number] ?? 0;
        if (count > 0) {
          rows.push([sticker.number, section.name, count]);
        }
      }
    }
    const csv = rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
    download("panini-repeats-trade.csv", csv);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split("\n");
      const newOwned = { ...$owned.get() };
      const newRepeats = { ...$repeats.get() };

      // Assuming format: number,section,type,owned,repeats
      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]?.trim();
        if (!line) continue;

        // Simple CSV split (doesn't handle commas inside quotes perfectly, but sufficient for our format)
        const cols = line.split(",").map((c) => c.replace(/^"|"$/g, ""));
        const number = cols[0];
        if (!number) continue;

        const isOwned = cols[3] === "yes";
        const repeatCount = parseInt(cols[4] ?? "0", 10) || 0;

        newOwned[number] = isOwned;
        newRepeats[number] = repeatCount;
      }

      importCollection(newOwned, newRepeats).then(() => {
        alert("Collection imported successfully!");
      });

      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white/50 p-5 shadow-lg backdrop-blur-xl ring-1 ring-white/60">
        <h2 className="mb-4 text-lg font-bold text-gray-800">Export Collection</h2>
        <div className="space-y-3">
          <ExportCard
            title="Full collection"
            description="Every sticker with owned status and repeat counts."
            onClick={exportFull}
          />
          <ExportCard
            title="Missing stickers"
            description="Stickers you still need to complete the album."
            onClick={exportMissing}
            accent="red"
          />
          <ExportCard
            title="Repeats / trade list"
            description="Duplicates available for swapping with friends."
            onClick={exportRepeats}
            accent="yellow"
          />
        </div>
      </div>

      <div className="rounded-3xl bg-white/50 p-5 shadow-lg backdrop-blur-xl ring-1 ring-white/60">
        <h2 className="mb-2 text-lg font-bold text-gray-800">Import Collection</h2>
        <p className="mb-4 text-sm text-gray-600">
          Upload a previously exported "Full collection" CSV to restore your progress.
        </p>
        <label className="flex w-full cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-primary)]/40 bg-white/40 px-4 py-6 text-center transition-all hover:bg-white/60">
          <span className="text-sm font-bold text-[var(--color-primary)]">
            Select CSV File
          </span>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImport}
          />
        </label>
      </div>
    </div>
  );
}

function ExportCard({
  title,
  description,
  onClick,
  accent,
}: {
  title: string;
  description: string;
  onClick: () => void;
  accent?: "red" | "yellow";
}) {
  const border =
    accent === "red"
      ? "border-[var(--color-accent-red)]/30"
      : accent === "yellow"
        ? "border-[var(--color-accent-yellow)]/50"
        : "border-[var(--color-primary)]/20";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border-2 bg-white/60 backdrop-blur-md p-4 text-left shadow-sm transition-all hover:bg-white/80 active:scale-95 ${border}`}
    >
      <p className="font-bold text-[var(--color-primary)]">{title}</p>
      <p className="mt-1 text-sm text-gray-600">{description}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Download CSV
      </p>
    </button>
  );
}
