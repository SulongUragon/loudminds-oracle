const BASE = 'https://finnhub.io/api/v1';

// Finnhub free: 60 calls/min, no daily cap
class RateLimiter {
  constructor(perMinute = 60) {
    this.perMinute = perMinute;
    this.calls = [];
  }
  async wait() {
    const now = Date.now();
    this.calls = this.calls.filter(t => now - t < 60000);
    if (this.calls.length >= this.perMinute) {
      const waitMs = 60000 - (now - this.calls[0]) + 100;
      await new Promise(r => setTimeout(r, waitMs));
      return this.wait();
    }
    this.calls.push(now);
  }
}

const limiter = new RateLimiter(55); // leave headroom

async function call(endpoint, params) {
  await limiter.wait();
  const url = new URL(`${BASE}/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set('token', process.env.FINNHUB_API_KEY);

  const res = await fetch(url.toString());
  const data = await res.json();
  return data;
}

const RESOLUTION_MAP = { '1min': 1, '5min': 5, '15min': 15, '30min': 30, '1h': 60 };

export async function getTimeSeries(symbol, interval = '5min', outputsize = 50) {
  const resolution = RESOLUTION_MAP[interval] || 5;
  const to = Math.floor(Date.now() / 1000);
  // Request 5 days back to cover weekends + after-hours gaps
  const from = to - 5 * 24 * 60 * 60;

  const data = await call('stock/candle', { symbol, resolution, from, to });
  if (data.s !== 'ok') {
    console.error(`[finnhub raw] ${symbol}:`, JSON.stringify(data));
    throw new Error(`No data for ${symbol} (${data.s})`);
  }
  return { ...data, _outputsize: outputsize };
}

export async function getQuote(symbol) {
  return call('quote', { symbol });
}

export async function getQuotes(symbols) {
  const results = await Promise.all(symbols.map(s => call('quote', { symbol: s })));
  return Object.fromEntries(symbols.map((s, i) => [s, results[i]]));
}
