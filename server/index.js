import { writeFileSync, unlinkSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT_FILE = path.join(__dirname, '..', '.server-port');

// PORT=0 → OS picks a free random port. Set PORT=3000 (etc.) to pin it.
const REQUESTED_PORT = Number(process.env.PORT ?? 0);
const HOST = process.env.HOST || '0.0.0.0';

function lanAddresses() {
  const out = [];
  const ifaces = networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        out.push({ name, address: iface.address });
      }
    }
  }
  return out;
}

const server = app.listen(REQUESTED_PORT, HOST, () => {
  const { port } = server.address();
  try { writeFileSync(PORT_FILE, String(port)); } catch {}
  console.log(`\n  ✅  Express server listening on ${HOST}:${port}`);
  console.log(`  →  http://localhost:${port}`);
  for (const { name, address } of lanAddresses()) {
    console.log(`  →  http://${address}:${port}   (${name})`);
  }
  console.log('  🔑  API key loaded from .env\n');
});

function cleanup() {
  try { unlinkSync(PORT_FILE); } catch {}
  server.close(() => process.exit(0));
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
