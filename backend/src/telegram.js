const BASE = 'https://api.telegram.org';

function esc(text) {
  // Escape HTML special chars for Telegram HTML parse mode
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function sendAlert(alert) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!token || !chatId) return;

  const side = alert.side === 'LONG' ? '🟢 LONG' : '🔴 SHORT';
  const rr = ((alert.target - alert.entry) / Math.abs(alert.entry - alert.stop)).toFixed(1);
  const commentary = alert.commentary ? `\n💡 <i>${esc(alert.commentary)}</i>` : '';

  const text = [
    `🔮 <b>LOUDMINDS ORACLE</b>`,
    ``,
    `<b>${esc(alert.symbol)}</b> — ${side}`,
    `📌 ${esc(alert.strategyName)}`,
    ``,
    `Entry:  $${alert.entry.toFixed(2)}`,
    `Stop:   $${alert.stop.toFixed(2)}`,
    `Target: $${alert.target.toFixed(2)}`,
    `R:R     ${rr}:1`,
    ``,
    `📊 ${esc(alert.reason)}${commentary}`,
    ``,
    `⚡ ${alert.confidence}% · ${new Date(alert.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
  ].join('\n');

  try {
    const res = await fetch(`${BASE}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const data = await res.json();
    if (!data.ok) console.error('[telegram] API error:', JSON.stringify(data));
  } catch (err) {
    console.error('[telegram] fetch error:', err.message);
  }
}
