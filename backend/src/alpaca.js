const BASE = process.env.ALPACA_BASE_URL || process.env.ALPACA_ENDPOINT || 'https://paper-api.alpaca.markets/v2';

function headers() {
  return {
    'APCA-API-KEY-ID': (process.env.ALPACA_API_KEY || process.env.ALPACA_KEY || '').trim(),
    'APCA-API-SECRET-KEY': (process.env.ALPACA_API_SECRET || process.env.ALPACA_SECRET || '').trim(),
    'Content-Type': 'application/json',
  };
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 200) {
    console.error(`[alpaca] ${method} ${path} → HTTP ${res.status}`);
  }
  const text = await res.text();
  try { return JSON.parse(text); } catch { return {}; }
}

export async function getAccount() {
  return api('GET', '/account');
}

export async function getPositions() {
  return api('GET', '/positions');
}

export async function getOrders() {
  return api('GET', '/orders?status=open&limit=20');
}

async function hasOpenPosition(symbol) {
  try {
    const pos = await api('GET', `/positions/${symbol}`);
    return !!pos.symbol;
  } catch {
    return false;
  }
}

export async function placeBracketOrder(alert) {
  if (!process.env.ALPACA_KEY || !process.env.ALPACA_SECRET) return;

  // Skip if already have an open position in this symbol
  if (await hasOpenPosition(alert.symbol)) {
    console.log(`[alpaca] skipping ${alert.symbol} — already have open position`);
    return;
  }

  const account = await getAccount();
  const buyingPower = parseFloat(account.buying_power || 0);
  if (buyingPower < 10) {
    console.warn('[alpaca] insufficient buying power:', buyingPower);
    return;
  }

  // Risk $500 per trade (or 10% of buying power, whichever is lower)
  const riskAmount = Math.min(500, buyingPower * 0.10);
  const qty = Math.max(1, Math.floor(riskAmount / alert.entry));

  const side = alert.side === 'LONG' ? 'buy' : 'sell';
  const takeProfitPrice = parseFloat(alert.target.toFixed(2));
  const stopLossPrice = parseFloat(alert.stop.toFixed(2));

  const order = {
    symbol: alert.symbol,
    qty: String(qty),
    side,
    type: 'market',
    time_in_force: 'day',
    order_class: 'bracket',
    take_profit: { limit_price: String(takeProfitPrice) },
    stop_loss: { stop_price: String(stopLossPrice) },
  };

  try {
    const result = await api('POST', '/orders', order);
    if (result.id) {
      console.log(`[alpaca] ${side.toUpperCase()} ${qty} ${alert.symbol} @ $${alert.entry} | stop $${stopLossPrice} | target $${takeProfitPrice} | order ${result.id}`);
    } else {
      console.error('[alpaca] order error:', JSON.stringify(result));
    }
    return result;
  } catch (err) {
    console.error('[alpaca] fetch error:', err.message);
  }
}
