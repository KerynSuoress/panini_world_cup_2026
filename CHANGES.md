# CHANGES — Grid Search, Scroll Fix & History

## Scroll-to-section fix

- **File:** `src/components/StickerGrid.tsx`
- Replaced `scrollIntoView` with manual scroll using `getBoundingClientRect()` to force layout flush before scrolling.
- Fixes sections landing halfway when using "Jump to section" with `content-visibility: auto` enabled.

## Sticker search modal

- **New:** `src/components/StickerSearch.tsx`
- Search bar on the Album grid opens a bottom-sheet modal.
- Matches sticker numbers and player names (case-insensitive, up to 30 results).
- Results grouped by section with owned / missing / repeat state.
- `+` / `−` buttons mark stickers without leaving search.

## History tab

- **New:** `src/pages/history.astro`, `src/components/History.tsx`
- **New:** `src/pages/api/history.ts` — `GET /api/history?profileId=&filter=&limit=`
- **Updated:** `src/pages/api/collection.ts` — `PATCH` now reads old state, upserts collection, and writes a history row when owned/repeats change.
- **Schema:** `history` table in `src/lib/schema.ts`
- **Migration:** `drizzle/0002_history.sql` + journal entry (auto-applies on deploy via `scripts/migrate.mjs`; runs after `0001_trade_requests`)

### History filters

| Tab | API filter |
|-----|------------|
| All | `all` |
| Recently Added | `owned_on` |
| Repeat Changes | `repeats` (`repeat_add`, `repeat_remove`) |
| Recently Removed | `owned_off` |

### Undo

Each history row has an **Undo** button that restores `oldOwned` / `oldRepeats` via `PATCH /api/collection` and updates local Nanostores.

## Navigation

- **History** tab added to `src/components/Navigation.tsx` and `src/layouts/Base.astro`.

## Deploy notes

- No manual migration step required — push and Railway runs migrations on startup.
- History only persists when `DATABASE_URL` is configured (same as collection sync).
