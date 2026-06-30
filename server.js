require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json());
app.use(express.static('public'));

// Simple per-IP rate limiting to control API cost
const requestLog = new Map();
const RATE_LIMIT = 10; // requests
const RATE_WINDOW_MS = 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  const entries = (requestLog.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  entries.push(now);
  requestLog.set(ip, entries);
  return entries.length > RATE_LIMIT;
}

app.post('/api/analogize', async (req, res) => {
  const ip = req.ip;
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
  }

  const { situation } = req.body;
  if (!situation || typeof situation !== 'string' || !situation.trim()) {
    return res.status(400).json({ error: 'Please describe a situation first.' });
  }
  if (situation.length > 4000) {
    return res.status(400).json({ error: 'Description is too long (max 4000 characters).' });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: `You translate complex business or occupational situations into simple, relatable everyday-life analogies that any consumer can understand. For each situation, produce exactly 3 distinct analogies. Each analogy should be 2-4 sentences: state the analogy clearly, then briefly map it back to the original situation. Respond ONLY with valid JSON in this exact shape, no markdown, no commentary:
{"analogies": [{"title": "short label", "text": "the analogy"}, {"title": "...", "text": "..."}, {"title": "...", "text": "..."}]}`,
      messages: [{ role: 'user', content: situation.trim() }],
    });

    const raw = message.content[0]?.text || '';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }

    if (!parsed || !Array.isArray(parsed.analogies)) {
      throw new Error('Could not parse model response');
    }

    res.json({ analogies: parsed.analogies.slice(0, 3) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong generating analogies. Please try again.' });
  }
});

app.listen(PORT, () => console.log(`Analogy app running on http://localhost:${PORT}`));
