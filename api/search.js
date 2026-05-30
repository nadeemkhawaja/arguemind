// Vercel Serverless Function — Web Search proxy (Brave or Google)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body;
  const query = (body && body.q ? String(body.q) : '').trim();
  if (!query) return res.status(400).json({ error: 'Missing search query' });

  const count = Math.min(Math.max(parseInt(body.count, 10) || 5, 1), 20);
  const provider = (req.headers['x-search-provider'] || 'brave').toLowerCase();

  try {
    const results = provider === 'google'
      ? await googleSearch(query, count, req)
      : await braveSearch(query, count, req);
    return res.status(200).json({ results });
  } catch (e) {
    return res.status(e.status || 502).json({ error: e.message });
  }
}

async function braveSearch(query, count, req) {
  const key = req.headers['x-search-key'] || process.env.BRAVE_API_KEY || '';
  if (!key) throw err('No Brave Search API key. Add one in ⚙ Settings or set BRAVE_API_KEY.', 400);
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
  const r = await fetch(url, { headers: { 'Accept': 'application/json', 'X-Subscription-Token': key } });
  if (!r.ok) throw err(`Brave Search error ${r.status}`, r.status);
  const data = await r.json();
  return ((data.web && data.web.results) || []).map(x => ({
    title: x.title || '',
    url: x.url || '',
    description: (x.description || '').replace(/<\/?[^>]+>/g, ''),
  }));
}

async function googleSearch(query, count, req) {
  const key = req.headers['x-search-key'] || process.env.GOOGLE_API_KEY || '';
  const cx = req.headers['x-search-cx'] || process.env.GOOGLE_CX || '';
  if (!key || !cx) throw err('Google search needs an API key and Search Engine ID (cx). Add them in ⚙ Settings or set GOOGLE_API_KEY + GOOGLE_CX.', 400);
  const num = Math.min(count, 10);
  const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}&num=${num}&q=${encodeURIComponent(query)}`;
  const r = await fetch(url);
  if (!r.ok) throw err(`Google Search error ${r.status}`, r.status);
  const data = await r.json();
  return (data.items || []).map(x => ({
    title: x.title || '',
    url: x.link || '',
    description: x.snippet || '',
  }));
}

function err(message, status) { const e = new Error(message); e.status = status; return e; }
