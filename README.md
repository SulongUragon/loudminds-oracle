# 🔮 LOUDMINDS ORACLE — Stock Alert Suite

99% replica of StocksToTrade Oracle. **REAL** market data, **REAL** algorithmic signals.

**Stack:** Node.js + Express + WebSocket (backend) · Vanilla HTML/JS + TradingView Lightweight Charts (frontend) · Twelve Data API

---

## ⚡ QUICK START (Local Test)

```bash
# 1. Backend
cd backend
cp .env.example .env
# Edit .env: paste your TWELVE_DATA_API_KEY (https://twelvedata.com/account)
npm install
npm start

# 2. Frontend (new terminal)
cd frontend
# Open index.html in browser (or use any static server, e.g.:)
npx serve .
```

Open `http://localhost:3000` (or wherever your static server points). Backend runs on `:8080`.

---

## 🚀 PRODUCTION DEPLOYMENT (Cloudflare + Railway)

### A. Deploy Backend to Railway

1. Push project to GitHub.
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub.
3. Pick the `backend/` folder as root.
4. Add env vars in Railway dashboard:
   - `TWELVE_DATA_API_KEY` = your key
   - `WATCHLIST` = comma-separated tickers (or use default)
   - `ALLOWED_ORIGINS` = `https://oracle.yourdomain.com`
   - `SCAN_INTERVAL_MS` = `30000`
5. Deploy. Note the generated URL (e.g., `oracle-api-production.up.railway.app`).

### B. Add Custom Subdomain via Cloudflare

1. Railway → Settings → Networking → Custom Domain → `oracle-api.yourdomain.com`.
2. Railway gives you a CNAME target (e.g., `xyz.up.railway.app`).
3. Cloudflare DNS → Add CNAME:
   - Name: `oracle-api`
   - Target: (Railway CNAME)
   - Proxy status: **DNS only** (gray cloud — required for WebSocket)
4. Wait 1-2 min for SSL.

> ⚠️ **WebSocket note:** Cloudflare proxied mode (orange cloud) supports WS but can interfere with long-lived connections on free plans. Use **DNS only** for backend.

### C. Deploy Frontend to Cloudflare Pages

1. Edit `frontend/index.html` line near the top of `<script>`:
   ```js
   const API = window.ORACLE_API || 'https://oracle-api.yourdomain.com';
   ```
2. Cloudflare Dashboard → Pages → Create Project → Connect to GitHub.
3. Pick `frontend/` as root, no build command needed (static).
4. Pages → Custom Domain → `oracle.yourdomain.com`.

### D. Final URLs
- Frontend: `https://oracle.yourdomain.com`
- Backend API: `https://oracle-api.yourdomain.com/api/health`
- WebSocket: `wss://oracle-api.yourdomain.com/ws`

---

## 🧠 ALERT STRATEGIES

Toggle live from the topbar. Multiple can run simultaneously.

| Key | Name | Logic |
|---|---|---|
| `oracle` | Oracle Momentum | Break 20-bar high/low + RVOL ≥ 2.0 + ATR-based stops/targets |
| `pullback` | Pullback EMA20 | Pullback to EMA20 in uptrend (EMA20>EMA50) + RSI 40-65 |
| `gap` | Gap & Go | Gap ±2% holding direction + RVOL ≥ 1.5 |
| `vwap` | VWAP Reclaim | Cross above/below VWAP + RVOL ≥ 1.3 |

All signals include: side (LONG/SHORT), entry, stop, target, confidence %, and reason.

---

## ⚙️ FREE TIER LIMITS & TUNING

Twelve Data Free = **8 calls/min, 800/day**.

With `SCAN_INTERVAL_MS=30000` and 50 tickers, the scanner rotates through the watchlist every ~25 min. To scan faster:

- **Reduce watchlist** to 20 tickers → full sweep every ~10 min.
- **Upgrade to Grow ($29/mo)** → set `SCAN_INTERVAL_MS=2000`, WebSocket-grade real-time.

Edit `WATCHLIST` env var anytime; restart backend.

---

## 💰 MONETIZATION (LoudMinds Product Angle)

1. **Tiered SaaS** ($29 / $79 / $149/mo):
   - Free: 10 tickers, oracle strategy only, 15-min delayed.
   - Pro: 50 tickers, all strategies, real-time, Telegram alerts.
   - Elite: Custom watchlists, backtesting, AI commentary (Claude on each alert).
2. **Telegram bot bridge** — push every alert to `@SavageSulongBot`. Charge $19/mo for signal-only access.
3. **White-label** — sell the codebase as a one-time license ($497) to other trader brands.
4. **Backtest add-on** — historical alert replay + win-rate report = $49/mo upsell.

---

## 🔧 EXTEND

- **Add Telegram alerts:** in `server.js` `onAlert`, POST to `https://api.telegram.org/bot<TOKEN>/sendMessage`.
- **Add news catalyst:** integrate Finnhub `/news` endpoint, attach to alerts.
- **Add Claude AI commentary:** call Anthropic API per alert with the candle context for natural-language thesis.
- **Add backtesting:** loop strategies over historical `time_series` and log hypothetical trades.

---

## 📁 PROJECT STRUCTURE

```
oracle-suite/
├── backend/
│   ├── src/
│   │   ├── server.js          # Express + WebSocket
│   │   ├── scanner.js         # Watchlist rotation engine
│   │   ├── twelveData.js      # API client + rate limiter
│   │   ├── indicators.js      # SMA, EMA, RSI, VWAP, ATR, RVOL
│   │   └── strategies/index.js # 4 alert strategies
│   ├── package.json
│   ├── railway.json
│   └── .env.example
└── frontend/
    ├── index.html              # Full dashboard (single file)
    ├── wrangler.toml
    └── _headers
```
