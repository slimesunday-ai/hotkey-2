// SIGNAGE · the census (owner: the signage agent): every sign the shared signage system letters, CITY-WIDE. Every district kit's
// blocks are built with the audit on in headless Chrome (?audit=1&report=1&district=<name>&walk=0, four districts at a time), and
// their sign logs (alloc.js logSign: family, words, the allocator's own pick when the swap table replaced it, x, z, lot) are counted:
//   · signs per family; the internet share (lexicon NET)
//   · REPEATS BY GAG (gags.js): a second copy of a design category within its family's view distance (roof boards 250 m, the rest
//     100 m). The copy nearer the city centre (0, 0) is the original; section 1 (blocks i −3…2, j −3…0) keeps all of its own.
//   · with --vs <label>: the signs whose words changed against that census, and whether every one of them was a repeat there
//   node style/city/signage/census.mjs <label> [--vs <label>] [--q <extra url query>] [district …]
//     before:  node style/city/signage/census.mjs before --q signswap=0     (the allocator's own picks: the swap table switched off)
//     after:   node style/city/signage/census.mjs after --vs before
// Writes signage/census-<label>.json (counts + every sign). The page must be served (port 5320).
import { spawn } from 'node:child_process';
import { register } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), CITY = path.resolve(HERE, '..'), ROOT = path.resolve(CITY, '../..');
register(pathToFileURL(path.join(ROOT, 'sim2/node-hooks.mjs')).href);
const { byKey } = await import(pathToFileURL(path.join(HERE, 'designs.js')).href), { VIEW, gagOf, inSection1 } = await import(pathToFileURL(path.join(HERE, 'gags.js')).href);
const { isNet } = await import(pathToFileURL(path.join(HERE, 'lexicon.js')).href);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', BASE = process.env.CITY_URL || 'http://127.0.0.1:5320/style/city/', sleep = ms => new Promise(r => setTimeout(r, ms));
const args = process.argv.slice(2), opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; }, label = args[0] || 'latest', VS = opt('vs'), EXTRA = opt('q');
const named = args.slice(1).filter((a, k, A) => !a.startsWith('--') && !(k > 0 && A[k - 1].startsWith('--')));

// ── 1 · the districts (manifest.js KITS) and their sign logs
const manifest = await fs.readFile(path.join(CITY, 'manifest.js'), 'utf8');
const districts = named.length ? named : [...manifest.matchAll(/'districts\/([a-z0-9_-]+)\.js'/g)].map(m => m[1]).filter((d, k, A) => A.indexOf(d) === k);
async function scan(d) {
  const prof = await fs.mkdtemp(path.join(os.tmpdir(), 'city-census-'));
  const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--use-angle=metal', '--ignore-gpu-blocklist', '--remote-debugging-port=0', '--window-size=400,338', 'about:blank'], { stdio: 'ignore' });
  try {
    let port = null; for (let t = 0; t < 100 && !port; t++) { await sleep(100); try { port = (await fs.readFile(path.join(prof, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch {} }
    if (!port) return { d, error: 'chrome did not start' };
    const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); let id = 0; const wait = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } };
    const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
    const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.result?.value;
    await send('Runtime.enable'); await send('Page.enable'); await send('Page.navigate', { url: `${BASE}?audit=1&report=1&shot=1&district=${encodeURIComponent(d)}&walk=0&w=400&h=250${EXTRA ? '&' + EXTRA : ''}` });
    const tA = Date.now(); let title = ''; while (Date.now() - tA < 480000 && title !== 'audit-ready') { await sleep(1000); title = await ev('document.title').catch(() => ''); }
    if (title !== 'audit-ready') return { d, error: 'no report within 8 min' };
    const r = await ev(`JSON.stringify({ modules: window.__auditReport.modules || [], blocks: window.__auditReport.blocks.map(b => ({ key: b.key, signs: b.signs || [], issues: b.issues.length, errors: (b.errors || []).length })) })`);
    ws.close(); return { d, ...JSON.parse(r) };
  } finally { ch.kill('SIGKILL'); await sleep(300); await fs.rm(prof, { recursive: true, force: true }).catch(() => {}); }
}
const t0 = Date.now(), results = [], queue = [...districts];
await Promise.all([0, 1, 2, 3].map(async () => { while (queue.length) { const d = queue.shift(); const r = await scan(d); results.push(r); console.log(`  ${d.padEnd(11)} ${r.error || `${r.blocks.length} blocks · ${r.blocks.reduce((s, b) => s + b.signs.length, 0)} sign records · ${r.blocks.reduce((s, b) => s + b.issues, 0)} audit issues`}`); } }));
const failed = results.filter(r => r.error); if (failed.length) { console.log('census FAILED:', failed.map(r => r.d + ': ' + r.error).join(' · ')); process.exit(1); }

// ── the audit's own check (tools/audit.mjs signRepeats: the same WORDS within the record's radius, regulatory plates exempt), per district
// run and city-wide: the swap must not add any
const { REGULATORY } = await import(pathToFileURL(path.join(HERE, 'lexicon.js')).href);
function auditRepeats(blocks) { const by = new Map(); let n = 0; for (const b of blocks) for (const s of b.signs) { const key = String(s.key).toUpperCase(); if (REGULATORY.has(key)) continue; if (!by.has(key)) by.set(key, []); by.get(key).push({ ...s, blk: b.key }); }
  for (const L of by.values()) for (let a = 0; a < L.length; a++) for (let c = a + 1; c < L.length; c++) { const A = L[a], B = L[c]; if (A.blk === B.blk && A.group === B.group) continue; const d = Math.hypot(A.x - B.x, A.z - B.z), r = Math.min(A.r ?? 96, B.r ?? 96); if (r > 0 ? d < r : A.blk === B.blk) n++; } return n; }
const auditSR = { byDistrict: Object.fromEntries(results.map(r => [r.d, auditRepeats(r.blocks)])), city: auditRepeats(results.flatMap(r => r.blocks)) };
// ── 2 · one entry per sign (a corner shop's two faces are one sign): identity = block | family | lot | the allocator's own pick
const signs = new Map(), kit = { n: 0 };
for (const r of results) for (const b of r.blocks) { const [i, j] = b.key.split('_').map(Number);
  for (const s of b.signs) { const orig = s.was ?? s.key, gag = gagOf(s, byKey); if (!gag) { kit.n++; continue; }
    const id = `${b.key}|${s.fam}|${s.group ?? '-'}|${orig}`, o = signs.get(id);
    if (o) { o.n++; continue; }
    const g0 = s.was !== undefined ? gagOf({ ...s, key: s.was }, byKey) : gag;
    signs.set(id, { id, blk: b.key, i, j, fam: s.fam, key: s.key, was: s.was, gag, gag0: g0, x: s.x, z: s.z, where: s.where, trade: s.trade, net: isNet(s.key), s1: inSection1(i, j), dist: Math.hypot(s.x, s.z), n: 1, district: r.d }); } }
const all = [...signs.values()].sort((a, b) => (b.s1 - a.s1) || (a.dist - b.dist) || (a.id < b.id ? -1 : 1));
// repeats: walk out from the centre (section 1 first); a sign whose gag already stands within its family's view distance is a repeat
const CELL = 50, grid = new Map(), cellOf = (x, z) => Math.floor(x / CELL) + ',' + Math.floor(z / CELL);
const near = (s, gag) => { const R = VIEW[s.fam], k = Math.ceil(R / CELL), cx = Math.floor(s.x / CELL), cz = Math.floor(s.z / CELL);
  for (let a = cx - k; a <= cx + k; a++) for (let c = cz - k; c <= cz + k; c++) for (const t of grid.get(a + ',' + c) || []) if (t.fam === s.fam && t.gag === gag && Math.hypot(t.x - s.x, t.z - s.z) < R) return t; return null; };
const repeats = [];
for (const s of all) { const t = near(s, s.gag); if (t) { s.repeatOf = t.id; s.d = Math.round(Math.hypot(t.x - s.x, t.z - s.z)); repeats.push(s); }
  const k = cellOf(s.x, s.z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(s); }
const byFam = {}, byGag = {};
for (const s of all) { const f = byFam[s.fam] ??= { signs: 0, repeats: 0, net: 0, swapped: 0 }; f.signs++; if (s.net) f.net++; if (s.was !== undefined) f.swapped++; }
for (const s of repeats) { byFam[s.fam].repeats++; const g = byGag[s.fam] ??= {}; g[s.gag] = (g[s.gag] || 0) + 1; }
for (const f of Object.keys(byGag)) byGag[f] = Object.fromEntries(Object.entries(byGag[f]).sort((a, b) => b[1] - a[1]));

// ── 3 · against another census: which signs changed (the swap may change repeats only)
let vs = null;
if (VS) { const B = JSON.parse(await fs.readFile(path.join(HERE, `census-${VS}.json`), 'utf8')), before = new Map(B.signs.map(s => [s.id, s]));
  const changed = all.filter(s => before.has(s.id) && before.get(s.id).key !== s.key), notRep = changed.filter(s => !before.get(s.id).repeatOf);
  const gone = B.signs.filter(s => !signs.has(s.id)).length, added = all.filter(s => !before.has(s.id)).length;
  vs = { label: VS, changed: changed.length, changedNotRepeat: notRep.map(s => s.id), beforeRepeats: B.repeats, missing: gone, added }; }

const res = { label, generated: new Date().toISOString(), query: EXTRA, view: VIEW, districts: results.map(r => ({ d: r.d, blocks: r.blocks.length, modules: r.modules.length })),
  signs: all.length, kitSigns: kit.n, internet: all.filter(s => s.net).length, repeats: repeats.length, repeatsOutsideSection1: repeats.filter(s => !s.s1).length, auditSignRepeat: auditSR, byFam, byGag, vs,
  repeatList: repeats.map(s => `${s.fam} ${s.gag} ${s.blk} "${s.key}" ← ${s.repeatOf.split('|')[0]} ${s.d} m`), signsList: undefined };
await fs.writeFile(path.join(HERE, `census-${label}.json`), JSON.stringify({ ...res, signs: all }, null, 0).replace(/},{"id"/g, '},\n{"id"'));
console.log(`\naudit sign-repeat (same words within radius): ${auditSR.city} city-wide · per district run ${JSON.stringify(auditSR.byDistrict)}`);
console.log(`\ncensus ${label}: ${all.length} signs (${kit.n} kit records not the signage system's) · internet ${res.internet} (${(res.internet / all.length * 100).toFixed(1)}%) · REPEATS BY GAG ${repeats.length} (${res.repeatsOutsideSection1} outside section 1) · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
for (const [f, v] of Object.entries(byFam)) console.log(`  ${f.padEnd(8)} ${String(v.signs).padStart(5)} signs · ${String(v.repeats).padStart(4)} repeats (view ${VIEW[f]} m)${v.swapped ? ` · ${v.swapped} swapped` : ''} · top: ${Object.entries(byGag[f] || {}).slice(0, 6).map(([g, n]) => g.replace(/^\w+:/, '') + ' ' + n).join(', ')}`);
if (vs) console.log(`  vs ${VS}: ${vs.changed} signs changed (all repeats there: ${vs.changedNotRepeat.length ? 'NO · ' + vs.changedNotRepeat.slice(0, 5).join(' ') : 'yes'}) · repeats ${vs.beforeRepeats} → ${repeats.length} · signs gone ${vs.missing} · new ${vs.added}`);
