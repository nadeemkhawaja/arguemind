// Netlify Function — Web Search proxy (Brave or Google)
// Brave/Google APIs have no browser CORS, so the frontend calls this proxy.
// Provider comes from the x-search-provider header ("brave" | "google").
// Keys come from request headers (user's localStorage) or env vars:
//   Brave : x-search-key            | BRAVE_API_KEY
//   Google: x-search-key + x-search-cx | GOOGLE_API_KEY + GOOGLE_CX

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const query = (body && body.q ? String(body.q) : '').trim();
  if (!query) return json({ error: 'Missing search query' }, 400);
  const count = Math.min(Math.max(parseInt(body.count, 10) || 5, 1), 20);
  const provider = (req.headers.get('x-search-provider') || 'brave').toLowerCase();

  try {
    const results = provider === 'google'
      ? await googleSearch(query, count, req)
      : await braveSearch(query, count, req);
    return json({ results });
  } catch (e) {
    return json({ error: e.message }, e.status || 502);
  }
};

async function braveSearch(query, count, req) {
  const key = req.headers.get('x-search-key') || process.env.BRAVE_API_KEY || '';
  if (!key) throw err('No Brave Search API key. Add one in ⚙ Settings or set BRAVE_API_KEY.', 400);
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
  const r = await fetch(url, {
    headers: { 'Accept': 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': key },
  });
  if (!r.ok) throw err(`Brave Search error ${r.status}`, r.status);
  const data = await r.json();
  return ((data.web && data.web.results) || []).map((x) => ({
    title: x.title || '',
    url: x.url || '',
    description: (x.description || '').replace(/<\/?[^>]+>/g, ''),
  }));
}

async function googleSearch(query, count, req) {
  const key = req.headers.get('x-search-key') || process.env.GOOGLE_API_KEY || '';
  const cx = req.headers.get('x-search-cx') || process.env.GOOGLE_CX || '';
  if (!key || !cx) throw err('Google search needs an API key and Search Engine ID (cx). Add them in ⚙ Settings or set GOOGLE_API_KEY + GOOGLE_CX.', 400);
  const num = Math.min(count, 10); // Google caps num at 10 per request
  const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}&num=${num}&q=${encodeURIComponent(query)}`;
  const r = await fetch(url);
  if (!r.ok) throw err(`Google Search error ${r.status}`, r.status);
  const data = await r.json();
  return (data.items || []).map((x) => ({
    title: x.title || '',
    url: x.link || '',
    description: x.snippet || '',
  }));
}

function err(message, status) { const e = new Error(message); e.status = status; return e; }

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
