import fetch from 'node-fetch';

const BASE = 'https://api.twelvedata.com';

// Rate limiter: free tier = 8 calls/min, 800/day
class RateLimiter {
  constructor(perMinute = 8) {
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

const limiter = new RateLimiter(8);

async function call(endpoint, params) {
  await limiter.wait();
  const url = new URL(`${BASE}/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set('apikey', process.env.TWELVE_DATA_API_KEY);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.status === 'error') throw new Error(data.message);
  return data;
}

export async function getQuote(symbol) {
  return call('quote', { symbol });
}

// Batch quotes via comma-separated symbols (free tier: 1 call returns multiple)
export async function getQuotes(symbols) {
  const data = await call('quote', { symbol: symbols.join(',') });
  // Single symbol returns object, multiple returns object keyed by symbol
  if (symbols.length === 1) return { [symbols[0]]: data };
  return data;
}

export async function getTimeSeries(symbol, interval = '5min', outputsize = 50) {
  return call('time_series', { symbol, interval, outputsize });
}

export async function getRSI(symbol, interval = '5min', time_period = 14) {
  return call('rsi', { symbol, interval, time_period });
}
