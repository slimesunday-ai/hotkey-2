#!/usr/bin/env node
// THE PERFORMANCE PROBE (perf-1): measures THE RUN as it is, scene by scene, and changes nothing that draws or plays.
// Every hook it needs is put in from outside: a script the browser runs before the page's own (requestAnimationFrame
// wrapped, WebGL's link and query calls counted, long animation frames observed) and wrappers set on the city's own
// objects after it is up (window.__city: the renderer, its shadow pass, the post stack's render). The server must run:
//   node demo/serve.mjs --port 5497 --quiet
//
//   HK2_DEBUG_PORT=5748 node demo/tools/perf-probe.mjs --port 5497 [--json docs/perf/x.json] [--shots <dir>]
//        [--only start,park,market,docks,plaza,subway,duel1,duel2,library,ahead,map,wave,raid,nightraid] [--seconds 6]
//        [--night <crew>:<hold>[:won|lost]] (nightraid: the raid in the game at night)
//        [--rates 4,6] [--no-ab] [--no-profile] [--no-trace] [--no-census] [--no-alloc] [--no-scenes] [--load]
//        [--soak <days>] [--soak-skip K] [--uncapped] [--size 1600x1000] [--market-hour 20]
//
// The whole measurement of docs/perf/2026-11-18-audit.md, in one command (about 20 minutes):
//   HK2_DEBUG_PORT=5748 node demo/tools/perf-probe.mjs --port 5497 --load --soak 3 --json docs/perf/<date>-run.json --shots docs/perf/shots
//
// What each scene gets (the scenes are staged with the page's own handles: hud.load, hud.panel, the fight page's
// pick, real keys for Enter and the fight's WASD):
//   frames     for --seconds: the interval between frames, the main thread's work per frame (from the first
//              animation-frame callback to a message posted from it: every callback, their promises, style, layout,
//              paint), the JavaScript inside animation-frame callbacks alone, the GPU time of the city's draw (its own
//              EXT_disjoint_timer_query: quality.js), draw calls and triangles of the colour pass and the shadow pass,
//              renders outside the city's draw, the JS heap per frame (allocation and drops: --enable-precise-memory-info)
//   census     one frame through renderer.renderBufferDirect: every object drawn, by KIND, with its calls and triangles
//              in the colour and the shadow pass, its type, materials, shadow flags; and which objects re-make their
//              matrix every frame although it never changes (two snapshots of matrixWorld, 3 s apart)
//   profile    a sampled CPU profile (500 µs), summed into buckets by the file and function each sample is charged to
//   trace      a browser trace: the main thread's time by kind (script, style, layout, paint, GC …), the GPU process
//   alloc      V8's sampling heap profiler: MB allocated a second, by bucket and by function
//   ab         the same scene in alternation inside one minute (A B A B): the pixel ratio 1 against 2, the sun's
//              shadow re-drawn every frame against held
//   rates      the CPU slowed --rates times (Emulation.setCPUThrottlingRate): an imitation of a slower machine's main
//              thread, NOT a laptop (its GPU, memory and thermal limits are not imitated)
//   --load     a fresh browser: requests, bytes, what the server sends, time to the first picture and to playable,
//              shaders linked before and after; then the page again with the city's block cache warm
//   --soak N   the game playing itself N days (runtest=dealer, speed 1): every long animation frame (> 50 ms) with
//              what the run was doing, the heap every 5 s with a full GC at the start and the end. (smooth-1: and how
//              many of the rules' sample fights ran on the page's own thread in each long frame, `fights`, from the
//              fight module's own count, src/fight/duel.mjs DUEL_RUNS: a long frame with more than a step's own couple
//              of fights is the odds' (`why`); the counts the page's odds workers kept, `odds`)
//   ahead      (smooth-1) the Ahead screen opened fresh: every long frame from the press until its fight tables are
//              all worked out (hud.ahead.oddsLeft 0), and how long that took
//   --uncapped Chrome with --disable-gpu-vsync --disable-frame-rate-limit: frame intervals are not held to 60 a second
// Prints a table per section and writes everything to --json. Timings depend on the machine's load: it records
// `uptime` and how many other headless Chromes run beside every section.
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { RUN_CONFIG as cfg, newRun, step, view } from '../../src/run/index.mjs';
import { POLICIES, decide } from '../../src/run/policies.mjs';
import { crewFoes } from '../../src/run/raid.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const has = name => process.argv.includes(name);
const PORT = opt('--port', 5497);
const DEBUG = Number(process.env.HK2_DEBUG_PORT) || 5748;
const [W, H] = opt('--size', '1600x1000').split('x').map(Number);
const SECONDS = Number(opt('--seconds', 6));
const RATES = (opt('--rates', '4,6') || '').split(',').filter(Boolean).map(Number);
const SHOTS = opt('--shots', null) ? path.resolve(opt('--shots')) : null;
const JSON_OUT = opt('--json', null);
const UNCAPPED = has('--uncapped');
const MARKET_HOUR = Number(opt('--market-hour', 20));
const ALL = ['start', 'park', 'market', 'docks', 'plaza', 'subway', 'duel1', 'duel2', 'library', 'ahead', 'map', 'wave', 'raid'];
const ONLY = opt('--only', null)?.split(',') ?? ALL;
const BASE = `http://127.0.0.1:${PORT}/demo/`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = { when: new Date().toISOString(), machine: { cpus: os.cpus()[0]?.model, cores: os.cpus().length, mem: Math.round(os.totalmem() / 2 ** 30) }, size: [W, H], uncapped: UNCAPPED, sections: {} };
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

/** The machine's load now: the load average and how many other headless Chromes run (ours not counted). */
function loadNow() {
  let up = '';
  let others = null;
  try { up = execSync('uptime').toString().trim().replace(/^.*load averages?: /, ''); } catch {}
  try {
    const lines = execSync('pgrep -fl remote-debugging-port || true').toString().split('\n').filter(l => /--remote-debugging-port=\d+/.test(l) && !/--type=/.test(l));
    others = lines.filter(l => !l.includes(`--remote-debugging-port=${DEBUG}`)).length;
  } catch {}
  return { load: up, otherChromes: others, at: new Date().toISOString().slice(11, 19) };
}

// ── the browser and our own DevTools socket (chrome.mjs starts and stops it; this one listens to every event) ────────
const FLAGS = ['--enable-precise-memory-info', ...(UNCAPPED ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : [])];
async function connect() {
  const base = `http://127.0.0.1:${DEBUG}`;
  const target = (await fetch(`${base}/json/list`).then(r => r.json())).find(t => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('no DevTools socket')); });
  let nextId = 0;
  const waiting = new Map();
  const handlers = new Map();
  const logs = [];
  ws.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.id && waiting.has(msg.id)) {
      const { resolve, reject } = waiting.get(msg.id);
      waiting.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') logs.push(`[exception] ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`.slice(0, 400));
    if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error')) logs.push(`[error] ${msg.params.args.map(a => a.value ?? a.description ?? '').join(' ')}`.slice(0, 400));
    for (const fn of handlers.get(msg.method) ?? []) fn(msg.params);
  };
  ws.onclose = () => { for (const { reject } of waiting.values()) reject(new Error('the DevTools socket closed')); waiting.clear(); };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    waiting.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const on = (method, fn) => { if (!handlers.has(method)) handlers.set(method, []); handlers.get(method).push(fn); };
  const off = method => handlers.delete(method);
  async function evaluate(expression, timeout = 120000) {
    const r = await Promise.race([send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }), sleep(timeout).then(() => { throw new Error(`timed out: ${expression.slice(0, 80)}`); })]);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  }
  async function waitFor(expression, timeout = 120000, every = 200) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await evaluate(`!!(${expression})`, 20000).catch(() => false)) return (Date.now() - t0) / 1000;
      await sleep(every);
    }
    throw new Error(`timed out waiting for ${expression}`);
  }
  async function shot(file) {
    const r = await Promise.race([send('Page.captureScreenshot', { format: 'jpeg', quality: 70, clip: { x: 0, y: 0, width: W, height: H, scale: 0.5 } }), sleep(20000).then(() => { throw new Error('no screenshot'); })]);
    writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
  }
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: INJECT });
  return { send, on, off, evaluate, waitFor, shot, logs, close: () => ws.close() };
}

// ── what runs in the page before anything of its own ─────────────────────────────────────────────────────────────
const INJECT = `(() => {
  if (window.__perf) return;
  const P = window.__perf = { rec: false, frames: [], gpu: [], draw: [], other: [], loaf: [], ctx: [], links: [], exts: [], marks: {}, note: null };
  const raf0 = window.requestAnimationFrame.bind(window);
  const mem = () => (performance.memory ? performance.memory.usedJSHeapSize : 0);
  // a frame's main-thread work: from the first animation-frame callback (ours, registered first every frame) to a message
  // posted from it, which runs once the frame's callbacks, their promises, style, layout and paint are done
  const ch = new MessageChannel();
  let cur = null;
  ch.port1.onmessage = () => { if (!cur) return; cur.work = performance.now() - cur.t0; if (P.rec) P.frames.push(cur); cur = null; };
  const first = ts => {
    raf0(first);
    if (cur && P.rec) { cur.work = null; P.frames.push(cur); }
    cur = { ts, t0: performance.now(), js: 0, heap: mem() };
    ch.port2.postMessage(0);
  };
  raf0(first);
  window.requestAnimationFrame = cb => raf0(ts => { const t = performance.now(); try { cb(ts); } finally { if (cur) cur.js += performance.now() - t; } });
  // every WebGL / 2D context the page makes, every program linked (when), every extension asked for, every GPU timer result
  const gc0 = HTMLCanvasElement.prototype.getContext;
  const ids = new WeakMap();
  P.dc = {};
  HTMLCanvasElement.prototype.getContext = function (type, ...a) {
    const c = gc0.call(this, type, ...a);
    if (c && !ids.has(c)) { ids.set(c, P.ctx.length); P.ctx.push({ type, w: this.width, h: this.height, t: Math.round(performance.now()), attrs: a[0] ? JSON.stringify(a[0]).slice(0, 160) : null, canvas: this }); }
    return c;
  };
  for (const G of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!G) continue;
    // draws per context (another WebGL context drawing every frame is a cost the city's own counters never see)
    for (const n of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) {
      const f = G.prototype[n];
      if (f) G.prototype[n] = function (...a) { if (P.rec) { const id = ids.get(this); P.dc[id] = (P.dc[id] || 0) + 1; } return f.apply(this, a); };
    }
    const link = G.prototype.linkProgram;
    G.prototype.linkProgram = function (...a) { P.links.push(Math.round(performance.now())); return link.apply(this, a); };
    const ext = G.prototype.getExtension;
    G.prototype.getExtension = function (n) { if (!P.exts.includes(n)) P.exts.push(n); return ext.call(this, n); };
    const qp = G.prototype.getQueryParameter;
    G.prototype.getQueryParameter = function (q, pname) { const v = qp.call(this, q, pname); if (pname === 0x8866 && P.rec) P.gpu.push(Number(v) / 1e6); return v; };
  }
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) P.loaf.push({ t: Math.round(e.startTime), d: Math.round(e.duration), block: Math.round(e.blockingDuration ?? 0),
        style: e.styleAndLayoutStart ? Math.round(e.startTime + e.duration - e.styleAndLayoutStart) : 0, render: e.renderStart ? Math.round(e.startTime + e.duration - e.renderStart) : 0,
        scripts: (e.scripts || []).slice().sort((a, b) => b.duration - a.duration).slice(0, 4).map(s => ({ d: Math.round(s.duration), fn: s.sourceFunctionName || '', url: (s.sourceURL || '').replace(/^.*?\\/(demo|city|src)\\//, '$1/'), inv: (s.invoker || '').slice(0, 80), forced: Math.round(s.forcedStyleAndLayoutDuration || 0) })),
        note: (() => { try { return P.note ? P.note() : null; } catch { return null; } })() });
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch {}
  const poll = setInterval(() => {
    const d = window.__demo;
    if (!P.marks.up && document.body && document.body.classList.contains('up')) P.marks.up = Math.round(performance.now());
    if (!P.marks.playable && d && d.hud && (d.hud.phase === 'choose' || d.hud.phase === 'pick')) P.marks.playable = Math.round(performance.now());
    if (P.marks.up && P.marks.playable) clearInterval(poll);
  }, 50);
})();`;

// ── hooks on the city's own objects, once it is up ───────────────────────────────────────────────────────────────
const HOOKS = `(() => {
  const P = window.__perf, c = window.__city, R = c.renderer;
  if (P.hooked) return true;
  P.hooked = true;
  const I = R.info.render;
  let inPost = false, inShadow = false, frameRec = null;
  const sm = R.shadowMap, smr = sm.render;
  sm.render = function (...a) {
    inShadow = true; const c0 = I.calls, t0 = I.triangles;
    try { return smr.apply(this, a); } finally { inShadow = false; if (frameRec) { frameRec.shCalls += I.calls - c0; frameRec.shTris += I.triangles - t0; } }
  };
  const pr = c.post.render;
  c.post.render = function (...a) {
    inPost = true; frameRec = { calls: 0, tris: 0, shCalls: 0, shTris: 0 }; const c0 = I.calls, t0 = I.triangles, p0 = I.points, l0 = I.lines;
    try { return pr.apply(this, a); } finally {
      inPost = false; frameRec.calls = I.calls - c0; frameRec.tris = I.triangles - t0; frameRec.points = I.points - p0; frameRec.lines = I.lines - l0;
      if (P.rec) P.draw.push(frameRec); frameRec = null;
    }
  };
  // renders of the city's renderer outside its own draw (the stage's passes, portraits on it …)
  const r0 = R.render;
  R.render = function (scene, camera) {
    if (inPost || inShadow) return r0.apply(this, arguments);
    const c0 = I.calls, t0 = I.triangles, rt = R.getRenderTarget();
    try { return r0.apply(this, arguments); } finally { if (P.rec) P.other.push({ t: Math.round(performance.now()), calls: I.calls - c0, tris: I.triangles - t0, rt: rt ? rt.width + 'x' + rt.height : 'canvas', who: (scene && (scene.name || scene.type)) || '?' }); }
  };
  // ONE FRAME'S CENSUS: every draw by object, in the colour and the shadow pass (renderBufferDirect is one draw)
  const rbd = R.renderBufferDirect;
  let census = null;
  R.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
    if (!census) return rbd.apply(this, arguments);
    const c0 = I.calls, t0 = I.triangles;
    const out = rbd.apply(this, arguments);
    let e = census.get(object);
    if (!e) census.set(object, e = { col: 0, colT: 0, sh: 0, shT: 0, oth: 0, othT: 0, mats: new Set() });
    const k = inShadow ? 'sh' : inPost ? 'col' : 'oth';
    e[k] += Math.max(1, I.calls - c0); e[k + 'T'] += I.triangles - t0; e.mats.add(material);
    return out;
  };
  const ancestors = o => { const a = []; for (let x = o; x; x = x.parent) a.push(x); return a; };
  function kinds() {
    const K = new Map();
    for (const r of c.stream.blocks.values()) {
      const m = r.mesh || {};
      for (const x of [].concat(m.full || [])) K.set(x, 'city: blocks, near tier (one mesh per material layer per block)');
      if (m.mid) K.set(m.mid, 'city: blocks, mid tier (one mesh per block)');
      if (m.far) K.set(m.far, 'city: blocks, far tier');
      if (m.cmid) K.set(m.cmid, "city: blocks' own seated/idle people, mid tier");
      for (const l of m.cfull || []) for (const x of l || []) K.set(x, "city: blocks' own seated/idle people, full tier");
      if (r.chunk && r.chunk.mesh) K.set(r.chunk.mesh, 'city: woods far chunks');
    }
    const A = c.peds && c.peds.ready ? c.peds.anim : null;
    if (A) { K.set(A.batch, 'crowd: near bodies (one BatchedMesh, posed in the shader)'); K.set(A.mid, 'crowd: mid bodies (one BatchedMesh)'); K.set(A.far, 'crowd: far boxes (one BatchedMesh)'); }
    return K;
  }
  function kindOf(o, K) {
    if (K.has(o)) return K.get(o);
    const chain = ancestors(o);
    if (!chain.includes(c.scene)) return o.isMesh && o.material && o.material.type === 'ShaderMaterial' ? 'post: full-screen passes' : 'not in the scene: ' + (o.name || o.type);
    for (const x of chain) {
      const n = x.name || '';
      if (/^hk2:prop/.test(n)) return 'stage: hand props (one mesh each)';
      if (/^hk2:rides/.test(n)) return 'stage: rides (cab, board, scooter)';
      if (/^hk2:player-ring/.test(n)) return 'stage: the player ring';
      if (/^hk2-arrange|^hk2:inside|crib|trailer/i.test(n)) return 'stage: home interior / arrange (' + n.slice(0, 30) + ')';
      if (/^fight:/.test(n)) return 'fight: cover';
      if (/^signal-/.test(n)) return 'city: traffic signals';
      if (n === 'water') return 'city: water';
      if (n === 'second-chance') return 'city: the ferry';
      if (x.userData && ('dome' in x.userData || 'tufts' in x.userData)) return 'sky (dome, clouds)';
    }
    if (o.isSprite) return 'sprites (marks, labels)';
    if (o.isPoints) return 'points';
    if (o.isLine || o.isLineSegments) return 'lines';
    if (o.isBatchedMesh) return 'other BatchedMesh (' + (o.parent === c.scene ? 'top' : (o.parent.name || o.parent.type)) + ', ' + o.material.type + ')';
    if (o.isInstancedMesh) return 'other InstancedMesh (' + (o.name || (o.parent === c.scene ? 'top' : (o.parent.name || o.parent.type))) + ', ' + o.count + ' instances)';
    const top = chain[chain.length - 2];
    return 'other: ' + (top === o ? 'top-level ' : (top.name || top.type) + ' > ') + (o.name || o.type) + ' [' + (Array.isArray(o.material) ? 'multi' : o.material && o.material.type) + ']';
  }
  P.kindOf = o => kindOf(o, kinds());
  P.census = () => new Promise(resolve => {
    R.shadowMap.needsUpdate = true;
    requestAnimationFrame(() => {
      census = new Map();
      R.shadowMap.needsUpdate = true;
      requestAnimationFrame(() => {
        const got = census; census = null;
        const K = kinds(), by = {};
        for (const [o, e] of got) {
          const k = kindOf(o, K);
          const b = by[k] ??= { objects: 0, types: {}, col: 0, colT: 0, sh: 0, shT: 0, oth: 0, othT: 0, mats: new Set(), cast: 0, receive: 0, autoMatrix: 0, instances: 0,
            sample: (m => ({ name: o.name, geo: o.geometry && o.geometry.type, verts: o.geometry && o.geometry.attributes.position ? o.geometry.attributes.position.count : null, cap: o.instanceMatrix ? o.instanceMatrix.count : null, culled: o.frustumCulled, order: o.renderOrder, transparent: !!(m && m.transparent), map: !!(m && m.map), color: m && m.color ? m.color.getHexString() : null, mat: m && m.type, layer: o.layers.mask }))([].concat(o.material)[0]) };
          b.objects++; b.types[o.type] = (b.types[o.type] || 0) + 1;
          for (const f of ['col', 'colT', 'sh', 'shT', 'oth', 'othT']) b[f] += e[f];
          for (const m of e.mats) b.mats.add(m);
          if (o.castShadow) b.cast++; if (o.receiveShadow) b.receive++; if (o.matrixAutoUpdate) b.autoMatrix++;
          b.instances += o.isInstancedMesh ? o.count : o.isBatchedMesh ? (o._instanceInfo ? o._instanceInfo.filter(i => i.active && i.visible).length : 0) : 1;
        }
        for (const b of Object.values(by)) { b.mats = b.mats.size; }
        resolve(by);
      });
    });
  });
  // what the scene holds, drawn or not, and its matrices: which objects re-make a matrix that never changes
  P.snapshot = () => { const K = kinds(), m = new Map(); c.scene.traverse(o => { if (o === c.scene) return; m.set(o, Float32Array.from(o.matrixWorld.elements)); }); P.snap = { m, K }; return m.size; };
  P.compare = () => {
    const { m, K } = P.snap, by = {};
    let total = 0;
    c.scene.traverse(o => {
      if (o === c.scene) return; total++;
      const was = m.get(o); if (!was) return;
      const k = o.isMesh || o.isSprite || o.isPoints || o.isLine ? kindOf(o, K) : 'groups and empties (' + (o.type) + ')';
      const b = by[k] ??= { objects: 0, auto: 0, autoStill: 0, moved: 0, visible: 0 };
      b.objects++; if (o.visible) b.visible++;
      const same = o.matrixWorld.elements.every((v, i) => v === was[i]);
      if (!same) b.moved++;
      if (o.matrixAutoUpdate) { b.auto++; if (same) b.autoStill++; }
    });
    return { total, by };
  };
  // the GPU memory the scene's geometry and textures and the targets hold (an estimate: sizes × bytes per element)
  P.gpuMemory = () => {
    const geos = new Set(), tex = new Set();
    c.scene.traverse(o => {
      if (o.geometry) geos.add(o.geometry);
      for (const m of [].concat(o.material || [])) for (const v of Object.values(m)) if (v && v.isTexture) tex.add(v);
      for (const m of [].concat(o.material || [])) if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u && u.value && u.value.isTexture) tex.add(u.value);
    });
    let gb = 0; const bufs = new Set();
    for (const g of geos) { for (const a of Object.values(g.attributes)) { const arr = a.isInterleavedBufferAttribute ? a.data.array : a.array; if (arr && !bufs.has(arr)) { bufs.add(arr); gb += arr.byteLength; } } if (g.index && !bufs.has(g.index.array)) { bufs.add(g.index.array); gb += g.index.array.byteLength; } }
    let tb = 0; const texList = [];
    for (const t of tex) { const im = t.image || {}; const w = im.width || (t.source && t.source.data && t.source.data.width) || 0, h = im.height || (t.source && t.source.data && t.source.data.height) || 0; const per = t.type === 1015 ? 16 : t.type === 1016 ? 8 : 4; const b = w * h * per * (t.generateMipmaps !== false && t.minFilter >= 1007 ? 4 / 3 : 1); tb += b; texList.push([t.name || t.constructor.name, w, h, Math.round(b / 1e6 * 10) / 10]); }
    texList.sort((a, b) => b[3] - a[3]);
    const s = c.R.shadow, cw = R.domElement.width, chh = R.domElement.height;
    return { geometries: geos.size, geometryMB: +(gb / 1e6).toFixed(1), textures: tex.size, textureMB: +(tb / 1e6).toFixed(1), topTextures: texList.slice(0, 6),
      shadowMapMB: +(s * s * 8 / 1e6).toFixed(1), canvasMB: +(cw * chh * 4 * (c.R.aa ? 4 + 1 : 1) / 1e6 + cw * chh * 4 * (c.R.aa ? 4 : 1) / 1e6).toFixed(1),
      postSceneTargetMB: c.post.active ? +(cw * chh * 4 * 4 / 1e6 + cw * chh * 4 / 1e6).toFixed(1) : 0, info: { ...R.info.memory }, programs: R.info.programs.length };
  };
  P.start = () => { P.frames.length = 0; P.gpu.length = 0; P.draw.length = 0; P.other.length = 0; P.dc = {}; P.t0 = performance.now(); P.links0 = P.links.length; P.rec = true; return true; };
  P.stop = () => {
    P.rec = false;
    const peds = c.peds && c.peds.stats ? c.peds.stats() : null;
    const secs = (performance.now() - P.t0) / 1000;
    const contexts = Object.entries(P.dc).map(([id, n]) => { const x = P.ctx[id] || {}; const cv = x.canvas; return { id: +id, type: x.type, size: cv ? cv.width + 'x' + cv.height : '?', inPage: !!(cv && cv.isConnected), main: cv === R.domElement, drawsPerSecond: Math.round(n / secs) }; });
    let stream = null; try { const m = c.stream.memory && c.stream.memory(); stream = m && { cpuMB: Math.round(m.cpu / 1e6), gpuMB: Math.round(m.gpu / 1e6), blocks: c.stream.blocks.size }; } catch {}
    return { ms: Math.round(performance.now() - P.t0), contexts, stream, frames: P.frames.map(f => [+f.ts.toFixed(2), f.work == null ? -1 : +f.work.toFixed(2), +f.js.toFixed(2), f.heap]), gpu: P.gpu.map(x => +x.toFixed(3)), draw: P.draw, other: P.other, links: P.links.length - P.links0,
      ratio: R.getPixelRatio(), canvas: [R.domElement.width, R.domElement.height], dyn: c.dyn.scale, programs: R.info.programs.length, mem: { ...R.info.memory },
      peds: peds && { pool: peds.pool, visible: peds.visible, tiers: peds.tiers, updateMs: peds.updateMs }, people: (() => { try { return window.__demo.stage.debug().people ?? null; } catch { return null; } })(),
      heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null };
  };
  return true;
})()`;

const CTX = 'window.__perf.ctx.map(({ canvas, ...x }) => ({ ...x, inPage: !!(canvas && canvas.isConnected), now: canvas ? canvas.width + "x" + canvas.height : null }))';

// ── summaries ────────────────────────────────────────────────────────────────────────────────────────────────────
const q = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const r1 = x => (x == null ? null : Math.round(x * 10) / 10);
const r2 = x => (x == null ? null : Math.round(x * 100) / 100);
function summarise(m) {
  const ts = m.frames.map(f => f[0]);
  const iv = ts.slice(1).map((t, i) => t - ts[i]);
  const work = m.frames.map(f => f[1]).filter(x => x >= 0);
  const js = m.frames.map(f => f[2]);
  // the heap: what was allocated (the rises between frames) and what the collector dropped (the falls)
  let up = 0, drops = 0, dropMB = 0;
  for (let i = 1; i < m.frames.length; i++) { const d = m.frames[i][3] - m.frames[i - 1][3]; if (d > 0) up += d; else if (d < -2e5) { drops++; dropMB += -d / 1e6; } }
  const secs = m.ms / 1000;
  const draw = m.draw;
  const avg = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const others = {};
  for (const o of m.other) { const k = `${o.who} → ${o.rt}`; (others[k] ??= { n: 0, calls: 0, tris: 0 }); others[k].n++; others[k].calls += o.calls; others[k].tris += o.tris; }
  for (const o of Object.values(others)) { o.perSecond = r1(o.n / secs); o.calls = Math.round(o.calls / o.n); o.tris = Math.round(o.tris / o.n); delete o.n; }
  return {
    frames: m.frames.length, fps: r1(m.frames.length / secs),
    interval: { med: r2(q(iv, 0.5)), p95: r2(q(iv, 0.95)), p99: r2(q(iv, 0.99)), worst: r2(Math.max(0, ...iv)), over20: iv.filter(x => x > 20).length, over33: iv.filter(x => x > 33).length, over50: iv.filter(x => x > 50).length },
    work: { med: r2(q(work, 0.5)), p95: r2(q(work, 0.95)), p99: r2(q(work, 0.99)), worst: r2(Math.max(0, ...work)) },
    js: { med: r2(q(js, 0.5)), p95: r2(q(js, 0.95)) },
    gpu: { n: m.gpu.length, med: r2(q(m.gpu, 0.5)), p95: r2(q(m.gpu, 0.95)), worst: r2(Math.max(0, ...m.gpu)) },
    draw: draw.length ? { calls: Math.round(avg(draw.map(d => d.calls))), tris: Math.round(avg(draw.map(d => d.tris))), shadowCalls: Math.round(avg(draw.map(d => d.shCalls))), shadowTris: Math.round(avg(draw.map(d => d.shTris))), shadowFrames: draw.filter(d => d.shCalls > 0).length, frames: draw.length, maxCalls: Math.max(...draw.map(d => d.calls)), maxTris: Math.max(...draw.map(d => d.tris)), points: Math.round(avg(draw.map(d => d.points))), lines: Math.round(avg(draw.map(d => d.lines))) } : null,
    otherRenders: others,
    alloc: { mbPerSecond: r1(up / 1e6 / secs), gcDrops: drops, gcDropMB: r1(dropMB) },
    links: m.links, ratio: m.ratio, canvas: m.canvas, dyn: m.dyn, programs: m.programs, mem: m.mem, peds: m.peds, people: m.people, heapMB: m.heap, contexts: m.contexts, stream: m.stream,
  };
}

// a CPU profile, charged to buckets: the first frame from the sample's leaf upward that belongs to a known file decides
const BUCKETS = [
  [/three\.(module|core)\.js$/, null],
  [/\/render\//, 'renderer: three draw + post (render/post.js, lighting)'],
  [/\/city\/.*\/(peds|pedsim|people)\.js$/, 'crowd (city walkers: sim, tiers, batches)', [[/^(animate|writeGait2|face|where)$/, 'animation & poses (crowd gait)']]],
  [/\/city\/.*\/anim\//, 'animation & poses (crowd gait)'],
  [/\/city\/.*\/(stream|gpu|glue|ground|water|cache|pool|lod|far)\.js$/, 'city update (stream, ground, water)'],
  [/\/city\/.*\/camera\//, 'camera rig'],
  [/\/city\/.*\/(traffic|simstate|interiors|subway|stage)\//, 'city other (traffic, interiors, subway)'],
  [/\/city\/.*\/main\.js$/, 'city frame loop (main.js)'],
  [/\/city\//, 'city other (traffic, interiors, subway)'],
  [/\/demo\/fight\/(anim|clips)/, 'animation & poses (stage, fight)'],
  [/\/demo\/stage\/actors\.js$/, "stage's people (actors.js)", [[/^(pose|poseOf|startClip|drawProp|reconcile|resume)$/, 'animation & poses (stage, fight)']]],
  [/\/demo\/stage\//, "stage's people (director, camera, sets)"],
  [/\/demo\/fight\//, 'fight (rules on the page, fx, blood)'],
  [/\/demo\/run\/duel\.js$/, 'fight (rules on the page, fx, blood)'],
  [/\/src\/fight\//, 'fight (rules on the page, fx, blood)'],
  [/\/demo\/(run|hud)\//, 'interface JS (panels)'],
  [/\/src\//, 'rules (src/run)'],
  [/\/demo\/boot\.js$/, 'boot'],
];
function bucketProfile(profile) {
  const byId = new Map(profile.nodes.map(n => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const bucketOf = new Map();
  const classify = id => {
    if (bucketOf.has(id)) return bucketOf.get(id);
    const n = byId.get(id);
    const f = n.callFrame;
    let b;
    if (f.functionName === '(garbage collector)') b = 'garbage collection';
    else if (f.functionName === '(idle)') b = 'idle';
    else if (f.functionName === '(program)') b = 'browser native (style, layout, paint, GL submit outside JS)';
    else if (f.functionName === '(root)') b = 'idle';
    else {
      for (let x = id; x != null; x = parent.get(x)) {
        const fr = byId.get(x).callFrame;
        const url = fr.url || '';
        if (!url) continue;
        if (url.startsWith('debugger://') || /^VM\d/.test(url)) continue;
        const rule = BUCKETS.find(([re]) => re.test(url));
        if (!rule) continue;
        if (rule[1] === null) continue;
        b = rule[1];
        for (const [fre, sub] of rule[2] ?? []) if (fre.test(fr.functionName)) b = sub;
        break;
      }
      if (!b) {
        // three's own work with no file of ours above it, or a native GL call: the renderer
        const any = (() => { for (let x = id; x != null; x = parent.get(x)) { const u = byId.get(x).callFrame.url || ''; if (/three\.(module|core)\.js$/.test(u)) return true; } return false; })();
        b = any ? 'renderer: three draw + post (render/post.js, lighting)' : (f.url ? 'other script' : 'native calls (GL, DOM) from script');
        if (!f.url && /^(\(program\))$/.test(f.functionName)) b = 'browser native';
      }
      // within three's renderer: where it goes
      const fn = f.functionName;
      if (b.startsWith('renderer') && /three\.(module|core)\.js$/.test(f.url || '')) {
        if (/^(projectObject|intersectsObject|intersectsSphere|setFromProjectionMatrix|updateMatrixWorld|updateWorldMatrix|multiplyMatrices|compose|traverseVisible)$/.test(fn)) b = 'renderer: scene traversal, culling, matrices';
        else if (/sort|painterSort|reversePainterSort/i.test(fn)) b = 'renderer: sorting';
      }
    }
    bucketOf.set(id, b);
    return b;
  };
  const tot = {}, fns = {};
  let all = 0;
  const dts = profile.timeDeltas;
  profile.samples.forEach((id, i) => {
    const dt = (dts[i + 1] ?? dts[i] ?? 0) / 1000;
    const b = classify(id);
    tot[b] = (tot[b] ?? 0) + dt;
    all += dt;
    const f = byId.get(id).callFrame;
    const k = `${f.functionName || '(anon)'} ${(f.url || '').replace(/^.*?\/(demo|city|src)\//, '$1/').replace(/^city\/from-trunk\/style\/city\//, 'city:').replace(/^city\/vendor\/three\/build\//, 'three:')}:${f.lineNumber + 1}`;
    fns[k] = (fns[k] ?? 0) + dt;
  });
  const busy = all - (tot.idle ?? 0);
  return {
    ms: Math.round(all), busyMs: Math.round(busy),
    buckets: Object.fromEntries(Object.entries(tot).filter(([k]) => k !== 'idle').sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, { ms: Math.round(v), share: Math.round((100 * v) / Math.max(1, busy)) }])),
    top: Object.entries(fns).filter(([k]) => !k.startsWith('(idle)') && !k.startsWith('(root)')).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => [k, Math.round(v), Math.round((100 * v) / Math.max(1, busy))]),
  };
}

async function profileFor(page, ms) {
  await page.send('Profiler.enable');
  await page.send('Profiler.setSamplingInterval', { interval: 500 });
  await page.send('Profiler.start');
  await sleep(ms);
  const { profile } = await page.send('Profiler.stop');
  await page.send('Profiler.disable');
  return bucketProfile(profile);
}

// who allocates: V8's sampling heap profiler (every ~32 KB allocated is a sample, its stack kept), summed by function
// and by the same buckets as the CPU profile. What it shows is what is allocated while sampling, live or not: the garbage
async function allocFor(page, ms) {
  await page.send('HeapProfiler.enable');
  await page.send('HeapProfiler.startSampling', { samplingInterval: 32768, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  await sleep(ms);
  const { profile } = await page.send('HeapProfiler.stopSampling');
  const byFn = {}, byBucket = {};
  let total = 0;
  const walk = (n, chain) => {
    const here = [...chain, n.callFrame];
    if (n.selfSize) {
      total += n.selfSize;
      const f = n.callFrame;
      const k = `${f.functionName || '(anon)'} ${(f.url || '').replace(/^.*?\/(demo|city|src)\//, '$1/').replace(/^city\/from-trunk\/style\/city\//, 'city:').replace(/^city\/vendor\/three\/build\//, 'three:')}:${f.lineNumber + 1}`;
      byFn[k] = (byFn[k] ?? 0) + n.selfSize;
      let b = 'other';
      for (let i = here.length - 1; i >= 0; i--) { const u = here[i].url || ''; const rule = BUCKETS.find(([re]) => re.test(u)); if (rule && rule[1]) { b = rule[1]; break; } if (/three\.(module|core)\.js$/.test(u)) b = 'renderer: three draw + post (render/post.js, lighting)'; }
      byBucket[b] = (byBucket[b] ?? 0) + n.selfSize;
    }
    for (const c of n.children ?? []) walk(c, here);
  };
  walk(profile.head, []);
  await page.send('HeapProfiler.disable');
  const secs = ms / 1000;
  return {
    mbPerSecond: r1(total / 1e6 / secs),
    buckets: Object.fromEntries(Object.entries(byBucket).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, r2(v / 1e6 / secs)])),
    top: Object.entries(byFn).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => [k, r2(v / 1e6 / secs)]),
  };
}

// a trace: the main thread's time by kind, per second, and how busy the GPU process and the compositor are
async function traceFor(page, ms) {
  const done = new Promise(resolve => page.on('Tracing.tracingComplete', p => resolve(p.stream)));
  await page.send('Tracing.start', { transferMode: 'ReturnAsStream', traceConfig: { includedCategories: ['toplevel', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8', 'blink.user_timing'] } });
  await sleep(ms);
  await page.send('Tracing.end');
  const stream = await done;
  page.off('Tracing.tracingComplete');
  let text = '';
  for (;;) {
    const r = await page.send('IO.read', { handle: stream, size: 1 << 20 });
    text += r.base64Encoded ? Buffer.from(r.data, 'base64').toString() : r.data;
    if (r.eof) break;
  }
  await page.send('IO.close', { handle: stream });
  const json = JSON.parse(text);
  const events = Array.isArray(json) ? json : json.traceEvents;
  const names = new Map();
  for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name);
  // the renderer's main thread: the one whose pid has the most FunctionCall events
  const fc = {};
  for (const e of events) if (e.name === 'FunctionCall' || e.name === 'FireAnimationFrame') fc[`${e.pid}:${e.tid}`] = (fc[`${e.pid}:${e.tid}`] ?? 0) + 1;
  const main = Object.entries(fc).sort((a, b) => b[1] - a[1])[0]?.[0];
  const secs = ms / 1000;
  // self time by event name on the main thread (complete events nested by time)
  const mainEv = events.filter(e => `${e.pid}:${e.tid}` === main && e.ph === 'X' && e.dur != null).sort((a, b) => a.ts - b.ts || b.dur - a.dur);
  const self = {};
  const stack = [];
  for (const e of mainEv) {
    while (stack.length && stack[stack.length - 1].end <= e.ts) stack.pop();
    if (stack.length) stack[stack.length - 1].child += e.dur;
    const rec = { name: e.name, end: e.ts + e.dur, dur: e.dur, child: 0 };
    stack.push(rec);
    e.__rec = rec;
  }
  for (const e of mainEv) { const r = e.__rec; self[r.name] = (self[r.name] ?? 0) + Math.max(0, r.dur - r.child); }
  const busyBy = {};
  for (const e of events) {
    if (e.ph !== 'X' || e.name !== 'ThreadControllerImpl::RunTask' && e.name !== 'RunTask') continue;
    const th = names.get(`${e.pid}:${e.tid}`) ?? `${e.pid}:${e.tid}`;
    busyBy[th] = (busyBy[th] ?? 0) + e.dur / 1000;
  }
  const gc = events.filter(e => `${e.pid}:${e.tid}` === main && /^(MinorGC|MajorGC|V8\.GC_SCAVENGER|V8\.GC_MARK_COMPACTOR|V8\.GCScavenger|V8\.GCFinalizeMC|BlinkGC\.AtomicPhase)$/.test(e.name) && e.dur != null);
  const gcPauses = gc.filter(e => e.name === 'MinorGC' || e.name === 'MajorGC').map(e => e.dur / 1000);
  return {
    mainThread: names.get(main) ?? main,
    mainSelfMsPerSecond: Object.fromEntries(Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, v]) => [k, r1(v / 1000 / secs)])),
    busyMsPerSecond: Object.fromEntries(Object.entries(busyBy).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => [k, r1(v / secs)])),
    gc: { pauses: gcPauses.length, worstMs: r1(Math.max(0, ...gcPauses)), totalMsPerSecond: r1(gcPauses.reduce((s, x) => s + x, 0) / secs) },
  };
}

// ── the run's states: found by the rules themselves, so they are the same every time ──────────────────────────────
function findFight(foes) {
  const pols = [{ ...POLICIES.dealer(120), buy: true }, { ...POLICIES.homeAt(90), buy: true }, { ...POLICIES.shark(120), buy: true }];
  for (const pol of pols) for (let seed = 1; seed <= 60; seed++) {
    let s = newRun({ seed });
    for (let k = 0; k < 300 && s.day <= 5; k++) {
      const v = view(cfg, s);
      const ch = decide(cfg, s, pol, v);
      if (!ch) break;
      const r = step(cfg, s, ch);
      const e = r.events.find(x => x.duel);
      if (e && (e.duel.jumped ? 2 : 1) === foes && v.choices.some(x => JSON.stringify(x.choice) === JSON.stringify(ch))) return { seed, state: s, choice: ch, result: e.duel.result, seconds: e.duel.seconds };
      s = r.state;
    }
  }
  return null;
}

// ── the page, scene by scene ──────────────────────────────────────────────────────────────────────────────────────
async function key(page, k) {
  const KEYS = { Enter: ['Enter', 13], ' ': ['Space', 32], Escape: ['Escape', 27] };
  const [code, vk] = KEYS[k] ?? (/^\d$/.test(k) ? [`Digit${k}`, 48 + Number(k)] : [`Key${k.toUpperCase()}`, k.toUpperCase().charCodeAt(0)]);
  for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...(type === 'keyDown' && k.length === 1 ? { text: k } : {}) });
}

async function upRun(page, url) {
  await page.send('Page.navigate', { url });
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 300000, 250);
  await page.evaluate(HOOKS);
  await page.evaluate(`(() => { const d = window.__demo; window.__perf.note = () => { const h = d.hud; return h && h.state ? 'day ' + h.state.day + ' ' + h.state.hour + ':00 ' + h.state.place + ' ' + h.phase + (h.duel && h.duel.active ? ' FIGHT' : '') + (h.trip && h.trip.active ? ' trip' : '') : 'boot'; }; return true; })()`);
  // dynamic resolution is held (it would change the picture under load); what it had done by now is kept for the report
  const dyn = await page.evaluate('(c => { const s = c.dyn.scale; c.dyn.setEnabled(false); c.renderer.setPixelRatio(Math.min(c.R.dpr, devicePixelRatio)); return { scaleAtHold: s, ratio: c.renderer.getPixelRatio(), timer: c.dyn.timer, preset: c.PR.name, look: c.post.lookName, postActive: c.post.active, passes: c.post.passes }; })(window.__city)');
  return dyn;
}

/** Carries the run on from the state it has, with these fields (as the picture tools do: run-world-shots.mjs). */
async function loadState(page, fields) {
  await page.waitFor('window.__demo.hud.phase === "choose"', 150000, 100);
  const t0 = Date.now();
  const ok = await page.evaluate(`(async () => {
    const h = window.__demo.hud;
    const s = structuredClone(h.state);
    const f = ${JSON.stringify(fields)};
    Object.assign(s, { people: {}, shifts: {}, today: {}, door: null, hoursThere: 0 }, f, { owned: { ...s.owned, ...(f.owned ?? {}) } });
    s.books.earned += (s.carried + s.banked) - (h.state.carried + h.state.banked);
    return await h.load(s);
  })()`, 180000);
  if (!ok) throw new Error('the run would not load the state');
  return (Date.now() - t0) / 1000;
}
async function loadWhole(page, state) {
  await page.waitFor('window.__demo.hud.phase === "choose"', 150000, 100);
  const t0 = Date.now();
  const ok = await page.evaluate(`window.__demo.hud.load(${JSON.stringify(state)})`, 180000);
  if (!ok) throw new Error('the run would not load the state');
  return (Date.now() - t0) / 1000;
}
async function chooseAndGo(page, choice) {
  const v = await page.evaluate('window.__demo.hud.view');
  const want = v.choices.find(x => JSON.stringify(x.choice) === JSON.stringify(choice)) ?? v.choices.find(x => x.choice.do === choice.do && (choice.id === undefined || x.choice.id === choice.id) && (choice.to === undefined || x.choice.to === choice.to));
  if (!want) throw new Error(`no ${JSON.stringify(choice)} among the choices`);
  await page.evaluate(`window.__demo.hud.pick(${JSON.stringify(want.key)})`);
  await sleep(300);
  await key(page, 'Enter');
  return want;
}

async function measure(page, seconds, during = null) {
  await page.evaluate('window.__perf.start()');
  if (during) await during(seconds);
  else await sleep(seconds * 1000);
  return summarise(await page.evaluate('window.__perf.stop()', 60000));
}

const SCENE_NOTES = {};
/** One scene: settle, picture, frames, census, matrices, profile, trace, A/B, throttled. */
async function scene(page, name, { settle = 2500, during = null, seconds = SECONDS, light = false } = {}) {
  await sleep(settle);
  const rec = { load: loadNow() };
  if (SHOTS) rec.shot = path.relative(process.cwd(), await page.shot(path.join(SHOTS, `${name}.jpg`)).catch(() => null) ?? '');
  rec.base = await measure(page, seconds, during);
  // (performance.memory's figure counts the typed arrays too: V8's own split, JS objects against array buffers)
  rec.heapUsage = await page.send('Runtime.getHeapUsage').then(h => ({ usedMB: r1(h.usedSize / 1e6), backingMB: h.backingStorageSize != null ? r1(h.backingStorageSize / 1e6) : null }), () => null);
  console.log(`  ${name}: ${rec.base.fps} fps, interval med ${rec.base.interval.med} p99 ${rec.base.interval.p99} worst ${rec.base.interval.worst} ms (>33: ${rec.base.interval.over33}), main thread med ${rec.base.work.med} p95 ${rec.base.work.p95} ms, GPU med ${rec.base.gpu.med} p95 ${rec.base.gpu.p95} ms, ${rec.base.draw?.calls} calls ${((rec.base.draw?.tris ?? 0) / 1e6).toFixed(2)} M tris (shadow ${rec.base.draw?.shadowCalls} calls in ${rec.base.draw?.shadowFrames}/${rec.base.draw?.frames} frames), heap ${rec.base.heapMB} MB, walkers ${JSON.stringify(rec.base.peds?.tiers)}`);
  if (light) return rec;
  if (!has('--no-census')) {
    rec.census = await page.evaluate('window.__perf.census()', 30000).catch(e => ({ error: String(e) }));
    await page.evaluate('window.__perf.snapshot()');
    await sleep(3000);
    rec.matrices = await page.evaluate('window.__perf.compare()', 30000).catch(e => ({ error: String(e) }));
    rec.gpuMemory = await page.evaluate('window.__perf.gpuMemory()').catch(e => ({ error: String(e) }));
  }
  if (!has('--no-profile')) rec.profile = await profileFor(page, 4000).catch(e => ({ error: String(e) }));
  if (!has('--no-trace')) rec.trace = await traceFor(page, 3000).catch(e => ({ error: String(e) }));
  if (!has('--no-alloc')) rec.alloc = await allocFor(page, 3000).catch(e => ({ error: String(e) }));
  if (!has('--no-ab')) {
    // A B A B inside one minute: the pixel ratio, then the sun's shadow held
    rec.ab = { pixels: [], shadow: [] };
    for (const pr of [1, 2, 1, 2]) {
      await page.evaluate(`window.__city.renderer.setPixelRatio(${pr})`);
      await sleep(600);
      const m = await measure(page, 2.5);
      rec.ab.pixels.push({ ratio: pr, gpu: m.gpu.med, gpu95: m.gpu.p95, work: m.work.med, interval: m.interval.med });
    }
    await page.evaluate('window.__city.renderer.setPixelRatio(1)');
    const every0 = await page.evaluate('window.__city.R.shadowEvery');
    for (const held of [false, true, false, true]) {
      await page.evaluate(`window.__city.R.shadowEvery = ${held ? 1e9 : every0}`);
      await sleep(400);
      const m = await measure(page, 2.5);
      rec.ab.shadow.push({ held, gpu: m.gpu.med, gpu95: m.gpu.p95, work: m.work.med, shadowFrames: m.draw?.shadowFrames, frames: m.draw?.frames });
    }
    await page.evaluate(`window.__city.R.shadowEvery = ${every0}`);
    const avg = (a, k) => r2(a.reduce((s, x) => s + (x[k] ?? 0), 0) / a.length);
    const p1 = rec.ab.pixels.filter(x => x.ratio === 1), p2 = rec.ab.pixels.filter(x => x.ratio === 2);
    const s0 = rec.ab.shadow.filter(x => !x.held), s1 = rec.ab.shadow.filter(x => x.held);
    rec.ab.summary = { gpuAt1: avg(p1, 'gpu'), gpuAt2: avg(p2, 'gpu'), workAt1: avg(p1, 'work'), workAt2: avg(p2, 'work'), gpuShadowLive: avg(s0, 'gpu'), gpuShadowHeld: avg(s1, 'gpu'), workShadowLive: avg(s0, 'work'), workShadowHeld: avg(s1, 'work') };
    console.log(`    A/B: GPU ${rec.ab.summary.gpuAt1} ms at ratio 1, ${rec.ab.summary.gpuAt2} at 2 · shadow live ${rec.ab.summary.gpuShadowLive} / held ${rec.ab.summary.gpuShadowHeld} ms GPU, main thread ${rec.ab.summary.workShadowLive} / ${rec.ab.summary.workShadowHeld} ms`);
  }
  if (RATES.length) {
    rec.throttled = {};
    for (const rate of RATES) {
      await page.send('Emulation.setCPUThrottlingRate', { rate });
      await sleep(800);
      const m = await measure(page, Math.max(4, seconds * 0.75));
      rec.throttled[rate] = { fps: m.fps, interval: m.interval, work: m.work, js: m.js, gpu: m.gpu };
      await page.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      console.log(`    CPU ×${rate}: ${m.fps} fps, interval med ${m.interval.med} p95 ${m.interval.p95} ms (>33: ${m.interval.over33}, >50: ${m.interval.over50}), main thread med ${m.work.med} p95 ${m.work.p95} ms`);
    }
    await sleep(500);
  }
  return rec;
}

async function scenes(browser) {
  const page = await connect();
  const S = (out.sections.scenes = { load: loadNow(), scenes: {} });
  try {
    const url = `${BASE}?mode=run&seed=3`;
    S.page = await upRun(page, url);
    console.log(`scenes: ${url} · preset ${S.page.preset}, look ${S.page.look} (post ${S.page.postActive ? `${S.page.passes} pass` : 'off'}), dynamic resolution was at ${S.page.scaleAtHold} when held, GPU timer ${S.page.timer}`);
    S.contexts = await page.evaluate(CTX);
    S.extensions = await page.evaluate('window.__perf.exts');
    // the post stack's own per-pass GPU cost at this size (render/post.js bench: n renders of each pass, synced)
    S.postBench = await page.evaluate('window.__city.post.bench(60)').catch(e => String(e));
    const want = n => ONLY.includes(n);
    const S2 = S.scenes;
    const park = { place: 'park', day: 2, hour: 14, banked: 40, carried: 8, energy: 6, heat: 0, placeHeat: { park: 0, market: 0 } };
    if (want('start')) S2.start = await scene(page, 'start');
    if (want('park')) { S2.park = { teleport: await loadState(page, park) }; Object.assign(S2.park, await scene(page, 'park')); }
    if (want('market')) { const t = await loadState(page, { place: 'market', day: 2, hour: MARKET_HOUR, banked: 40, carried: 20, energy: 6, heat: 0, placeHeat: { park: 0, market: 0 } }); S2.market = { teleport: t, hour: MARKET_HOUR, ...(await scene(page, 'market')) }; }
    if (want('docks')) { const t = await loadState(page, { place: 'docks', day: 2, hour: 15, banked: 40, carried: 20, energy: 6, heat: 0, placeHeat: {} }); S2.docks = { teleport: t, ...(await scene(page, 'docks')) }; }
    if (want('plaza')) { const t = await loadState(page, { place: 'plaza', day: 2, hour: 15, banked: 40, carried: 20, energy: 6, heat: 0, placeHeat: {} }); S2.plaza = { teleport: t, ...(await scene(page, 'plaza')) }; }
    for (const p of ['library', 'ahead', 'map']) if (want(p)) {
      await loadState(page, park);
      // (smooth-1) THE AHEAD SCREEN OPENED FRESH: its fight tables are worked out on opening; every long frame from the
      // press until they are all there (hud.ahead.oddsLeft 0)
      if (p === 'ahead') {
        await sleep(1500);
        const loaf0 = await page.evaluate('window.__perf.loaf.length');
        await page.evaluate('window.__perf.start()');
        const t0 = Date.now();
        await page.evaluate('window.__demo.hud.panel("ahead")');
        await page.waitFor('window.__demo.hud.ahead && window.__demo.hud.ahead.oddsLeft === 0', 60000, 50).catch(() => null);
        const secs = (Date.now() - t0) / 1000;
        await sleep(600);
        const m = summarise(await page.evaluate('window.__perf.stop()', 60000));
        const loaf = (await page.evaluate(`window.__perf.loaf.slice(${loaf0})`)).filter(l => l.d > 50);
        S2.aheadOpen = { load: loadNow(), secondsToTables: secs, oddsLeft: await page.evaluate('window.__demo.hud.ahead && window.__demo.hud.ahead.oddsLeft'), interval: m.interval, work: m.work, loaf };
        console.log(`  ahead, opened fresh: its tables in ${secs} s; frames >33 ${m.interval.over33}, >50 ${m.interval.over50}, worst ${m.interval.worst} ms; long frames ${loaf.map(l => l.d).join(', ') || 'none'} · load ${S2.aheadOpen.load.load}`);
        await page.evaluate('window.__demo.hud.panel(null)');
        await sleep(800);
      }
      await page.evaluate(`window.__demo.hud.panel(${JSON.stringify(p)})`);
      S2[p] = await scene(page, p, { settle: 2000 });
      await page.evaluate('window.__demo.hud.panel(null)');
    }
    if (want('subway')) {
      // a ride to a far place: from the trailer park to the docks, measured from Enter until the next choice
      await loadState(page, { ...park, carried: 40 });
      await sleep(1500);
      const v = await page.evaluate('window.__demo.hud.view');
      const ride = v.choices.find(x => x.choice.do === 'subway' && (x.choice.to === 'docks' || x.choice.to === 'plaza')) ?? v.choices.find(x => x.choice.do === 'subway');
      if (!ride) S2.subway = { error: 'no subway choice' };
      else {
        const linksBefore = await page.evaluate('window.__perf.links.length');
        S2.subway = { to: ride.choice.to, load: loadNow() };
        S2.subway.base = await measure(page, 0, async () => {
          await chooseAndGo(page, ride.choice);
          const t0 = Date.now();
          await sleep(1500);
          await page.waitFor('window.__demo.hud.phase === "choose"', 120000, 100).catch(() => null);
          S2.subway.seconds = (Date.now() - t0) / 1000;
        });
        S2.subway.loaf = (await page.evaluate('window.__perf.loaf.slice(-30)')).filter(l => l.d > 50);
        S2.subway.linksDuring = (await page.evaluate('window.__perf.links.length')) - linksBefore;
        if (SHOTS) await page.shot(path.join(SHOTS, 'subway-arrived.jpg')).catch(() => null);
        console.log(`  subway to ${ride.choice.to}: ${S2.subway.seconds} s, frames >50 ms ${S2.subway.base.interval.over50}, worst ${S2.subway.base.interval.worst} ms, programs linked ${S2.subway.linksDuring}`);
        S2.subway.arrived = await scene(page, 'subway-arrived', { settle: 1500, light: true });
      }
    }
    for (const [name, foes] of [['duel1', 1], ['duel2', 2]]) if (want(name)) {
      const f = findFight(foes);
      if (!f) { S2[name] = { error: 'no state found' }; continue; }
      await loadWhole(page, f.state);
      await sleep(1500);
      const linksBefore = await page.evaluate('window.__perf.links.length');
      const loafBefore = await page.evaluate('window.__perf.loaf.length');
      await chooseAndGo(page, f.choice);
      await page.waitFor('window.__demo.hud.duel.active', 60000, 50).catch(() => null);
      await sleep(600);
      const r = await scene(page, name, { settle: 0, seconds: Math.min(SECONDS, 5), light: true });
      await page.waitFor('!window.__demo.hud.duel.active', 60000, 200).catch(() => null);
      r.fight = { seed: f.seed, choice: f.choice, result: f.result, seconds: f.seconds, foes };
      r.linksDuring = (await page.evaluate('window.__perf.links.length')) - linksBefore;
      r.loaf = (await page.evaluate(`window.__perf.loaf.slice(${loafBefore})`)).filter(l => l.d > 50);
      console.log(`    programs linked during the fight: ${r.linksDuring}; long frames: ${r.loaf.map(l => `${l.d} ms (${l.note})`).join(', ') || 'none'}`);
      S2[name] = r;
      await page.waitFor('window.__demo.hud.phase === "choose" || window.__demo.hud.phase === "report"', 90000, 200).catch(() => null);
      if ((await page.evaluate('window.__demo.hud.phase')) !== 'choose') { await key(page, 'Enter'); await sleep(1500); }
    }
    S.errors = page.logs.slice(0, 20);
  } finally {
    page.close();
  }
}

async function wave() {
  const page = await connect();
  const S = (out.sections.wave = { load: loadNow() });
  try {
    // (anim-1, --guns new: the hand-posed gun bodies; the page's own default is the old ones until they are judged)
    await page.send('Page.navigate', { url: `${BASE}?mode=fight${opt('--guns', '') === 'new' ? '&guns=new' : ''}` });
    await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "pick"', 300000, 250);
    await page.evaluate(HOOKS);
    await page.evaluate('(c => { c.dyn.setEnabled(false); c.renderer.setPixelRatio(Math.min(c.R.dpr, devicePixelRatio)); return true; })(window.__city)');
    await sleep(2000);
    S.pick = await scene(page, 'fightpage-pick', { light: true, seconds: 3 });
    // the wave: a raid (four at once), the Doorman shotgun in hand, Earl at the front (fight-run.mjs --guns)
    await page.evaluate("window.__demo.hud.pick({ weapon: 'doorman', gear: [], ally: true, earl: 'front', level: 'raid' })");
    const linksBefore = await page.evaluate('window.__perf.links.length');
    await key(page, 'Enter');
    await page.waitFor('window.__demo.hud.phase === "fight"', 60000, 50);
    const down = new Set();
    const CODES = { KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68 };
    const hold = async m => {
      const want = new Set();
      if (m[0] > 0.38) want.add('KeyD'); if (m[0] < -0.38) want.add('KeyA'); if (m[1] > 0.38) want.add('KeyS'); if (m[1] < -0.38) want.add('KeyW');
      for (const c of [...down]) if (!want.has(c)) { await page.send('Input.dispatchKeyEvent', { type: 'keyUp', code: c, key: c.slice(3).toLowerCase(), windowsVirtualKeyCode: CODES[c] }); down.delete(c); }
      for (const c of want) if (!down.has(c)) { await page.send('Input.dispatchKeyEvent', { type: 'keyDown', code: c, key: c.slice(3).toLowerCase(), windowsVirtualKeyCode: CODES[c] }); down.add(c); }
    };
    // the player driven the way fight-run.mjs drives it (src/fight/policies.mjs kite, read off the page)
    const drive = async secs => {
      const t0 = Date.now();
      while (Date.now() - t0 < secs * 1000) {
        const s = await page.evaluate('(h => ({ phase: h.phase, m: h.phase === "fight" ? h.driveMove() : [0, 0] }))(window.__demo.hud)').catch(() => ({ phase: '?' }));
        if (s.phase === 'over') break;
        if (s.phase === 'fight') await hold(s.m);
        await sleep(150);
      }
      await hold([0, 0]);
    };
    await sleep(800);
    S.fight = await scene(page, 'fightpage-wave', { settle: 0, during: drive, seconds: SECONDS });
    S.linksDuring = (await page.evaluate('window.__perf.links.length')) - linksBefore;
    S.loaf = (await page.evaluate('window.__perf.loaf')).filter(l => l.d > 50).slice(-20);
    S.errors = page.logs.slice(0, 20);
  } finally {
    page.close();
  }
}

// (raidfight-1) THE RAID ON YOUR HOME at the trailer's door (demo/run/raidfight.js, on the fight page at ELM ST, whose
// zone is the trailer park's): --raid <crew>:<hold>:<size>:<earl 0|1>:<seed> (default the biggest rush, the Doorman,
// Earl beside you), picked with a real B and a real mouse press on Watch the raid; measured from the press to its end,
// with the programs linked while it played
async function raid() {
  const page = await connect();
  const S = (out.sections.raid = { load: loadNow() });
  try {
    const R = opt('--raid', 'rush:doorman:2:1:5');
    await page.send('Page.navigate', { url: `${BASE}?mode=fight&guns=new&site=elm&nostairs=1&raid=${R}` });
    await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "pick"', 300000, 250);
    await page.evaluate(HOOKS);
    await page.evaluate('(c => { c.dyn.setEnabled(false); c.renderer.setPixelRatio(Math.min(c.R.dpr, devicePixelRatio)); return true; })(window.__city)');
    await sleep(2000);
    await key(page, 'b');
    await sleep(500);
    const box = await page.evaluate(`(() => { const b = document.querySelector('[data-row="raid:go"]'); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
    if (!box) throw new Error('raid: no Watch the raid button');
    const linksBefore = await page.evaluate('window.__perf.links.length');
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type, x: box[0], y: box[1], button: 'left', clickCount: 1 });
    await page.waitFor('window.__demo.hud.phase === "raid"', 60000, 30);
    const during = async secs => {
      const t0 = Date.now();
      while (Date.now() - t0 < secs * 1000 && (await page.evaluate('window.__demo.hud.phase').catch(() => '?')) === 'raid') await sleep(150);
    };
    S.fight = await scene(page, 'fightpage-raid', { settle: 0, during, seconds: SECONDS });
    await page.waitFor('window.__demo.hud.phase !== "raid"', 120000, 100);
    S.linksDuring = (await page.evaluate('window.__perf.links.length')) - linksBefore;
    S.links = (await page.evaluate('window.__perf.links')).slice(linksBefore).slice(0, 10);
    S.rec = await page.evaluate('(L => L[L.length - 1] ?? null)(window.__demo.hud.raid.log)');
    S.loaf = (await page.evaluate('window.__perf.loaf')).filter(l => l.d > 50).slice(-20);
    S.errors = page.logs.slice(0, 20);
    console.log(`  raid ${R}: programs linked while it played ${S.linksDuring}${S.linksDuring ? ` (${JSON.stringify(S.links).slice(0, 400)})` : ''}; long animation frames over 50 ms ${S.loaf.length}; seen ${S.rec?.seen}, first shot or blow ${S.rec?.open} s, control back ${S.rec?.close} s`);
  } finally {
    page.close();
  }
}

// (raidfight-5) THE RAID IN THE GAME AT NIGHT (demo/run/raidfight.js under the run's own night, the look the owner
// chose: c, the porch lamp and the stage's clock set back to 19:00 while it plays): --night <crew>:<hold>[:won|lost]
// (default rush:doorman:won). The run's night at the crib with the Sixes due (fight-film.mjs's own `night:` case),
// to bed with a real Enter. Every picture of the page from the bed to the night's card: its time, the raid's phase,
// how black the picture was (the stage's veil, as drawn); every program linked; and the two moments the stage's clock
// was set and put back, with the picture they fell in and how black it was then.
function nightRaidCase(crew, hold, result) {
  const s0 = newRun({ seed: 3, cfg });
  const c = crewFoes(cfg, crew, 1);
  for (let day = 3; day < 90; day++) {
    const sixes = { ...s0.sixes, marks: [{ why: 'refuse', text: `refused Dutch the tax (day ${day})`, n: 9, day }], did: day, word: day - 3, raid: { day, warned: day - 1, crew, size: 1, n: c.n, stake: 1500 } };
    const s = { ...s0, place: 'crib', day, hour: 21, energy: 4, stash: { smokes: 6 }, things: { sixshot: true, doorman: true, chopper: true, longeye: true, doorbar: true, camera: true }, ammo: { sixshot: 24, doorman: 12, chopper: 60, longeye: 10 }, holdWith: null, sixes, banked: s0.banked + 400, books: { ...s0.books, earned: s0.books.earned + 400 } };
    const held = step(cfg, s, { do: 'holdWith', with: hold }).state;
    const r = step(cfg, held, { do: 'sleep' });
    const e = r.events.find(x => x.type === 'raid' && x.kind === 'sixes' && x.duel);
    if (e && e.home && (!result || e.duel.result === result)) return { state: held, duel: e.duel };
  }
  throw new Error(`no night of ${crew} with ${hold}${result ? `, ${result}` : ''}`);
}
async function nightraid() {
  const page = await connect();
  const S = (out.sections.nightraid = { load: loadNow() });
  try {
    const [crew, hold, result] = opt('--night', 'rush:doorman:won').split(':');
    const C = nightRaidCase(crew, hold ?? 'doorman', result ?? null);
    console.log(`  night raid: ${C.duel.them?.text}, ${C.duel.you?.label}; the rules: ${C.duel.result} in ${C.duel.seconds} s (day ${C.state.day})`);
    await upRun(page, `${BASE}?mode=run&seed=3&speed=1&new=1${opt('--qs', '')}`);
    await sleep(1500);
    await loadWhole(page, C.state);
    await page.waitFor('window.__demo.hud.phase === "choose" && !window.__demo.hud.odds?.pending', 150000, 100);
    await sleep(2500);
    // (every picture from here: its time apart, the raid's phase, the veil's opacity as drawn; the clock's two moments)
    await page.evaluate(`(() => { const d = window.__demo, veil = document.getElementById('hk2-cut');
      const R = window.__nightRaid = { rows: [], clocks: [], on: true, active: null, ended: null, links0: window.__perf.links.length, programs0: window.__city.renderer.info.programs.length, stacks: [] };
      for (const G of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) { const l = G && G.prototype.linkProgram; if (l) G.prototype.linkProgram = function (...a) { if (R.on) R.stacks.push({ t: Math.round(performance.now()), stack: String(new Error().stack).split(String.fromCharCode(10)).slice(2, 9).map(x => x.trim().replace(/^at /, '').replace(new RegExp('https?:[^ )]*[/](demo|city|src)[/]'), '$1/')).join(' < ') }); return l.apply(this, a); }; }
      const op = () => (veil ? +(+getComputedStyle(veil).opacity).toFixed(3) : 0);
      R.warm = []; const sc = window.__city.scene, add0 = sc.add.bind(sc), rem0 = sc.remove.bind(sc);
      sc.add = (...o) => { for (const x of o) if (x && x.name === 'hk2:warm') R.warm.push(['add', Math.round(performance.now()), x.children.length]); return add0(...o); };
      sc.remove = (...o) => { for (const x of o) if (x && x.name === 'hk2:warm') R.warm.push(['remove', Math.round(performance.now())]); return rem0(...o); };
      const set0 = d.stage.setClock.bind(d.stage);
      d.stage.setClock = c => { const t = performance.now(); const o = op(); const r = set0(c); R.clocks.push({ t: +t.toFixed(1), hour: c && c.hour, raid: !!d.hud.raid.active, opacity: o, black: !!d.stage.travel?.fade?.black, ms: +(performance.now() - t).toFixed(2) }); return r; };
      let last = performance.now();
      const tick = now => { if (!R.on) return; requestAnimationFrame(tick); const st = d.hud.raid.state, a = d.hud.raid.active;
        if (a && R.active === null) R.active = now; if (!a && R.active !== null && R.ended === null) R.ended = now;
        R.rows.push([+last.toFixed(1), +(now - last).toFixed(2), st ? st.phase : (a ? 'set' : null), op()]); last = now; };
      requestAnimationFrame(tick); return true; })()`);
    await chooseAndGo(page, { do: 'sleep' });
    await page.waitFor('window.__demo.hud.raid.active', 180000, 50);
    await page.waitFor('!window.__demo.hud.raid.active', 240000, 100);
    await page.waitFor('!!document.querySelector(".rn-raid-card")', 60000, 100);
    await sleep(800);
    const R = await page.evaluate('(R => { R.on = false; return { warm: R.warm, rows: R.rows, clocks: R.clocks, active: R.active, ended: R.ended, links: window.__perf.links.slice(R.links0), stacks: R.stacks, programs: window.__city.renderer.info.programs.slice(R.programs0).map(p => ({ name: p.name, key: String(p.cacheKey).slice(0, 160), users: (() => { const out = []; const P = window.__city.renderer.properties; window.__city.scene.traverse(o => { const ms = o.material ? [].concat(o.material) : []; for (const m of ms) if (P.get(m).currentProgram === p && out.length < 4) { let q = o, chain = []; while (q && chain.length < 4) { chain.push((q.name || q.type) + (q.isSprite ? "[sprite" + (m.map ? " map " + (m.map.image && m.map.image.width) : "") + (m.fog ? " fog" : "") + (m.depthTest ? "" : " nodepth") + "]" : "")); q = q.parent; } out.push(chain.join(" < ")); } }); return out; })() })) }; })(window.__nightRaid)');
    const rec = await page.evaluate('(R => (R.log[R.log.length - 1] || {}).fight || null)(window.__demo.hud.raid)');
    // (a picture is SEEN when the veil was under 0.98 as the picture before it was drawn: a long one under the black is a
    // wait in the black, not a hitch)
    const rows = R.rows.map(([t, dt, phase, opacity], k) => ({ t, dt, phase, opacity, before: k ? R.rows[k - 1][3] : 1 }));
    const fight = rows.filter(r => (r.phase === 'fight' || r.phase === 'down') && r.before < 0.98);
    const worst = fight.reduce((m, r) => (r.dt > m.dt ? r : m), { dt: 0 });
    const inRaid = rows.filter(r => r.t >= R.active - 1 && (R.ended === null || r.t <= R.ended + 1));
    const frameOf = t => rows.find(r => r.t <= t && t < r.t + r.dt) ?? null;
    const clocks = R.clocks.filter(c => c.t >= (R.active ?? 0) - 5000).map(c => ({ ...c, frame: frameOf(c.t) }));
    const links = R.links.filter(t => R.active !== null && t >= R.active - 50 && (R.ended === null || t <= R.ended + 50));
    S.rec = rec && { seen: rec.seen, result: rec.result, skipped: rec.skipped, threw: rec.threw, light: rec.light, frames: rec.frames?.faults ?? null, open: rec.open, close: rec.close };
    S.fight = { frames: fight.length, worst: worst.dt, worstAt: worst, over33: fight.filter(r => r.dt > 33.4).length, over20: fight.filter(r => r.dt > 20).length, slowest: fight.map(r => r.dt).sort((a, b) => b - a).slice(0, 6) };
    S.unseen = rows.filter(r => r.before >= 0.98 && r.dt > 33.4 && r.t >= R.active - 2000).map(r => ({ dt: r.dt, phase: r.phase, opacity: r.opacity }));
    S.clocks = clocks;
    S.linksDuring = links.length;
    // (each with the picture it fell in: under the black, or seen)
    S.linksAt = links.map(t => ({ t: Math.round(t - R.active), frame: frameOf(t) }));
    S.linksSeen = S.linksAt.filter(l => !l.frame || l.frame.before < 0.98).length;
    S.links = { active: R.active, ended: R.ended, during: links, all: R.links, stacks: R.stacks, programs: R.programs, warm: R.warm };
    if (R.warm.length) console.log(`    the warm-up of the fight's materials (gunmesh.js warmMaterials): ${R.warm.map(([w, t, n]) => `${w}${n !== undefined ? ` ${n}` : ''} at ${Math.round(t - R.active)} ms`).join(', ')} from the black lifting; links at ${R.links.map(t => `${Math.round(t - R.active)} ms`).join(', ')}`);
    S.loaf = (await page.evaluate('window.__perf.loaf')).filter(l => R.active !== null && l.t >= R.active - 2000 && l.d > 50).map(l => ({ d: l.d, t: l.t, why: l.scripts?.[0] ? `${l.scripts[0].url} ${l.scripts[0].fn}` : null }));
    S.rows = inRaid.length;
    S.errors = page.logs.slice(0, 20);
    console.log(`  night raid ${crew}:${hold}: seen ${rec?.seen} (the rules ${rec?.result}), look ${rec?.light?.look}, the stage's clock ${JSON.stringify(rec?.light?.clock)}`);
    console.log(`    the fight as seen: ${S.fight.frames} pictures, the worst ${S.fight.worst} ms (${worst.phase}), over 33 ms ${S.fight.over33}, over 20 ms ${S.fight.over20}; the slowest ${S.fight.slowest.join(', ')}`);
    console.log(`    programs linked from the raid's call to its end: ${S.linksDuring}, of them while the picture was seen (the veil under 0.98): ${S.linksSeen}${S.linksDuring ? ` (${S.linksAt.map(l => `at ${l.t} ms in a ${l.frame?.dt ?? '?'} ms picture, the veil ${l.frame?.before ?? '?'} → ${l.frame?.opacity ?? '?'}`).join('; ')}; ${JSON.stringify(R.programs).slice(0, 400)})` : ''}`);
    for (const c of clocks) console.log(`    the clock set to ${c.hour} (${c.raid ? 'the raid up' : 'no raid'}) in ${c.ms} ms: the veil ${c.opacity}${c.black ? ', black' : ''}; the picture it fell in ${c.frame ? `${c.frame.dt} ms, the veil ${c.frame.before} → ${c.frame.opacity}` : 'not found'}`);
    console.log(`    pictures over 33 ms under the black (not seen): ${S.unseen.map(u => `${u.dt} ms (${u.phase})`).join(', ') || 'none'}; long animation frames over 50 ms: ${S.loaf.map(l => `${l.d} ms`).join(', ') || 'none'}`);
    if (page.logs.length) console.log(`    page errors: ${page.logs.slice(0, 4).join(' | ')}`);
  } finally {
    page.close();
  }
}

// ── loading: a fresh profile, then the same page again (the city's block cache warm) ─────────────────────────────────
async function loading() {
  const page = await connect();
  const S = (out.sections.loading = { load: loadNow(), passes: [] });
  try {
    await page.send('Network.enable');
    for (const pass of ['cold (fresh profile)', 'again (the same profile: the block cache warm, and the HTTP cache as the server allows)']) {
      const req = new Map();
      page.off('Network.requestWillBeSent'); page.off('Network.responseReceived'); page.off('Network.loadingFinished');
      page.on('Network.requestWillBeSent', p => req.set(p.requestId, { url: p.request.url, type: p.type, t: p.timestamp }));
      page.on('Network.responseReceived', p => { const r = req.get(p.requestId); if (r) { r.status = p.response.status; r.mime = p.response.mimeType; r.cache = p.response.headers['Cache-Control'] ?? p.response.headers['cache-control'] ?? null; r.enc = p.response.headers['Content-Encoding'] ?? p.response.headers['content-encoding'] ?? null; r.fromCache = p.response.fromDiskCache || p.response.fromServiceWorker; } });
      page.on('Network.loadingFinished', p => { const r = req.get(p.requestId); if (r) { r.bytes = p.encodedDataLength; r.end = p.timestamp; } });
      page.off('Network.requestServedFromCache');
      page.on('Network.requestServedFromCache', p => { const r = req.get(p.requestId); if (r) r.servedFromCache = true; });
      // (the status as it came over the wire: a revalidated file is a 304 there, though the page is handed its kept copy as a 200)
      page.off('Network.responseReceivedExtraInfo');
      page.on('Network.responseReceivedExtraInfo', p => { const r = req.get(p.requestId); if (r) r.wire = p.statusCode; });
      const t0 = Date.now();
      await page.send('Page.navigate', { url: `${BASE}?mode=run&seed=3` });
      await page.waitFor('window.__perf && window.__perf.marks.playable && window.__perf.marks.up', 300000, 200);
      const wall = (Date.now() - t0) / 1000;
      await sleep(2000);
      const marks = await page.evaluate('(() => { const c = window.__city, P = window.__perf; return { up: P.marks.up, playable: P.marks.playable, cityFirstView: c.marks.first ? Math.round(c.marks.first) : null, cityReady: c.marks.ready ? Math.round(c.marks.ready) : null, cityWarmed: c.marks.warmed ? Math.round(c.marks.warmed) : null, stageReadySeconds: window.__demo.readySeconds, linksTotal: P.links.length, linksBeforePlayable: P.links.filter(t => t <= P.marks.playable).length, linksBeforeUp: P.links.filter(t => t <= P.marks.up).length, lastLink: P.links[P.links.length - 1] ?? null, heapMB: Math.round(performance.memory.usedJSHeapSize / 1e6), ctx: P.ctx.map(({ canvas, ...x }) => ({ ...x, inPage: !!(canvas && canvas.isConnected) })), nav: (e => e && { domContentLoaded: Math.round(e.domContentLoadedEventEnd), load: Math.round(e.loadEventEnd) })(performance.getEntriesByType("navigation")[0]) }; })()');
      const list = [...req.values()];
      const byKind = {};
      for (const r of list) {
        const u = r.url.replace(/^https?:\/\/[^/]+/, '');
        const k = u.startsWith('/city/from-trunk/') ? 'city (from trunk)' : u.startsWith('/city/vendor/') ? 'three.js (vendored)' : u.startsWith('/demo/') ? 'demo (stage, run, fight, hud)' : u.startsWith('/src/') ? 'src (rules)' : u.startsWith('data:') || u.startsWith('blob:') ? 'data/blob' : 'other';
        const ext = (u.match(/\.(\w+)(\?|$)/)?.[1] ?? r.type ?? '?').toLowerCase();
        const b = byKind[k] ??= { requests: 0, MB: 0, byExt: {} };
        b.requests++; b.MB += (r.bytes ?? 0) / 1e6; b.byExt[ext] = (b.byExt[ext] ?? 0) + 1;
      }
      for (const b of Object.values(byKind)) b.MB = r2(b.MB);
      const cacheHeaders = [...new Set(list.map(r => r.cache).filter(Boolean))];
      const enc = [...new Set(list.map(r => r.enc ?? 'none'))];
      const t00 = Math.min(...list.map(r => r.t));
      const lastEnd = Math.max(...list.filter(r => r.end).map(r => r.end));
      // (smooth-1: what the HTTP cache did: answered 304 by the server, served from the browser's cache, sent whole)
      const statuses = {};
      for (const r of list) statuses[r.status ?? '?'] = (statuses[r.status ?? '?'] ?? 0) + 1;
      const wire = {};
      for (const r of list) if (r.wire != null) wire[r.wire] = (wire[r.wire] ?? 0) + 1;
      const cacheUse = { statuses, wire, notModified: list.filter(r => r.wire === 304 || r.status === 304).length, fromCache: list.filter(r => r.fromCache || r.servedFromCache).length, sentWhole: list.filter(r => (r.wire ?? r.status) === 200 && !(r.fromCache || r.servedFromCache)).length, transferredMB: r2(list.reduce((a, r) => a + (r.bytes ?? 0), 0) / 1e6), worldJson: list.filter(r => /world\/export\/world\.json/.test(r.url)).length };
      const rec = { pass, wallSecondsToPlayable: wall, marks, cacheUse, requests: list.length, MB: r2(list.reduce((s, r) => s + (r.bytes ?? 0), 0) / 1e6), byKind, cacheHeaders, encodings: enc, failed: list.filter(r => r.status >= 400).length, lastResponseSeconds: r2(lastEnd - t00), largest: list.filter(r => r.bytes).sort((a, b) => b.bytes - a.bytes).slice(0, 8).map(r => [r.url.replace(/^https?:\/\/[^/]+/, ''), r2(r.bytes / 1e6)]) };
      // what compression would save: every file the page asked for, compressed here with gzip and brotli as a server would send it
      if (!S.passes.length) {
        const { gzipSync, brotliCompressSync } = await import('node:zlib');
        const { readFileSync } = await import('node:fs');
        const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
        let raw = 0, gz = 0, br = 0, files = 0;
        for (const r of list) {
          const u = r.url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
          if (!u.startsWith('/') || u.endsWith('/')) continue;
          let buf;
          try { buf = readFileSync(path.join(root, decodeURIComponent(u))); } catch { continue; }
          files++; raw += buf.length; gz += gzipSync(buf, { level: 6 }).length; br += brotliCompressSync(buf).length;
        }
        rec.compression = { files, rawMB: r2(raw / 1e6), gzipMB: r2(gz / 1e6), brotliMB: r2(br / 1e6) };
      }
      rec.scripts = list.filter(r => /\.m?js(\?|$)/.test(r.url)).length;
      S.passes.push(rec);
      console.log(`loading, ${pass}: playable at ${(marks.playable / 1000).toFixed(1)} s (veil up ${(marks.up / 1000).toFixed(1)} s, the city's first view ${((marks.cityFirstView ?? 0) / 1000).toFixed(1)} s), ${list.length} requests, ${rec.MB} MB, encodings ${enc.join('/')}, cache ${cacheHeaders.join(' / ')}; programs linked ${marks.linksBeforePlayable} before playable, ${marks.linksTotal} by now; heap ${marks.heapMB} MB; HTTP: ${cacheUse.notModified} answered 304, ${cacheUse.fromCache} from the browser's cache, ${cacheUse.sentWhole} sent whole, world.json asked ${cacheUse.worldJson}× · load ${loadNow().load}`);
    }
  } finally {
    page.close();
  }
}

// ── the game playing itself: long frames with what it was doing, the heap over time ──────────────────────────────
async function soak(days) {
  const page = await connect();
  const S = (out.sections.soak = { load: loadNow(), days, samples: [] });
  try {
    // (smooth-1: --soak-skip K presses Space one second into every K-th step's scene, autoplay.js &skip=: the next
    // choice comes while its odds may still be being worked out)
    const url = `${BASE}?mode=run&runtest=dealer&seed=3&days=${days}&speed=1${opt('--soak-skip', null) ? `&skip=${Number(opt('--soak-skip'))}` : ''}`;
    await page.send('Page.navigate', { url });
    await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.state', 300000, 250);
    await page.evaluate(HOOKS);
    await page.evaluate(`(() => { const d = window.__demo; window.__perf.note = () => { const h = d.hud; return h && h.state ? 'day ' + h.state.day + ' ' + h.state.hour + ':00 ' + h.state.place + ' ' + h.phase + (h.duel && h.duel.active ? ' FIGHT' : '') : 'boot'; }; return true; })()`);
    await page.evaluate('(c => { c.dyn.setEnabled(false); c.renderer.setPixelRatio(Math.min(c.R.dpr, devicePixelRatio)); return true; })(window.__city)');
    // (smooth-1) THE RULES' SAMPLE FIGHTS ON THE PAGE'S OWN THREAD: the fight module's own count (the same module the page
    // runs: the same address), read at every animation frame and kept when it moves
    await page.evaluate(`import('/src/fight/duel.mjs').then(m => { const P = window.__perf; P.fights = [[Math.round(performance.now()), m.DUEL_RUNS.n]]; const tick = () => { const n = m.DUEL_RUNS.n; if (n !== P.fights[P.fights.length - 1][1]) P.fights.push([Math.round(performance.now()), n]); requestAnimationFrame(tick); }; requestAnimationFrame(tick); return true; })`);
    await page.send('HeapProfiler.enable');
    const heapNow = async gc => { if (gc) await page.send('HeapProfiler.collectGarbage'); const h = await page.send('Runtime.getHeapUsage'); return r1(h.usedSize / 1e6); };
    // (the JS objects alone, above; and the typed arrays' memory, which is outside that heap: geometry, the crowd's buffers)
    const backingNow = async () => { const h = await page.send('Runtime.getHeapUsage'); return { usedMB: r1(h.usedSize / 1e6), backingMB: h.backingStorageSize != null ? r1(h.backingStorageSize / 1e6) : null, embedderMB: h.embedderHeapUsedSize != null ? r1(h.embedderHeapUsedSize / 1e6) : null }; };
    S.heapStartAfterGC = await heapNow(true);
    S.heapStart = await backingNow();
    const loaf0 = await page.evaluate('window.__perf.loaf.length');
    await page.evaluate('window.__perf.start()');
    const t0 = Date.now();
    console.log(`soak: ${url}`);
    for (;;) {
      await sleep(5000);
      const st = await page.evaluate('(() => { const h = window.__demo.hud; return { title: document.title, day: h.state.day, hour: h.state.hour, place: h.state.place, phase: h.phase, steps: h.steps, frames: window.__perf.frames.length }; })()').catch(() => null);
      const heap = await heapNow(false);
      S.samples.push({ s: Math.round((Date.now() - t0) / 1000), heap, ...st, load: Math.round((Date.now() - t0) / 1000) % 60 < 5 ? loadNow() : undefined });
      // the frames buffer is drained every few minutes so it never grows past what one evaluate can carry
      if (st?.frames > 20000) { const part = summarise(await page.evaluate('window.__perf.stop()', 60000)); (S.parts ??= []).push(part); await page.evaluate('window.__perf.start()'); }
      if (!st || st.title.startsWith('run-') || Date.now() - t0 > 40 * 60000) break;
    }
    const last = summarise(await page.evaluate('window.__perf.stop()', 60000));
    (S.parts ??= []).push(last);
    S.seconds = Math.round((Date.now() - t0) / 1000);
    S.heapEndAfterGC = await heapNow(true);
    S.heapEnd = await backingNow();
    S.heapGrowthMBPerMinute = r2((S.heapEndAfterGC - S.heapStartAfterGC) / (S.seconds / 60));
    S.loaf = (await page.evaluate(`window.__perf.loaf.slice(${loaf0})`)).filter(l => l.d > 50);
    // (smooth-1: each long frame's sample fights on this thread: the count at the first frame after it less the count
    // before it. A step plays its own fight or two; more than that is the odds being worked out here)
    const F = (await page.evaluate('window.__perf.fights')) ?? [];
    const countAt = t => { let n = F[0]?.[1] ?? 0; for (const [ft, fn] of F) { if (ft > t) break; n = fn; } return n; };
    for (const l of S.loaf) {
      l.fights = countAt(l.t + l.d + 40) - countAt(l.t - 1);
      const top = l.scripts?.[0];
      l.why = l.fights > 4 ? `the odds: ${l.fights} sample fights on the page's thread` : top ? `${top.url || '(native)'} ${top.fn || ''} ${top.inv || ''}`.replace(/\s+/g, ' ').trim() : `no script (${l.render ? 'render' : 'other'})`;
    }
    S.fightsOnPage = F.length ? F[F.length - 1][1] - F[0][1] : null;
    S.odds = await page.evaluate('window.__demo.hud.odds ?? null').catch(() => null);
    S.over50 = S.loaf.length;
    S.over100 = S.loaf.filter(l => l.d > 100).length;
    S.oddsFrames = S.loaf.filter(l => l.fights > 4).length;
    S.title = await page.evaluate('document.title');
    S.runtest = await page.evaluate('(R => R && { days: R.days, steps: R.steps, seconds: R.seconds, fpsMean: R.fpsMean, fpsWorst: R.fpsWorst, daySeconds: R.daySeconds })(window.__runtest)');
    S.errors = page.logs.slice(0, 20);
    console.log(`soak: ${S.title}, ${S.seconds} s; heap after GC ${S.heapStartAfterGC} → ${S.heapEndAfterGC} MB (${S.heapGrowthMBPerMinute} MB/min); long animation frames (>50 ms) ${S.loaf.length}, over 100 ms ${S.over100}, the odds' ${S.oddsFrames}; sample fights on the page's thread ${S.fightsOnPage}`);
    for (const l of S.loaf) console.log(`  ${String(l.d).padStart(5)} ms  ${l.note ?? ''}  ${l.why}`);
  } finally {
    page.close();
  }
}

// ── the run ──────────────────────────────────────────────────────────────────────────────────────────────────────
const sections = [];
if (has('--load')) sections.push(['loading', loading]);
if (ONLY.some(n => n !== 'wave' && n !== 'raid' && n !== 'nightraid') && !has('--no-scenes')) sections.push(['scenes', scenes]);
if (ONLY.includes('wave') && !has('--no-scenes')) sections.push(['wave', wave]);
if (ONLY.includes('raid') && !has('--no-scenes')) sections.push(['raid', raid]);
if (ONLY.includes('nightraid') && !has('--no-scenes')) sections.push(['nightraid', nightraid]);
if (opt('--soak', null)) sections.push(['soak', () => soak(Number(opt('--soak')))]);
let failed = false;
for (const [name, fn] of sections) {
  const browser = await launch({ debugPort: DEBUG, width: W, height: H, flags: FLAGS });
  try {
    await fn(browser);
  } catch (err) {
    failed = true;
    console.error(`${name}: ${String(err?.stack ?? err).slice(0, 1500)}`);
    (out.sections[name] ??= {}).error = String(err);
  } finally {
    await browser.close();
  }
  if (JSON_OUT) { mkdirSync(path.dirname(path.resolve(JSON_OUT)), { recursive: true }); writeFileSync(JSON_OUT, `${JSON.stringify(out, null, 1)}\n`); }
}

// ── the table ────────────────────────────────────────────────────────────────────────────────────────────────────
const sc = { ...(out.sections.scenes?.scenes ?? {}), ...(out.sections.wave?.fight ? { wave: out.sections.wave.fight } : {}) };
if (Object.keys(sc).length) {
  console.log('\nscene            fps   interval med/p99/worst   >33 >50   main thread med/p95   GPU med/p95   calls  Mtris  shadow calls  heap MB  CPU×4 med/p95 interval   CPU×6');
  for (const [k, r] of Object.entries(sc)) {
    const b = r.base;
    if (!b) continue;
    const t = rt => (r.throttled?.[rt] ? `${r.throttled[rt].interval.med}/${r.throttled[rt].interval.p95}` : '-');
    console.log(`${k.padEnd(16)} ${String(b.fps).padStart(5)}   ${`${b.interval.med}/${b.interval.p99}/${b.interval.worst}`.padEnd(22)} ${String(b.interval.over33).padStart(3)} ${String(b.interval.over50).padStart(3)}   ${`${b.work.med}/${b.work.p95}`.padEnd(20)}  ${`${b.gpu.med}/${b.gpu.p95}`.padEnd(12)}  ${String(b.draw?.calls ?? '-').padStart(5)}  ${((b.draw?.tris ?? 0) / 1e6).toFixed(2).padStart(5)}  ${String(b.draw?.shadowCalls ?? '-').padStart(12)}  ${String(b.heapMB).padStart(7)}  ${t(4).padEnd(22)} ${t(6)}`);
  }
}
console.log(failed ? 'perf-probe: a section fell over (see above)' : 'perf-probe: done');
process.exit(failed ? 1 : 0);
