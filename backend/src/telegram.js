const BASE = 'https://api.telegram.org';

export async function sendAlert(alert) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const side = alert.side === 'LONG' ? '🟢 LONG' : '🔴 SHORT';
  const rr = ((alert.target - alert.entry) / Math.abs(alert.entry - alert.stop)).toFixed(1);

  const lines = [
    `🔮 *LOUDMINDS ORACLE*`,
    ``,
    `*${alert.symbol}* — ${side}`,
    `📌 Strategy: ${alert.strategyName}`,
    ``,
    `Entry:  $${alert.entry.toFixed(2)}`,
    `Stop:   $${alert.stop.toFixed(2)}`,
    `Target: $${alert.target.toFixed(2)}`,
    `R:R     ${rr}:1`,
    ``,
    `📊 ${alert.reason}`,
    alert.commentary ? `\n💡 ${alert.commentary}` : '',
    ``,
    `⚡ ${alert.confidence}% confidence · ${new Date(alert.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
  ].join('\n');

  try {
    await fetch(`${BASE}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: lines, parse_mode: 'Markdown' }),
    });
  } catch (err) {
    console.error('[telegram]', err.message);
  }
}
