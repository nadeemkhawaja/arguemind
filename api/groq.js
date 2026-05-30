// Vercel Serverless Function — Groq proxy
// Accepts user key via x-user-api-key header, falls back to GROQ_API_KEY env var.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body;
  if (!body || !body.messages) return res.status(400).json({ error: 'Missing messages' });

  const userKey = req.headers['x-user-api-key'] || '';
  const key = userKey || process.env.GROQ_API_KEY || '';
  if (!key) return res.status(500).json({ error: 'Groq API key not set. Add your key in ⚙ Settings or set GROQ_API_KEY in Vercel env.' });

  const model = body.model || 'llama-3.3-70b-versatile';

  const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: body.max_tokens || 1200, messages: body.messages }),
  });

  const text = await upstream.text();
  res.setHeader('Content-Type', 'application/json');
  return res.status(upstream.status).send(text);
}
