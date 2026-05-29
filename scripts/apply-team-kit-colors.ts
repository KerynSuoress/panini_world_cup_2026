/**
 * Apply national team kit colors to team sections in catalog.json.
 * Run: npm run catalog:kit-colors
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TEAM_KIT_COLORS } from "./team-kit-colors";
import type { Section } from "./build-catalog";

const catalogPath = join(process.cwd(), "src/data/catalog.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf-8")) as {
  sections: Section[];
};

let updated = 0;
for (const section of catalog.sections) {
  if (section.type !== "team" || !section.code) continue;
  const colors = TEAM_KIT_COLORS[section.code];
  if (!colors) {
    console.warn(`No kit colors for ${section.code} (${section.name})`);
    continue;
  }
  section.colors = colors;
  console.log(`${section.code.padEnd(4)} ${section.name}: ${colors.primary} / ${colors.accent}`);
  updated++;
}

writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
console.log(`\nUpdated ${updated} team sections.`);
