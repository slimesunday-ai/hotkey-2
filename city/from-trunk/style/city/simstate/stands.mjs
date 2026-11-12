// SIM LIVE pass · makes simstate/stands.json: the stand spots of every sim place (stands.js), from the blocks' own audit builds in
// headless Chrome (?sim=live&simstands=1&shot=1 — the page's build code, exactly). Re-run it when a kit changes the ground round a sim
// place; the page must be served (cd ~/Desktop/deadnet-style && node style/serve.mjs 5320).
//   node style/city/simstate/stands.mjs [--out <file>]
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url)), BASE = process.env.CITY_URL || 'http://127.0.0.1:5320/style/city/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', sleep = ms => new Promise(r => setTimeout(r, ms));
// SPREAD (pass 5b): SPREAD=<m> builds the page at ?spread=<m> and writes that spread's file (world/city.js sdata: stands.s<m>.json beside the default's)
register(pathToFileURL(path.resolve(HERE, '../../../sim2/node-hooks.mjs')).href);
const { sdata, SPREAD } = await import(pathToFileURL(path.resolve(HERE, '../../../world/city.js')).href), SQ = process.env.SPREAD ? '&spread=' + SPREAD : '';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; }, OUT = path.resolve(opt('out', path.join(HERE, sdata('stands.json'))));
const prof = await fs.mkdtemp(path.join(os.tmpdir(), 'city-stands-'));
const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--use-angle=metal', '--ignore-gpu-blocklist', '--remote-debugging-port=0', '--window-size=320,288', 'about:blank'], { stdio: 'ignore' });
let code = 1;
try {
  let port = null; for (let t = 0; t < 100 && !port; t++) { await sleep(100); try { port = (await fs.readFile(path.join(prof, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch {} }
  if (!port) throw new Error('chrome did not start');
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); let id = 0; const wait = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } if (m.method === 'Runtime.consoleAPICalled') { const s = m.params.args.map(a => a.value ?? a.description).join(' '); if (/stands:/.test(s)) console.log(s.replace(/^\[[\d.]+s\]\s*/, '')); } };
  const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
  await send('Runtime.enable'); await send('Page.navigate', { url: `${BASE}?sim=live&simstands=1&shot=1&peds=0&w=64&h=64&simport=1${SQ}` });
  const t0 = Date.now(); let res = null; while (Date.now() - t0 < 600000 && !res) { await sleep(1000); res = await ev('window.__simStands ? JSON.stringify(window.__simStands) : null').catch(() => null); }
  if (!res) throw new Error('no stand spots within 10 min'); const S = JSON.parse(res); if (S.error) throw new Error(S.error);
  await fs.writeFile(OUT, JSON.stringify({ ...S, kerbCheck: undefined }, null, 1)); ws.close(); code = 0;   // (the kerb check is printed below, not kept)
  const n = Object.values(S.places).reduce((s, p) => s + p.spots.length, 0), walked = Object.values(S.places).reduce((s, p) => s + p.spots.filter(x => x.entry).length, 0);
  console.log(`${Object.keys(S.places).length} places · ${n} spots (${walked} walked to) · ${Object.keys(S.skipped).length} places without any (${Object.keys(S.skipped).join(', ')}) · ${S.blocks} blocks built in ${(S.ms / 1000).toFixed(1)} s → ${path.relative(process.cwd(), OUT)}`);
  if (S.errors?.length) console.log('build errors:\n  ' + S.errors.join('\n  '));
  // the kerb check (stands.js): spots and their paths nearer a kerb-wait row or a zebra approach than STAND.kerb — now, and in the file replaced
  const K = S.kerbCheck, kl = r => typeof r === 'string' ? r : `spots ${r.near}/${r.spots} nearer than ${K.clear} m (min ${r.min} m) · path points ${r.pathsNear}/${r.paths}${r.worst.length ? ' · ' + r.worst.slice(0, 6).map(w => `${w[0]} (${w[1]}, ${w[2]}) ${w[3]} m`).join(', ') : ''}`;
  if (K) { console.log(`kerb check · now: ${kl(K.now)}`); console.log(`kerb check · the file it replaces: ${kl(K.before)}`); if (K.now.near || K.now.pathsNear) code = 1; }
} catch (e) { console.error('stands: ' + (e && e.message || e)); }
finally { ch.kill('SIGKILL'); await sleep(300); await fs.rm(prof, { recursive: true, force: true }).catch(() => {}); }
process.exit(code);
