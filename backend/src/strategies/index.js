import { sma, ema, rsi, vwap, atr, rvol } from '../indicators.js';

/**
 * Each strategy returns either null (no signal) or:
 * { side: 'LONG'|'SHORT', entry, stop, target, confidence, reason }
 */

// 1. ORACLE-STYLE: Momentum breakout + volume spike
export function oracleMomentum(candles) {
  if (candles.length < 55) return null;
  const last = candles[candles.length - 1];
  const prev20 = candles.slice(-21, -1);
  const high20 = Math.max(...prev20.map(c => c.high));
  const low20 = Math.min(...prev20.map(c => c.low));
  const rv = rvol(candles, 20);
  const a = atr(candles, 14);
  const closes = candles.map(c => c.close);
  const ema50 = ema(closes, 50);
  if (!rv || !a || !ema50) return null;

  // Skip low-volatility stocks — ATR must be at least 0.5% of price
  if (a / last.close < 0.005) return null;

  const uptrend = last.close > ema50;

  // Long breakout — only in uptrend
  if (uptrend && last.close > high20 && rv >= 1.8) {
    return {
      side: 'LONG',
      entry: last.close,
      stop: +(last.close - a * 1.5).toFixed(2),
      target: +(last.close + a * 2).toFixed(2),
      confidence: Math.min(95, 60 + rv * 10),
      reason: `Breakout > 20-bar high | RVOL ${rv.toFixed(2)}x | ATR ${a.toFixed(2)} | EMA50 ✓`,
    };
  }
  // Short breakdown — only in downtrend
  if (!uptrend && last.close < low20 && rv >= 1.8) {
    return {
      side: 'SHORT',
      entry: last.close,
      stop: +(last.close + a * 1.5).toFixed(2),
      target: +(last.close - a * 2).toFixed(2),
      confidence: Math.min(95, 60 + rv * 10),
      reason: `Breakdown < 20-bar low | RVOL ${rv.toFixed(2)}x | ATR ${a.toFixed(2)} | EMA50 ✓`,
    };
  }
  return null;
}

// 2. PULLBACK to EMA20 in uptrend
export function pullbackEMA(candles) {
  if (candles.length < 50) return null;
  const closes = candles.map(c => c.close);
  const last = candles[candles.length - 1];
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const a = atr(candles, 14);
  const r = rsi(closes, 14);
  if (!ema20 || !ema50 || !a || r == null) return null;

  // Uptrend pullback long
  if (ema20 > ema50 && last.low <= ema20 * 1.005 && last.close > ema20 && r > 40 && r < 65) {
    return {
      side: 'LONG',
      entry: last.close,
      stop: +(ema20 - a).toFixed(2),
      target: +(last.close + a * 2.5).toFixed(2),
      confidence: 75,
      reason: `Pullback to EMA20 in uptrend | RSI ${r.toFixed(0)}`,
    };
  }
  // Downtrend bounce short
  if (ema20 < ema50 && last.high >= ema20 * 0.995 && last.close < ema20 && r > 35 && r < 60) {
    return {
      side: 'SHORT',
      entry: last.close,
      stop: +(ema20 + a).toFixed(2),
      target: +(last.close - a * 2.5).toFixed(2),
      confidence: 75,
      reason: `Bounce to EMA20 in downtrend | RSI ${r.toFixed(0)}`,
    };
  }
  return null;
}

// 3. GAP AND GO
export function gapAndGo(candles) {
  if (candles.length < 30) return null;
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const a = atr(candles, 14);
  const rv = rvol(candles, 20);
  if (!a || !rv) return null;

  const gapPct = ((last.open - prev.close) / prev.close) * 100;

  if (gapPct >= 2 && last.close > last.open && rv >= 1.5) {
    return {
      side: 'LONG',
      entry: last.close,
      stop: +(last.open - a * 0.5).toFixed(2),
      target: +(last.close + a * 2).toFixed(2),
      confidence: 70 + Math.min(20, gapPct * 2),
      reason: `Gap up +${gapPct.toFixed(1)}% holding | RVOL ${rv.toFixed(2)}x`,
    };
  }
  if (gapPct <= -2 && last.close < last.open && rv >= 1.5) {
    return {
      side: 'SHORT',
      entry: last.close,
      stop: +(last.open + a * 0.5).toFixed(2),
      target: +(last.close - a * 2).toFixed(2),
      confidence: 70 + Math.min(20, Math.abs(gapPct) * 2),
      reason: `Gap down ${gapPct.toFixed(1)}% failing | RVOL ${rv.toFixed(2)}x`,
    };
  }
  return null;
}

// 4. VWAP RECLAIM
export function vwapReclaim(candles) {
  if (candles.length < 20) return null;
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const v = vwap(candles);
  const a = atr(candles, 14);
  const rv = rvol(candles, 20);
  if (!v || !a || !rv) return null;

  if (prev.close < v && last.close > v && rv >= 1.3) {
    return {
      side: 'LONG',
      entry: last.close,
      stop: +(v - a * 0.5).toFixed(2),
      target: +(last.close + a * 2).toFixed(2),
      confidence: 72,
      reason: `VWAP reclaim from below | RVOL ${rv.toFixed(2)}x`,
    };
  }
  if (prev.close > v && last.close < v && rv >= 1.3) {
    return {
      side: 'SHORT',
      entry: last.close,
      stop: +(v + a * 0.5).toFixed(2),
      target: +(last.close - a * 2).toFixed(2),
      confidence: 72,
      reason: `VWAP loss from above | RVOL ${rv.toFixed(2)}x`,
    };
  }
  return null;
}

export const STRATEGIES = {
  oracle: { name: 'Oracle Momentum', fn: oracleMomentum },
  pullback: { name: 'Pullback EMA20', fn: pullbackEMA },
  gap: { name: 'Gap & Go', fn: gapAndGo },
  vwap: { name: 'VWAP Reclaim', fn: vwapReclaim },
};

export function runStrategies(candles, enabled = ['oracle']) {
  const signals = [];
  for (const key of enabled) {
    const strat = STRATEGIES[key];
    if (!strat) continue;
    const sig = strat.fn(candles);
    if (sig) signals.push({ strategy: key, strategyName: strat.name, ...sig });
  }
  return signals;
}
