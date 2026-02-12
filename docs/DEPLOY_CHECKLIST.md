# PlexifySOLO — Railway Deployment Checklist

Step-by-step guide to deploy PlexifySOLO to Railway.app.
Last updated: 2026-02-12 (Session 5)

---

## Prerequisites

- [x] GitHub repo pushed with latest Session 5 commit
- [x] Supabase project running with seed data loaded
- [x] Anthropic API key active
- [x] `npm run build` passes locally
- [ ] Railway account created (free tier works for sandbox trial)

---

## Step 1: Create Railway Account

1. Go to https://railway.app
2. Click **Sign Up** — use your GitHub account (easiest)
3. Verify your email if prompted

---

## Step 2: Create a New Project

1. From the Railway dashboard, click **New Project**
2. Select **Deploy from GitHub Repo**
3. Connect your GitHub account if not already connected
4. Find and select the `plexifybid` repo (or `plexifysolo` if renamed)
5. Railway will detect the `Dockerfile` and `railway.toml` automatically

---

## Step 3: Set Environment Variables

In the Railway service settings, go to **Variables** and add these:

| Variable | Value | Notes |
|----------|-------|-------|
| `SUPABASE_URL` | `https://your-project.supabase.co` | From Supabase dashboard → Settings → API |
| `SUPABASE_ANON_KEY` | `eyJ...` | From Supabase dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | From Supabase dashboard → Settings → API (keep secret!) |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | From console.anthropic.com → API Keys |
| `NODE_ENV` | `production` | Exactly this value |

**Do NOT set** `PORT` — Railway assigns this automatically.

**Optional** (set after first deploy):
| Variable | Value | Notes |
|----------|-------|-------|
| `ALLOWED_ORIGINS` | `https://your-app.up.railway.app` | Lock down CORS after you know your domain |

### Where to find your Supabase keys:
1. Go to https://supabase.com/dashboard
2. Select your PlexifySOLO project
3. Go to **Settings** → **API**
4. Copy the **Project URL**, **anon public** key, and **service_role** key

### Where to find your Anthropic key:
1. Go to https://console.anthropic.com
2. Click **API Keys**
3. Copy your key (starts with `sk-ant-`)

---

## Step 4: Trigger First Deploy

1. Railway auto-deploys when you push to the connected branch
2. If it doesn't start automatically, click **Deploy** in the Railway dashboard
3. Watch the build logs — you should see:
   - Docker build stages completing
   - `npm ci` installing dependencies
   - `npm run build` building the frontend
   - Final image starting with `node server/index.mjs`
4. Build takes ~2-4 minutes on first deploy

---

## Step 5: Verify Health Check

1. Once deployed, Railway shows a URL like `https://plexifysolo-production.up.railway.app`
2. Open: `https://YOUR-DOMAIN/api/health`
3. You should see:
   ```json
   {
     "status": "ok",
     "version": "0.1.0",
     "environment": "production"
   }
   ```
4. If health check fails, check Railway deploy logs for errors

### Common issues:
- **503 error**: Build succeeded but server crashed. Check logs for missing env vars.
- **Health check timeout**: Server didn't start within 10s. Check that `PORT` env var is NOT manually set.
- **"Cannot find module"**: A dependency is missing. Check that `package.json` has all required deps in `dependencies` (not `devDependencies`).

---

## Step 6: Test Sandbox URL

1. Open: `https://YOUR-DOMAIN/sandbox?token=pxs_c13a257e1701ca2b148733ac591381cd8a284f9b7bd47084`
2. You should see:
   - "Verifying access..." loading animation
   - Redirect to /home with welcome banner: "Welcome back, Mel!"
   - Sidebar showing "Mel Wallace / Hexagon | Multivista"
3. Click **Ask Plexi** in the sidebar
4. Type: "Show me my top prospects"
5. Plexi should respond with real prospect data from Supabase

### If auth fails:
- Check that Supabase has the seed data loaded (tenant with that token)
- Check that `SUPABASE_SERVICE_ROLE_KEY` is set correctly in Railway
- Check Railway logs for auth errors

---

## Step 7: Lock Down CORS

After confirming everything works:

1. Copy your Railway domain (e.g., `https://plexifysolo-production.up.railway.app`)
2. In Railway Variables, add:
   ```
   ALLOWED_ORIGINS=https://plexifysolo-production.up.railway.app
   ```
3. Railway will auto-redeploy with the new variable
4. Verify the app still works after redeploy

---

## Step 8: Share with Mel

Mel's sandbox URL:
```
https://YOUR-DOMAIN/sandbox?token=pxs_c13a257e1701ca2b148733ac591381cd8a284f9b7bd47084
```

Replace `YOUR-DOMAIN` with your actual Railway domain.

---

## Ongoing: Monitor

- **Railway dashboard**: Shows deploy status, logs, metrics
- **Supabase dashboard**: Shows database usage, API requests
- **Anthropic console**: Shows API usage and costs
- **Usage events**: Check `usage_events` table in Supabase for auth + chat activity

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (full access) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | No | Railway sets this automatically — do not set manually |
| `ALLOWED_ORIGINS` | No | Comma-separated allowed CORS origins (default: allow all) |
