import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateCommentary(alert, candles) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const last = candles[candles.length - 1];
  const prev5 = candles.slice(-6, -1);
  const avgVol = prev5.reduce((s, c) => s + c.volume, 0) / prev5.length;
  const volSpike = last.volume / (avgVol || 1);

  const prompt = `You are a terse, experienced day trader. In 2 sentences max, explain why this alert is worth watching. Be specific about price action, not generic. No disclaimers.

Alert: ${alert.symbol} ${alert.side} via ${alert.strategyName}
Entry: $${alert.entry} | Stop: $${alert.stop} | Target: $${alert.target}
Signal: ${alert.reason}
Current candle: O${last.open.toFixed(2)} H${last.high.toFixed(2)} L${last.low.toFixed(2)} C${last.close.toFixed(2)} Vol ${volSpike.toFixed(1)}x avg`;

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [{ role: 'user', content: prompt }],
    });
    return msg.content[0]?.text?.trim() || null;
  } catch {
    return null;
  }
}
