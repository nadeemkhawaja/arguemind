// Vercel Serverless Function — Anthropic proxy
// Accepts user key via x-user-api-key header, falls back to ANTHROPIC_API_KEY env var.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body;
  if (!body || !body.messages) return res.status(400).json({ error: 'Missing messages' });

  const userKey = req.headers['x-user-api-key'] || '';
  const API_KEY = userKey || process.env.ANTHROPIC_API_KEY || '';
  if (!API_KEY) return res.status(500).json({ error: 'No API key. Set ANTHROPIC_API_KEY in Vercel env, or add your key in ⚙ Settings.' });

  const model = body.model || 'claude-sonnet-4-20250514';

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: body.max_tokens || 1200, messages: body.messages }),
  });

  const text = await upstream.text();
  res.setHeader('Content-Type', 'application/json');
  return res.status(upstream.status).send(text);
}
