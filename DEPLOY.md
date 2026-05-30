# Deploying to Railway

## Prerequisites

- A [Railway](https://railway.app) account
- The [Railway CLI](https://docs.railway.app/guides/cli) installed
- Node.js ≥ 22.12.0

---

## 1. Push your code to GitHub

Railway deploys from a Git repo. Push the project to a GitHub repository if you haven't already.

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create panini-tracker --public --source=. --push
```

---

## 2. Create a Railway project

1. Go to [railway.app](https://railway.app) and click **New Project**
2. Select **Deploy from GitHub repo** and connect your repository
3. Railway will detect it as a Node.js project automatically

---

## 3. Add a MySQL database

1. Inside your Railway project, click **+ New**
2. Select **Database → MySQL**
3. Wait for it to provision (usually under a minute)
4. Click the MySQL service → **Variables** tab → copy the `DATABASE_URL` value

---

## 4. Set environment variables

In your Railway app service (not the MySQL service), go to **Variables** and add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Paste the value copied from the MySQL service |
| `NODE_VERSION` | `22` |

Railway automatically exposes `DATABASE_URL` to the app at runtime.

---

## 5. Build & start (automatic)

Railway’s Railpack reads `package.json` automatically:

| Script | Command |
|---|---|
| Build | `npm run build` (default) |
| Start | `npm start` → `node ./dist/server/entry.mjs` |

You usually **do not** need to set custom build/start commands in the dashboard. If deploy fails with “No start command detected”, ensure `package.json` includes the `"start"` script and redeploy.

---

## 6. Database migrations (automatic — no CLI required)

You **do not** need the Railway CLI. Migrations run when the app starts in production.

1. Ensure `DATABASE_URL` is set on your **app** service (copy from MySQL → **Variables** in the Railway dashboard).
2. Push code that includes the `drizzle/` folder.
3. Redeploy (push to GitHub, or **Deploy → Redeploy** in the Railway dashboard).
4. Open **Deploy logs** and look for `[migrate] Database schema is up to date`.

If migration failed, see **“Migrate without CLI”** below.

**Local (optional):** Copy `DATABASE_URL` from Railway into a `.env` file, then:

```bash
npm run db:migrate:run
```

(`db:migrate` / drizzle-kit is only needed when *generating* new migration files, not when applying them.)

---

## Migrate without CLI

Pick **one** of these:

### A. Redeploy (easiest)

Push your branch or click **Redeploy** on the app service. `npm start` runs `scripts/migrate.mjs` before the server.

### B. Run migrate locally with dashboard URL

1. Railway → **MySQL** service → **Variables** → copy `DATABASE_URL` (or `MYSQL_URL`).
2. Create `.env` in the project root:

```env
DATABASE_URL=mysql://user:pass@host:port/railway
```

3. From the project folder:

```bash
npm run db:migrate:run
```

You never need `railway login` or `railway run`.

### C. Paste SQL in Railway (fallback)

If A/B are not an option:

1. Railway → **MySQL** → **Data** tab (or connect with any MySQL client using the public URL).
2. Run the script [`drizzle/manual/trade_requests_once.sql`](drizzle/manual/trade_requests_once.sql) once.

If foreign key errors say the table already exists, you only need the `INSERT INTO __drizzle_migrations` part (or skip if trades already work).

---

## 7. Deploy

Every push to your connected branch triggers an automatic redeploy. To deploy manually:

```bash
railway up
```

---

## Subsequent schema changes

If you update `src/lib/schema.ts`:

```bash
npm run db:generate   # creates a new SQL file in drizzle/
git add drizzle/ && git commit -m "add migration"
git push              # redeploy — migrate runs automatically on start
```

---

## Local development with a database

Copy the Railway `DATABASE_URL` or spin up a local MySQL instance:

```bash
docker run -d -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=panini \
  mysql:8
```

Create a `.env` file at the project root:

```env
DATABASE_URL=mysql://root:root@localhost:3306/panini
```

Then run migrations and start the dev server:

```bash
npm run db:migrate
npm run dev
```

Without a `DATABASE_URL`, the app runs in local mode and stores each user's collection in their browser's localStorage.

---

## Notes

- **Redeploying the app never touches the database.** The MySQL service is independent.
- **Clearing browser storage** is safe — users just re-enter their email to reconnect to their data.
- **The `DATABASE_URL` is server-side only** — it is never sent to the browser.
