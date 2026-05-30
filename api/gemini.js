// Vercel Serverless Function — Google AI Studio (Gemini) proxy
// Accepts user key via x-user-api-key header, falls back to GOOGLE_AI_KEY env var.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body;
  if (!body || !body.messages) return res.status(400).json({ error: 'Missing messages' });

  const userKey = req.headers['x-user-api-key'] || '';
  const key = userKey || process.env.GOOGLE_AI_KEY || '';
  if (!key) return res.status(500).json({ error: 'Google AI key not set. Add your key in ⚙ Settings or set GOOGLE_AI_KEY in Vercel env.' });

  const model = body.model || 'gemini-2.0-flash';

  const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: body.max_tokens || 1200, messages: body.messages }),
  });

  const text = await upstream.text();
  res.setHeader('Content-Type', 'application/json');
  return res.status(upstream.status).send(text);
}
