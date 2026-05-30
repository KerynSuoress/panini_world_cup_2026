export type StickerType = "shield" | "player" | "teamphoto" | "special";
export type SectionType = "team" | "special";
export type FilterType = "all" | "owned" | "missing";

export interface Sticker {
  number: string;
  type: StickerType;
  wide: boolean;
  label?: string;
}

export interface Section {
  slug: string;
  name: string;
  code?: string;
  group?: string;
  type: SectionType;
  photoIndex?: number;
  colors?: { primary: string; accent: string };
  stickers: Sticker[];
}

export interface Catalog {
  sections: Section[];
}

export interface CollectionState {
  owned: Record<string, boolean>;
  repeats: Record<string, number>;
}

export interface SectionStats {
  total: number;
  owned: number;
  missing: number;
  repeats: number;
  percent: number;
}

export interface GlobalStats {
  total: number;
  owned: number;
  missing: number;
  totalRepeats: number;
  percent: number;
}

export interface TradeSummarySticker {
  number: string;
  label?: string;
  section: string;
  sectionSlug: string;
  quantity: number;
}

export interface TradeSummary {
  initiatorEmail: string;
  partnerEmail: string;
  youGive: TradeSummarySticker[];
  youGet: TradeSummarySticker[];
  giveCount: number;
  getCount: number;
}
