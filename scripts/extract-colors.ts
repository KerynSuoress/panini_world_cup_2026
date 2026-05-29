import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { ALBUM_PHOTOS_DIR, TEAMS } from "./teams-data";
import type { Section } from "./build-catalog";

const PHOTO_FILES = [
  "20260528_172059.jpg",
  "20260528_172108.jpg",
  "20260528_172121.jpg",
  "20260528_172129.jpg",
  "20260528_172134.jpg",
  "20260528_172138.jpg",
  "20260528_172142.jpg",
  "20260528_172147.jpg",
  "20260528_172151.jpg",
  "20260528_172156.jpg",
  "20260528_172200.jpg",
  "20260528_172206.jpg",
  "20260528_172211.jpg",
  "20260528_172219.jpg",
  "20260528_172227.jpg",
  "20260528_172232.jpg",
  "20260528_172236.jpg",
  "20260528_172243.jpg",
  "20260528_172246.jpg",
  "20260528_172253.jpg",
  "20260528_172258.jpg",
  "20260528_172303.jpg",
  "20260528_172310.jpg",
  "20260528_172315.jpg",
  "20260528_172319.jpg",
  "20260528_172324.jpg",
  "20260528_172332.jpg",
  "20260528_172336.jpg",
  "20260528_172340.jpg",
  "20260528_172345.jpg",
  "20260528_172349.jpg",
  "20260528_172352.jpg",
  "20260528_172355.jpg",
  "20260528_172359.jpg",
  "20260528_172403.jpg",
  "20260528_172407.jpg",
  "20260528_172410.jpg",
  "20260528_172413.jpg",
  "20260528_172417.jpg",
  "20260528_172419.jpg",
  "20260528_172423.jpg",
  "20260528_172427.jpg",
  "20260528_172431.jpg",
  "20260528_172434.jpg",
  "20260528_172437.jpg",
  "20260528_172440.jpg",
  "20260528_172443.jpg",
  "20260528_172447.jpg",
  "20260528_172450.jpg",
  "20260528_172453.jpg",
  "20260528_172458.jpg",
  "20260528_172511.jpg",
  "20260528_172517.jpg",
];

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

async function extractColors(imagePath: string): Promise<{
  primary: string;
  accent: string;
}> {
  const { data, info } = await sharp(imagePath)
    .rotate()
    .resize(120, 120, { fit: "cover" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buckets = new Map<string, { rgb: [number, number, number]; count: number; s: number; l: number; h: number }>();

  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    
    const [h, s, l] = rgbToHsl(r, g, b);
    if (s < 0.15 || l < 0.15 || l > 0.85) continue;

    const key = `${Math.round(r / 24) * 24}-${Math.round(g / 24) * 24}-${Math.round(b / 24) * 24}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      buckets.set(key, { rgb: [r, g, b], count: 1, s, l, h });
    }
  }

  const sorted = [...buckets.values()].sort((a, b) => {
    const scoreA = a.count * (a.s * a.s);
    const scoreB = b.count * (b.s * b.s);
    return scoreB - scoreA;
  });
  
  const primary = sorted[0];
  
  if (!primary) {
    return { primary: "#1B3FA0", accent: "#E8233A" };
  }
  
  const accent = sorted.find(c => {
    const hueDiff = Math.abs(c.h - primary.h);
    const dist = Math.min(hueDiff, 1 - hueDiff);
    return dist > 0.15;
  }) || sorted.find(c => {
    return Math.abs(c.l - primary.l) > 0.3;
  }) || sorted[1] || primary;

  const enhance = (c: any) => {
    const enhanced = hslToRgb(c.h, Math.min(1, c.s * 1.5), Math.min(0.6, Math.max(0.3, c.l)));
    return rgbToHex(enhanced[0], enhanced[1], enhanced[2]);
  };

  return {
    primary: enhance(primary),
    accent: enhance(accent),
  };
}

async function main() {
  const catalogPath = join(process.cwd(), "src/data/catalog.json");
  const catalog = JSON.parse(readFileSync(catalogPath, "utf-8")) as {
    sections: Section[];
  };

  for (const section of catalog.sections) {
    if (!section.photoIndex) continue;
    const file = PHOTO_FILES[section.photoIndex - 1];
    if (!file) continue;
    const imagePath = join(process.cwd(), ALBUM_PHOTOS_DIR, file);
    try {
      const colors = await extractColors(imagePath);
      section.colors = colors;
      console.log(`${section.name}: ${colors.primary} / ${colors.accent}`);
    } catch (e) {
      console.log(`Failed to process ${section.name}:`, e);
    }
  }

  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  console.log("Updated catalog colors.");
}

main().catch(console.error);
