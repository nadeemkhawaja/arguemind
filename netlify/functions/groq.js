// Netlify Function — Groq proxy
// Accepts user key via x-user-api-key header, falls back to GROQ_API_KEY env var.

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!body || !body.messages) return json({ error: 'Missing messages' }, 400);

  const userKey = req.headers.get('x-user-api-key') || '';
  const key = userKey || process.env.GROQ_API_KEY || '';
  if (!key) return json({ error: 'Groq API key not set. Add your key in ⚙ Settings or set GROQ_API_KEY in Netlify env.' }, 500);

  const model = body.model || 'llama-3.3-70b-versatile';
  const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: body.max_tokens || 1200, messages: body.messages }),
  });

  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { 'Content-Type': 'application/json' } });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
