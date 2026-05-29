# Panini FIFA World Cup 2026 — Sticker Tracker

Mobile-first web app to track your Panini FIFA World Cup 2026 sticker collection (Colombia edition).

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:4321/grid](http://localhost:4321/grid).

## Features

- **Album Grid** — Clean reconstructed grid for all 48 teams (Mexico → Panama) plus special sections. Click to mark owned (green) or missing.
- **Repeats** — Per-sticker repeat counts for trading duplicates.
- **Dashboard** — Completion stats, team rankings, almost-done highlights.
- **Export** — Download CSV (full collection, missing list, trade/repeats list).

## Catalog generation

The sticker catalog is built from album page photos in `album-pgs/`:

```bash
npm run catalog:build    # Generate src/data/catalog.json
npm run catalog:colors   # Extract per-team colors from photos
```

## Data persistence (local-first)

Collection state is stored in `localStorage` under key `panini-collection-v1`.

### Cloud migration path

To move to MySQL + Railway (see `PLAN.md`):

1. Add Drizzle schema and API routes (`GET/PATCH /api/collection`).
2. Replace `loadCollection` / `saveCollection` in `src/store/persistence.ts` with API calls.
3. Components continue using `$owned` and `$repeats` — no UI changes needed.

## Tech stack

- Astro 6 + React 19 islands
- Tailwind CSS 4
- Nanostores (local state + persistence)
