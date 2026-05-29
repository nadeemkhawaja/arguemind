import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import zlib from 'zlib';

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

// ── Brave Search proxy ─────────────────────────────────────
app.post('/api/search', (req, res) => {
  const query = (req.body && req.body.q ? String(req.body.q) : '').trim();
  if (!query) return res.status(400).json({ error: 'Missing search query' });

  const count = Math.min(Math.max(parseInt(req.body.count, 10) || 5, 1), 20);
  const key = req.headers['x-search-key'] || process.env.BRAVE_API_KEY || '';
  if (!key) {
    return res.status(400).json({ error: 'No Brave Search API key. Add one in ⚙ Settings or set BRAVE_API_KEY.' });
  }

  const options = {
    hostname: 'api.search.brave.com',
    path: `/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`,
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': key,
    },
  };

  const proxy = https.request(options, apiRes => {
    let chunks = [];
    apiRes.on('data', c => chunks.push(c));
    apiRes.on('end', () => {
      const raw = Buffer.concat(chunks);
      // Brave responds gzipped when Accept-Encoding: gzip is sent.
      const finish = (buf) => {
        if (apiRes.statusCode !== 200) {
          return res.status(apiRes.statusCode).json({ error: `Brave Search error ${apiRes.statusCode}`, detail: buf.toString() });
        }
        try {
          const data = JSON.parse(buf.toString());
          const results = ((data.web && data.web.results) || []).map(r => ({
            title: r.title || '',
            url: r.url || '',
            description: (r.description || '').replace(/<\/?[^>]+>/g, ''),
          }));
          res.json({ results });
        } catch (e) {
          res.status(502).json({ error: 'Bad search response: ' + e.message });
        }
      };
      if (apiRes.headers['content-encoding'] === 'gzip') {
        zlib.gunzip(raw, (err, out) => finish(err ? raw : out));
      } else finish(raw);
    });
  });

  proxy.on('error', err => res.status(502).json({ error: 'Search proxy error: ' + err.message }));
  proxy.end();
});

app.use(express.static(path.join(rootDir, 'dist')));

export default app;
