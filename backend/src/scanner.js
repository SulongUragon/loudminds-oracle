import { getTimeSeries } from './twelveData.js';
import { parseTimeSeries } from './indicators.js';
import { runStrategies, STRATEGIES } from './strategies/index.js';
import { generateCommentary } from './commentary.js';

export class Scanner {
  constructor({ watchlist, onAlert, onTick }) {
    this.watchlist = watchlist;
    this.onAlert = onAlert;
    this.onTick = onTick;
    this.candleCache = new Map(); // symbol -> { candles, lastFetch }
    this.recentAlerts = new Map(); // symbol -> timestamp (dedupe)
    this.activeStrategies = ['oracle'];
    this.cursor = 0;
    this.running = false;
    this.stats = { scans: 0, alerts: 0, errors: 0, startedAt: Date.now() };
  }

  setStrategies(keys) {
    this.activeStrategies = keys.filter(k => STRATEGIES[k]);
  }

  getStrategies() {
    return Object.entries(STRATEGIES).map(([k, v]) => ({
      key: k,
      name: v.name,
      active: this.activeStrategies.includes(k),
    }));
  }

  async scanSymbol(symbol) {
    try {
      const ts = await getTimeSeries(symbol, '5min', 50);
      const candles = parseTimeSeries(ts);
      if (candles.length < 21) return;

      this.candleCache.set(symbol, { candles, lastFetch: Date.now() });

      const last = candles[candles.length - 1];
      this.onTick?.({ symbol, price: last.close, volume: last.volume, time: last.time });

      const signals = runStrategies(candles, this.activeStrategies);
      for (const sig of signals) {
        const dedupeKey = `${symbol}:${sig.strategy}:${sig.side}`;
        const lastAlertTime = this.recentAlerts.get(dedupeKey) || 0;
        if (Date.now() - lastAlertTime < 15 * 60 * 1000) continue; // 15min dedupe

        this.recentAlerts.set(dedupeKey, Date.now());
        const alert = {
          id: `${Date.now()}-${symbol}-${sig.strategy}`,
          symbol,
          timestamp: new Date().toISOString(),
          price: last.close,
          ...sig,
        };
        this.stats.alerts++;
        // Generate AI commentary async — emit alert immediately, then push update
        this.onAlert?.(alert);
        generateCommentary(alert, candles).then(commentary => {
          if (commentary) {
            alert.commentary = commentary;
            this.onAlert?.({ ...alert, _update: true });
          }
        }).catch(() => {});
      }
    } catch (err) {
      this.stats.errors++;
      console.error(`[scan ${symbol}]`, err.message);
    }
  }

  async start(intervalMs = 30000) {
    this.running = true;
    // Free tier: 8 calls/min. We scan 1 symbol per cycle, rotating through watchlist.
    // With 50 symbols & 30s interval = full sweep every 25 minutes. Adjust per plan.
    while (this.running) {
      const symbol = this.watchlist[this.cursor % this.watchlist.length];
      this.cursor++;
      this.stats.scans++;
      await this.scanSymbol(symbol);
      await new Promise(r => setTimeout(r, intervalMs));
    }
  }

  stop() { this.running = false; }

  getCandles(symbol) {
    return this.candleCache.get(symbol)?.candles || [];
  }

  getStats() {
    return {
      ...this.stats,
      uptime: Math.floor((Date.now() - this.stats.startedAt) / 1000),
      watchlistSize: this.watchlist.length,
      cached: this.candleCache.size,
      activeStrategies: this.activeStrategies,
    };
  }
}
