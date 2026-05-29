import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { TEAMS } from "./teams-data";
import { TEAM_KIT_COLORS } from "./team-kit-colors";

export type StickerType = "shield" | "player" | "teamphoto" | "special";
export type SectionType = "team" | "special";

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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function teamStickers(code: string): Sticker[] {
  return Array.from({ length: 20 }, (_, i) => {
    const n = i + 1;
    let type: StickerType = "player";
    if (n === 1) type = "shield";
    if (n === 13) type = "teamphoto";
    return {
      number: `${code}-${n}`,
      type,
      wide: n === 13,
    };
  });
}

function introSections(): Section[] {
  return [
    {
      slug: "intro-we-are-panini",
      name: "We Are Panini",
      type: "special",
      photoIndex: 1,
      colors: { primary: "#1B3FA0", accent: "#E8233A" },
      stickers: [
        { number: "00", type: "special", wide: false, label: "We Are Panini" },
        { number: "01", type: "special", wide: false, label: "FIFA World Cup Trophy" },
        { number: "02", type: "special", wide: false, label: "FIFA World Cup Trophy" },
        { number: "FWC 3", type: "special", wide: false, label: "Official Mascots" },
        { number: "FWC 4", type: "special", wide: false, label: "Official Slogan" },
      ],
    },
    {
      slug: "intro-host-cities",
      name: "Host Countries & Cities",
      type: "special",
      photoIndex: 2,
      colors: { primary: "#111111", accent: "#FFD700" },
      stickers: [
        { number: "FWC 5", type: "special", wide: false, label: "Official Match Ball" },
        { number: "FWC 6", type: "special", wide: false, label: "Host Trophy Hologram" },
        { number: "FWC 7", type: "special", wide: false, label: "Host Country Emblem" },
        { number: "FWC 8", type: "special", wide: false, label: "Host Trophy Hologram" },
      ],
    },
  ];
}

function historySections(): Section[] {
  const page1Years = ["1930", "1938", "1950", "1962", "1974"];

  const page1: Sticker[] = page1Years.map((year, i) => ({
    number: `FWC ${9 + i}`,
    type: "special" as StickerType,
    wide: false,
    label: `${year} Winner`,
  }));

  const page2Years = ["1978", "1982", "1986", "2006", "2014", "2022"];

  const page2: Sticker[] = page2Years.map((year, i) => ({
    number: `FWC ${14 + i}`,
    type: "special" as StickerType,
    wide: false,
    label: `${year} Winner`,
  }));

  return [
    {
      slug: "history-1930-1974",
      name: "FIFA World Cup History (1930–1974)",
      type: "special",
      photoIndex: 51,
      colors: { primary: "#0B1F4A", accent: "#00BCD4" },
      stickers: page1,
    },
    {
      slug: "history-1978-2022",
      name: "FIFA World Cup History (1978–2022)",
      type: "special",
      photoIndex: 52,
      colors: { primary: "#0B1F4A", accent: "#FFD700" },
      stickers: page2,
    },
  ];
}

function cocaColaSection(): Section {
  const players = [
    "Lamine Yamal",
    "Joshua Kimmich",
    "Joško Gvardiol",
    "Santiago Giménez",
    "Federico Valverde",
    "Harry Kane",
    "Jefferson Lerma",
    "Enner Valencia",
    "Virgil van Dijk",
    "Raúl Jiménez",
    "Alphonso Davies",
    "Emiliano Martínez",
    "Gabriel Magalhães",
    "Lautaro Martínez",
  ];

  return {
    slug: "coca-cola-legends",
    name: "Coca-Cola Legends",
    code: "CC",
    type: "special",
    photoIndex: 53,
    colors: { primary: "#E8233A", accent: "#FFFFFF" },
    stickers: players.map((label, i) => ({
      number: `CC${i + 1}`,
      type: "special" as StickerType,
      wide: false,
      label,
    })),
  };
}

export function buildCatalog(): { sections: Section[] } {
  const teamSections: Section[] = TEAMS.map((team) => ({
    slug: slugify(team.name),
    name: team.name,
    code: team.code,
    group: team.group,
    type: "team" as SectionType,
    photoIndex: team.photoIndex,
    colors: TEAM_KIT_COLORS[team.code] ?? { primary: "#1B3FA0", accent: "#E8233A" },
    stickers: teamStickers(team.code),
  }));

  return {
    sections: [
      ...introSections(),
      ...teamSections,
      ...historySections(),
      cocaColaSection(),
    ],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outPath = join(process.cwd(), "src/data/catalog.json");
  
  let existingCatalog: { sections: Section[] } | null = null;
  if (existsSync(outPath)) {
    try {
      existingCatalog = JSON.parse(readFileSync(outPath, "utf-8"));
    } catch (e) {}
  }

  const catalog = buildCatalog();

  // Preserve photo-extracted colors for special sections only (teams use kit colors)
  if (existingCatalog) {
    for (const section of catalog.sections) {
      if (section.type === "team") continue;
      const existingSection = existingCatalog.sections.find((s) => s.slug === section.slug);
      if (existingSection?.colors) {
        section.colors = existingSection.colors;
      }
    }
  }

  writeFileSync(outPath, JSON.stringify(catalog, null, 2));
  const total = catalog.sections.reduce((s, sec) => s + sec.stickers.length, 0);
  console.log(`Wrote ${catalog.sections.length} sections, ${total} stickers → ${outPath}`);
}
