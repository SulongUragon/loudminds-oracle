const BASE = 'https://api.telegram.org';
const BATCH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let queue = [];
let timer = null;

function esc(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatAlert(alert) {
  const side = alert.side === 'LONG' ? '🟢 LONG' : '🔴 SHORT';
  const rr = ((alert.target - alert.entry) / Math.abs(alert.entry - alert.stop)).toFixed(1);
  const commentary = alert.commentary ? `\n💡 <i>${esc(alert.commentary)}</i>` : '';
  return [
    `<b>${esc(alert.symbol)}</b> ${side} · R:R ${rr}:1`,
    `📌 ${esc(alert.strategyName)}`,
    `Entry $${alert.entry.toFixed(2)} · Stop $${alert.stop.toFixed(2)} · Target $${alert.target.toFixed(2)}`,
    `📊 ${esc(alert.reason)}${commentary}`,
    `⚡ ${alert.confidence}% · ${new Date(alert.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
  ].join('\n');
}

async function flush() {
  timer = null;
  if (!queue.length) return;

  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!token || !chatId) { queue = []; return; }

  const batch = queue.splice(0);
  const text = [
    `🔮 <b>LOUDMINDS ORACLE</b> — ${batch.length} signal${batch.length > 1 ? 's' : ''}`,
    ``,
    ...batch.map((a, i) => (i > 0 ? `──────────────\n` : '') + formatAlert(a)),
  ].join('\n');

  try {
    const res = await fetch(`${BASE}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const data = await res.json();
    if (!data.ok) console.error('[telegram] API error:', JSON.stringify(data));
    else console.log(`[telegram] sent ${batch.length} alert(s)`);
  } catch (err) {
    console.error('[telegram] fetch error:', err.message);
  }
}

export function sendAlert(alert) {
  queue.push(alert);
  if (!timer) timer = setTimeout(flush, BATCH_INTERVAL_MS);
}
