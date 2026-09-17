# Ledgerline

A personal task/project manager with daily/weekly/monthly/yearly plans, overdue
alerts, expense tracking with budgets, and a schedule view — installable as a
PWA, syncing across your devices through a small serverless backend.

## How it works

- **Frontend**: static HTML/CSS/JS (no build step), installable as a PWA.
- **Backend**: one Vercel serverless function (`/api/data`) that reads/writes
  a single JSON row in **Supabase** (Postgres).
- **Auth**: a single passcode you choose, stored as an environment variable
  (`APP_PASSCODE`) on the server, checked on every request. This app is
  designed for one person (you) using it from multiple devices — it is not a
  multi-account system.
- No offline mode — every load and save talks directly to Supabase.

## Deploy steps

### 1. Push this folder to a GitHub repo

```
git init
git add .
git commit -m "Ledgerline"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Create a Supabase project

- Go to **supabase.com** → sign up (free tier, no card required) → **New
  project**.
- Pick any name/region and a database password (you won't need that password
  for this app — Supabase generates separate API keys we'll use instead).
- Wait ~1-2 minutes for the project to finish provisioning.

### 3. Create the data table

- In your Supabase project, open the **SQL Editor** (left sidebar) → **New
  query** → paste this and click **Run**:

```sql
create table if not exists ledgerline_data (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
```

That's the only table this app needs — a single row holds your entire
tasks/plans/expenses dataset as JSON.

### 4. Get your API credentials

- In Supabase: **Project Settings** (gear icon) → **API**.
- Copy two values:
  - **Project URL** — looks like `https://xxxxxxxx.supabase.co`
  - **service_role key** (under "Project API keys") — a long secret string.
    ⚠️ This key bypasses all database security rules, so it must only ever
    live in Vercel's server-side environment variables — never put it in any
    frontend file or commit it to GitHub.

### 5. Import the repo into Vercel

- Go to vercel.com → **New Project** → import the repo.
- Framework preset: "Other" (no build step needed).

### 6. Set your environment variables

- Project → **Settings** → **Environment Variables** → add:
  - `SUPABASE_URL` = your Project URL from step 4
  - `SUPABASE_SERVICE_ROLE_KEY` = your service_role key from step 4
  - `APP_PASSCODE` = a password of your choosing (this is what unlocks the
    app — treat it like a real password)
- Redeploy (env var changes only apply to new deployments — go to
  **Deployments** → latest → ⋯ → **Redeploy**, and uncheck "Use existing
  Build Cache" the first time).

### 7. Open your deployed URL

- Enter your passcode on the login screen. It's remembered in that browser
  from then on, so you won't need to re-enter it every visit.
- Repeat on your other devices with the same passcode — they'll all read and
  write the same data.

## Install as a PWA

- **iOS (Safari)**: open the URL → Share → Add to Home Screen.
- **Android (Chrome)**: open the URL → menu (⋮) → Add to Home Screen /
  Install app.
- **Desktop (Chrome/Edge)**: address bar → install icon, or menu → Install
  Ledgerline.

Once installed it opens full-screen like a native app. It always requires an
internet connection — there is no offline mode.

## Notes & limits

- This is single-user: everyone with the passcode shares the same data. If
  you want separate accounts for other people, that needs a real login system
  and per-user rows — ask if you want that built out (Supabase actually makes
  this easier later, since it has built-in auth).
- Sync is "last write wins" — every load fetches fresh, every save overwrites
  the row. Fine for one person across their own devices; not built for
  simultaneous multi-editor use.
- No offline mode: if there's no connection, the app shows a clear error
  rather than silently working from stale data.
- Export/Import (Settings tab) still works exactly as before, as a manual
  backup independent of the server.

## Troubleshooting

- **"No Supabase database connected"**: `SUPABASE_URL` or
  `SUPABASE_SERVICE_ROLE_KEY` isn't set (or was set after the last deploy —
  redeploy after adding env vars).
- **"Server is not configured"**: `APP_PASSCODE` is missing.
- **"Unauthorized"**: both the above are set correctly, but the passcode you
  typed doesn't match `APP_PASSCODE` — check for extra spaces/typos.
- **A generic `FUNCTION_INVOCATION_FAILED` crash**: usually means the
  dependency didn't actually install (e.g. a stale build cache reused old
  `node_modules`). Redeploy with **"Use existing Build Cache" unchecked** to
  force a clean `npm install`, and check the Build Log for a line like
  `added N packages` confirming `@supabase/supabase-js` was installed.
- **To inspect your data directly**: Supabase → **Table Editor** →
  `ledgerline_data` — you'll see the single row with your whole dataset as
  JSON, handy for manual backups or debugging.
