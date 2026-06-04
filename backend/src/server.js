import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import { Scanner } from './scanner.js';
import { getTimeSeries, get5minHistory } from './marketData.js';
import { parseTimeSeries } from './indicators.js';
import { STRATEGIES } from './strategies/index.js';
import { getAccount, getPositions, getOrders } from './alpaca.js';

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true }));
app.use(express.json());

const watchlist = (process.env.WATCHLIST || 'AAPL,TSLA,NVDA').split(',').map(s => s.trim().toUpperCase());

const recentAlerts = []; // ring buffer
const MAX_ALERTS = 200;

const scanner = new Scanner({
  watchlist,
  onAlert: (alert) => {
    if (alert._update) {
      // Commentary arrived — patch existing alert in buffer and broadcast update
      const idx = recentAlerts.findIndex(a => a.id === alert.id);
      if (idx !== -1) recentAlerts[idx] = alert;
      broadcast({ type: 'alert_update', data: alert });
      return;
    }
    recentAlerts.unshift(alert);
    if (recentAlerts.length > MAX_ALERTS) recentAlerts.pop();
    broadcast({ type: 'alert', data: alert });
  },
  onTick: (tick) => {
    broadcast({ type: 'tick', data: tick });
  },
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(msg) {
  const str = JSON.stringify(msg);
  wss.clients.forEach(c => {
    if (c.readyState === 1) c.send(str);
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'snapshot', data: { alerts: recentAlerts, stats: scanner.getStats() } }));
});

// REST endpoints
app.get('/api/health', (req, res) => res.json({ ok: true, ...scanner.getStats() }));
app.get('/api/alerts', (req, res) => res.json(recentAlerts));
app.get('/api/strategies', (req, res) => res.json(scanner.getStrategies()));

app.post('/api/strategies', (req, res) => {
  const { active } = req.body;
  if (!Array.isArray(active)) return res.status(400).json({ error: 'active must be array' });
  scanner.setStrategies(active);
  res.json({ ok: true, active: scanner.activeStrategies });
});

app.get('/api/watchlist', (req, res) => res.json(watchlist));

app.get('/api/positions', async (req, res) => {
  try { res.json(await getPositions()); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/account', async (req, res) => {
  try { res.json(await getAccount()); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/candles/:symbol', async (req, res) => {
  try {
    const cached = scanner.getCandles(req.params.symbol.toUpperCase());
    if (cached.length) return res.json(cached);
    const ts = await getTimeSeries(req.params.symbol.toUpperCase(), req.query.interval || '5min', 100);
    res.json(parseTimeSeries(ts));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/backtest', async (req, res) => {
  const symbol = (req.query.symbol || '').toUpperCase();
  const stratKey = req.query.strategy || 'oracle';
  const days = Math.min(55, Math.max(7, parseInt(req.query.days || '30', 10)));

  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  const strat = STRATEGIES[stratKey];
  if (!strat) return res.status(400).json({ error: 'unknown strategy' });

  try {
    const allCandles = await get5minHistory(symbol, days);
    // Filter to regular market hours only (9:30 AM – 4:00 PM ET)
    const candles = allCandles.filter(c => {
      const t = new Date(c.time.replace(' ', 'T') + 'Z');
      const etHour = (t.getUTCHours() - 4 + 24) % 24; // rough ET offset (EDT)
      const etMin = t.getUTCMinutes();
      const mins = etHour * 60 + etMin;
      return mins >= 570 && mins < 960; // 9:30=570, 16:00=960
    });
    const trades = [];
    const MIN_LOOKBACK = 55;
    const EXIT_BARS = 24; // ~2 hours on 5-min candles

    for (let i = MIN_LOOKBACK; i < candles.length - 1; i++) {
      const sig = strat.fn(candles.slice(0, i + 1));
      if (!sig || sig.confidence < 70) continue;
      let outcome = 'TIMEOUT';
      let exitPrice = candles[Math.min(i + EXIT_BARS, candles.length - 1)].close;
      let exitDate = candles[Math.min(i + EXIT_BARS, candles.length - 1)].time;

      for (let j = i + 1; j < Math.min(i + EXIT_BARS + 1, candles.length); j++) {
        const c = candles[j];
        const stopHit = sig.side === 'LONG' ? c.low <= sig.stop : c.high >= sig.stop;
        const targetHit = sig.side === 'LONG' ? c.high >= sig.target : c.low <= sig.target;
        if (stopHit) { outcome = 'LOSS'; exitPrice = sig.stop; exitDate = c.time; break; }
        if (targetHit) { outcome = 'WIN'; exitPrice = sig.target; exitDate = c.time; break; }
      }

      const risk = Math.abs(sig.entry - sig.stop);
      const pnl = sig.side === 'LONG' ? exitPrice - sig.entry : sig.entry - exitPrice;
      trades.push({
        date: candles[i].time,
        symbol,
        side: sig.side,
        entry: +sig.entry.toFixed(2),
        stop: +sig.stop.toFixed(2),
        target: +sig.target.toFixed(2),
        reason: sig.reason,
        exitPrice: +exitPrice.toFixed(2),
        exitDate,
        outcome,
        pnlR: risk > 0 ? +(pnl / risk).toFixed(2) : 0,
      });
      i += 24; // skip ~2 hours to avoid signal clustering
    }

    const wins = trades.filter(t => t.outcome === 'WIN').length;
    const losses = trades.filter(t => t.outcome === 'LOSS').length;
    const totalPnlR = +trades.reduce((s, t) => s + t.pnlR, 0).toFixed(2);
    res.json({
      symbol, strategy: stratKey, strategyName: strat.name, days, trades,
      summary: {
        total: trades.length, wins, losses,
        timeouts: trades.length - wins - losses,
        winRate: trades.length ? Math.round((wins / trades.length) * 100) : 0,
        totalPnlR,
        avgPnlR: trades.length ? +(totalPnlR / trades.length).toFixed(2) : 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🔮 LoudMinds Oracle backend on :${PORT}`);
  console.log(`📊 Watchlist: ${watchlist.length} symbols`);
  console.log(`🧠 Strategies: ${scanner.activeStrategies.join(', ')}`);
  scanner.start(parseInt(process.env.SCAN_INTERVAL_MS || '30000', 10));
});
