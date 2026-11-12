// Shared by the HUD's tools: the demo's own static server on the HUD builder's port, started here and stopped by its
// own process id. Nothing else is ever stopped.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const HUD_PORT = 5471;
export const HUD_DEBUG_PORT = 5472;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Start demo/serve.mjs on `port`. Returns { url, pid, stop() }. Throws when the port is already taken. */
export async function serve(port = HUD_PORT) {
  const base = `http://127.0.0.1:${port}`;
  if (await fetch(`${base}/demo/hud-dev.html`).then(r => r.ok, () => false)) throw new Error(`port ${port} is already serving: stop that server first`);
  const child = spawn(process.execPath, [path.join(ROOT, 'demo', 'serve.mjs'), '--port', String(port), '--quiet'], { stdio: 'ignore' });
  for (let k = 0; k < 60; k++) {
    await sleep(100);
    if (await fetch(`${base}/demo/hud-dev.html`).then(r => r.ok, () => false)) return { url: base, pid: child.pid, stop: () => child.kill('SIGTERM') };
  }
  child.kill('SIGTERM');
  throw new Error('the demo server did not start');
}
