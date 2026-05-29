# Panini FIFA World Cup 2026 — Sticker Tracker App
## Comprehensive Build Plan

---

## 0. Overview

A mobile-first web app to track your Panini FIFA World Cup 2026 sticker collection (Colombia edition). Built with Astro + React islands, backed by MySQL, deployed on Railway.

**Two core views:**
- **Dashboard** — stats, team completion rankings, trade intelligence
- **Grid** — mark stickers as owned / duplicate / missing

---

## 1. Tech Stack

| Layer | Choice | Version | Reason |
|---|---|---|---|
| Framework | Astro | `6.3.8` | Near-zero JS by default, perfect for mobile |
| Islands | React | `19` | Only where interactivity needed |
| Styling | Tailwind CSS | `4.x` | Fast, utility-first |
| State | Nanostores | `1.3.0` | Astro's officially recommended state manager for islands — framework-agnostic, 294 bytes |
| Nanostores React | @nanostores/react | `1.1.0` | React adapter for Nanostores |
| Database | MySQL | `8` | Structured, relational, Railway-native |
| ORM | Drizzle ORM | `0.45.2` | Lightweight, type-safe, works great with MySQL |
| DB Kit | drizzle-kit | `latest` | Migrations + Drizzle Studio |
| MySQL client | mysql2 | `latest` | Node.js MySQL driver Drizzle uses |
| API | Astro API Routes | built-in | No extra server needed |
| Export | SheetJS (xlsx) | `latest` | CSV + Excel export |
| Scripts runtime | tsx | `latest` | Run TypeScript scripts directly |
| Deploy | Railway | — | MySQL plugin + Astro deploy in one project |

> **Node requirement:** Astro 6 requires **Node 22.12.0 or higher**. Set this in Railway's environment config before deploying.

---

## 2. Color System

Extracted directly from the Panini FIFA World Cup 2026 Colombia Edition cover.

```css
:root {
  --color-primary:        #1B3FA0;  /* Deep Blue — primary actions, nav */
  --color-accent-red:     #E8233A;  /* Vibrant Red — alerts, missing */
  --color-accent-green:   #4CAF50;  /* Bright Green — owned / complete */
  --color-accent-yellow:  #FFD700;  /* Sunshine Yellow — duplicates */
  --color-accent-teal:    #00BCD4;  /* Teal — highlights, badges */
  --color-bg:             #F5F5F5;  /* Off White — page background */
  --color-text:           #1A1A1A;  /* Near Black — body text */

  /* Colombia flag */
  --color-col-yellow:     #FCD116;
  --color-col-blue:       #003087;
  --color-col-red:        #CE1126;
}
```

**Sticker state colors:**

| State | Color | Token |
|---|---|---|
| Missing | Red | `--color-accent-red` |
| Owned | Green | `--color-accent-green` |
| Duplicate | Yellow | `--color-accent-yellow` |

---

## 3. Database Schema (MySQL)

```sql
-- Teams / Sections
CREATE TABLE sections (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,       -- e.g. "Colombia", "Group A"
  slug        VARCHAR(100) NOT NULL UNIQUE,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Master sticker catalog (source of truth, populated from scans)
CREATE TABLE stickers (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  number      VARCHAR(10) NOT NULL UNIQUE, -- e.g. "1", "COL-1", "FWC-3"
  section_id  INT NOT NULL,
  label       VARCHAR(200),               -- player name / description if known
  is_shiny    BOOLEAN DEFAULT FALSE,
  sort_order  INT DEFAULT 0,
  FOREIGN KEY (section_id) REFERENCES sections(id)
);

-- User's collection state
CREATE TABLE collection (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  sticker_id  INT NOT NULL UNIQUE,
  state       ENUM('missing', 'owned', 'duplicate') DEFAULT 'missing',
  quantity    INT DEFAULT 0,             -- how many copies owned
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sticker_id) REFERENCES stickers(id)
);
```

> **Note:** `collection` has one row per sticker, always. Seed it with `state = 'missing'` for all stickers after initial catalog import.

---

## 4. Project Structure

```
/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx          # React island — stats view
│   │   ├── StickerGrid.tsx        # React island — grid view
│   │   ├── SectionCard.tsx        # Team completion card
│   │   ├── StickerCell.tsx        # Individual sticker tap target
│   │   ├── ProgressRing.tsx       # SVG progress ring
│   │   ├── NavBar.tsx             # Bottom tab navigation
│   │   ├── ImportCSV.tsx          # CSV upload component
│   │   └── ExportButton.tsx       # CSV/Excel export
│   ├── layouts/
│   │   └── Base.astro
│   ├── pages/
│   │   ├── index.astro            # Redirects to /dashboard
│   │   ├── dashboard.astro
│   │   ├── grid.astro
│   │   └── api/
│   │       ├── stickers.ts        # GET all stickers + states
│   │       ├── collection.ts      # PATCH state, GET missing/dupes
│   │       ├── import.ts          # POST CSV import
│   │       └── export.ts          # GET CSV/Excel download
│   ├── lib/
│   │   ├── db.ts                  # Drizzle MySQL connection
│   │   ├── schema.ts              # Drizzle schema (mirrors SQL above)
│   │   └── stickers.ts            # DB query helpers
│   ├── store/
│   │   ├── collectionStore.ts     # Nanostores atoms for sticker state
│   │   └── uiStore.ts             # Nanostores atoms for UI state (active filter, section)
│   └── styles/
│       └── global.css             # CSS custom properties + Tailwind base
├── scans/                         # <<< AI INSTRUCTION BELOW
├── scripts/
│   └── seed-from-scans.ts         # Parse scan data → seed DB
├── astro.config.mjs
├── tailwind.config.mjs
├── drizzle.config.ts
├── package.json
└── PLAN.md                        # This file
```

---

## 5. Nanostores — State Design

Nanostores is Astro's officially recommended state library for sharing state between islands. It is framework-agnostic, tree-shakable, and under 300 bytes.

```typescript
// src/store/collectionStore.ts
import { atom, map } from 'nanostores'

// Map of sticker_number -> state
// e.g. { "COL-1": "owned", "COL-2": "missing", "COL-3": "duplicate" }
export const $collection = map<Record<string, 'missing' | 'owned' | 'duplicate'>>({})

// Map of sticker_number -> quantity (for duplicates)
export const $quantities = map<Record<string, number>>({})

// Active filter in grid view
export const $activeFilter = atom<'all' | 'missing' | 'owned' | 'duplicate'>('all')

// Active section slug for jump navigation
export const $activeSection = atom<string>('')
```

```typescript
// Usage in a React island
import { useStore } from '@nanostores/react'
import { $collection } from '../store/collectionStore'

export const StickerCell = ({ number }: { number: string }) => {
  const collection = useStore($collection)
  const state = collection[number] ?? 'missing'
  // ...
}
```

---

## 6. AI Scan Processing Instructions

> **IMPORTANT — READ BEFORE BUILDING**
>
> The developer will provide a folder called `/scans/` containing **one photo per album page**, named sequentially:
> `page-01.jpg`, `page-02.jpg`, `page-03.jpg` ... etc.
>
> **Your job as AI (Claude Code) when you receive these scans:**
>
> 1. Analyze each image one by one
> 2. For each page, extract:
>    - The **section name** (team name or special section label visible on the page header)
>    - Every **sticker number** visible (printed in the corner of each sticker slot)
>    - Whether any stickers appear to be **shiny / foil** (usually marked differently)
> 3. Build a `stickers.json` file in this exact format:
>
> ```json
> [
>   {
>     "section": "Colombia",
>     "slug": "colombia",
>     "stickers": [
>       { "number": "COL-1", "label": "", "isShiny": false },
>       { "number": "COL-2", "label": "", "isShiny": false },
>       { "number": "COL-S1", "label": "Squad Shot", "isShiny": true }
>     ]
>   },
>   {
>     "section": "FIFA World Cup Moments",
>     "slug": "fifa-world-cup-moments",
>     "stickers": [
>       { "number": "FWC-1", "label": "", "isShiny": false }
>     ]
>   }
> ]
> ```
>
> 4. Then run `scripts/seed-from-scans.ts` to populate the database
> 5. Confirm total sticker count and section count after seeding
>
> **If a number is unclear in a scan**, mark it as `"number": "UNCLEAR-P{page}-{position}"` and flag it in a `SCAN_ISSUES.md` file for manual review.

---

## 7. API Routes

### `GET /api/stickers`
Returns all stickers with their current collection state.

```typescript
// Response
{
  sections: [
    {
      id: 1,
      name: "Colombia",
      slug: "colombia",
      total: 18,
      owned: 12,
      duplicates: 3,
      stickers: [
        { id: 1, number: "COL-1", state: "owned", quantity: 1 },
        { id: 2, number: "COL-2", state: "missing", quantity: 0 },
        { id: 3, number: "COL-3", state: "duplicate", quantity: 2 }
      ]
    }
  ]
}
```

### `PATCH /api/collection`
Update a sticker's state.

```typescript
// Request body
{ stickerId: number, state: "missing" | "owned" | "duplicate", quantity?: number }

// Response
{ success: true, sticker: { id, state, quantity } }
```

### `POST /api/import`
Accept a CSV file and bulk-update collection states.

```typescript
// Expected CSV columns: number, state, quantity
// number = sticker number (e.g. "COL-1")
// state = missing | owned | duplicate
// quantity = integer
```

### `GET /api/export?format=csv|xlsx`
Download current collection state as CSV or Excel.

---

## 8. Dashboard View — Components & Data

```
Dashboard
├── ProgressRing          — Overall % complete (giant ring, primary blue)
├── StatBar               — Row of quick stats
│   ├── Total stickers
│   ├── Owned
│   ├── Missing
│   └── Duplicates (available for trade)
├── SectionRankings       — Team cards sorted by % complete
│   └── SectionCard (per team)
│       ├── Team name
│       ├── Progress bar (colored by %)
│       ├── X / Y stickers
│       └── Duplicate count badge
├── AlmostDone            — Sections >= 80% complete (highlighted in teal)
└── TradeBoard            — Your duplicate stickers grouped by section
```

**Dashboard computed stats:**

- Overall completion %
- Average team completion %
- Most complete team
- Least complete team
- Total duplicates available for trade
- Top 5 duplicate stickers (most copies)

---

## 9. Grid View — Components & Data

```
Grid
├── FilterBar             — Tabs: All / Missing / Owned / Duplicates
├── SectionSelect         — Dropdown to jump to a section
└── StickerGrid (per section)
    ├── Section header    — Team name + mini progress bar
    └── StickerCell[]     — Tap to cycle state
        ├── Missing       — Red background, number shown
        ├── Owned         — Green background, checkmark
        └── Duplicate     — Yellow background, count badge
```

**Tap behavior:**
- First tap: missing → owned
- Second tap: owned → duplicate (quantity++)
- Long press on duplicate: decrease quantity (back to owned if 0)
- State saved to DB immediately on tap (optimistic UI)

---

## 10. CSV Import / Export Format

### Import (upload)
```csv
number,state,quantity
COL-1,owned,1
COL-2,duplicate,3
COL-3,missing,0
```

### Export (download)
Two sheets if Excel, two files if CSV:

**Sheet 1 — Missing:**
```csv
number,section
COL-2,Colombia
BRA-4,Brazil
```

**Sheet 2 — Duplicates (trade list):**
```csv
number,section,quantity
COL-3,Colombia,2
ARG-1,Argentina,1
```

---

## 11. NavBar (Bottom Tab — Mobile First)

```
[ Dashboard ]  [ Grid ]  [ Import/Export ]
```

Active tab highlighted in `--color-primary` (#1B3FA0).
Fixed to bottom of screen, safe area inset aware.

---

## 12. Railway Deployment

### Setup
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway init

# Add MySQL plugin inside Railway dashboard
# Copy DATABASE_URL from Railway env vars
```

### Environment Variables
```env
DATABASE_URL=mysql://user:pass@host:port/dbname
PUBLIC_APP_NAME=Sticker Tracker
NODE_VERSION=22
```

### Build Config (Railway)
```
Build Command:   npm run build
Start Command:   node ./dist/server/entry.mjs
Output Dir:      dist
```

### `astro.config.mjs` for Railway
```javascript
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

export default defineConfig({
  integrations: [react(), tailwind()],
  output: 'server',           // SSR mode for API routes + DB access
  adapter: node({
    mode: 'standalone'
  }),
});
```

### First Deploy Sequence
```bash
# 1. Push to GitHub
# 2. Connect repo to Railway
# 3. Set environment variables in Railway dashboard (including NODE_VERSION=22)
# 4. Run DB migrations
railway run npm run db:migrate

# 5. Seed sticker catalog (after scans processed)
railway run npm run db:seed

# 6. Deploy
railway up
```

### `package.json` scripts
```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "tsx scripts/seed-from-scans.ts",
    "db:studio": "drizzle-kit studio"
  }
}
```

### `package.json` dependencies (pinned versions)
```json
{
  "dependencies": {
    "astro": "^6.3.8",
    "@astrojs/react": "latest",
    "@astrojs/tailwind": "latest",
    "@astrojs/node": "latest",
    "react": "^19",
    "react-dom": "^19",
    "nanostores": "^1.3.0",
    "@nanostores/react": "^1.1.0",
    "drizzle-orm": "^0.45.2",
    "mysql2": "latest",
    "xlsx": "latest"
  },
  "devDependencies": {
    "drizzle-kit": "latest",
    "tsx": "latest",
    "typescript": "latest",
    "tailwindcss": "latest"
  }
}
```

---

## 13. Build Sequence (Step by Step)

Follow this order to avoid blockers:

1. Verify Node version: `node -v` must be >= 22.12.0
2. `npm create astro@latest` -- select empty template, TypeScript strict
3. Add integrations: `npx astro add react tailwind node`
4. Install deps: `npm install nanostores @nanostores/react drizzle-orm mysql2 xlsx`
5. Install dev deps: `npm install -D drizzle-kit tsx`
6. Set up `src/lib/db.ts` with Drizzle + MySQL connection
7. Write schema in `src/lib/schema.ts`
8. Run `npm run db:generate && npm run db:migrate`
9. **Drop scans into `/scans/` folder and process with AI** (see Section 6)
10. Run `npm run db:seed` to populate sticker catalog
11. Build API routes (`/api/stickers`, `/api/collection`, `/api/import`, `/api/export`)
12. Build Nanostores atoms in `src/store/`
13. Build `StickerCell` + `StickerGrid` React island
14. Build `Dashboard` React island
15. Build `NavBar`
16. Build `ImportCSV` + `ExportButton`
17. Wire pages (`dashboard.astro`, `grid.astro`)
18. Test on mobile (Chrome DevTools device mode)
19. Set `NODE_VERSION=22` in Railway dashboard
20. Deploy to Railway

---

## 14. Notes & Future Enhancements (Post v1)

- Trade matching: share your duplicates list via link, match with friends
- Notification when a section hits 100%
- Photo mode: take photo of loose sticker pile, extract numbers via OCR (v2)
- Multi-user / family mode
- PWA manifest for home screen install
