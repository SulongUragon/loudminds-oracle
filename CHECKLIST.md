# 🔮 LOUDMINDS ORACLE — DEPLOY CHECKLIST

**Total time when home: ~15 minutes**

Tick mo lang ang bawat step. May exact buttons, links, at copy-paste blocks.

---

## ☐ STEP 1 — Get Twelve Data API Key (2 min)

1. Open: **https://twelvedata.com/register**
2. Sign up (free, no credit card)
3. After login → Dashboard shows your **API Key** at the top
4. Copy the key → save it somewhere (gagamitin sa Step 4)

---

## ☐ STEP 2 — Create GitHub Repo (1 min)

1. Open: **https://github.com/new**
2. Repository name: `loudminds-oracle`
3. Visibility: **Private** (recommended)
4. **DO NOT** check "Add a README" — leave everything blank
5. Click **Create repository**
6. Leave that tab open — you'll need the URL

---

## ☐ STEP 3 — Push Code to GitHub (2 min)

Open Terminal, `cd` into the `oracle-suite` folder, then run:

```bash
bash deploy.sh
```

Enter your GitHub username when prompted. Done.

*(If git asks for credentials, use a Personal Access Token — generate one at https://github.com/settings/tokens/new with `repo` scope.)*

---

## ☐ STEP 4 — Deploy Backend to Railway (4 min)

1. Open: **https://railway.app/new**
2. Click **Deploy from GitHub repo** → authorize if first time
3. Pick `loudminds-oracle`
4. After it loads → click your service → **Settings** tab
5. Scroll to **Root Directory** → set to: `backend` → click Save
6. Go to **Variables** tab → click **Raw Editor**
7. Open `RAILWAY_ENV.txt` from this folder, copy entire content, paste into Railway
8. Replace `YOUR_TWELVE_DATA_KEY_HERE` with your key from Step 1
9. Replace `YOUR_DOMAIN_HERE` with your actual domain (e.g. `loudminds.club`) → save
10. Go to **Settings** → **Networking** → **Generate Domain**
11. Copy the URL (looks like `oracle-api-production-xxxx.up.railway.app`)
12. Test sa browser: paste URL + `/api/health` → dapat may JSON response

✅ Backend live!

---

## ☐ STEP 5 — Point Custom Subdomain (3 min)

1. Sa Railway → **Settings → Networking → Custom Domain**
2. Type: `oracle-api.YOUR_DOMAIN.club` (palitan ng totoong domain mo)
3. Railway gives you a CNAME target (e.g. `xxxx.up.railway.app`) → copy it
4. Open: **https://dash.cloudflare.com** → your domain → **DNS**
5. Click **Add record**:
   - Type: `CNAME`
   - Name: `oracle-api`
   - Target: (paste Railway CNAME)
   - Proxy status: **DNS only** ← IMPORTANT (gray cloud, hindi orange)
   - TTL: Auto
6. Save → wait 1-2 min
7. Test: `https://oracle-api.YOUR_DOMAIN/api/health` → JSON dapat

---

## ☐ STEP 6 — Update Frontend URL & Push (1 min)

1. Open `frontend/index.html` sa text editor
2. Find this line (around line 305):
   ```js
   const API = window.ORACLE_API || 'http://localhost:8080';
   ```
3. Replace with (palitan ng totoo mong subdomain):
   ```js
   const API = 'https://oracle-api.YOUR_DOMAIN.club';
   ```
4. Save → in terminal:
   ```bash
   git add frontend/index.html
   git commit -m "set prod api url"
   git push
   ```

---

## ☐ STEP 7 — Deploy Frontend to Cloudflare Pages (3 min)

1. Open: **https://dash.cloudflare.com** → **Workers & Pages** → **Create**
2. Click **Pages** tab → **Connect to Git**
3. Authorize Cloudflare with GitHub → pick `loudminds-oracle`
4. Build settings:
   - Framework preset: **None**
   - Build command: *(leave blank)*
   - Build output directory: `frontend`
5. Click **Save and Deploy** → wait ~1 min
6. After deployed → **Custom Domains** tab → **Set up a custom domain**
7. Enter: `oracle.YOUR_DOMAIN.club` → Cloudflare auto-configures everything

---

## ☐ STEP 8 — VERIFY (30 sec)

Open: **https://oracle.YOUR_DOMAIN.club**

You should see:
- ✅ Dark gold "LOUDMINDS · ORACLE" logo top-left
- ✅ Green "LIVE" dot top-right (WebSocket connected)
- ✅ Watchlist on the right showing all 50 tickers
- ✅ Chart loading sa center (default = AAPL)
- ✅ "SCANNING" sa bottom bar
- ✅ Alerts pop-up as scanner finds setups (may take 5-10 min)

🎉 **DONE.**

---

## 🆘 TROUBLESHOOTING

| Symptom | Fix |
|---|---|
| Red dot, "RECONNECTING" | Cloudflare CNAME for `oracle-api` must be **gray cloud (DNS only)**, not orange |
| CORS error sa browser console | Railway env `ALLOWED_ORIGINS` mismatch — must equal exactly `https://oracle.YOUR_DOMAIN` |
| Empty watchlist | Backend not running — check Railway logs |
| No alerts after 15 min | Either (a) market closed, or (b) no qualifying setups — toggle all 4 strategy chips ON sa topbar |
| "Rate limit" sa Railway logs | Free Twelve Data tier = 8 calls/min — reduce `WATCHLIST` env to 20 tickers |
| Railway build fails | Make sure **Root Directory** is set to `backend` (Step 4.5) |

---

## 📋 INFO REFERENCE

- **Backend logs**: Railway dashboard → your service → **Deployments** tab → click latest
- **Frontend logs**: Cloudflare Pages → your project → **Deployments**
- **Edit watchlist**: Railway Variables → edit `WATCHLIST` → save → auto-redeploys
- **Edit strategies**: Sa app mismo, click strategy chips sa topbar
- **Total monthly cost**: $5 (Railway) + $0 (Cloudflare) + $0 (Twelve Data free) = **$5/mo**
