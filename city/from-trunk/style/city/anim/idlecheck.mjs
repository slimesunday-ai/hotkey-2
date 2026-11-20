// ANIM LAB · K3-IDLES (2026-11-19) · the standing idles measured from the game's camera (hotkey 2's Lock: 24 m up, 64° down, a 42° lens,
// a person about 70 px tall on 1600 × 1000; K0-looks looksshots.mjs's LOCK), on the code as it is and on the code before this lane.
//   serve   a read-only static server for this worktree on --port, where /@base/<path> serves <path> as it was at --base (git show):
//           the same page, before and after, from one server (run it in the background; every other mode needs it)
//   corner  the live city on the busy downtown corner (Central Ave, the Director's rush on downtown), the game's camera, --secs s sampled
//           at 10 Hz: every drawn (near tier) walker in the picture, standing (idle weight > .5) or not, its idle, its own seed.
//           Prints: standing people, the share of each idle, how long a person holds an idle (a stop = one idle, pedsim.js pickIdle),
//           and the same-moment pairs of standing people → <out>/<ver>-corner.json
//   alike   the lab (one look, standing on the plaza, facing 3/4 to the camera), the game's camera at the player's pixel size: every idle
//           and every (idle, seed) the corner saw, drawn as PART MAPS (head · arms · body · legs in flat ids, so an arm in front of the
//           body still counts) over 21 s of its own clock at 10 fps. The difference of two motions = the share of the person's pixels
//           whose part differs, at the best time shift of one against the other (a 6 s window against 15 s), so a clock offset costs
//           nothing: two people in the same idle with no per-person variation score exactly 0. Prints each idle's nearest other idle
//           (does it read as its own thing from up there), and the corner's same-moment pairs scored → <out>/<ver>-alike.json
//   perf    the live city, the same camera, --secs s windows, base and after alternating --runs times: the GPU time (the page's own timer
//           query, dyn.gpu, as bench.js reads it), the frame interval, draw calls, programs → <out>/perf.json
//   bench   the repository's bench (?bench=1, bench.js's fixed flight), base and after alternating --runs times → <out>/bench.json
// --ver base|after|both (default both: base first). Writes every process id it starts to --pids and stops only those.
//   node style/city/anim/idlecheck.mjs serve [--port 5520] [--base 482457d8]
//   node style/city/anim/idlecheck.mjs corner|alike|perf|bench [--port 5520] [--cdp 5784] [--ver both] [--secs 90] [--runs 3] [--tod day]
//     [--out style/city/shots/k3-idles]
import { spawn, execFileSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const argv = process.argv.slice(2), MODE = argv[0], arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const PORT = +arg('port', 5520), CDP = +arg('cdp', 5784), BASEREV = arg('base', '482457d8'), SECS = +arg('secs', 90), RUNS = +arg('runs', 3), TOD = arg('tod', 'day');
const VERS = arg('ver', 'both') === 'both' ? ['base', 'after'] : [arg('ver')];
const OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/k3-idles'))), PIDS = path.resolve(arg('pids', path.join(os.tmpdir(), `k3-idles-${CDP}.pids`)));
const BASE = `http://127.0.0.1:${PORT}`, PFX = v => v === 'base' ? '/@base' : '', sleep = ms => new Promise(r => setTimeout(r, ms));
const W = 1600, H = 1000, LOCK = { high: 24, down: 64, lens: 42, anchor: .82 * 1.75 };
// the street: K0-looks's downtown corner on Central Ave (the densest spot by day and by night), the Director's rush on downtown
const FOCUS = arg('focus', '-1,0.1,5.2').split(',').map(Number), RUSH = arg('rush', 'downtown');
const lock = ([x, y, z]) => { const el = LOCK.down * Math.PI / 180, d = LOCK.high / Math.sin(el), p = [x, y + LOCK.anchor, z]; return { pos: [p[0] + Math.cos(el) * d, p[1] + LOCK.high, p[2]], tgt: p }; };
const r3 = v => v.map(x => +x.toFixed(2)).join(',');
const q = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const f2 = x => x === null || x === undefined ? '–' : (+x).toFixed(2);

// ── serve: this worktree, and /@base/ from git (cached), read-only, no-store
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.md': 'text/plain', '.woff2': 'font/woff2', '.bin': 'application/octet-stream', '.wasm': 'application/wasm' };
async function serveMode() {
  const cache = new Map();
  const srv = http.createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, BASE).pathname), base = false;
      if (p.startsWith('/@base/')) { base = true; p = p.slice(6); }
      if (p.endsWith('/')) p += 'index.html';
      const rel = path.posix.normalize(p).replace(/^\/+/, '');
      if (rel.startsWith('..') || rel.includes('\0')) { res.writeHead(403); return res.end(); }
      let body;
      if (base) { if (!cache.has(rel)) { try { cache.set(rel, execFileSync('git', ['show', `${BASEREV}:${rel}`], { cwd: ROOT, maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] })); } catch { cache.set(rel, null); } } body = cache.get(rel); }
      else body = await fs.readFile(path.join(ROOT, rel)).catch(() => null);
      if (!body) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body);
    } catch (e) { res.writeHead(500); res.end(String(e)); }
  });
  srv.listen(PORT, '127.0.0.1', () => console.log(`serving ${ROOT} on ${BASE} (and ${BASEREV} under ${BASE}/@base/)`));
}

// ── the processes this run starts (and only those)
const mine = [];
const own = async (what, child) => { mine.push(child.pid); await fs.appendFile(PIDS, `${what} ${child.pid}\n`); };
const stopMine = () => { for (const pid of mine.splice(0)) { try { process.kill(pid, 'SIGTERM'); } catch {} } };
process.on('exit', stopMine); process.on('SIGINT', () => { stopMine(); process.exit(130); });
const answers = async url => { try { return (await fetch(url, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; } };
async function needServer() { if (!(await answers(`${BASE}/@base/style/city/index.html`))) throw new Error(`no idlecheck server on ${BASE} (node style/city/anim/idlecheck.mjs serve --port ${PORT})`); }
async function chrome(w = W, h = H) {
  if (await answers(`http://127.0.0.1:${CDP}/json/version`)) throw new Error(`port ${CDP} already answers: not this run's browser`);
  const prof = await fs.mkdtemp(path.join(os.tmpdir(), 'k3-chrome-'));
  const ch = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check',
    '--use-angle=metal', '--ignore-gpu-blocklist', '--hide-scrollbars', `--remote-debugging-port=${CDP}`, `--window-size=${w},${h}`, 'about:blank'], { stdio: 'ignore' });
  await own('chrome', ch);
  for (let t = 0; t < 150 && !(await answers(`http://127.0.0.1:${CDP}/json/version`)); t++) await sleep(100);
  const page = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const wait = new Map(), errors = [], logs = [];
  const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' ')); };
  for (const d of ['Runtime.enable', 'Page.enable']) await send(d);
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  const ev = async (expr, ms = 180000) => { const r = await Promise.race([send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }), sleep(ms).then(() => ({ timeout: true }))]);
    if (r.timeout) throw new Error('page did not answer in ' + ms / 1000 + ' s: ' + expr.slice(0, 80));
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text || 'eval failed'); return r.result?.result?.value; };
  const close = async () => { try { ws.close(); } catch {} stopMine(); await sleep(500); await fs.rm(prof, { recursive: true, force: true }).catch(() => {}); };
  return { send, ev, close, errors, logs };
}
// three.js reports a shader that fails to compile on the console, not as an exception
const shaderOk = (B, what) => { const bad = B.logs.filter(l => /Shader Error|ERROR: 0:|Program Info Log|VALIDATE_STATUS/.test(l)); if (bad.length) throw new Error(`${what}: shader error: ${bad[0].slice(0, 1500)}`); };
// the live city on the corner, the game's camera, nothing moving the camera or the pixel ratio
const cityUrl = (ver, o = {}) => { const L = lock(FOCUS); return `${BASE}${PFX(ver)}/style/city/index.html?q=high&nobake=1&rush=${RUSH}&cam=${r3(L.pos)}&look=${r3(L.tgt)}&fov=${LOCK.lens}&w=${W}&h=${H}` +
  (TOD === 'night' ? '&tod=night' : '') + (o.bench ? '&bench=1' : '&rig=0&loadin=0&nodyn=1'); };
async function openCity(B, u) {
  B.errors.length = 0; await B.send('Page.navigate', { url: u }); const t0 = Date.now();
  while (Date.now() - t0 < 400000) { if (B.errors.length) throw new Error('page error: ' + B.errors[0]);
    if (await B.ev(`!!(window.__city && !window.__city.loading && window.__city.peds?.ready && window.__city.stream.settled?.())`, 10000).catch(() => false)) { shaderOk(B, u); return Date.now() - t0; } await sleep(500); }
  throw new Error('timeout loading ' + u);
}

// --talk share,outer: the after page's TALK (pedsim.js) set in the page before measuring or filming (a busier talking corner to show
// beside the committed one: the module's own object, so the city reads it; the default in the file is untouched)
const TALKARG = arg('talk', null), TALKSET = TALKARG ? `import('/style/city/pedsim.js').then(m => { const [s, r] = ${JSON.stringify(TALKARG.split(',').map(Number))}; m.TALK.share = s; m.TALK.r[1] = r; return JSON.stringify(m.TALK); })` : null;
// ── corner: who stands, in which idle, for how long
const SAMPLE = secs => `(async () => { const C = window.__city, P = C.peds, V = new C.THREE.Vector3(), out = [], t0 = performance.now();
  await new Promise(done => { const iv = setInterval(() => { const t = (performance.now() - t0) / 1000, row = [];
    for (const w of P.sim.walkers) { if (w.hide || w.tier !== 1 || !w.g) continue; V.set(w.p[0], w.p[1] + .9, w.p[2]).project(C.camera);
      if (Math.abs(V.x) > 1 || Math.abs(V.y) > 1 || V.z > 1) continue; const g = w.g;
      row.push([w.id, g.idle, +g.iw.toFixed(2), +(w.vc || 0).toFixed(2), g.iseed ?? -1, w.agent ? 1 : 0, w.faceTo ? w.faceTo.id : -1]); }
    out.push([+t.toFixed(2), row]); if (t >= ${secs}) { clearInterval(iv); done(); } }, 100); });
  return out; })()`;
function cornerStats(samples, names) {
  const STAND = r => r[1] >= 0 && r[1] < 32 && r[2] > .5, byIdle = {}, people = {}, eps = [], open = new Map(), pairs = { all: 0, same: 0, list: new Map() };
  let standSum = 0, drawnSum = 0, standMax = 0; const T1 = samples[samples.length - 1][0];
  for (const [t, row] of samples) {
    const st = row.filter(STAND); standSum += st.length; drawnSum += row.length; standMax = Math.max(standMax, st.length);
    for (const r of st) { byIdle[r[1]] = (byIdle[r[1]] || 0) + 1; (people[r[1]] ||= new Set()).add(r[0]); }
    // episodes: one person, one idle, contiguous (a gap under 0.35 s is the same stop)
    const seen = new Set();
    for (const r of st) { const k = r[0], e = open.get(k); seen.add(k);
      if (e && e.idle === r[1] && t - e.t1 < .35) { e.t1 = t; continue; }
      if (e) { eps.push(e); open.delete(k); }
      open.set(k, { id: k, idle: r[1], t0: t, t1: t, cutStart: t < .2, seed: r[4] }); }
    for (const [k, e] of open) if (!seen.has(k) && t - e.t1 >= .35) { eps.push(e); open.delete(k); }
    for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) { pairs.all++; const a = st[i], b = st[j];
      const key = [[a[1], a[4]], [b[1], b[4]]].sort((x, y) => x[0] - y[0] || x[1] - y[1]).map(m => m.join(':')).join('|');
      pairs.list.set(key, (pairs.list.get(key) || 0) + 1); if (a[1] === b[1]) pairs.same++; } }
  for (const e of open.values()) { e.cutEnd = true; eps.push(e); }
  // (the elbow round: pairs turned to talk, w.faceTo: each pair once, and how long it was seen standing together)
  const talk = new Map(); for (const [, row] of samples) for (const r of row) if (r[6] >= 0 && STAND(r)) { const k = Math.min(r[0], r[6]) + '-' + Math.max(r[0], r[6]); talk.set(k, (talk.get(k) || 0) + .05); }
  const n = samples.length, durs = eps.map(e => e.t1 - e.t0 + .1), whole = eps.filter(e => !e.cutStart && !e.cutEnd).map(e => e.t1 - e.t0 + .1);
  return { samples: n, secs: T1, drawnMean: drawnSum / n, standMean: standSum / n, standMax,
    idles: Object.fromEntries(Object.entries(byIdle).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, { name: names[k] || '#' + k, share: v / standSum, people: people[k].size }])),
    distinctIdles: Object.keys(byIdle).length, episodes: eps.length, whole: whole.length,
    hold: { p25: q(whole, .25), p50: q(whole, .5), p75: q(whole, .75), max: Math.max(0, ...durs) },
    pairs: { moments: pairs.all, sameIdle: pairs.same, list: [...pairs.list].map(([k, v]) => ({ k, n: v })) },
    seeds: { standing: new Set(eps.map(e => e.id)).size, seeded: new Set(eps.filter(e => e.seed >= 0).map(e => e.id)).size }, talk: { pairs: talk.size, secs: [...talk.values()].reduce((a, b) => a + b, 0) } };
}
async function cornerMode() {
  await needServer(); await fs.mkdir(OUT, { recursive: true }); const B = await chrome(), res = {};
  try { for (const ver of VERS) {
    const ms = await openCity(B, cityUrl(ver)); if (ver === 'after' && TALKSET) await B.ev(TALKSET); await sleep(5000);
    const names = await B.ev(`import('${PFX(ver)}/style/city/anim/idle.js').then(m => m.IDLE_NAMES)`);
    const samples = await B.ev(SAMPLE(SECS), (SECS + 60) * 1000), S = cornerStats(samples, names);
    res[ver] = S; await fs.writeFile(path.join(OUT, `${ver}-corner.json`), JSON.stringify({ ver, url: cityUrl(ver), loadMs: ms, names, stats: S, samples }, null, 0));
    console.log(`\n${ver.toUpperCase()} · the corner (${FOCUS}), the game's camera, ${TOD}, ${S.secs.toFixed(0)} s at 10 Hz · drawn walkers in the picture ${S.drawnMean.toFixed(1)} mean`);
    console.log(`  standing: ${S.standMean.toFixed(1)} mean, ${S.standMax} at most · ${S.seeds.standing} different people stood · ${S.distinctIdles} different idles seen · ${S.seeds.seeded} with their own variation`);
    console.log('  idle                        share   people');
    for (const [k, v] of Object.entries(S.idles)) console.log(`  ${(k + ' ' + v.name).padEnd(26)} ${(100 * v.share).toFixed(1).padStart(5)} %  ${String(v.people).padStart(4)}`);
    console.log(`  how long a person holds one idle (a stop; ${S.whole} whole stops of ${S.episodes}): p25 ${f2(S.hold.p25)} s · median ${f2(S.hold.p50)} s · p75 ${f2(S.hold.p75)} s · longest seen ${f2(S.hold.max)} s`);
    console.log(`  standing pairs at the same moment: ${S.pairs.moments} pair-samples, ${S.pairs.sameIdle} (${(100 * S.pairs.sameIdle / Math.max(1, S.pairs.moments)).toFixed(1)} %) in the same idle`);
    console.log(`  pairs turned to talk: ${S.talk.pairs} (seen standing together ${S.talk.secs.toFixed(0)} s in all: ${(S.talk.secs / S.secs).toFixed(2)} pairs talking at a time)${ver === 'after' && TALKARG ? ' · TALK share, outer ring ' + TALKARG : ''}`);
  } } finally { await B.close(); }
  return res;
}

// ── alike: the game's camera in the lab, each frame drawn twice (lit, and in flat part ids: head · −x arm · +x arm · body · legs, so an
// arm in front of the body still counts), and the best-shift difference of two motions over a whole loop
const CW = 96, CH = 104, FPS = 5, LEN = 30, WIN = 15, SHIFT = 15, TOP = +arg('top', 300);
// "look alike": as alike as the two most alike of the eight idles before K3-idles (weight shift and pockets + foot tap: 20.1 % on this
// measure, the base run of 2026-11-19); the seeds for the per-person check (three pairs of people in each idle)
const ALIKE = +arg('alike', .201), VSEEDS = [[101, 202], [303, 404], [505, 606]];
// (the measure itself, the same on either body: a person's frames per motion, the best-shift difference of two, a sheet)
const ALIKE_METHODS = `    seq(key, v, seed) { const fr = []; let px = 0; for (let k = 0; k < ${LEN * FPS}; k++) { this.pose(v, seed, 3 + k / ${FPS}); const f = this.frame(); fr.push(f); px += f.idx.length; } this.seqs.set(key, fr); return px / fr.length; },
    // A's first WIN s against B from each shift in [0, SHIFT) s (coarse, then refined): the share of the pixels either person covers whose
    // part or colour differs; both ways (a gesture one of them has and the other lacks counts either way), the larger
    one(A0, B0) { const nW = ${WIN * FPS}, nS = ${SHIFT * FPS};
      const score = s => { let bad = 0, uni = 0; for (let i = 0; i < nW; i += 2) { const x = A0[i], y = B0[i + s], yo = y.o, xo = x.o, xi = x.idx; let both = 0, agree = 0;
          for (let k = 0; k < xi.length; k++) { const p = xi[k], w = yo[p]; if (w) { both++; if (w === xo[p]) agree++; } } const u = xi.length + y.idx.length - both; uni += u; bad += u - agree; } return bad / Math.max(1, uni); };
      let best = 1, bs = 0; for (let s = 0; s < nS; s += 3) { const v = score(s); if (v < best) { best = v; bs = s; } }
      for (let s = Math.max(0, bs - 2); s <= Math.min(nS - 1, bs + 2); s++) { const v = score(s); if (v < best) { best = v; bs = s; } } return [best, bs / ${FPS}]; },
    diff(ka, kb) { const A0 = this.seqs.get(ka), B0 = this.seqs.get(kb), x = this.one(A0, B0), y = this.one(B0, A0); return x[0] >= y[0] ? x : y; },
    // a sheet: one row per motion, frames every 2 s, the part ids in flat colours (to look at what was measured)
    sheet(keys) { const cols = 12, cv = document.createElement('canvas'); cv.width = cols * ${CW}; cv.height = keys.length * ${CH}; const g = cv.getContext('2d'), id = g.createImageData(${CW}, ${CH});
      const PAL = [[24, 24, 28], [255, 200, 40], [60, 200, 255], [255, 80, 160], [120, 220, 90], [150, 150, 160]];
      keys.forEach((k, r) => { const fr = this.seqs.get(k); for (let c = 0; c < cols; c++) { const o = fr[c * 10].o; for (let y = 0; y < ${CH}; y++) for (let x = 0; x < ${CW}; x++) { const v = o[(${CH} - 1 - y) * ${CW} + x] >> 9, d = (y * ${CW} + x) * 4; id.data.set([...PAL[v] || [255, 255, 255], 255], d); }
        g.putImageData(id, c * ${CW}, r * ${CH}); } g.fillStyle = '#fff'; g.font = '10px sans-serif'; g.fillText(k, 3, r * ${CH} + 11); });
      return cv.toDataURL('image/png'); }`;
const ALIKE_SETUP = (look) => `(async () => { const A = window.__anim, THREE = await import('three'), { installAnim2 } = await import('./walk2.js');
  const { renderer, scene, camera, BATCH } = A, B = BATCH.v2, acts = A.actors; acts.splice(1); const a = acts[0]; a.x = 0; a.z = 0; a.look = ${look} % A.LK2.length; a.yaw = Math.PI / 4; a.label = null;
  for (const o of scene.children) o.visible = o === B.b || !!o.isLight; scene.background = null; renderer.shadowMap.enabled = false; renderer.setPixelRatio(1); renderer.setSize(${CW}, ${CH});
  const m = new THREE.MeshBasicMaterial();
  m.onBeforeCompile = (sh, r) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\\nvarying float vK3P;').replace('#include <begin_vertex>', '#include <begin_vertex>\\n  vK3P = aPart;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\\nvarying float vK3P;').replace(/}\\s*$/, ' float p = floor(vK3P + .5); float c = p == 5. ? 1. : p == 3. ? 2. : p == 4. ? 3. : (p == 0. || p == 12.) ? 4. : 5.; gl_FragColor = vec4(c / 8., 0., 0., 1.);\\n}'); };
  m.customProgramCacheKey = () => 'k3part'; installAnim2(m, B.uni);
  const rt = new THREE.WebGLRenderTarget(${CW}, ${CH}), bp = new Uint8Array(${CW * CH * 4}), bl = new Uint8Array(${CW * CH * 4});
  const el = ${LOCK.down} * Math.PI / 180, d = ${LOCK.high} / Math.sin(el), p = [a.x, a.y + ${LOCK.anchor}, a.z];
  camera.position.set(p[0] + Math.cos(el) * d, p[1] + ${LOCK.high}, p[2]); camera.fov = ${LOCK.lens}; camera.aspect = ${W / H}; camera.clearViewOffset(); camera.updateProjectionMatrix(); camera.lookAt(p[0], p[1], p[2]); camera.updateMatrixWorld();
  const c = new THREE.Vector3(a.x, a.y + .85, a.z).project(camera), cx = (c.x + 1) / 2 * ${W}, cy = (1 - c.y) / 2 * ${H};
  camera.setViewOffset(${W}, ${H}, Math.round(cx - ${CW / 2}), Math.round(cy - ${CH / 2}), ${CW}, ${CH}); camera.updateProjectionMatrix();
  const orig = B.b.material, N = ${CW * CH};
  const draw = (mat, buf) => { B.b.material = mat; renderer.setRenderTarget(rt); renderer.setClearColor(0, 0); renderer.clear(); renderer.render(scene, camera); renderer.readRenderTargetPixels(rt, 0, 0, ${CW}, ${CH}, buf); renderer.setRenderTarget(null); B.b.material = orig; };
  window.__k3 = { a, seqs: new Map(),
    pose(v, seed, t) { const g = a.g; g.idle = v; g.iw = 1; g.w = 0; g.v = 0; g.omega = 0; g.hp = 0; g.hr = 0; g.it = t; g.iseed = seed; g.look = v === 8 ? -.9 : 0; g.wasStill = true; g.still = 9; },
    // a frame: per pixel the part id (3 bits) and the lit colour (3 bits a channel); 0 = no person. Dense, and the person's pixels' list
    frame() { A.draw(); draw(m, bp); draw(orig, bl); const o = new Uint16Array(N), idx = []; for (let i = 0; i < N; i++) { const k = Math.round(bp[i * 4] / 32); if (!k) continue;
        o[i] = k << 9 | (bl[i * 4] >> 5) << 6 | (bl[i * 4 + 1] >> 5) << 3 | (bl[i * 4 + 2] >> 5); idx.push(i); } return { o, idx: Uint16Array.from(idx) }; },
    ${ALIKE_METHODS} };
  return { looks: A.LK2.length }; })()`;
// (--body city: the same measure on the city's own body, idlebody.html: the crowd's first look, the cast's walk with the elbow; the lab
// draws no elbow)
const ALIKE_BODY = look => `(async () => { const I = __ib, N = ${CW * CH}, P = { k: ${look}, pool: 'npc', x: 0, z: 0, yaw: Math.PI / 4, g: null }, bp = new Uint8Array(N * 4), bl = new Uint8Array(N * 4);
  window.__k3 = { seqs: new Map(),
    pose(v, seed, t) { P.g = I.stand(v, seed, t, v === 8 ? -.9 : 0); I.people([P]); },
    frame() { I.aim('game', P, ${CW}, ${CH}); I.grab(true, bp, ${CW}, ${CH}); I.grab(false, bl, ${CW}, ${CH}); const o = new Uint16Array(N), idx = []; for (let i = 0; i < N; i++) { const k = Math.round(bp[i * 4] / 32); if (!k) continue;
        o[i] = k << 9 | (bl[i * 4] >> 5) << 6 | (bl[i * 4 + 1] >> 5) << 3 | (bl[i * 4 + 2] >> 5); idx.push(i); } return { o, idx: Uint16Array.from(idx) }; } };
  Object.assign(window.__k3, { ${ALIKE_METHODS} }); return { looks: 48 }; })()`;
async function alikeMode() {
  await needServer(); await fs.mkdir(OUT, { recursive: true }); const B = await chrome(CW, CH), res = {};
  try { for (const ver of VERS) {
    const CITY = arg('body', 'lab') === 'city', look = +arg('look', 0);
    if (CITY) { await openBody(B, ver); await B.ev(ALIKE_BODY(look)); }
    else { B.errors.length = 0; await B.send('Page.navigate', { url: `${BASE}${PFX(ver)}/style/city/anim/index.html?scene=idles&ab=v2&shot=1` });
      for (let t = 0; t < 180 && (await B.ev('document.title', 5000).catch(() => '')) !== 'ready'; t++) await sleep(500);
      if (B.errors.length) throw new Error('lab error: ' + B.errors[0]);
      await B.ev(ALIKE_SETUP(look)); }
    await B.ev(`__k3.seq('probe', 0, -1)`); shaderOk(B, (CITY ? 'body ' : 'lab ') + ver);
    if (argv.includes('--dbg')) console.log(await B.ev(`(() => { const S = __anim.scene; return JSON.stringify(S.children.map(o => [o.type, o.visible, o.name, o.isBatchedMesh ? 'BATCH' : '', o.children.length, o.geometry?.parameters ? JSON.stringify(o.geometry.parameters) : ''])); })()`));
    if (argv.includes('--dbg')) console.log(await B.ev(`(() => { const f = __k3.frame(), h = {}; for (let i = 0; i < f.o.length; i++) { const k = f.o[i] >> 9; h[k] = (h[k] || 0) + 1; } return JSON.stringify({ n: f.idx.length, h, kids: __anim.scene.children.filter(o => o.visible).map(o => o.type + (o.isLight ? '' : '')) }); })()`));
    const names = await B.ev(CITY ? `__ib.idle.IDLE_NAMES` : `import('./idle.js').then(m => m.IDLE_NAMES)`), corner = JSON.parse(await fs.readFile(path.join(OUT, `${ver}-corner.json`), 'utf8').catch(() => 'null'));
    // the motions: every idle with no variation (seed −1), and every (idle, seed) the corner's standing pairs showed
    const mot = new Map(); names.forEach((n, v) => mot.set(`${v}:-1`, [v, -1]));
    // (the corner's TOP most frequent pairs; the share of pair-samples they cover is printed)
    const all = corner ? corner.stats.pairs.list : [], plist = all.slice().sort((x, y) => y.n - x.n).slice(0, TOP), cover = all.length ? plist.reduce((t, x) => t + x.n, 0) / all.reduce((t, x) => t + x.n, 0) : 1;
    for (const { k } of plist) for (const m of k.split('|')) { const [v, s] = m.split(':').map(Number); mot.set(`${v}:${s}`, [v, s]); }
    const vary = ver === 'after' && !argv.includes('--novary'); if (vary) names.forEach((n, v) => VSEEDS.flat().forEach(s => mot.set(`${v}:${s}`, [v, s])));
    const t0 = Date.now(), px = {}; for (const [key, [v, s]] of mot) px[key] = Math.round(await B.ev(`__k3.seq(${JSON.stringify(key)}, ${v}, ${s})`));
    console.error(`${ver}: ${mot.size} motions drawn in ${((Date.now() - t0) / 1000).toFixed(0)} s · person pixels per frame ${Math.min(...Object.values(px))}–${Math.max(...Object.values(px))}`);
    const sheet = await B.ev(`__k3.sheet(${JSON.stringify(names.map((n, v) => `${v}:-1`))})`); await fs.writeFile(path.join(OUT, `${ver}-alike${CITY ? '-city' : ''}-sheet.png`), Buffer.from(sheet.split(',')[1], 'base64'));
    const memo = new Map(), D = async (a, b) => { const k = a < b ? a + '/' + b : b + '/' + a; if (!memo.has(k)) memo.set(k, await B.ev(`__k3.diff(${JSON.stringify(a)}, ${JSON.stringify(b)})`)); return memo.get(k); };
    // each idle's nearest other idle (the pool's idles: the crossing wait is the crossing's own; it is compared too)
    const near = []; for (let i = 0; i < names.length; i++) { let best = [9, -1]; for (let j = 0; j < names.length; j++) { if (i === j) continue; const [d] = await D(`${i}:-1`, `${j}:-1`); if (d < best[0]) best = [d, j]; } near.push({ idle: i, name: names[i], nearest: best[1], d: best[0] }); }
    // the same idle on two people (the per-person variation alone: tempo, size, side; at a crossing also the waiting style)
    const per = []; if (vary) for (let v = 0; v < names.length; v++) { const ds = []; for (const [a, b] of VSEEDS) ds.push((await D(`${v}:${a}`, `${v}:${b}`))[0]); per.push({ idle: v, name: names[v], d: ds }); }
    // the corner's same-moment pairs, scored, weighted by how long they stood together
    const scored = []; for (const { k, n } of plist) { const [a, b] = k.split('|'); const [d, s] = await D(a, b); scored.push({ a, b, n, d, shift: s, same: a.split(':')[0] === b.split(':')[0] }); }
    const wq = (list, p) => { const s = list.slice().sort((x, y) => x.d - y.d), tot = s.reduce((t, x) => t + x.n, 0); let acc = 0; for (const x of s) { acc += x.n; if (acc >= p * tot) return x.d; } return null; };
    const share = (list, th) => { const tot = list.reduce((t, x) => t + x.n, 0); return tot ? list.filter(x => x.d < th).reduce((t, x) => t + x.n, 0) / tot : null; };
    const same = scored.filter(x => x.same), R = { names, near, pairs: scored, per, all: { n: scored.reduce((t, x) => t + x.n, 0), p25: wq(scored, .25), p50: wq(scored, .5), alike: share(scored, ALIKE) },
      same: { n: same.reduce((t, x) => t + x.n, 0), p50: wq(same, .5), max: same.length ? Math.max(...same.map(x => x.d)) : null, alike: share(same, ALIKE) } };
    res[ver] = R; await fs.writeFile(path.join(OUT, `${ver}-alike${CITY ? '-city' : ''}.json`), JSON.stringify(R, null, 1));
    console.log(`\n${ver.toUpperCase()} · from the game's camera (a ${CW} × ${CH} cut at 1:1 of 1600 × 1000, the person ~70 px), ${CITY ? 'the city\'s body (the crowd\'s look ' + look + ', the elbow)' : 'the lab (no elbow)'}, lit + part ids, whole loops, best time shift`);
    console.log('  idle                         nearest other idle            difference');
    for (const r of near) console.log(`  ${(r.idle + ' ' + r.name).padEnd(28)} ${(r.nearest + ' ' + names[r.nearest]).padEnd(28)} ${(100 * r.d).toFixed(1).padStart(5)} %`);
    const nd = near.filter(r => r.idle !== 8).map(r => r.d); console.log(`  the pool's idles: nearest-other difference median ${(100 * q(nd, .5)).toFixed(1)} %, smallest ${(100 * Math.min(...nd)).toFixed(1)} %`);
    if (per.length) { console.log('  the same idle on two people with their own variation (three pairs each): difference'); for (const r of per) console.log(`  ${(r.idle + ' ' + r.name).padEnd(28)} ${r.d.map(d => (100 * d).toFixed(1).padStart(5) + ' %').join('  ')}`); }
    console.log(`  (the corner's ${plist.length} most frequent pairs of ${all.length}: ${(100 * cover).toFixed(1)} % of its pair-samples)`);
    console.log(`  the corner's standing pairs (pair-samples ${R.all.n}): difference median ${f2(100 * R.all.p50)} %, p25 ${f2(100 * R.all.p25)} %; look alike (under ${(100 * ALIKE).toFixed(1)} %, as alike as weight shift and pockets + foot tap): ${f2(100 * R.all.alike)} % of them`);
    console.log(`  of those, in the same idle (${R.same.n}): difference median ${f2(R.same.p50 === null ? null : 100 * R.same.p50)} %, largest ${f2(R.same.max === null ? null : 100 * R.same.max)} %, look alike: ${f2(R.same.alike === null ? null : 100 * R.same.alike)} %`);
  } } finally { await B.close(); }
  return res;
}

// ── perf: the corner's GPU time, base and after alternating
const WINDOW = secs => `(async () => { const C = window.__city, d = C.dyn, r = C.renderer, out = { ft: [], gpu: [], calls: [], tris: [] }; let last = performance.now(); const t0 = last;
  await new Promise(done => { const step = () => { const now = performance.now(); out.ft.push(now - last); last = now; const g = d.gpu; if (g !== null && g !== undefined) out.gpu.push(g); out.calls.push(r.info.render.calls); out.tris.push(r.info.render.triangles);
    if (now - t0 > ${secs * 1000}) done(); else requestAnimationFrame(step); }; requestAnimationFrame(step); });
  out.programs = r.info.programs?.length; out.timer = !!d.timer; return out; })()`;
async function perfMode() {
  await needServer(); await fs.mkdir(OUT, { recursive: true }); const B = await chrome(), res = { base: [], after: [] }, secs = +arg('secs', 8);
  try { for (let k = 0; k < RUNS; k++) for (const ver of (k % 2 ? [...VERS].reverse() : VERS)) {
    await openCity(B, cityUrl(ver)); await sleep(4000); const w = await B.ev(WINDOW(secs), (secs + 30) * 1000);
    const S = { gpu50: q(w.gpu, .5), gpu95: q(w.gpu, .95), ft50: q(w.ft, .5), calls: q(w.calls, .5), tris: q(w.tris, .5), programs: w.programs, timer: w.timer, n: w.gpu.length };
    res[ver].push(S); console.log(`perf ${ver.padEnd(5)} run ${k + 1}: GPU p50 ${f2(S.gpu50)} p95 ${f2(S.gpu95)} ms · frame p50 ${f2(S.ft50)} ms · calls ${S.calls} · tris ${(S.tris / 1e6).toFixed(2)} M · programs ${S.programs} · ${S.n} frames timed`); }
  } finally { await B.close(); }
  for (const ver of VERS) console.log(`perf ${ver}: GPU p50 per run [${res[ver].map(s => f2(s.gpu50)).join(', ')}] median ${f2(q(res[ver].map(s => s.gpu50), .5))} ms`);
  await fs.writeFile(path.join(OUT, 'perf.json'), JSON.stringify(res, null, 1)); return res;
}
async function benchMode() {
  await needServer(); await fs.mkdir(OUT, { recursive: true }); const B = await chrome(), res = { base: [], after: [] };
  try { for (let k = 0; k < RUNS; k++) for (const ver of (k % 2 ? [...VERS].reverse() : VERS)) {
    B.errors.length = 0; await B.send('Page.navigate', { url: cityUrl(ver, { bench: true }) }); const t0 = Date.now(); let done = false;
    while (Date.now() - t0 < 600000) { if ((await B.ev('document.title', 10000).catch(() => '')) === 'bench done') { done = true; break; } await sleep(2000); }
    if (!done) { console.log(`bench ${ver} run ${k + 1}: no result in 600 s`); continue; }
    const r = await B.ev(`({ text: window.__bench.text, segs: window.__bench.segs.map(s => ({ name: s.name, gpu: s.gpu.slice().sort((a, b) => a - b), calls: s.calls.slice().sort((a, b) => a - b), walkers: s.walkers })) })`);
    const segs = r.segs.map(s => ({ name: s.name, gpu50: q(s.gpu, .5), gpu95: q(s.gpu, .95), calls: q(s.calls, .5), walkers: s.walkers }));
    res[ver].push(segs); console.log(`bench ${ver.padEnd(5)} run ${k + 1}: ` + segs.map(s => `${s.name} ${f2(s.gpu50)}`).join(' · ') + ' (GPU p50 ms)');
    await fs.writeFile(path.join(OUT, `bench-${ver}-${k + 1}.txt`), r.text); }
  } finally { await B.close(); }
  const names = [...new Set(VERS.flatMap(v => res[v].flatMap(r => r.map(s => s.name))))];
  for (const n of names) console.log(`bench ${n.padEnd(16)} ` + VERS.map(v => { const a = res[v].map(r => r.find(s => s.name === n)?.gpu50).filter(x => x !== undefined && x !== null); return `${v} [${a.map(f2).join(', ')}] median ${f2(q(a, .5))}`; }).join(' | '));
  await fs.writeFile(path.join(OUT, 'bench.json'), JSON.stringify(res, null, 1)); return res;
}

// ── shot: any page of this server ('ready' title pages: the lab's shot/strip modes) → a png
async function shotMode() {
  await needServer(); const u = arg('url'), f = path.resolve(arg('file', path.join(OUT, 'shot.png'))), w = +arg('w', 1600), h = +arg('h', 1000); const B = await chrome(w, h);
  try { await B.send('Page.navigate', { url: BASE + u }); for (let t = 0; t < 240 && (await B.ev('document.title', 5000).catch(() => '')) !== 'ready'; t++) await sleep(500);
    shaderOk(B, u); if (B.errors.length) throw new Error('page error: ' + B.errors[0]);
    const r = await B.send('Page.captureScreenshot', { format: 'png' }); await fs.mkdir(path.dirname(f), { recursive: true }); await fs.writeFile(f, Buffer.from(r.result.data, 'base64')); console.log('wrote ' + f);
  } finally { await B.close(); } }
// ── input: the live city as a player meets it (the camera rig on), real input (CDP mouse: wheel zooms at the corner, then a drag), and at
// each step what the people standing in the picture play, the frame interval, page and shader errors → <out>/<ver>-input.json, a png
// at the closest step. Fails (exit 1) on an error, or with nobody standing in the picture at any step
const INPUT_SAMPLE = `(async () => { const C = window.__city, V = new C.THREE.Vector3(), ft = []; let last = performance.now();
  await new Promise(done => { const t0 = last, step = () => { const now = performance.now(); ft.push(now - last); last = now; if (now - t0 > 1500) done(); else requestAnimationFrame(step); }; requestAnimationFrame(step); });
  const by = {}; let stand = 0, seeded = 0, drawn = 0;
  for (const w of C.peds.sim.walkers) { if (w.hide || w.tier !== 1 || !w.g) continue; V.set(w.p[0], w.p[1] + .9, w.p[2]).project(C.camera); if (Math.abs(V.x) > 1 || Math.abs(V.y) > 1 || V.z > 1) continue; drawn++;
    const g = w.g; if (g.idle >= 0 && g.idle < 32 && g.iw > .5) { stand++; by[g.idle] = (by[g.idle] || 0) + 1; if (g.iseed >= 0) seeded++; } }
  ft.sort((a, b) => a - b); return { cam: [C.camera.position.x, C.camera.position.y, C.camera.position.z].map(v => +v.toFixed(1)), drawn, stand, seeded, by, ft50: +ft[ft.length >> 1].toFixed(1) }; })()`;
async function inputMode() {
  await needServer(); await fs.mkdir(OUT, { recursive: true }); const B = await chrome(), res = {}; let fail = 0;
  const mouse = (type, x, y, o = {}) => B.send('Input.dispatchMouseEvent', { type, x, y, button: o.button ?? 'none', buttons: o.buttons ?? 0, clickCount: o.clickCount ?? 0, deltaX: o.dx ?? 0, deltaY: o.dy ?? 0 });
  try { for (const ver of VERS) {
    const u = cityUrl(ver).replace('&rig=0&loadin=0&nodyn=1', '&loadin=0&nodyn=1'); await openCity(B, u); await sleep(3000); const steps = [];
    const sample = async what => { const r = await B.ev(INPUT_SAMPLE); shaderOk(B, ver + ' ' + what); r.what = what; r.errors = B.errors.length; steps.push(r);
      console.log(`${ver.padEnd(5)} ${what.padEnd(12)} camera ${r.cam.join(',')} · drawn ${r.drawn} · standing ${r.stand} (${r.seeded} with their own variation) · idles ${JSON.stringify(r.by)} · frame p50 ${r.ft50} ms · errors ${r.errors}`); };
    await sample('start');
    for (let k = 1; k <= 4; k++) { await mouse('mouseMoved', W / 2, H / 2); for (let j = 0; j < 4; j++) { await mouse('mouseWheel', W / 2, H / 2, { dy: -120 }); await sleep(60); } await sleep(1200); await sample('zoom in ' + k); }
    await mouse('mouseMoved', W / 2, H / 2); await mouse('mousePressed', W / 2, H / 2, { button: 'left', buttons: 1, clickCount: 1 });
    for (let j = 1; j <= 12; j++) { await mouse('mouseMoved', W / 2 - j * 18, H / 2 - j * 6, { button: 'left', buttons: 1 }); await sleep(30); }
    await mouse('mouseReleased', W / 2 - 216, H / 2 - 72, { button: 'left', buttons: 0, clickCount: 1 }); await sleep(1500); await sample('drag');
    const r = await B.send('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(OUT, `${ver}-input.png`), Buffer.from(r.result.data, 'base64'));
    res[ver] = { url: u, steps, errors: B.errors.splice(0) }; await fs.writeFile(path.join(OUT, `${ver}-input.json`), JSON.stringify(res[ver], null, 1));
    if (res[ver].errors.length || steps.some(s => s.errors)) { fail++; console.log(`${ver}: page errors: ${res[ver].errors.slice(0, 3).join(' | ')}`); }
    if (!steps.some(s => s.stand > 0)) { fail++; console.log(`${ver}: nobody standing in the picture at any step`); }
    const cam0 = steps[0].cam.join(), moved = steps.filter(s => s.cam.join() !== cam0).length; console.log(`${ver}: the camera moved on ${moved} of ${steps.length - 1} input steps`); if (!moved) fail++;
  } } finally { await B.close(); }
  console.log(fail ? `input: ${fail} failure(s)` : 'input: no failures'); if (fail) process.exitCode = 1;
}
// ── film: the board and the clip. A shot page of the city on the corner (the same walkers in the same places every run), one person placed
// standing (actors.js's way: a rolled look, peds.addLook, sim.putAgent), every idle in turn from its loop's start, as authored (no seed):
// each frame the game's camera (1:1, and the person 3×) and a close view (10 m off, 58° down); then the corner from the game's camera,
// before (base) and after, the same seconds. → <out>/board.jpg, <out>/clip.mp4 (frames in a temp folder, removed after)
const FILM_HELP = `(() => { if (window.__f3) return true; const C = window.__city, P = C.peds, V = new C.THREE.Vector3();
  for (const n of document.querySelectorAll('body > *:not(canvas)')) if (!n.querySelector?.('canvas')) n.style.visibility = 'hidden';
  const f = window.__f3 = { w: null,
    aim(w, view) { const p = w.p, el = (view === 'game' ? ${LOCK.down} : view === 'wide' ? 30 : 22) * Math.PI / 180, t = view === 'game' ? [p[0], p[1] + ${LOCK.anchor}, p[2]] : [p[0], p[1] + .85, p[2]], d = view === 'game' ? ${LOCK.high} / Math.sin(el) : view === 'wide' ? 15 : 7.5;
      C.controls.target.set(...t); C.camera.position.set(t[0] + Math.cos(el) * d, t[1] + Math.sin(el) * d, t[2]); C.camera.lookAt(C.controls.target); C.camera.fov = ${LOCK.lens}; C.camera.updateProjectionMatrix(); C.camera.updateMatrixWorld(); },
    corner() { const L = ${JSON.stringify(lock(FOCUS))}; C.controls.target.set(...L.tgt); C.camera.position.set(...L.pos); C.camera.lookAt(C.controls.target); C.camera.fov = ${LOCK.lens}; C.camera.updateProjectionMatrix(); C.camera.updateMatrixWorld(); },
    screen(w, up) { V.set(w.p[0], w.p[1] + up, w.p[2]).project(C.camera); const r = C.renderer.domElement.getBoundingClientRect(); return [Math.round(r.left + (V.x + 1) / 2 * r.width), Math.round(r.top + (1 - V.y) / 2 * r.height)]; },
    async figure(seed, yaw, pool = 'agent') { const CH = await import('/style/city/cast.js'), LK = await import('/style/city/simstate/looks.js');
      const idx = P.addLook(LK.bake(CH, CH.rollLook(seed, { pool }))); if (idx < 0) throw new Error('addLook refused');
      const t = C.controls.target; let best = null, room = 0;
      for (let dx = -8; dx <= 8; dx += 2) for (let dz = -12; dz <= 12; dz += 2) { const L = P.sim.laneNear(t.x + dx, t.z + dz, 6); if (!L) continue;
        const q = P.sim.where({ E: L.E, s: L.s, lat: 0, next: null, pE: null, p: [0, 0, 0, 0] }, [0, 0, 0, 0]); V.set(q[0], q[1] + .9, q[2]).project(C.camera); if (Math.abs(V.x) > .5 || Math.abs(V.y) > .5) continue;
        const r = Math.min(...P.sim.walkers.map(w => Math.hypot(w.p[0] - q[0], w.p[2] - q[2]))); if (r > room) { room = r; best = q; } }
      if (!best) throw new Error('no clear spot'); const w = P.sim.putAgent({ id: 'hk2:k3-figure', look: idx, fix: [best[0], best[1], best[2], yaw] }); w.cleaner = 'hk2'; f.idx = idx; return f.w = w; },
    // four more of the same person in a row across the picture (1.4 m apart, the first in the middle): the same idle on five people
    five(yaw) { const p = f.w.p; f.row = [-2, -1, 1, 2].map(k => { const w = P.sim.putAgent({ id: 'hk2:k3-five-' + k, look: f.idx, fix: [p[0], p[1], p[2] + 1.4 * k, yaw] }); w.cleaner = 'hk2'; return w; }); f.row.splice(2, 0, f.w); return f.row.length; },
    vary(v, seeds) { if (f.row.some(w => !w.g)) return false; f.row.forEach((w, k) => { const g = w.g; g.idle = v; g.it = 0; g.iseed = seeds[k]; g.iw = 1; g.still = 9; g.wasStill = true; }); return true; },
    idle(v) { const g = f.w.g; if (!g) return false; g.idle = v; g.it = 0; g.iseed = -1; g.iw = 1; g.still = 9; g.wasStill = true; return true; },
    label(text) { let n = document.getElementById('f3-label'); if (!n) { n = document.createElement('div'); n.id = 'f3-label'; document.body.appendChild(n);
        Object.assign(n.style, { position: 'fixed', left: '10px', top: '10px', zIndex: 99, font: '600 16px/1.25 system-ui, sans-serif', color: '#fff', background: 'rgba(0,0,0,.6)', padding: '4px 8px', borderRadius: '4px', pointerEvents: 'none', whiteSpace: 'pre', visibility: 'visible' }); }
      n.textContent = text; return true; } }; return true; })()`;
const TICK = dt => `(__city.renderer.shadowMap.needsUpdate = true, __city.tick(${dt}, 1), true)`;
async function filmMode() {
  await needServer(); await fs.mkdir(OUT, { recursive: true }); const B = await chrome(), dir = await fs.mkdtemp(path.join(os.tmpdir(), 'k3-film-')), FPS = 24, SEG = +arg('seg', 10), CORNER = +arg('corner', 8), VSEG = +arg('vseg', 6);
  const shotUrl = ver => cityUrl(ver).replace('&rig=0&loadin=0&nodyn=1', '&shot=1'), cut = { x: (W - 720) / 2, y: (H - 450) / 2, width: 720, height: 450 };
  const grab = async (file, clip, fmt = 'jpeg') => { const r = await B.send('Page.captureScreenshot', { format: fmt, quality: 90, clip: { ...clip, scale: 1 } }); await fs.writeFile(file, Buffer.from(r.result.data, 'base64')); };
  const open = async ver => { B.errors.length = 0; await B.send('Page.navigate', { url: shotUrl(ver) }); for (let t = 0; t < 600 && (await B.ev('document.title', 10000).catch(() => '')) !== 'ready'; t++) await sleep(500);
    shaderOk(B, ver); if (B.errors.length) throw new Error('page error: ' + B.errors[0]); await B.ev(FILM_HELP); await B.ev(`(__city.renderer.shadowMap.needsUpdate = true, __city.tick(1 / 30, 300), true)`); };
  const meta = { idles: [], corner: {} };
  try {
    // every idle on one person (the after page: all of them)
    // (the names as the city plays them: the cast's, whose idle 2 is a hand to the face; its 4 is hands behind the back)
    await open('after'); const names = (await B.ev(`import('/style/city/anim/cast/idle.js').then(m => m.IDLE_NAMES)`)).map((n, i) => i === 4 ? 'hands behind the back' : n);
    await B.ev(`__f3.figure(${+arg('seed', 4242)}, ${+arg('yaw', 1.05)}).then(() => true)`); for (let k = 0; k < 30 && !(await B.ev('!!__f3.w.g')); k++) await B.ev(TICK(1 / 30));
    for (let v = 0; v < names.length; v++) {
      await B.ev(`(__f3.idle(${v}), __f3.aim(__f3.w, 'game'), ${TICK(0)})`); for (let k = 0; k < 6; k++) await B.ev(`(__f3.idle(${v}), __f3.aim(__f3.w, 'game'), ${TICK(1 / 30)})`); await B.ev(`__f3.idle(${v})`);
      const m = { v, name: names[v], frames: SEG * FPS };
      for (let k = 0; k < SEG * FPS; k++) {
        await B.ev(`(__f3.aim(__f3.w, 'game'), __f3.label(''), ${TICK(1 / FPS)})`); if (k === 0) m.feet = await B.ev(`__f3.screen(__f3.w, 0)`), m.head = await B.ev(`__f3.screen(__f3.w, 2.1)`);
        await grab(path.join(dir, `i${v}-g${k}.png`), { x: W / 2 - 80, y: H / 2 - 60, width: 160, height: 160 }, 'png');
        await grab(path.join(dir, `i${v}-w${k}.jpg`), cut);
        await B.ev(`(__f3.aim(__f3.w, 'close'), ${TICK(0)})`); await grab(path.join(dir, `i${v}-c${k}.jpg`), cut); }
      meta.idles.push(m); console.error(`idle ${v} ${names[v]}: ${SEG * FPS} frames`); }
    // the same idle on five people: one look, five seeds (tempo, size, side; at a crossing the waiting style)
    await B.ev(`__f3.five(${+arg('yaw', 1.05)})`); for (let k = 0; k < 30 && !(await B.ev('__f3.row.every(w => !!w.g)')); k++) await B.ev(TICK(1 / 30)); meta.vary = [];
    for (const [v, seeds] of [[8, [11, 222, 333, 444, 555]], [11, [21, 232, 343, 454, 565]], [9, [31, 242, 353, 464, 575]], [0, [41, 252, 363, 474, 585]]]) {
      for (let k = 0; k < 8; k++) await B.ev(`(__f3.vary(${v}, ${JSON.stringify(seeds)}), __f3.aim(__f3.w, 'game'), ${TICK(1 / 30)})`); await B.ev(`__f3.vary(${v}, ${JSON.stringify(seeds)})`);
      const m = { v, name: names[v], seeds, frames: VSEG * FPS, traits: await B.ev(`import('/style/city/anim/idle.js').then(M => ${JSON.stringify(seeds)}.map(n => M.idleTraits(n)))`) };
      for (let k = 0; k < VSEG * FPS; k++) {
        await B.ev(`(__f3.aim(__f3.w, 'game'), ${TICK(1 / FPS)})`); await grab(path.join(dir, `v${v}-w${k}.jpg`), cut);
        await B.ev(`(__f3.aim(__f3.w, 'wide'), ${TICK(0)})`); await grab(path.join(dir, `v${v}-c${k}.jpg`), cut); }
      meta.vary.push(m); console.error(`five in idle ${v}: ${VSEG * FPS} frames`); }
    // the corner, before and after: the same shot page, the same seconds, the game's camera on the corner
    for (const ver of ['base', 'after']) { await open(ver); await B.ev(`(__f3.corner(), ${TICK(0)})`);
      for (let k = 0; k < CORNER * FPS; k++) { await B.ev(`(__f3.corner(), ${TICK(1 / FPS)})`); await grab(path.join(dir, `k-${ver}-${k}.jpg`), { x: 0, y: 0, width: W, height: H }); }
      meta.corner[ver] = CORNER * FPS; console.error(`corner ${ver}: ${CORNER * FPS} frames`); }
    meta.errors = B.errors.splice(0);
  } finally { await B.close(); }
  await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta));
  const py = `import json, sys, os, subprocess
from PIL import Image, ImageDraw, ImageFont
d, out, fps = sys.argv[1], sys.argv[2], int(sys.argv[3]); M = json.load(open(os.path.join(d, 'meta.json')))
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 18); f2 = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 14)
except Exception: F = f2 = ImageFont.load_default()
BG = (20, 20, 24)
# the clip: per idle, [the game's camera 720 x 450 at 1:1, the person 3x in its corner | the close view], a title bar; then the corner
fr = os.path.join(d, 'clip'); os.makedirs(fr, exist_ok=True); n = 0
def save(im):
  global n; im.save(os.path.join(fr, f'{n:05d}.jpg'), quality=88); n += 1
for m in M['idles']:
  for k in range(m['frames']):
    im = Image.new('RGB', (1440, 510), BG); g = Image.open(os.path.join(d, f"i{m['v']}-w{k}.jpg")).convert('RGB'); c = Image.open(os.path.join(d, f"i{m['v']}-c{k}.jpg")).convert('RGB')
    p = Image.open(os.path.join(d, f"i{m['v']}-g{k}.png")).convert('RGB').resize((480, 480), Image.NEAREST).crop((60, 40, 420, 400))
    im.paste(g, (0, 36)); im.paste(p.resize((216, 216), Image.NEAREST), (720 - 220, 36 + 450 - 220)); im.paste(c, (720, 36))
    D = ImageDraw.Draw(im); D.text((10, 8), f"{m['v']}  {m['name']}", font=F, fill=(255, 210, 90)); D.text((300, 10), "left: the game's camera (24 m up, 64 deg down), 1:1, inset 3x  |  right: low close view (7.5 m, 22 deg down)", font=f2, fill=(220, 220, 220))
    save(im)
def tr(t, v): return f"{'L' if t['mirror'] else 'R'} x{t['tempo']:.2f} size {t['size']:.2f}" + (f" waits as {t['wait']}" if v == 8 and t['wait'] != 8 else '')
for m in M.get('vary', []):
  for k in range(m['frames']):
    im = Image.new('RGB', (1440, 510), BG); im.paste(Image.open(os.path.join(d, f"v{m['v']}-w{k}.jpg")).convert('RGB'), (0, 36)); im.paste(Image.open(os.path.join(d, f"v{m['v']}-c{k}.jpg")).convert('RGB'), (720, 36))
    D = ImageDraw.Draw(im); D.text((10, 8), f"the same idle on five people: {m['v']} {m['name']}", font=F, fill=(255, 210, 90)); D.text((520, 10), "one look, five seeds (side, tempo, size" + (", the waiting style)" if m['v'] == 8 else ")") + " | left: the game's camera 1:1 | right: 15 m, 30 deg down", font=f2, fill=(220, 220, 220))
    D.text((10, 466), 'left to right: ' + '  |  '.join(tr(t, m['v']) for t in m['traits']), font=f2, fill=(200, 200, 200)); save(im)
nk = min(M['corner'].get('base', 0), M['corner'].get('after', 0))
for k in range(nk):
  im = Image.new('RGB', (1440, 510), BG)
  for i, v in enumerate(('base', 'after')):
    c = Image.open(os.path.join(d, f'k-{v}-{k}.jpg')).convert('RGB').crop((440, 275, 1160, 725)); im.paste(c, (720 * i, 36))
  D = ImageDraw.Draw(im); D.text((10, 8), 'the busy corner, before', font=F, fill=(255, 210, 90)); D.text((730, 8), 'after (the same walkers, the same seconds)', font=F, fill=(255, 210, 90))
  D.text((1000, 10), "the game's camera, the middle 720 x 450 at 1:1", font=f2, fill=(220, 220, 220)); save(im)
r = subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(fps), '-i', os.path.join(fr, '%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', os.path.join(out, 'clip.mp4')], capture_output=True, text=True); print('clip', r.returncode, r.stderr[-400:])
# the board: per idle one row: the person from the game's camera at 2x (nearest pixel) at six moments of 8 s, then the close view at the same six
W, cw, ch = 2200, 150, 150; rows = []
def head(t, h=30):
  r = Image.new('RGB', (W, h), BG); ImageDraw.Draw(r).text((10, 6), t, font=F, fill=(240, 240, 240)); rows.append(r)
head(f"Every idle on one person, as authored (no per-person variation), from its loop's start. Left: the game's camera (24 m up, 64 deg down, 42 deg lens), the person at 2x, nearest pixel. Right: a low close view (7.5 m, 22 deg down). Six moments over {M['idles'][0]['frames'] // fps} s.", 34)
for m in M['idles']:
  r = Image.new('RGB', (W, 196), BG); D = ImageDraw.Draw(r); D.text((8, 8), f"{m['v']}", font=F, fill=(255, 210, 90)); D.text((8, 32), m['name'], font=f2, fill=(230, 230, 230))
  ks = [int(i * (m['frames'] - 1) / 5) for i in range(6)]
  for j, k in enumerate(ks):
    p = Image.open(os.path.join(d, f"i{m['v']}-g{k}.png")).convert('RGB').crop((35, 25, 125, 115)).resize((180, 180), Image.NEAREST); r.paste(p, (170 + j * 186, 8))
    c = Image.open(os.path.join(d, f"i{m['v']}-c{k}.jpg")).convert('RGB').crop((210, 25, 510, 425)).resize((135, 180), Image.LANCZOS); r.paste(c, (1310 + j * 148, 8))
  rows.append(r)
for m in M.get('vary', []):
  head(f"{m['v']} {m['name']} on five people (one look, five seeds), left to right: " + '  |  '.join(tr(t, m['v']) for t in m['traits']) + ". Game camera 1:1 at three moments; 15 m, 30 deg down.", 28)
  r = Image.new('RGB', (W, 300), BG)
  for j, k in enumerate([0, m['frames'] // 3, 2 * m['frames'] // 3]):
    g = Image.open(os.path.join(d, f"v{m['v']}-w{k}.jpg")).convert('RGB').crop((210, 100, 510, 340)); r.paste(g.resize((360, 288), Image.NEAREST), (5 + j * 366, 6))
  c = Image.open(os.path.join(d, f"v{m['v']}-c{m['frames'] // 2}.jpg")).convert('RGB').crop((100, 40, 620, 410)); r.paste(c.resize((404, 288), Image.LANCZOS), (1110, 6)); rows.append(r)
head("The busy corner from the game's camera: before (left) and after (right), the same walkers at the same second (the middle of the picture).", 30)
k = nk // 2; r = Image.new('RGB', (W, 760), BG)
for i, v in enumerate(('base', 'after')):
  c = Image.open(os.path.join(d, f'k-{v}-{k}.jpg')).convert('RGB').crop((240, 150, 1360, 850)); r.paste(c.resize((1090, 681), Image.LANCZOS), (5 + i * 1100, 5))
rows.append(r)
B = Image.new('RGB', (W, sum(x.size[1] for x in rows)), BG); y = 0
for x in rows: B.paste(x, (0, y)); y += x.size[1]
B.save(os.path.join(out, 'board.jpg'), quality=86); print('board', B.size)`;
  const { spawnSync } = await import('node:child_process'); const r = spawnSync('python3', ['-c', py, dir, OUT, String(FPS)], { encoding: 'utf8', maxBuffer: 1 << 26 }); console.log(r.stdout, r.stderr.slice(-2000));
  if (!argv.includes('--keep')) await fs.rm(dir, { recursive: true, force: true }); else console.log('frames kept in ' + dir);
}
// ── the city's own body (idlebody.html): a page of it, base or after
async function openBody(B, ver, w = 1200, h = 800) {
  B.errors.length = 0; await B.send('Page.navigate', { url: `${BASE}/style/city/anim/idlebody.html${ver === 'base' ? '?ver=base' : ''}` });
  for (let t = 0; t < 240 && (await B.ev('document.title', 5000).catch(() => '')) !== 'ready'; t++) { if (B.errors.length) throw new Error('idlebody error: ' + B.errors[0]); await sleep(250); }
  if (B.errors.length) throw new Error('idlebody error: ' + B.errors[0]); }
// sheet: rows of idles on the city's body, from the game's camera and close (--rows '[{"v":17,"seed":-1,"label":"…"}]' or a file;
// --times 0,2,4 · --views game,close,front,side · --look k · --pool npc|agent · --yaw · --file out.jpg)
async function sheetMode() {
  await needServer(); const B = await chrome(1200, 800), ver = VERS.length === 1 ? VERS[0] : 'after', rowsArg = arg('rows', '[]');
  const rows = JSON.parse(rowsArg.trim().startsWith('[') ? rowsArg : await fs.readFile(rowsArg, 'utf8')), f = path.resolve(arg('file', path.join(OUT, 'sheet.jpg')));
  const o = { rows, times: arg('times', '0,2,4,6,8,10').split(',').map(Number), views: arg('views', 'game,close').split(','), k: +arg('look', 0), pool: arg('pool', 'npc'), yaw: +arg('yaw', .79), az: +arg('az', 0), gs: +arg('gs', 3) };
  try { await openBody(B, ver); shaderOk(B, 'idlebody ' + ver); const url = await B.ev(`__ib.sheet(${JSON.stringify(o)})`, 600000); shaderOk(B, 'idlebody sheet');
    await fs.mkdir(path.dirname(f), { recursive: true }); await fs.writeFile(f, Buffer.from(url.split(',')[1], 'base64')); console.log('wrote ' + f); } finally { await B.close(); } }
// ── elbow: THE ELBOW-AWARE CHECK (idlebody.js check: the city's shader by transform feedback, on the city's body) for every idle the pool
// can pick, on the looks the crowd wears (--pool npc: pedbake.js's 48; --pool agent: THE RUN's people, 48 rolled the same way; looks of
// one shape are checked once), through --secs s of each idle at --hz, as authored (no seed) and on the two people who move it most (the
// largest size, mirrored and not); the crossing's wait in every waiting style, both ways round, glancing at a light on either side; the
// pair's talk as the one talking, the one listening and halfway. Fails (exit 1) unless every count is 0 for every idle in the pool on
// the crowd's looks (--pool npc, npc-traits): forearm/hand through the torso, the head or the legs, one arm through the other, core
// points, folds, cracks of 0.01 mm or more. THE RUN's looks (--pool agent, agent-traits) are measured and reported, not failed.
// --idles 17,18: only those (and no crossing unless 8 is named) · --looks 0,5: only those looks · --ver base|after|both
async function elbowMode() {
  await needServer(); const B = await chrome(800, 600), res = {}, hz = +arg('hz', 2), secs = +arg('secs', 16), pools = arg('pool', 'npc').split(','), n = +arg('n', 48);
  let fail = 0;
  try { for (const ver of VERS) { await openBody(B, ver); shaderOk(B, 'idlebody ' + ver);
    const M = await B.ev(`({ pool: __ib.idle.IDLE_POOL, wait: __ib.idle.IDLE_WAIT || [], names: __ib.idle.IDLE_NAMES, chat: __ib.idle.IDLE.chat ?? -1, seeds: (() => { const T = __ib.idle.idleTraits; if (!T) return null;
      const s = { big: [-1, -1], wait: {} }; let bs = [0, 0]; for (let q = 0; q < 1000; q++) { const t = T(q), m = t.mirror ? 1 : 0; if (t.size > bs[m]) { bs[m] = t.size; s.big[m] = q; }
        const w = s.wait[t.wait] ||= [-1, -1, 0, 0]; if (t.size > w[2 + m]) { w[2 + m] = t.size; w[m] = q; } } return s; })() })`);
    const only = arg('idles', null)?.split(',').map(Number), ids = only || [...M.pool, 8, ...(M.chat >= 0 ? [M.chat] : [])], states = [];
    const times = Array.from({ length: Math.round(secs * hz) }, (_, q) => +(q / hz).toFixed(3));
    for (const v of ids) {
      if (v === 8) { const styles = M.seeds ? Object.entries(M.seeds.wait) : [['8', [-1, -1]]];
        for (const [st, w] of styles) for (const seed of new Set(w.slice(0, 2))) for (const look of [-1.3, 1.3]) for (const t of times) states.push({ key: `8 as ${st}${seed >= 0 ? ' s' + seed : ''}`, v: 8, seed, t, look }); continue; }
      const seeds = [-1, ...(M.seeds ? M.seeds.big : [])], looks = v === M.chat ? [1, 0, .5] : [0];
      for (const seed of new Set(seeds)) for (const look of looks) for (const t of times) states.push({ key: `${v}${seed >= 0 ? ' s' + seed : ''}${v === M.chat ? ' r' + look : ''}`, v, seed, t, look }); }
    const t0 = Date.now(); res[ver] = {};
    // (--pool npc-traits / agent-traits: every trait of the slots that meet a posed arm on the mannequin, the cast's own gate's way)
    for (const pool0 of pools) { const tr = pool0.endsWith('-traits'), pool = tr ? 'trait' : pool0, looks = tr ? await B.ev(`__ib.traitKeys(${JSON.stringify(pool0.split('-')[0])})`) : arg('looks', null)?.split(',').map(Number) || Array.from({ length: n }, (_, k) => k);
      const r = await B.ev(`__ib.check(${JSON.stringify({ pool, looks, states, dedupe: true })})`, 3600000); shaderOk(B, 'idlebody check');
      res[ver][pool0] = r; const shapes = Object.keys(r.looks).length;
      console.log(`\n${ver.toUpperCase()} · ${pool0} looks: ${looks.length} (${shapes} shapes) · ${states.length} states each (${secs} s at ${hz} Hz) · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      const KINDS = ['torso', 'head', 'legs', 'arm', 'core', 'folds'], agg = new Map();
      for (const [k, L] of Object.entries(r.looks)) for (const [key, c] of Object.entries(L.states)) { const a = agg.get(key) || agg.set(key, { looks: 0, bad: 0, crack: 0, ex: null, ...Object.fromEntries(KINDS.map(x => [x, 0])) }).get(key); a.looks++;
        let bad = false; for (const x of KINDS) { a[x] += c[x]; if (c[x]) bad = true; } a.crack = Math.max(a.crack, c.crack); if (c.crack >= 1e-5) bad = true; if (bad) { a.bad++; if (!a.ex) a.ex = { look: isNaN(+k) ? k : +k, first: c.first }; } }
      console.log('  idle (variant)'.padEnd(30) + KINDS.map(x => x.padStart(7)).join('') + '  crack mm  looks bad · first');
      const idOf = key => +key.split(' ')[0], byIdle = new Map();
      for (const [key, a] of agg) { console.log(('  ' + key).padEnd(30) + KINDS.map(x => String(a[x]).padStart(7)).join('') + (a.crack * 1000).toFixed(4).padStart(10) + `  ${a.bad}/${a.looks}${a.ex ? ' · look ' + a.ex.look + ' ' + JSON.stringify(a.ex.first) : ''}`);
        const b = byIdle.get(idOf(key)) || byIdle.set(idOf(key), { bad: 0 }).get(idOf(key)); b.bad += a.bad; }
      const bad = [...byIdle].filter(([, b]) => b.bad).map(([v]) => v); if (ver === 'after' && bad.length && pool0.startsWith('npc')) fail++;
      console.log(`  ${ver} ${pool0}: ${byIdle.size - bad.length}/${byIdle.size} idles clean on every look${bad.length ? ' · not clean: ' + bad.map(v => v + ' ' + (M.names[v] || '')).join(', ') : ''}${pool0.startsWith('npc') ? '' : ' (THE RUN\'s people: reported, the gate is the crowd\'s)'}`); }
    await fs.mkdir(OUT, { recursive: true }); await fs.writeFile(path.join(OUT, `${ver}-elbow.json`), JSON.stringify(res[ver]));
  } } finally { await B.close(); }
  console.log(fail ? 'elbow: FAIL' : 'elbow: PASS'); if (fail) process.exitCode = 1;
}
// ── elbowfilm: THE ELBOW ROUND's board and clip (→ --out, default shots/k3-idles/elbow: board.jpg, clip.mp4, frames.json)
//   1. each bent idle on one person of the crowd (pedbake.js's first NPC look, placed the game's way), as authored, from its loop's start,
//      --seg s each: the game's camera (720 × 450 of the 1600 × 1000 picture at 1:1, the person 3× inset) | a low close view (7.5 m, 22° down)
//   2. a pair turning to talk on the live corner: the first pair that forms after the page settles, filmed from the frame it forms, --pair s
//   3. the busy corner from the game's camera, before (--base) | after, by day and by night, --corner s each
// EVERY FRAME is measured: for 1, the same idle on the city's body at the same moment (idlebody.js steps: what the elbow check counts, and
// the largest vertex step from the frame before: a snap); for 2 and 3, every person standing in the picture: the heading's turn rate,
// the idle weight's change in one frame, an idle that changes while it shows (weight > 0.1 on both frames)
const STAND_FRAME = `(() => { const C = window.__city, V = new C.THREE.Vector3(), out = [];
  for (const w of C.peds.sim.walkers) { if (w.hide || w.tier !== 1 || !w.g || (w.vc || 0) >= .05) continue; V.set(w.p[0], w.p[1] + .9, w.p[2]).project(C.camera); if (Math.abs(V.x) > 1 || Math.abs(V.y) > 1 || V.z > 1) continue;
    out.push([w.id, +(w.yawS ?? w.p[3]).toFixed(4), w.g.idle, +w.g.iw.toFixed(3), w.faceTo ? w.faceTo.id : -1, Math.round((V.x + 1) / 2 * ${W}), Math.round((1 - V.y) / 2 * ${H})]); } return out; })()`;
function frameStats(frames, dt) {   // frames: [[id, yaw, idle, iw, faceTo]…] per frame → the worst of each, over people seen on two frames running
  let yaw = 0, diw = 0, sw = 0, n = 0; const yr = [];
  for (let k = 1; k < frames.length; k++) { const prev = new Map(frames[k - 1].map(r => [r[0], r])); for (const r of frames[k]) { const p = prev.get(r[0]); if (!p) continue; n++;
    let d = r[1] - p[1]; d = Math.atan2(Math.sin(d), Math.cos(d)); const rate = Math.abs(d) / dt; yr.push(rate); yaw = Math.max(yaw, rate); diw = Math.max(diw, Math.abs(r[3] - p[3]));
    if (r[2] !== p[2] && r[3] > .1 && p[3] > .1) sw++; } }
  yr.sort((a, b) => a - b); return { personFrames: n, yawMax: +yaw.toFixed(2), yawP99: +(yr[Math.floor(yr.length * .99)] ?? 0).toFixed(2), iwStepMax: +diw.toFixed(3), idleSwitchShowing: sw }; }
async function elbowFilmMode() {
  await needServer(); const OUT2 = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/k3-idles/elbow'))); await fs.mkdir(OUT2, { recursive: true });
  const B = await chrome(), dir = await fs.mkdtemp(path.join(os.tmpdir(), 'k3-elbowfilm-')), FPS = 24, SEG = +arg('seg', 5), PAIR = +arg('pair', 24), AFTER = +arg('after', 3), CORNER = +arg('corner', 8);
  const IDS = arg('idles', '10,12,14,15,17,19,20,21,22,23').split(',').map(Number), BUSY = arg('busy', '1,2.0').split(',').map(Number);
  // (pedsim.js TALK set in the page, the module's own object: --busy share,outer ring for the busier corner; the file's default untouched)
  const talkSet = ([sh, r]) => `import('/style/city/pedsim.js').then(m => { m.TALK.share = ${sh}; m.TALK.r[1] = ${r}; return true; })`;
  // (the plain numbers on the two talking corners: the corner measure's, idlecheck.mjs corner --talk)
  const NOTE = { after: arg('note-committed', 'TALK.share 3, ring 1.25-1.8 m (committed): a pair now and then'), busy: arg('note-busy', `TALK.share ${BUSY[0]}, ring 1.25-${BUSY[1]} m: busier`) };
  const shotUrl = (ver, tod) => cityUrl(ver).replace('&rig=0&loadin=0&nodyn=1', '&shot=1').replace('&tod=night', '') + (tod === 'night' ? '&tod=night' : ''), cut = { x: (W - 720) / 2, y: (H - 450) / 2, width: 720, height: 450 };
  const grab = async (file, clip, fmt = 'jpeg') => { const r = await B.send('Page.captureScreenshot', { format: fmt, quality: 90, clip: { ...clip, scale: 1 } }); await fs.writeFile(file, Buffer.from(r.result.data, 'base64')); };
  // (open: the shot page; talk: TALK set before the crowd settles, so the stops of the settling seconds already look for someone; settle:
  // frames at 1/30 s before filming)
  const open = async (ver, tod = 'day', talk = null, settle = 300) => { B.errors.length = 0; await B.send('Page.navigate', { url: shotUrl(ver, tod) }); for (let t = 0; t < 600 && (await B.ev('document.title', 10000).catch(() => '')) !== 'ready'; t++) await sleep(500);
    shaderOk(B, ver); if (B.errors.length) throw new Error('page error: ' + B.errors[0]); await B.ev(FILM_HELP); if (talk) await B.ev(talkSet(talk)); for (let k = 0; k < settle; k += 100) await B.ev(`(__city.renderer.shadowMap.needsUpdate = true, __city.tick(1 / 30, ${Math.min(100, settle - k)}), true)`); };
  const meta = { idles: [], pair: null, corner: {}, frames: {}, note: NOTE };
  try {
    await open('after'); const names = await B.ev(`import('/style/city/anim/idle.js').then(m => m.IDLE_NAMES)`);
    // 1 · the bent idles on one person of the crowd
    await B.ev(`__f3.figure(${0x5eed}, ${+arg('yaw', 1.05)}, 'npc').then(() => true)`); for (let k = 0; k < 30 && !(await B.ev('!!__f3.w.g')); k++) await B.ev(TICK(1 / 30));
    for (const v of IDS) {
      await B.ev(`(__f3.idle(${v}), __f3.aim(__f3.w, 'game'), ${TICK(0)})`); for (let k = 0; k < 6; k++) await B.ev(`(__f3.idle(${v}), __f3.aim(__f3.w, 'game'), ${TICK(1 / 30)})`); await B.ev(`__f3.idle(${v})`);
      const m = { v, name: names[v], frames: SEG * FPS, t: [] };
      for (let k = 0; k < SEG * FPS; k++) {
        await B.ev(`(__f3.aim(__f3.w, 'game'), __f3.label(''), ${TICK(1 / FPS)})`); m.t.push(await B.ev('+__f3.w.g.it.toFixed(4)'));
        await grab(path.join(dir, `i${v}-g${k}.png`), { x: W / 2 - 80, y: H / 2 - 60, width: 160, height: 160 }, 'png'); await grab(path.join(dir, `i${v}-w${k}.jpg`), cut);
        await B.ev(`(__f3.aim(__f3.w, 'close'), ${TICK(0)})`); await grab(path.join(dir, `i${v}-c${k}.jpg`), cut); }
      meta.idles.push(m); console.error(`idle ${v} ${names[v]}: ${SEG * FPS} frames`); }
    // 2 · one pair seen close from start to finish (turn in, talk, hand over, one walks on, the other turns back): the figure out of the
    // way, the busier talking setting (--busy) so a pair forms soon; filmed from the frame it forms until --after s after it ends
    await B.ev(`(__f3.w.hide = true, __f3.corner(), ${TICK(0)})`); await B.ev(talkSet(BUSY));
    // (a pair is filmed from the frame it forms: pairs already talking when the search starts are passed over)
    const NEWPAIR = (first, any = true) => `(() => { const S = window.__k3pairs ||= new Set(), V = new __city.THREE.Vector3(); for (const w of __city.peds.sim.walkers) { const o = w.faceTo; if (!o || w.id > o.id) continue; const key = w.id + '-' + o.id; if (S.has(key)) continue; S.add(key); if (!${first} && !${any} && (w.g?.idle === 8) === (o.g?.idle === 8)) continue; if (${first} || w.tier !== 1 || o.tier !== 1) continue; V.set(w.p[0], w.p[1] + .9, w.p[2]).project(__city.camera); if (Math.abs(V.x) < .7 && Math.abs(V.y) < .7) return [w.id, o.id]; } return null; })()`;
    // (up to --tries pairs, each filmed from the frame it forms: kept is the first that shows the whole story (a hand-over, then one walks on
    // while the other stays and turns back); else the one that shows most of it)
    const tryPair = async (pair, n) => { const r = { ids: pair, rows: [], prefix: `p${n}` };
      const mid = await B.ev(`(() => { const W = __city.peds.sim.walkers, a = W.find(w => w.id === ${pair[0]}), b = W.find(w => w.id === ${pair[1]}); return [(a.p[0] + b.p[0]) / 2, a.p[1], (a.p[2] + b.p[2]) / 2, 0, b.p[0] - a.p[0], b.p[2] - a.p[2]]; })()`), at = `{ p: ${JSON.stringify(mid.slice(0, 4))} }`;
      // (close: 7.5 m, 22° down, from the side of the line between them, the side nearer the game camera's)
      const ln = Math.hypot(mid[4], mid[5]) || 1, px = -mid[5] / ln, pz = mid[4] / ln, sd = px >= 0 ? 1 : -1, CL = { el: 22 * Math.PI / 180, d: 7.5 };
      const side = `(() => { const C = __city, t = [${mid[0]}, ${mid[1] + .85}, ${mid[2]}], c = Math.cos(${CL.el}) * ${CL.d}; C.controls.target.set(...t); C.camera.position.set(t[0] + ${sd * px} * c, t[1] + Math.sin(${CL.el}) * ${CL.d}, t[2] + ${sd * pz} * c); C.camera.lookAt(C.controls.target); C.camera.fov = 42; C.camera.updateProjectionMatrix(); C.camera.updateMatrixWorld(); return true; })()`;
      let ended = -1; for (let k = 0; k < PAIR * FPS && (ended < 0 || k - ended < AFTER * FPS); k++) { await B.ev(`(__f3.aim(${at}, 'game'), ${TICK(1 / FPS)})`);
        const row = await B.ev(`__city.peds.sim.walkers.filter(w => w.id === ${pair[0]} || w.id === ${pair[1]}).map(w => [w.id, +(w.yawS ?? w.p[3]).toFixed(4), w.g ? w.g.idle : -1, w.g ? +w.g.iw.toFixed(3) : 0, w.faceTo ? w.faceTo.id : -1, w.g ? +w.g.look.toFixed(2) : 0, +(w.vc || 0).toFixed(2)])`);
        r.rows.push(row); if (ended < 0 && row.length === 2 && row.every(x => x[4] < 0)) ended = k;
        await grab(path.join(dir, `${r.prefix}-w${k}.jpg`), cut); await B.ev(`(${side}, ${TICK(0)})`); await grab(path.join(dir, `${r.prefix}-c${k}.jpg`), cut); }
      r.frames = r.rows.length; r.endedAt = ended;
      // (the story: a hand-over while paired: someone's look crosses 0.5; then at the let-go exactly one walks on, the other still for 1 s)
      const paired = r.rows.filter(x => x.length === 2 && x[0][4] >= 0), talker = x => x.find(y => y[5] > .5)?.[0];
      r.handover = paired.some((x, k) => k > 0 && talker(x) !== undefined && talker(paired[k - 1]) !== undefined && talker(x) !== talker(paired[k - 1]));
      const at0 = ended >= 0 ? r.rows[Math.min(r.rows.length - 1, ended + 2)] : null, stays = at0 && at0.length === 2 ? at0.filter(x => x[6] < .05).map(x => x[0]) : [];
      r.oneWalks = stays.length === 1 && r.rows.slice(ended, ended + FPS).every(x => (x.find(y => y[0] === stays[0])?.[6] ?? 1) < .05);
      console.error(`pair try ${n} ${pair}: ${r.frames} frames, let go at ${ended}, hand-over ${r.handover}, one walks on ${r.oneWalks}`); return r; };
    const tries = []; for (let n = 0; n < +arg('tries', 4); n++) {
      await B.ev(NEWPAIR(true)); let pair = null; for (let k = 0; k < 24 * 150 && !pair; k++) { await B.ev(`(__f3.corner(), ${TICK(1 / FPS)})`); pair = await B.ev(NEWPAIR(false, k > 24 * 90)); }
      if (!pair) break; const r = await tryPair(pair, n); tries.push(r); if (r.handover && r.oneWalks) break; }
    meta.pair = tries.slice().sort((a, b) => (b.handover + b.oneWalks) - (a.handover + a.oneWalks) || b.frames - a.frames)[0] || null;
    meta.pairTries = tries.map(r => ({ ids: r.ids, frames: r.frames, endedAt: r.endedAt, handover: r.handover, oneWalks: r.oneWalks }));
    if (!meta.pair) console.error('no pair formed on the corner');
    // 3 · the busy corner from the game's camera (the same shot page, the same seconds): by day before | after; by day the committed
    // talking | the busier one (--busy); by night before | after. Per frame: the people standing in the picture, and the pairs talking
    const CORNERS = [['day', 'base', null], ['day', 'after', null], ['day', 'busy', BUSY], ['night', 'base', null], ['night', 'after', null]];
    for (const [tod, key, talk] of CORNERS) { const ver = key === 'base' ? 'base' : 'after'; await open(ver, tod, talk, +arg('settle', 900)); await B.ev(`(__f3.corner(), ${TICK(0)})`); const fr = [];
      for (let k = 0; k < CORNER * FPS; k++) { await B.ev(`(__f3.corner(), ${TICK(1 / FPS)})`); fr.push(await B.ev(STAND_FRAME)); await grab(path.join(dir, `k-${tod}-${key}-${k}.jpg`), { x: 0, y: 0, width: W, height: H }); }
      if (key !== 'base') (meta.at ||= {})[tod] = [...(meta.at?.[tod] || []), ...fr.flatMap(r => r.map(x => [x[5], x[6]]))];
      meta.corner[tod + '-' + key] = CORNER * FPS; meta.frames['corner ' + tod + ' ' + key] = { ...frameStats(fr, 1 / FPS), pairsAtATime: +(fr.reduce((a, r) => a + r.filter(x => x[4] >= 0).length / 2, 0) / fr.length).toFixed(2) };
      console.error(`corner ${tod} ${key}: ${CORNER * FPS} frames`); }
    // (the corner's cut: 720 x 450 at 1:1 round where people stand, the median of the standing people's places on the after pages; the
    // same cut for before and after)
    meta.crop = {}; for (const [tod, P0] of Object.entries(meta.at || {})) { const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1] ?? 0, cx = med(P0.map(p => p[0])), cy = med(P0.map(p => p[1]));
      meta.crop[tod] = [Math.max(0, Math.min(W - 720, Math.round(cx - 360))), Math.max(0, Math.min(H - 450, Math.round(cy - 225)))]; } delete meta.at;
    meta.errors = B.errors.splice(0);
    // every frame of 1 on the city's body (the same look, the same moments)
    await openBody(B, 'after'); for (const m of meta.idles) { const r = await B.ev(`__ib.steps(${JSON.stringify({ k: 0, pool: 'npc', states: m.t.map(t => ({ v: m.v, seed: -1, t })) })})`, 600000);
      const st = r.slice(1).map(x => x[1]).sort((a, b) => a - b); meta.frames[`idle ${m.v} ${m.name}`] = { frames: r.length, crossingFrames: r.filter(x => x[0]).length, crossings: r.reduce((a, x) => a + x[0], 0), stepMaxCm: +(100 * st[st.length - 1]).toFixed(2), stepP99Cm: +(100 * st[Math.floor(st.length * .99)]).toFixed(2), stepMedCm: +(100 * st[st.length >> 1]).toFixed(2) }; }
    if (meta.pair) meta.frames['pair'] = frameStats(meta.pair.rows, 1 / FPS);
  } finally { await B.close(); }
  await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta)); await fs.writeFile(path.join(OUT2, 'frames.json'), JSON.stringify({ frames: meta.frames, pair: meta.pair && { ids: meta.pair.ids, rows: meta.pair.rows } }, null, 1));
  for (const [k, v] of Object.entries(meta.frames)) console.log(`every frame · ${k.padEnd(34)} ${JSON.stringify(v)}`);
  const py = `import json, sys, os, subprocess
from PIL import Image, ImageDraw, ImageFont
d, out, fps = sys.argv[1], sys.argv[2], int(sys.argv[3]); M = json.load(open(os.path.join(d, 'meta.json')))
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 18); f2 = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 14)
except Exception: F = f2 = ImageFont.load_default()
BG = (20, 20, 24); fr = os.path.join(d, 'clip'); os.makedirs(fr, exist_ok=True); n = 0
def save(im):
  global n; im.save(os.path.join(fr, f'{n:05d}.jpg'), quality=88); n += 1
def card(title, sub, secs=2.0):
  for k in range(int(secs * fps)):
    im = Image.new('RGB', (1440, 510), BG); D = ImageDraw.Draw(im); D.text((40, 200), title, font=F, fill=(255, 210, 90)); D.text((40, 236), sub, font=f2, fill=(220, 220, 220)); save(im)
card('The crowd standing: the elbow round', 'Bent arms on the crowd\\'s own body, each idle labelled; a pair turning to talk; the busy corner before and after, and two amounts of talking.', 2.5)
for m in M['idles']:
  for k in range(m['frames']):
    im = Image.new('RGB', (1440, 510), BG); g = Image.open(os.path.join(d, f"i{m['v']}-w{k}.jpg")).convert('RGB'); c = Image.open(os.path.join(d, f"i{m['v']}-c{k}.jpg")).convert('RGB')
    p = Image.open(os.path.join(d, f"i{m['v']}-g{k}.png")).convert('RGB').resize((480, 480), Image.NEAREST).crop((60, 40, 420, 400))
    im.paste(g, (0, 36)); im.paste(p.resize((216, 216), Image.NEAREST), (720 - 220, 36 + 450 - 220)); im.paste(c, (720, 36))
    D = ImageDraw.Draw(im); D.text((10, 8), f"{m['v']}  {m['name']}", font=F, fill=(255, 210, 90)); D.text((420, 10), "left: the game's camera (24 m up, 64 deg down), 1:1, inset 3x  |  right: low close view (7.5 m, 22 deg down)", font=f2, fill=(220, 220, 220))
    save(im)
P = M.get('pair')
if P:
  card('Turning to talk', 'One pair on the live corner, close, from the moment it forms: they turn in, talk, hand over, one walks on, the other turns back.', 1.5)
  for k in range(P['frames']):
    im = Image.new('RGB', (1440, 510), BG); im.paste(Image.open(os.path.join(d, f"{P['prefix']}-w{k}.jpg")).convert('RGB'), (0, 36)); im.paste(Image.open(os.path.join(d, f"{P['prefix']}-c{k}.jpg")).convert('RGB'), (720, 36))
    rows = P['rows'][k]; who = '   '.join((f"#{r[0]} talks" if r[5] > .5 else f"#{r[0]} listens") if r[4] >= 0 else (f"#{r[0]} walks on" if r[6] >= .05 else f"#{r[0]} let go") for r in rows)
    D = ImageDraw.Draw(im); D.text((10, 8), 'a pair turning to talk', font=F, fill=(255, 210, 90)); D.text((260, 10), "left: the game's camera on the pair, 1:1  |  right: close (7.5 m, 22 deg down, from the side)", font=f2, fill=(220, 220, 220)); D.text((900, 8), who, font=F, fill=(140, 230, 255)); save(im)
def pairs(tod, a, b, la, lb, title):
  nk = min(M['corner'].get(tod + '-' + a, 0), M['corner'].get(tod + '-' + b, 0))
  for k in range(nk):
    im = Image.new('RGB', (1440, 540), BG)
    cx, cy = M.get('crop', {}).get(tod, [440, 275])
    for i, v in enumerate((a, b)): im.paste(Image.open(os.path.join(d, f'k-{tod}-{v}-{k}.jpg')).convert('RGB').crop((cx, cy, cx + 720, cy + 450)), (720 * i, 62))
    D = ImageDraw.Draw(im); D.text((10, 6), title, font=F, fill=(255, 210, 90)); D.text((10, 36), la, font=f2, fill=(230, 230, 230)); D.text((730, 36), lb, font=f2, fill=(230, 230, 230)); save(im)
NT = dict(M.get('note', {}))
for key, fk in (('after', 'corner day after'), ('busy', 'corner day busy')):
  pa = M['frames'].get(fk, {}).get('pairsAtATime')
  if pa is not None: NT[key] = NT.get(key, key) + f'  ·  in these seconds: {pa:.1f} pairs talking at a time'
pairs('day', 'base', 'after', 'before (the last round: straight arms)', 'after (the elbow round)', "The busy corner by day, the game's camera, 720 x 450 at 1:1 where the people stand")
pairs('day', 'after', 'busy', NT.get('after', 'committed'), NT.get('busy', 'busier'), 'How much talking? The same corner, the same seconds')
pairs('night', 'base', 'after', 'before (the last round)', 'after (the elbow round: the cold twice as likely at night)', "The busy corner by night, the game's camera, 720 x 450 at 1:1 where the people stand")
r = subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(fps), '-i', os.path.join(fr, '%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', os.path.join(out, 'clip.mp4')], capture_output=True, text=True); print('clip', r.returncode, n, 'frames', r.stderr[-400:])
W, rows = 2200, []
def head(t, h=30):
  r = Image.new('RGB', (W, h), BG); ImageDraw.Draw(r).text((10, 6), t, font=F, fill=(240, 240, 240)); rows.append(r)
head(f"The bent idles on one person of the crowd, as authored, from the loop's start. Left: the game's camera (24 m up, 64 deg down, 42 deg lens), the person at 2x, nearest pixel. Right: a low close view (7.5 m, 22 deg down). Six moments over {M['idles'][0]['frames'] // fps} s.", 34)
for m in M['idles']:
  r = Image.new('RGB', (W, 196), BG); D = ImageDraw.Draw(r); D.text((8, 8), f"{m['v']}", font=F, fill=(255, 210, 90)); D.text((8, 32), m['name'], font=f2, fill=(230, 230, 230))
  ks = [int(i * (m['frames'] - 1) / 5) for i in range(6)]
  for j, k in enumerate(ks):
    p = Image.open(os.path.join(d, f"i{m['v']}-g{k}.png")).convert('RGB').crop((35, 25, 125, 115)).resize((180, 180), Image.NEAREST); r.paste(p, (170 + j * 186, 8))
    c = Image.open(os.path.join(d, f"i{m['v']}-c{k}.jpg")).convert('RGB').crop((210, 25, 510, 425)).resize((135, 180), Image.LANCZOS); r.paste(c, (1310 + j * 148, 8))
  rows.append(r)
if P:
  head('A pair turning to talk on the live corner, from the frame it formed to after it let go: the game camera (top) and close (bottom) at six moments.', 30)
  r = Image.new('RGB', (W, 470), BG); ks = [int(i * (P['frames'] - 1) / 5) for i in range(6)]
  for j, k in enumerate(ks):
    r.paste(Image.open(os.path.join(d, f"{P['prefix']}-w{k}.jpg")).convert('RGB').crop((210, 75, 510, 375)).resize((220, 220), Image.NEAREST), (10 + j * 366, 6))
    r.paste(Image.open(os.path.join(d, f"{P['prefix']}-c{k}.jpg")).convert('RGB').crop((160, 40, 560, 400)).resize((300, 188), Image.LANCZOS), (10 + j * 366, 240))
  rows.append(r)
for tod, a, b, t in (('day', 'base', 'after', 'The busy corner by day: before (left), after (right), the same second.'), ('day', 'after', 'busy', 'How much talking: ' + NT.get('after', '') + ' (left) | ' + NT.get('busy', '') + ' (right).'), ('night', 'base', 'after', 'The busy corner by night: before (left), after (right).')):
  nk = min(M['corner'].get(tod + '-' + a, 0), M['corner'].get(tod + '-' + b, 0))
  if not nk: continue
  head(t, 30); k = nk // 2; r = Image.new('RGB', (W, 700), BG)
  for i, v in enumerate((a, b)): r.paste(Image.open(os.path.join(d, f'k-{tod}-{v}-{k}.jpg')).convert('RGB').crop((240, 150, 1360, 850)).resize((1090, 681), Image.LANCZOS), (5 + i * 1100, 5))
  rows.append(r)
B = Image.new('RGB', (W, sum(x.size[1] for x in rows)), BG); y = 0
for x in rows: B.paste(x, (0, y)); y += x.size[1]
B.save(os.path.join(out, 'board.jpg'), quality=86); print('board', B.size)`;
  const { spawnSync } = await import('node:child_process'); const r = spawnSync('python3', ['-c', py, dir, OUT2, String(FPS)], { encoding: 'utf8', maxBuffer: 1 << 26 }); console.log(r.stdout, r.stderr.slice(-2000));
  if (!argv.includes('--keep')) await fs.rm(dir, { recursive: true, force: true }); else console.log('frames kept in ' + dir);
}
// ev: an expression on the body page (--expr '…'), its value printed as JSON
async function evMode() { await needServer(); const B = await chrome(800, 600), ver = VERS.length === 1 ? VERS[0] : 'after';
  try { await openBody(B, ver); console.log(JSON.stringify(await B.ev(arg('expr'), 1800000))); } finally { await B.close(); } }
const MODES = { input: inputMode, film: filmMode, shot: shotMode, serve: serveMode, corner: cornerMode, alike: alikeMode, perf: perfMode, bench: benchMode, sheet: sheetMode, ev: evMode, elbow: elbowMode, elbowfilm: elbowFilmMode };
if (!MODES[MODE]) { console.error('usage: node style/city/anim/idlecheck.mjs serve|corner|alike|perf|bench [--ver base|after|both] …'); process.exit(2); }
MODES[MODE]().then(() => { if (MODE !== 'serve') process.exit(process.exitCode || 0); }, e => { console.error(e.stack || e); stopMine(); process.exit(1); });
