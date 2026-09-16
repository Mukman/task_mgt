# Ledgerline

A personal task/project manager with daily/weekly/monthly/yearly plans, overdue
alerts, expense tracking with budgets, and a schedule view — installable as a
PWA, syncing across your devices through a small serverless backend.

## How it works

- **Frontend**: static HTML/CSS/JS (no build step), installable as a PWA.
- **Backend**: one Vercel serverless function (`/api/data`) that reads/writes
  a single JSON blob in **Vercel KV** (Upstash Redis under the hood).
- **Auth**: a single passcode you choose, stored as an environment variable
  (`APP_PASSCODE`) on the server, checked on every request. This app is
  designed for one person (you) using it from multiple devices — it is not a
  multi-account system.

## Deploy steps

1. **Push this folder to a GitHub repo.**
   ```
   git init
   git add .
   git commit -m "Ledgerline"
   git branch -M main
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Import the repo into Vercel**
   - Go to vercel.com → New Project → import the repo.
   - Framework preset: "Other" (no build step needed).
   - Deploy once (it will fail to save data until KV + passcode are set —
     that's expected).

3. **Add Vercel KV to the project**
   - In the Vercel project → **Storage** tab → **Create Database** → **KV**
     (Upstash Redis).
   - Connect it to this project. Vercel will automatically inject the
     required `KV_REST_API_URL` / `KV_REST_API_TOKEN` env vars for you.

4. **Set your passcode**
   - Project → **Settings** → **Environment Variables**.
   - Add `APP_PASSCODE` = something only you know (this is effectively your
     password — treat it like one).
   - Redeploy (Settings changes require a redeploy, or just push a new commit).

5. **Open your deployed URL**
   - Enter your passcode on the login screen. It's stored only in your
     browser's local storage from then on, so you won't need to log in again
     on that device.
   - Repeat on your other devices with the same passcode — they'll all read
     and write the same data.

## Install as a PWA

- **iOS (Safari)**: open the URL → Share → Add to Home Screen.
- **Android (Chrome)**: open the URL → menu (⋮) → Add to Home Screen /
  Install app.
- **Desktop (Chrome/Edge)**: address bar → install icon, or menu → Install
  Ledgerline.

Once installed it opens full-screen like a native app and the service worker
lets the shell load even with no connection (though you'll need connectivity
to sync latest changes across devices).

## Notes & limits

- This is single-user: everyone with the passcode shares the same data. If
  you want separate accounts for other people, that needs a real login system
  and per-user storage keys — ask if you want that built out.
- Sync is "last write wins" — it syncs on load, on regaining focus, and after
  every change. If you edit the same item on two devices at the exact same
  moment, the later save wins. Fine for personal use; not built for
  simultaneous multi-editor use.
- Local storage (in the browser) is used as an offline cache so the app still
  opens and works without a connection; changes made offline sync next time
  you're online and hit "Sync now" or reopen the app.
- Export/Import (Settings tab) still works exactly as before, as a manual
  backup independent of the server.
