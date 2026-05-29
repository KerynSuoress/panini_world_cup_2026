import catalogData from "../data/catalog.json";
import type { Catalog, GlobalStats, Section, SectionStats, Sticker } from "./types";

export const catalog = catalogData as Catalog;

export function getAllStickers(): Sticker[] {
  return catalog.sections.flatMap((s) => s.stickers);
}

export function getAllStickerNumbers(): string[] {
  return getAllStickers().map((s) => s.number);
}

export function findSectionForSticker(number: string): Section | undefined {
  return catalog.sections.find((s) => s.stickers.some((st) => st.number === number));
}

export function computeSectionStats(
  section: Section,
  owned: Record<string, boolean>,
  repeats: Record<string, number>,
): SectionStats {
  const total = section.stickers.length;
  const ownedCount = section.stickers.filter((s) => owned[s.number]).length;
  const repeatCount = section.stickers.reduce(
    (sum, s) => sum + (repeats[s.number] ?? 0),
    0,
  );
  return {
    total,
    owned: ownedCount,
    missing: total - ownedCount,
    repeats: repeatCount,
    percent: total ? Math.round((ownedCount / total) * 100) : 0,
  };
}

export function computeGlobalStats(
  owned: Record<string, boolean>,
  repeats: Record<string, number>,
): GlobalStats {
  const stickers = getAllStickers();
  const total = stickers.length;
  const ownedCount = stickers.filter((s) => owned[s.number]).length;
  const totalRepeats = Object.values(repeats).reduce((a, b) => a + b, 0);
  return {
    total,
    owned: ownedCount,
    missing: total - ownedCount,
    totalRepeats,
    percent: total ? Math.round((ownedCount / total) * 100) : 0,
  };
}
