// Netlify Function — Brave Search proxy
// Brave's API has no browser CORS, so the frontend calls this proxy.
// Key comes from the x-search-key header (user's localStorage) or the
// BRAVE_API_KEY env var as a fallback.

export default async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const query = (body && body.q ? String(body.q) : '').trim();
  if (!query) return json({ error: 'Missing search query' }, 400);

  const count = Math.min(Math.max(parseInt(body.count, 10) || 5, 1), 20);
  const key = req.headers.get('x-search-key') || process.env.BRAVE_API_KEY || '';
  if (!key) {
    return json({ error: 'No Brave Search API key. Add one in ⚙ Settings or set BRAVE_API_KEY.' }, 400);
  }

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
  let upstream;
  try {
    upstream = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': key,
      },
    });
  } catch (e) {
    return json({ error: 'Search upstream error: ' + e.message }, 502);
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return json({ error: `Brave Search error ${upstream.status}`, detail }, upstream.status);
  }

  const data = await upstream.json();
  const results = ((data.web && data.web.results) || []).map((r) => ({
    title: r.title || '',
    url: r.url || '',
    description: (r.description || '').replace(/<\/?[^>]+>/g, ''),
  }));

  return json({ results });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
