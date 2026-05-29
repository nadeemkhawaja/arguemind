# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Dev (Express + Vite with hot reload + proxy)
npm run dev

# Production server (serves built dist/)
npm start        # or: node server/index.js

# Build for production (Vite → dist/)
npm run build

# Run tests
npm test

# Run a single test file
npx vitest run tests/api.test.js

# Legacy server (raw Node http, no build step needed)
node server.js   # requires .env with ANTHROPIC_API_KEY
```

**Local env setup:** Create `.env` in the project root:
```
ANTHROPIC_API_KEY=sk-ant-...
```

## Architecture

ArgueMind is a **vanilla JS single-page application** with no frontend framework. The UI lives in `index.html` (structure + inline JS calls) and `src/main.js` (all logic as global functions). `src/style.css` handles all styling. There is no bundler for the frontend source during development — Vite serves `index.html` directly and proxies `/api` to the Express backend.

### Request path

```
Browser → /api/claude
  Dev:        Vite proxy → Express (server/app.js) → api.anthropic.com
  Production: Netlify redirect → netlify/functions/claude.js → api.anthropic.com
```

`netlify.toml` maps `/api/claude` → `/.netlify/functions/claude` (status 200 rewrite). The Netlify edge function (`netlify/functions/claude.js`) and the Express app (`server/app.js`) are parallel implementations of the same proxy logic.

### Dual server files

- `server.js` — legacy raw-Node HTTP server (self-contained, no Express). Used for the original "just open index.html" workflow. Still works standalone.
- `server/app.js` + `server/index.js` — modern Express server used by `npm run dev` and `npm start`. `server/index.js` writes a `.server-port` file so `scripts/dev.js` can pass the dynamic port to Vite's proxy config.

### API key handling

The API key is **never hardcoded**. Two sources are accepted, in priority order:
1. `x-user-api-key` request header — set by the browser from user input stored in `localStorage`
2. `ANTHROPIC_API_KEY` environment variable — loaded from `.env` on the server

### SCIPAB reasoning pipeline

The core feature is a sequential 6-layer (L0–L5) chain-of-thought pipeline. Each layer calls Claude and passes the **full text** of all prior layers as context (not summaries). The layers map to SCIPAB:

| Layer | Role | SCIPAB |
|-------|------|--------|
| L0 | Fallacy scan (JSON output) | Situation |
| L1 | Context analysis | Situation |
| L2 | Argument builder | Complication |
| L2.5 | Socratic drill (optional interlude) | Complication |
| L3 | Counter-argument | Implementation |
| L4 | Self-critique | Position |
| L5 | Final strategy & verdict | Action + Benefit |

After L5, two parallel calls fire: Score Card (JSON) and Debate Coach feedback. After all calls complete, `runTelemetryOptimization()` runs purely in JS (no API call) to assess efficiency ratio and latency thresholds.

### Topic database

`src/main.js` begins with the `CATS` array — 15+ categories, each with sub-categories, each sub-category containing 6 topics with two pre-written opposing positions. This is the debate topic picker. The `esc()` helper at the top is used throughout for HTML-escaping user-facing strings.

### Other tabs

- **Arena** (`switchTab('aia')`) — AI vs AI debate: Loffi takes one side, a configurable opponent persona takes the other, judged by a third Claude call.
- **Live** (`switchTab('live')`) — Real-time voice debate using browser Speech Recognition + Kokoro TTS (WebAssembly, ~80MB download, no API key).
- **Flowchart** (`switchTab('flowchart')`) — Static SVG pipeline diagram rendered inline.
- **Archive** (`switchTab('history')`) — Past debate sessions stored in `localStorage`.

### Model configuration

Default model: `claude-sonnet-4-20250514`. OpenRouter models are detected by the presence of `/` in the model string (e.g. `anthropic/claude-sonnet-4`). The frontend sends the model name in the POST body; both proxy implementations route accordingly.

### Tests

`tests/api.test.js` uses Vitest + Supertest to integration-test the Express app in `server/app.js`. Tests import the app directly (no running server needed).
