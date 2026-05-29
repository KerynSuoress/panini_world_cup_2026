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

## 5. Configure build & start commands

In your Railway app service → **Settings → Build & Deploy**:

| Setting | Value |
|---|---|
| Build Command | `npm run build` |
| Start Command | `node ./dist/server/entry.mjs` |

---

## 6. Run the database migration

After the first deploy completes, open a terminal and run:

```bash
railway login
railway link   # select your project and environment
railway run npm run db:migrate
```

This creates the `profiles` and `collection` tables. You only need to do this once (or after schema changes).

---

## 7. Deploy

Every push to your connected branch triggers an automatic redeploy. To deploy manually:

```bash
railway up
```

---

## Subsequent schema changes

If you update `src/lib/schema.ts`, generate a new migration and run it:

```bash
npm run db:generate   # generates SQL migration in /drizzle
git add drizzle/ && git commit -m "add migration"
git push              # triggers redeploy
railway run npm run db:migrate
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
