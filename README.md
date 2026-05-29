# Panini FIFA World Cup 2026 — Sticker Tracker

A mobile-first web app to track your Panini FIFA World Cup 2026 sticker collection. Mark stickers as owned, log your repeats, compare with friends, and execute real sticker swaps — all synced to the cloud.

> Built for the Colombia edition of the album, but the catalog structure works for any regional edition.

---

## Features

### 📒 Album Grid
Browse all 994 stickers across 53 sections (48 teams + special sections). Tap once to mark owned, tap again to log a repeat. Green = owned, yellow = you have repeats, white = missing.

### 🔁 Repeats
Track how many extra copies you have of each sticker. The repeats page gives you a searchable list sorted by quantity — useful before a trade session.

### 📊 Analytics Dashboard
- Overall collection completion ring
- Per-team completion rankings
- "Almost done" highlights (≥ 80% complete sections)
- Top repeated stickers

### 🔄 Exchange
Enter a friend's email to see a side-by-side comparison of what you can trade:
- **I can give you** — your repeats they're still missing
- **You can give me** — their repeats you still need
- **Swap Studio** — tap stickers from each column and hit **Swap**. Both albums update in real time, for both users.

### 💾 Data Sync
Import your collection from a CSV file (useful for migrating from a spreadsheet) or export it at any time — full collection, missing list, and repeats list.

### 👤 Multi-profile
Multiple people can use the same deployment with their own email. Each profile's collection is stored separately in the database.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [Astro 6](https://astro.build) + [React 19](https://react.dev) islands |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) |
| State | [Nanostores](https://github.com/nanostores/nanostores) |
| Database | MySQL 8 via [Drizzle ORM](https://orm.drizzle.team) |
| Deployment | [Railway](https://railway.app) |

---

## Getting started

### Prerequisites

- Node.js ≥ 22.12.0
- A MySQL 8 database (optional — works offline without one)

### Install & run

```bash
git clone https://github.com/your-username/panini-tracker
cd panini-tracker
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

### With a database

Create a `.env` file at the project root:

```env
DATABASE_URL=mysql://user:password@localhost:3306/panini
```

Then run migrations and start:

```bash
npm run db:migrate
npm run dev
```

Without `DATABASE_URL` the app still works — each browser stores its own collection in `localStorage`.

### Available scripts

```bash
npm run dev           # Start dev server
npm run build         # Production build
npm run db:generate   # Generate new Drizzle migration after schema changes
npm run db:migrate    # Apply pending migrations
npm run db:studio     # Open Drizzle Studio (DB GUI)
```

---

## Deployment

The app is designed to deploy on [Railway](https://railway.app) with a MySQL plugin. See **[DEPLOY.md](./DEPLOY.md)** for the full step-by-step guide, including:

- Creating a Railway project
- Provisioning MySQL
- Setting environment variables
- Automatic migration on deploy

---

## Project structure

```
src/
├── components/       # React islands
│   ├── StickerGrid   # Main album grid with tap-to-own
│   ├── Dashboard     # Analytics and rankings
│   ├── Exchange      # Friend comparison + swap studio
│   ├── Repeats       # Repeat sticker management
│   └── DataSync      # CSV import / export
├── data/
│   └── catalog.json  # All 994 stickers across 53 sections
├── lib/
│   ├── db.ts         # Drizzle + MySQL connection
│   ├── schema.ts     # Database schema
│   └── exchange.ts   # Exchange / swap logic
├── pages/
│   ├── api/          # Server-side API routes
│   └── *.astro       # Page shells
└── store/
    ├── collectionStore.ts  # Nanostores atoms
    └── persistence.ts      # Auto-sync to DB on state change
```

---

## Catalog

The sticker catalog lives in `src/data/catalog.json` and contains every sticker number, label, section, team colors, and type (player, shield, team photo, etc.).

If you need to rebuild it from album page photos:

```bash
npm run catalog:build    # Generate catalog.json from scanned pages
npm run catalog:colors   # Extract team kit colors from photos
```

---

## Contributing

Pull requests are welcome. For major changes please open an issue first.

1. Fork the repo
2. Create a branch (`git checkout -b feature/my-thing`)
3. Commit your changes
4. Push and open a PR

---

## License

MIT — see [LICENSE](./LICENSE).
