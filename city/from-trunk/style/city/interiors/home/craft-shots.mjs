// AI City · home kit · THE CRAFTING PIECES, PICTURED (2026-11-19): craft.js's pieces as the preview page draws them (preview.html), in
// headless Chrome: the catalogue sheet (?view=v2&k=craft, a character for scale) and the crafting room (?view=craft: the bench on the floor
// spot, the can over the door, the Knock-Knock, the porch lamp outside), close and from the game's street camera (&cam=game), by day and
// by night, in each look (?bench, ?load, ?gun).
//   node style/city/interiors/home/craft-shots.mjs --port <page server> --debug <Chrome's debugging port> --out <dir> [--only sheet,room]
// The page server must be running: node style/serve.mjs <port>. Chrome is started here on --debug and stopped by its own handle.
// NOTHING IS FETCHED FROM THE NETWORK: the page's import map names three r185 on a CDN; with --three <dir> (a local copy of three 0.185.1:
// its build/ and examples/jsm/, e.g. the hotkey-2 game's city/vendor/three) every such request is answered from that folder instead, and
// any other request off this machine is refused.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 5511), DEBUG = +arg('debug', 5776), OUT = path.resolve(arg('out', 'style/city/shots/craft')), ONLY = arg('only', null)?.split(',') ?? null;
const want = k => !ONLY || ONLY.includes(k);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', sleep = ms => new Promise(r => setTimeout(r, ms));
const W = 1600, H = 1000, THREE_DIR = arg('three', null), CDN = 'https://cdn.jsdelivr.net/npm/three@0.185.1/';
await fs.mkdir(OUT, { recursive: true });

const prof = await fs.mkdtemp(path.join(os.tmpdir(), 'craft-shots-'));
const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--use-angle=metal', '--ignore-gpu-blocklist',
  '--hide-scrollbars', `--remote-debugging-port=${DEBUG}`, `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
let failed = 0;
try {
  let up = false;
  for (let k = 0; k < 100 && !up; k++) { await sleep(100); up = await fetch(`http://127.0.0.1:${DEBUG}/json/version`).then(r => r.ok, () => false); }
  if (!up) throw new Error('chrome did not start');
  const target = (await (await fetch(`http://127.0.0.1:${DEBUG}/json/list`)).json()).find(t => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const wait = new Map(), errors = [];
  let onFetchRef = null;
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); return; }
    if (m.method === 'Fetch.requestPaused') { onFetchRef?.(m); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); };
  const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  // (the CDN's three answered from the local copy; anything else off this machine refused)
  await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  const onFetch = async m => {
    const { requestId, request } = m.params, u = request.url;
    if (u.startsWith(`http://127.0.0.1:${PORT}/`)) return send('Fetch.continueRequest', { requestId });
    if (THREE_DIR && u.startsWith(CDN)) {
      try { const body = await fs.readFile(path.join(THREE_DIR, u.slice(CDN.length).split('?')[0]));
        return send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/javascript' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: body.toString('base64') });
      } catch { /* not in the copy: refused below */ }
    }
    errors.push(`refused ${u}`);
    return send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
  };
  onFetchRef = onFetch;
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  async function shoot(name, q) {
    const url = `http://127.0.0.1:${PORT}/style/city/interiors/home/preview.html?shot=1&w=${W}&h=${H}&${q}`;
    errors.length = 0;
    await send('Page.navigate', { url });
    let ok = false;
    for (let k = 0; k < 300 && !ok; k++) { await sleep(200); ok = (await ev('document.title').catch(() => '')) === 'ready'; }
    await sleep(300);
    const r = await send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(OUT, `${name}.png`);
    await fs.writeFile(file, Buffer.from(r.result.data, 'base64'));
    console.log(`${ok && !errors.length ? 'ok  ' : 'FAIL'} ${file}${errors.length ? ' · ' + errors.slice(0, 3).join(' | ') : ''}${ok ? '' : ' · the page never said ready'}`);
    if (!ok || errors.length) failed++;
  }
  if (want('sheet')) for (const tod of ['day', 'night']) await shoot(`sheet-${tod}`, `view=v2&k=craft${tod === 'night' ? '&tod=night' : ''}`);
  if (want('room')) {
    for (const tod of ['day', 'night']) for (const cam of ['room', 'game']) await shoot(`room-${cam}-${tod}`, `view=craft${tod === 'night' ? '&tod=night' : ''}${cam === 'game' ? '&cam=game' : ''}`);
    // the other looks, close: the garage bench, each load in the can, each gun on the door
    await shoot('room-bench1-day', 'view=craft&bench=1');
    for (let l = 1; l < 5; l++) await shoot(`room-load${l}-day`, `view=craft&load=${l}`);
    for (let g = 1; g < 3; g++) await shoot(`room-gun${g}-day`, `view=craft&gun=${g}`);
  }
  ws.close();
} catch (err) {
  console.error(String(err?.stack ?? err)); failed++;
} finally {
  try { ch.kill('SIGKILL'); } catch {}
  await sleep(300); await fs.rm(prof, { recursive: true, force: true }).catch(() => {});
}
console.log(failed ? `${failed} FAILED` : 'all ok');
process.exit(failed ? 1 : 0);
