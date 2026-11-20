#!/usr/bin/env node
// THE PHONE MEASURE (phone-1): THE RUN's play page loaded in headless Chrome set up as a phone, and the same page as
// the desktop sees it, and what each costs. A server must be running (any of them: the repo's, its fast mode, or an
// exported folder served from a sub-path):
//   node demo/serve.mjs --port 5523
//
//   HK2_DEBUG_PORT=5787 node demo/tools/phone-probe.mjs --port 5523 [--path /demo/] [--query sw=1]
//        [--device phone|desktop|both] [--seconds 60] [--scenes trailer,market] [--no-frames] [--json out.json]
//        [--shots <dir>] [--label before]
//
// What it does, for each device:
//   1. a FIRST VISIT on a fresh browser profile: /demo/?mode=run&seed=3 (and --query), every request counted as it
//      went over the wire: how many went to the network, how many bytes came (encoded: compressed when the server
//      compresses), how many were answered 304, from the HTTP cache, or by the page's service worker; the time to the
//      first picture (the city's own mark: its first view drawn) and to the panels (the veil lifted: body.up)
//   2. a SECOND VISIT, the same profile, the page opened again after about:blank: the same counts
//   3. FRAMES for --seconds at each scene: the trailer (where seed 3 starts: the crib) and the night market (day 2,
//      20:00, put there with the page's own hud.load, as the picture tools do): frames drawn a second (the city's
//      own draws, counted where the city hands each drawn frame to its dynamic resolution, so a cap on frames is seen)
//      and the slowest frame, the 95th and 99th percentile, frames over 50 ms
//   4. MEMORY as Chrome counts it: the JS heap in use (performance.memory, precise) and V8's split of it (the typed
//      arrays' backing store, mostly geometry), after each scene
// The phone set-up is 390 × 844 CSS pixels at a pixel ratio of 3 (an iPhone 14 / 15's screen), touch on (five
// points), an iPhone's Safari user agent, the processor slowed 4× (Emulation.setCPUThrottlingRate) and the network
// held to Chrome DevTools' "Fast 4G" figures: 9 Mbit/s down, 1.5 Mbit/s up, 165 ms round trip. THIS IS NOT iOS SAFARI:
// the graphics chip is this Mac's (not slowed), the WebGL is Chrome's over Metal, Chrome's memory limits, not Safari's.
// The desktop set-up is the 1600 × 1000 window the other tools use, at a pixel ratio of 1, nothing slowed.
// Over this machine's plain HTTP/1.1 server Chrome opens six connections at most to the host; a real host speaks
// HTTP/2 (every request at once on one connection): the first visit's time here is the worse of the two.
// It prints one line per measure and a table at the end; --json keeps everything.
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { PHONE, DESKTOP, emulate, connect, watchWorkers } from './phone-setup.mjs';

const opt = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
};
const has = name => process.argv.includes(name);
const PORT = opt('--port', 5523);
const DEBUG = Number(process.env.HK2_DEBUG_PORT) || 5787;
const PAGE_PATH = opt('--path', '/demo/');
const EXTRA = opt('--query', '');
const SECONDS = Number(opt('--seconds', 60));
const SCENES = opt('--scenes', 'trailer,market').split(',').filter(Boolean);
const DEVICES = (d => (d === 'both' ? ['phone', 'desktop'] : [d]))(opt('--device', 'both'));
const SHOTS = opt('--shots', null) ? path.resolve(opt('--shots')) : null;
const JSON_OUT = opt('--json', null);
const LABEL = opt('--label', '');
const URL0 = `http://127.0.0.1:${PORT}${PAGE_PATH}?mode=run&seed=3${EXTRA ? `&${EXTRA}` : ''}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const r1 = x => (x == null ? null : Math.round(x * 10) / 10);
const r2 = x => (x == null ? null : Math.round(x * 100) / 100);

/** The service worker's own requests (watchWorkers), counted per visit. */
let swReq = new Map();
function onWorker(method, p) {
  if (method === 'Network.requestWillBeSent') swReq.set(p.requestId, { url: p.request.url });
  else if (method === 'Network.responseReceived') { const r = swReq.get(p.requestId); if (r) { r.status = p.response.status; r.disk = !!p.response.fromDiskCache; r.enc = p.response.headers['content-encoding'] ?? null; } }
  else if (method === 'Network.responseReceivedExtraInfo') { const r = swReq.get(p.requestId); if (r) r.wire = p.statusCode; }
  else if (method === 'Network.requestServedFromCache') { const r = swReq.get(p.requestId); if (r) r.mem = true; }
  else if (method === 'Network.loadingFinished') { const r = swReq.get(p.requestId); if (r) r.bytes = p.encodedDataLength; }
}

/** One visit: navigate, count every request until the panels are up and two seconds more. */
async function visit(page, url) {
  const req = new Map();
  swReq = new Map();
  for (const m of ['Network.requestWillBeSent', 'Network.responseReceived', 'Network.loadingFinished', 'Network.requestServedFromCache', 'Network.responseReceivedExtraInfo', 'Network.loadingFailed']) page.off(m);
  page.on('Network.requestWillBeSent', p => { if (!/^(data|blob):/.test(p.request.url)) req.set(p.requestId, { url: p.request.url, t: p.timestamp }); });
  page.on('Network.responseReceived', p => {
    const r = req.get(p.requestId);
    if (!r) return;
    r.status = p.response.status;
    r.sw = !!p.response.fromServiceWorker;
    r.disk = !!p.response.fromDiskCache;
    r.enc = p.response.headers['content-encoding'] ?? p.response.headers['Content-Encoding'] ?? null;
  });
  page.on('Network.responseReceivedExtraInfo', p => { const r = req.get(p.requestId); if (r) r.wire = p.statusCode; });
  page.on('Network.requestServedFromCache', p => { const r = req.get(p.requestId); if (r) r.mem = true; });
  page.on('Network.loadingFinished', p => { const r = req.get(p.requestId); if (r) r.bytes = p.encodedDataLength; });
  page.on('Network.loadingFailed', p => { const r = req.get(p.requestId); if (r) r.failed = p.errorText; });
  await page.send('Page.navigate', { url });
  await page.waitFor('window.__probe && window.__probe.marks.up && window.__city && window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 600000, 250);
  await sleep(2000);
  const marks = await page.evaluate('({ first: window.__city.marks.first, up: window.__probe.marks.up, sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller), heapMB: performance.memory ? performance.memory.usedJSHeapSize / 1e6 : null })');
  const list = [...req.values()];
  // a request "went over the wire" when the network answered it: not the memory or disk cache, not the service worker
  // (a service worker's own fetch to the network shows as a request of its own, and is counted here)
  const cached = r => r.mem || r.disk || r.sw;
  const net = list.filter(r => !cached(r) && !r.failed);
  // the service worker's own fetches: the ones that went to the network, and their bytes
  const sw = [...swReq.values()];
  const swNet = sw.filter(r => !(r.mem || r.disk));
  return {
    url,
    requests: list.length,
    network: net.length + swNet.length,
    workerFetches: sw.length,
    workerNetwork: swNet.length,
    workerMB: r2(sw.reduce((s, r) => s + (r.bytes ?? 0), 0) / 1e6),
    notModified: list.filter(r => r.wire === 304 || r.status === 304).length,
    fromCache: list.filter(r => r.mem || r.disk).length,
    fromWorker: list.filter(r => r.sw).length,
    failed: list.filter(r => r.failed || r.status >= 400).map(r => `${r.status ?? r.failed} ${r.url}`).slice(0, 20),
    MB: r2((list.reduce((s, r) => s + (r.bytes ?? 0), 0) + sw.reduce((s, r) => s + (r.bytes ?? 0), 0)) / 1e6),
    encodings: [...new Set(list.filter(r => r.status === 200 && !cached(r)).map(r => r.enc ?? 'none'))],
    firstPicture: r2(marks.first / 1000),
    panels: r2(marks.up / 1000),
    controlled: marks.sw,
    heapMB: r1(marks.heapMB),
  };
}

/** Carries the run on from the state it has, with these fields (as the picture tools do). */
async function loadState(page, fields) {
  await page.waitFor('window.__demo.hud.phase === "choose"', 300000, 100);
  const ok = await page.evaluate(`(async () => {
    const h = window.__demo.hud;
    const s = structuredClone(h.state);
    const f = ${JSON.stringify(fields)};
    Object.assign(s, { people: {}, shifts: {}, today: {}, door: null, hoursThere: 0 }, f, { owned: { ...s.owned, ...(f.owned ?? {}) } });
    s.books.earned += (s.carried + s.banked) - (h.state.carried + h.state.banked);
    return await h.load(s);
  })()`, 300000);
  if (!ok) throw new Error('the run would not load the state');
  await page.waitFor('window.__demo.hud.phase === "choose"', 300000, 100);
}

// the city's drawn frames: every frame the city draws it hands to its dynamic resolution (main.js: dyn.frame(now)),
// a method of an object we can reach, so the count sits there, outside any cap on the page's animation frames
const FRAMES = `(() => {
  const c = window.__city, F = window.__probeFrames = { t: [] };
  if (!c.dyn.__probed) {
    const f0 = c.dyn.frame.bind(c.dyn);
    c.dyn.frame = (now, busy) => { if (window.__probeFrames.on) window.__probeFrames.t.push(performance.now()); return f0(now, busy); };
    c.dyn.__probed = true;
  }
  return true;
})()`;

async function frames(page, seconds) {
  await page.evaluate(FRAMES);
  await page.evaluate('(window.__probeFrames.t = [], window.__probeFrames.on = true)');
  await sleep(seconds * 1000);
  const t = await page.evaluate('(window.__probeFrames.on = false, window.__probeFrames.t)', 60000);
  const gaps = [];
  for (let k = 1; k < t.length; k++) gaps.push(t[k] - t[k - 1]);
  const s = gaps.slice().sort((a, b) => a - b);
  const q = p => (s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : null);
  const span = t.length > 1 ? (t[t.length - 1] - t[0]) / 1000 : seconds;
  const settings = await page.evaluate('(c => ({ preset: c.PR.name, pixelRatio: c.renderer.getPixelRatio(), dynScale: c.dyn.scale, canvas: [c.renderer.domElement.width, c.renderer.domElement.height] }))(window.__city)');
  const heap = await page.send('Runtime.getHeapUsage').catch(() => null);
  const mem = await page.evaluate('performance.memory ? { used: performance.memory.usedJSHeapSize / 1e6, total: performance.memory.totalJSHeapSize / 1e6 } : null');
  const counts = await page.evaluate('(c => { const k = c.stream.counts(); const p = c.peds && c.peds.stats ? c.peds.stats() : null; return { blocks: { full: k.full, mid: k.mid, far: k.far }, walkersDrawn: p ? p.visible : null, calls: c.info.render.calls }; })(window.__city)').catch(() => null);
  return {
    fps: r1((t.length - 1) / span),
    frames: t.length,
    slowest: r1(s[s.length - 1] ?? null),
    p95: r1(q(0.95)),
    p99: r1(q(0.99)),
    over50: gaps.filter(g => g > 50).length,
    heapUsedMB: r1(mem?.used),
    heapTotalMB: r1(mem?.total),
    v8: heap && { usedMB: r1(heap.usedSize / 1e6), backingMB: heap.backingStorageSize != null ? r1(heap.backingStorageSize / 1e6) : null },
    preset: settings.preset,
    pixelRatio: r2(settings.pixelRatio),
    canvas: settings.canvas,
    ...counts,
  };
}

const out = { when: new Date().toISOString(), label: LABEL, url: URL0, seconds: SECONDS, devices: {} };
let failed = false;
for (const device of DEVICES) {
  const D = device === 'phone' ? PHONE : DESKTOP;
  const browser = await launch({ debugPort: DEBUG, width: D === PHONE ? 500 : D.width, height: D === PHONE ? 900 : D.height, flags: ['--enable-precise-memory-info'] });
  const rec = (out.devices[device] = { setup: { ...D, ua: D.ua ? 'iPhone Safari' : null } });
  let page = null;
  let workers = null;
  try {
    page = await connect(DEBUG);
    workers = await watchWorkers(DEBUG, { net: D.net, on: onWorker });
    await emulate(page.send, D);
    rec.first = await visit(page, URL0);
    console.log(`${device} first visit: ${rec.first.requests} requests (${rec.first.network} over the network, ${rec.first.notModified} answered 304, ${rec.first.fromCache} from the browser's cache, ${rec.first.fromWorker} from the service worker; the worker's own fetches ${rec.first.workerFetches}, ${rec.first.workerNetwork} to the network, ${rec.first.workerMB} MB), ${rec.first.MB} MB in all, encodings ${rec.first.encodings.join('/')}; first picture ${rec.first.firstPicture} s, panels ${rec.first.panels} s; failed ${rec.first.failed.length}`);
    await page.send('Page.navigate', { url: 'about:blank' });
    await sleep(1500);
    rec.second = await visit(page, URL0);
    console.log(`${device} second visit: ${rec.second.requests} requests (${rec.second.network} over the network, ${rec.second.notModified} answered 304, ${rec.second.fromCache} from the browser's cache, ${rec.second.fromWorker} from the service worker; the worker's own fetches ${rec.second.workerFetches}, ${rec.second.workerNetwork} to the network, ${rec.second.workerMB} MB), ${rec.second.MB} MB in all; first picture ${rec.second.firstPicture} s, panels ${rec.second.panels} s; service worker in charge: ${rec.second.controlled}`);
    if (!has('--no-frames')) {
      rec.scenes = {};
      for (const name of SCENES) {
        if (name === 'market') await loadState(page, { place: 'market', day: 2, hour: 20, banked: 40, carried: 20, energy: 6, heat: 0, placeHeat: { park: 0, market: 0 } });
        await sleep(4000);
        if (SHOTS) await page.shot(path.join(SHOTS, `${device}-${name}${LABEL ? `-${LABEL}` : ''}.jpg`)).catch(() => null);
        const f = (rec.scenes[name] = await frames(page, SECONDS));
        console.log(`${device} ${name}: ${f.fps} frames a second over ${SECONDS} s, slowest ${f.slowest} ms (p95 ${f.p95}, p99 ${f.p99}, ${f.over50} over 50 ms); preset ${f.preset}, pixel ratio ${f.pixelRatio}, canvas ${f.canvas.join('×')}; heap ${f.heapUsedMB} MB used (typed arrays ${f.v8?.backingMB} MB); blocks ${JSON.stringify(f.blocks)}, walkers drawn ${f.walkersDrawn}, draw calls ${f.calls}`);
      }
    }
    rec.errors = page.errors.slice(0, 20);
    if (rec.errors.length) console.log(`${device}: page errors:\n  ${rec.errors.join('\n  ')}`);
  } catch (err) {
    failed = true;
    rec.error = String(err?.stack ?? err).slice(0, 1500);
    console.error(`${device}: ${rec.error}`);
  } finally {
    page?.close();
    workers?.close();
    await browser.close();
  }
  if (JSON_OUT) { mkdirSync(path.dirname(path.resolve(JSON_OUT)), { recursive: true }); writeFileSync(JSON_OUT, `${JSON.stringify(out, null, 1)}\n`); }
}

// the table
console.log(`\n${LABEL || 'measure'} · ${URL0}`);
console.log('device   visit   requests  network  MB      first picture  panels   | scene    fps   slowest  p99    >50  heap MB  ratio  preset');
for (const [device, rec] of Object.entries(out.devices)) {
  for (const v of ['first', 'second']) {
    const x = rec[v];
    if (!x) continue;
    console.log(`${device.padEnd(8)} ${v.padEnd(7)} ${String(x.requests).padStart(8)}  ${String(x.network).padStart(7)}  ${String(x.MB).padEnd(6)}  ${String(x.firstPicture).padStart(8)} s     ${String(x.panels).padStart(6)} s |`);
  }
  for (const [name, f] of Object.entries(rec.scenes ?? {})) console.log(`${''.padEnd(70)}| ${name.padEnd(8)} ${String(f.fps).padStart(5)}  ${String(f.slowest).padStart(6)}  ${String(f.p99).padStart(5)}  ${String(f.over50).padStart(3)}  ${String(f.heapUsedMB).padStart(7)}  ${String(f.pixelRatio).padStart(5)}  ${f.preset}`);
}
console.log(failed ? 'phone-probe: fail' : 'phone-probe: done');
process.exit(failed ? 1 : 0);
