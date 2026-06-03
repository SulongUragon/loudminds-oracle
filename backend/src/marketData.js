import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();
const INTERVAL_MAP = { '1min': '1m', '5min': '5m', '15min': '15m', '30min': '30m', '1h': '60m' };

export async function getTimeSeries(symbol, interval = '5min', outputsize = 50) {
  const yhInterval = INTERVAL_MAP[interval] || '5m';
  const period1 = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

  const result = await yf.chart(symbol, { interval: yhInterval, period1 });
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
  return yf.quote(symbol);
}

export async function getQuotes(symbols) {
  const results = await Promise.all(symbols.map(s => yf.quote(s)));
  return Object.fromEntries(symbols.map((s, i) => [s, results[i]]));
}

export async function getDailyHistory(symbol, days = 90) {
  const period1 = new Date(Date.now() - (days + 60) * 24 * 60 * 60 * 1000);
  const result = await yf.chart(symbol, { interval: '1d', period1 });
  if (!result?.quotes?.length) throw new Error(`No data for ${symbol}`);
  return result.quotes
    .filter(q => q.open != null && q.close != null)
    .map(q => ({
      time: new Date(q.date).toISOString().slice(0, 10),
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: q.volume || 0,
    }));
}
