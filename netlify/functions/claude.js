// Netlify Edge Function — Anthropic API proxy
// User can supply their own key via x-user-api-key header
// Falls back to ANTHROPIC_API_KEY env var

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!body || !body.messages) {
    return new Response(JSON.stringify({ error: 'Missing messages' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // User-supplied key from request header (stored in browser localStorage, never in code)
  const userKey = req.headers.get('x-user-api-key') || '';

  // Use user key if provided, otherwise fall back to server env key
  const API_KEY = userKey || process.env.ANTHROPIC_API_KEY || '';

  if (!API_KEY) {
    return new Response(
      JSON.stringify({
        error: 'No API key available. Set ANTHROPIC_API_KEY in Netlify env, or add your key in the ⚙ Settings panel.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const model = body.model || 'claude-sonnet-4-20250514';

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: body.max_tokens || 1200,
      messages: body.messages,
    }),
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
