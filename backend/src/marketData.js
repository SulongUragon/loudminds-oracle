import yahooFinance from 'yahoo-finance2';

// Yahoo Finance: free, no API key, full OHLCV history
// Suppress noisy validation warnings
yahooFinance.setGlobalConfig({ validation: { logErrors: false } });

const INTERVAL_MAP = { '1min': '1m', '5min': '5m', '15min': '15m', '30min': '30m', '1h': '60m' };

export async function getTimeSeries(symbol, interval = '5min', outputsize = 50) {
  const yhInterval = INTERVAL_MAP[interval] || '5m';
  const result = await yahooFinance.chart(symbol, {
    interval: yhInterval,
    range: '5d',
  });

  if (!result?.quotes?.length) throw new Error(`No data for ${symbol}`);

  const candles = result.quotes
    .filter(q => q.open != null && q.close != null)
    .map(q => ({
      time: new Date(q.date).toISOString().slice(0, 16).replace('T', ' '),
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: q.volume || 0,
    }));

  return { _quotes: candles, _outputsize: outputsize };
}

export async function getQuote(symbol) {
  return yahooFinance.quote(symbol);
}

export async function getQuotes(symbols) {
  const results = await Promise.all(symbols.map(s => yahooFinance.quote(s)));
  return Object.fromEntries(symbols.map((s, i) => [s, results[i]]));
}
