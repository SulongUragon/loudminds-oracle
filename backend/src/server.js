import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import { Scanner } from './scanner.js';
import { getTimeSeries } from './marketData.js';
import { parseTimeSeries } from './indicators.js';

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

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🔮 LoudMinds Oracle backend on :${PORT}`);
  console.log(`📊 Watchlist: ${watchlist.length} symbols`);
  console.log(`🧠 Strategies: ${scanner.activeStrategies.join(', ')}`);
  scanner.start(parseInt(process.env.SCAN_INTERVAL_MS || '30000', 10));
});
