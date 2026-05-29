import { catalog, findSectionForSticker, getAllStickers } from "./catalog";
import type { CollectionState } from "./types";

export interface ExchangeSticker {
  number: string;
  label?: string;
  section: string;
  sectionSlug: string;
  quantity: number;
}

export interface ExchangeResult {
  youGive: ExchangeSticker[];
  youGet: ExchangeSticker[];
}

function isMissing(owned: Record<string, boolean>, number: string): boolean {
  return !owned[number];
}

export function computeExchange(
  yours: CollectionState,
  partner: CollectionState,
): ExchangeResult {
  const youGive: ExchangeSticker[] = [];
  const youGet: ExchangeSticker[] = [];

  for (const sticker of getAllStickers()) {
    const section = findSectionForSticker(sticker.number);
    const meta = {
      number: sticker.number,
      label: sticker.label,
      section: section?.name ?? "Unknown",
      sectionSlug: section?.slug ?? "unknown",
    };

    const yourRepeats = yours.repeats[sticker.number] ?? 0;
    if (yourRepeats > 0 && isMissing(partner.owned, sticker.number)) {
      youGive.push({ ...meta, quantity: yourRepeats });
    }

    const partnerRepeats = partner.repeats[sticker.number] ?? 0;
    if (partnerRepeats > 0 && isMissing(yours.owned, sticker.number)) {
      youGet.push({ ...meta, quantity: partnerRepeats });
    }
  }

  return { youGive, youGet };
}

export function groupExchangeBySection(stickers: ExchangeSticker[]) {
  const bySlug = new Map<
    string,
    { name: string; slug: string; stickers: ExchangeSticker[] }
  >();

  for (const sticker of stickers) {
    const existing = bySlug.get(sticker.sectionSlug);
    if (existing) {
      existing.stickers.push(sticker);
    } else {
      bySlug.set(sticker.sectionSlug, {
        name: sticker.section,
        slug: sticker.sectionSlug,
        stickers: [sticker],
      });
    }
  }

  const catalogOrder = catalog.sections.map((s) => s.slug);
  return [...bySlug.values()].sort(
    (a, b) => catalogOrder.indexOf(a.slug) - catalogOrder.indexOf(b.slug),
  );
}

function formatStickerLine(sticker: ExchangeSticker): string {
  const label = sticker.label ? ` · ${sticker.label}` : "";
  const qty = sticker.quantity > 1 ? ` ×${sticker.quantity}` : "";
  return `${sticker.number} · ${sticker.section}${label}${qty}`;
}

function formatStickerBlock(
  heading: string,
  stickers: ExchangeSticker[],
  empty: string,
): string[] {
  if (stickers.length === 0) return [heading, empty, ""];
  return [heading, ...stickers.map((s) => `• ${formatStickerLine(s)}`), ""];
}

export function formatExchangeShareText(
  yourEmail: string,
  partnerEmail: string,
  youGive: ExchangeSticker[],
  youGet: ExchangeSticker[],
): string {
  const you = yourEmail.split("@")[0];
  const partner = partnerEmail.split("@")[0];

  return [
    `Panini exchange — ${you} ↔ ${partner}`,
    "",
    ...formatStickerBlock(
      `I can give you (${youGive.length}):`,
      youGive,
      "I have nothing to give you.",
    ),
    ...formatStickerBlock(
      `You can give me (${youGet.length}):`,
      youGet,
      "You have nothing to give me.",
    ),
  ]
    .join("\n")
    .trim();
}

function escapeCsv(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatExchangeCsv(
  youGive: ExchangeSticker[],
  youGet: ExchangeSticker[],
): string {
  const rows: (string | number)[][] = [
    ["direction", "number", "section", "label", "quantity"],
  ];

  for (const sticker of youGive) {
    rows.push(["give", sticker.number, sticker.section, sticker.label ?? "", sticker.quantity]);
  }
  for (const sticker of youGet) {
    rows.push(["get", sticker.number, sticker.section, sticker.label ?? "", sticker.quantity]);
  }

  return rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime = "text/plain;charset=utf-8;",
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
