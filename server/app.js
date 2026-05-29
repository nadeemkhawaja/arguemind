import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// ── Load .env ──────────────────────────────────────────────
export function loadEnv() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] = process.env[key] ?? val;
  }
}

loadEnv();

const app = express();
app.use(cors());
app.use(express.json());

// ── API Routes ─────────────────────────────────────────────
app.post('/api/claude', (req, res) => {
  const parsed = req.body;
  if (!parsed || !parsed.messages) {
    return res.status(400).json({ error: 'Invalid JSON or missing messages' });
  }

  // Accept user-supplied key from header (stored in browser, never in source code)
  const userKey = req.headers['x-user-api-key'] || '';
  const API_KEY = userKey || process.env.ANTHROPIC_API_KEY || '';
  if (!API_KEY) {
    return res.status(500).json({ error: 'No API key. Set ANTHROPIC_API_KEY in .env or add your key in ⚙ Settings.' });
  }

  const payload = JSON.stringify({
    model: parsed.model || 'claude-sonnet-4-20250514',
    max_tokens: parsed.max_tokens || 1200,
    messages: parsed.messages,
  });

  const options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
  };

  const proxy = https.request(options, apiRes => {
    res.status(apiRes.statusCode);
    apiRes.pipe(res);
  });

  proxy.on('error', err => {
    console.error('Proxy error:', err.message);
    res.status(502).json({ error: 'Proxy error: ' + err.message });
  });

  proxy.write(payload);
  proxy.end();
});

// ── Google AI Studio proxy ──────────────────────────────────
app.post('/api/gemini', async (req, res) => {
  if (!req.body || !req.body.messages) return res.status(400).json({ error: 'Missing messages' });
  const key = process.env.GOOGLE_AI_KEY || '';
  if (!key) return res.status(500).json({ error: 'GOOGLE_AI_KEY not set in .env' });
  const model = req.body.model || 'gemini-2.0-flash';
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model, max_tokens: req.body.max_tokens || 1200, messages: req.body.messages }),
    });
    const text = await r.text();
    res.status(r.status).set('Content-Type', 'application/json').send(text);
  } catch (e) {
    res.status(502).json({ error: 'Gemini proxy error: ' + e.message });
  }
});

// ── Web Search proxy (Brave or Google) ─────────────────────
app.post('/api/search', async (req, res) => {
  const query = (req.body && req.body.q ? String(req.body.q) : '').trim();
  if (!query) return res.status(400).json({ error: 'Missing search query' });

  const count = Math.min(Math.max(parseInt(req.body.count, 10) || 5, 1), 20);
  const provider = (req.headers['x-search-provider'] || 'brave').toLowerCase();

  try {
    if (provider === 'google') {
      const key = req.headers['x-search-key'] || process.env.GOOGLE_API_KEY || '';
      const cx = req.headers['x-search-cx'] || process.env.GOOGLE_CX || '';
      if (!key || !cx) return res.status(400).json({ error: 'Google search needs an API key and Search Engine ID (cx). Add them in ⚙ Settings or set GOOGLE_API_KEY + GOOGLE_CX.' });
      const num = Math.min(count, 10);
      const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}&num=${num}&q=${encodeURIComponent(query)}`;
      const r = await fetch(url);
      if (!r.ok) return res.status(r.status).json({ error: `Google Search error ${r.status}` });
      const data = await r.json();
      const results = (data.items || []).map(x => ({ title: x.title || '', url: x.link || '', description: x.snippet || '' }));
      return res.json({ results });
    }

    // Default: Brave
    const key = req.headers['x-search-key'] || process.env.BRAVE_API_KEY || '';
    if (!key) return res.status(400).json({ error: 'No Brave Search API key. Add one in ⚙ Settings or set BRAVE_API_KEY.' });
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
    const r = await fetch(url, { headers: { 'Accept': 'application/json', 'X-Subscription-Token': key } });
    if (!r.ok) return res.status(r.status).json({ error: `Brave Search error ${r.status}` });
    const data = await r.json();
    const results = ((data.web && data.web.results) || []).map(x => ({ title: x.title || '', url: x.url || '', description: (x.description || '').replace(/<\/?[^>]+>/g, '') }));
    return res.json({ results });
  } catch (e) {
    return res.status(502).json({ error: 'Search proxy error: ' + e.message });
  }
});

app.use(express.static(path.join(rootDir, 'dist')));

export default app;
