#!/usr/bin/env node
// THE CROWD'S RANGE, A AGAINST B, WHERE A PLAYER CAN LOOK (smooth-1, docs/perf/2026-11-18-audit.md fix 4). The city
// simulates walkers out to R.charFar (330 m on the high preset) while the game's zone draws to R.draw (151 m) and its
// haze closes at fog.far (139 m): demo/boot.js now gives the crowd the zone's range. This shows that nobody a player
// can see changes: at the market, the plaza and the park, in three views a player can make with the mouse (`near`:
// the Lock's own arm; `out`: zoomed all the way out by real wheel presses, the Lock's furthest arm; `low`: all the way
// out and tilted down to the Lock's flattest angle by a real drag, so the view runs out to the haze and past it), each
// turned round the player by a real drag while it is measured, it sets the range to A (the preset's) and B (ours) in
// alternation, A B A B, and for each half counts, every frame, the walkers in the camera's view in the clear (nearer
// than fog.near), in the haze (fog.near to fog.far), in its last 15 m, and past it (drawn in the haze's own colour), the
// city's own count of walkers on screen, and the city's own continuity counters (peds.js: a walker that appears or
// vanishes while on screen), and takes a picture of the view before the turn.
// The server must run: node demo/serve.mjs --port 5498 --quiet
//
//   HK2_DEBUG_PORT=5749 node demo/tools/crowd-range.mjs --port 5498 [--a 330] [--b <m>|draw] [--places market,plaza,park] [--views near,out,low]
//        [--settle 6] [--seconds 6] [--pairs 2] [--out <dir>] [--json <file>]
// Prints a table and `crowd-range-ok` when B shows the same walkers as A (on-screen appearances no more than A's, the
// counts in the clear and in the haze within the noise of the A halves), else `crowd-range-fail: <why>`.
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const PORT = opt('--port', 5498);
const A = Number(opt('--a', 330));
const B0 = opt('--b', 'boot');
const PLACES = opt('--places', 'market,plaza,park').split(',');
const VIEWS = opt('--views', 'near,out,low').split(',');
const PAIRS = Number(opt('--pairs', 2));
const SETTLE = Number(opt('--settle', 6));
const SECONDS = Number(opt('--seconds', 6));
const OUT = path.resolve(opt('--out', path.join(os.tmpdir(), 'crowd-range')));
const JSON_OUT = opt('--json', null);
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });
const loadNow = () => {
  try { return execSync('uptime').toString().trim().replace(/^.*load averages?: /, ''); } catch { return '?'; }
};

const STATES = {
  market: { place: 'market', day: 2, hour: 20, banked: 40, carried: 20, energy: 6, heat: 0, placeHeat: {} },
  plaza: { place: 'plaza', day: 2, hour: 15, banked: 40, carried: 20, energy: 6, heat: 0, placeHeat: {} },
  park: { place: 'park', day: 2, hour: 14, banked: 40, carried: 8, energy: 6, heat: 0, placeHeat: {} },
  docks: { place: 'docks', day: 2, hour: 15, banked: 40, carried: 20, energy: 6, heat: 0, placeHeat: {} },
};

// every frame: the walkers in the camera's view, in the clear and in the haze; the city's on-screen count
const SAMPLER = `(() => {
  const c = window.__city, T = c.THREE;
  const F = new T.Frustum(), M = new T.Matrix4(), V = new T.Vector3();
  const S = window.__crowd = { on: false, frames: 0, rings: new Array(20).fill(0), clear: 0, haze: 0, past: 0, edge: 0, visible: 0, pool: 0, maxClear: 0, maxHaze: 0, near: 0, far: 0 };
  const tick = () => {
    if (S.on && c.peds && c.peds.ready) {
      const cam = c.camera;
      cam.updateMatrixWorld();
      M.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      F.setFromProjectionMatrix(M);
      const fn = c.scene.fog ? c.scene.fog.near : 1e9, ff = c.scene.fog ? c.scene.fog.far : 1e9;
      let clear = 0, haze = 0, past = 0, edge = 0;
      for (const w of c.peds.sim.walkers) {
        if (w.hide) continue;
        V.set(w.p[0], w.p[1] + 0.9, w.p[2]);
        const d = V.distanceTo(cam.position);
        // (every walker round the camera, in 10 m rings of its distance, in view or not: the crowd's density out to the
        // haze and past it, the same in every direction)
        const ring = Math.floor(d / 10);
        if (ring < S.rings.length) S.rings[ring]++;
        if (!F.containsPoint(V)) continue;
        if (d < fn) clear++; else if (d < ff) haze++; else past++;
        if (d >= ff - 15 && d < ff) edge++;
      }
      const st = c.peds.stats();
      S.frames++; S.clear += clear; S.haze += haze; S.past += past; S.edge += edge; S.visible += st.visible; S.pool += st.pool;
      S.maxClear = Math.max(S.maxClear, clear); S.maxHaze = Math.max(S.maxHaze, haze); S.near = fn; S.far = ff;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return true;
})()`;

const browser = await launch({ width: 1600, height: 1000 });
const report = { when: new Date().toISOString(), a: A, b: null, places: {}, pictures: [] };
const faults = [];
try {
  const page = await browser.open(`http://127.0.0.1:${PORT}/demo/?mode=run&seed=3`);
  const ev = (js, ms = 60000) => page.evaluate(js, ms);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 300000, 250);
  // (dynamic resolution held, as the probe holds it: the picture's resolution never changes under the measurement)
  await ev('(c => { c.dyn.setEnabled(false); c.renderer.setPixelRatio(Math.min(c.R.dpr, devicePixelRatio)); return true; })(window.__city)');
  const boot = await ev('({ charFar: window.__city.R.charFar, draw: window.__city.R.draw, preset: window.__city.PR.name })');
  const B = B0 === 'boot' ? boot.charFar : B0 === 'draw' ? boot.draw : Number(B0);
  report.b = B;
  report.boot = boot;
  console.log(`crowd range: A ${A} m against B ${B} m (the page set ${boot.charFar} m; draw ${boot.draw} m; preset ${boot.preset})`);
  await ev(SAMPLER);
  const mouse = (type, x, y, extra = {}) => page.send('Input.dispatchMouseEvent', { type, x, y, button: 'none', ...extra });
  for (const place of PLACES) {
    console.log(`${place}:`);
    await page.waitFor('window.__demo.hud.phase === "choose"', 150000, 100);
    const ok = await ev(`(async () => { const h = window.__demo.hud; const s = structuredClone(h.state); const f = ${JSON.stringify(STATES[place])};
      Object.assign(s, { people: {}, shifts: {}, today: {}, door: null, hoursThere: 0 }, f); s.books.earned += (s.carried + s.banked) - (h.state.carried + h.state.banked); return await h.load(s); })()`, 180000);
    if (!ok) throw new Error(`${place}: the run would not load the state`);
    await sleep(4000);
    report.places[place] = {};
    for (const viewName of VIEWS) {
    if (viewName === 'out') {
      // ALL THE WAY OUT: real wheel presses over the picture (the Lock's arm to its longest)
      for (let k = 0; k < 40; k++) {
        await mouse('mouseWheel', 800, 380, { deltaX: 0, deltaY: 240 });
        await sleep(40);
      }
      await sleep(2500);
    }
    if (viewName === 'low') {
      // AND TILTED FLAT: a real drag down the picture, then up if that raised it (the Lock's flattest angle)
      const h0 = await ev('window.__city.camera.position.y');
      const tilt = async dy => {
        await mouse('mouseMoved', 800, 500);
        await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 800, y: 500, button: 'left', clickCount: 1 });
        for (let s = 1; s <= 20; s++) {
          await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 800, y: 500 + (dy * s) / 20, button: 'left', buttons: 1 });
          await sleep(40);
        }
        await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 800, y: 500 + dy, button: 'left', clickCount: 1 });
        await sleep(1500);
      };
      await tilt(-420);
      if ((await ev('window.__city.camera.position.y')) > h0) {
        await tilt(420);
        await tilt(420);
      }
    }
    const cam = await ev(`(() => { const c = window.__city, d = window.__demo; const a = d.stage.actors.get('a1'); const p = c.camera.position; return { mode: c.cam && c.cam.mode, arm: a ? +Math.hypot(p.x - a.x, p.y - (a.y ?? 0), p.z - a.z).toFixed(1) : null, height: +p.y.toFixed(1), fogNear: +c.scene.fog.near.toFixed(1), fogFar: +c.scene.fog.far.toFixed(1) }; })()`);
    console.log(`  ${viewName}: camera ${cam.mode}, ${cam.arm} m from the player, ${cam.height} m up; haze ${cam.fogNear} to ${cam.fogFar} m · load ${loadNow()}`);
    const halves = [];
    for (const [k, range] of Array.from({ length: 2 * PAIRS }, (_, i) => [i, i % 2 ? B : A])) {
      await ev(`window.__city.R.charFar = ${range}`);
      await sleep(SETTLE * 1000);
      const shot = await page.shot(path.join(OUT, `${place}-${viewName}-${k % 2 ? 'B' : 'A'}${k >> 1}.jpg`));
      report.pictures.push(shot);
      const st0 = await ev('(s => ({ spawns: s.onScreenSpawns, removals: s.onScreenRemovals, spawnWhy: s.spawnWhy, removalWhy: s.removalWhy }))(window.__city.peds.stats())');
      await ev('Object.assign(window.__crowd, { on: true, frames: 0, rings: new Array(20).fill(0), clear: 0, haze: 0, past: 0, edge: 0, visible: 0, pool: 0, maxClear: 0, maxHaze: 0 })');
      // TURNED ROUND THE PLAYER: a real drag across the picture and back, over the measured seconds
      const steps = Math.max(10, Math.round(SECONDS * 10));
      await mouse('mouseMoved', 600, 380);
      await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 600, y: 380, button: 'left', clickCount: 1 });
      for (let s = 1; s <= steps; s++) {
        const u = s / steps;
        const x = 600 + 500 * (u < 0.5 ? u * 2 : 2 - u * 2);
        await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: 380, button: 'left', buttons: 1 });
        await sleep((SECONDS * 1000) / steps);
      }
      await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 600, y: 380, button: 'left', clickCount: 1 });
      await ev('window.__crowd.on = false');
      const S = await ev('window.__crowd');
      const st1 = await ev('(s => ({ spawns: s.onScreenSpawns, removals: s.onScreenRemovals, spawnWhy: s.spawnWhy, removalWhy: s.removalWhy, log: s.log }))(window.__city.peds.stats())');
      const n = Math.max(1, S.frames);
      const want = await ev('window.__city.peds.want');
      const h = { range, want, frames: S.frames, clear: +(S.clear / n).toFixed(1), haze: +(S.haze / n).toFixed(1), hazeEdge: +(S.edge / n).toFixed(1), pastHaze: +(S.past / n).toFixed(1), maxClear: S.maxClear, maxHaze: S.maxHaze,
        onScreen: +(S.visible / n).toFixed(1), simulated: Math.round(S.pool / n), spawnsOnScreen: st1.spawns - st0.spawns, removalsOnScreen: st1.removals - st0.removals,
        spawnLog: st1.spawns > st0.spawns ? st1.log.filter(l => l.k === 'spawn').slice(-(st1.spawns - st0.spawns)) : [], load: loadNow(), shot: path.basename(shot),
        rings: S.rings.map(x => +(x / n).toFixed(1)) };
      halves.push(h);
      console.log(`    ${k % 2 ? 'B' : 'A'} ${String(range).padStart(4)} m: round the camera by 10 m rings ${h.rings.slice(4, 16).join(' ')} (40 to 160 m)`);
      console.log(`    ${k % 2 ? 'B' : 'A'} ${String(range).padStart(4)} m: in view, clear ${h.clear} (max ${h.maxClear}), haze ${h.haze} (max ${h.maxHaze}; its last 15 m ${h.hazeEdge}), past it ${h.pastHaze}; on screen (city) ${h.onScreen}; simulated ${h.simulated} (the crowd's own number ${h.want}); appeared on screen ${h.spawnsOnScreen}, vanished on screen ${h.removalsOnScreen} · ${h.frames} frames · load ${h.load}`);
      // (the drag left the camera turned: put it back to the same view for the next half's picture)
      await mouse('mouseMoved', 600, 380);
    }
    const As = halves.filter((_, i) => i % 2 === 0), Bs = halves.filter((_, i) => i % 2 === 1);
    const avg = (xs, k) => +(xs.reduce((s, x) => s + x[k], 0) / xs.length).toFixed(1);
    const sum = (xs, k) => xs.reduce((s, x) => s + x[k], 0);
    const P = (report.places[place][viewName] = { camera: cam, halves, summary: {
      clear: [avg(As, 'clear'), avg(Bs, 'clear')], haze: [avg(As, 'haze'), avg(Bs, 'haze')], hazeEdge: [avg(As, 'hazeEdge'), avg(Bs, 'hazeEdge')], pastHaze: [avg(As, 'pastHaze'), avg(Bs, 'pastHaze')], onScreen: [avg(As, 'onScreen'), avg(Bs, 'onScreen')], simulated: [avg(As, 'simulated'), avg(Bs, 'simulated')],
      spawnsOnScreen: [sum(As, 'spawnsOnScreen'), sum(Bs, 'spawnsOnScreen')], removalsOnScreen: [sum(As, 'removalsOnScreen'), sum(Bs, 'removalsOnScreen')],
      rings: [0, 1].map(j => (j ? Bs : As)[0].rings.map((_, r) => +((j ? Bs : As).reduce((a, x) => a + x.rings[r], 0) / (j ? Bs : As).length).toFixed(1))) } });
    // the noise: how far the two A halves are from each other; B must sit within it (or closer to their mean)
    const within = k => {
      const xs = As.map(x => x[k]);
      const m = xs.reduce((a, x) => a + x, 0) / xs.length;
      const spread = Math.max(Math.max(...xs) - Math.min(...xs), 0.15 * m, 1.5);
      return Bs.every(b => Math.abs(b[k] - m) <= spread);
    };
    for (const k of ['clear', 'haze', 'hazeEdge', 'onScreen']) if (!within(k)) faults.push(`${place} ${viewName}: walkers ${k} in view ${JSON.stringify(Bs.map(b => b[k]))} with ${B} m against ${JSON.stringify(As.map(a => a[k]))} with ${A} m`);
    if (P.summary.spawnsOnScreen[1] > P.summary.spawnsOnScreen[0]) faults.push(`${place} ${viewName}: ${P.summary.spawnsOnScreen[1]} walkers appeared on screen with ${B} m, ${P.summary.spawnsOnScreen[0]} with ${A} m`);
    console.log(`  ${place} ${viewName}: round the camera, 10 m rings 40 to 160 m: A ${P.summary.rings[0].slice(4, 16).join(' ')} · B ${P.summary.rings[1].slice(4, 16).join(' ')}`);
    console.log(`  ${place} ${viewName}: A/B in view clear ${P.summary.clear.join(' / ')}, haze ${P.summary.haze.join(' / ')} (last 15 m ${P.summary.hazeEdge.join(' / ')}), past it ${P.summary.pastHaze.join(' / ')}, on screen ${P.summary.onScreen.join(' / ')}, simulated ${P.summary.simulated.join(' / ')}, appeared on screen ${P.summary.spawnsOnScreen.join(' / ')}`);
    }
  }
  report.errors = page.logs.filter(l => /\[exception\]|\[error\]/.test(l)).slice(0, 10);
  if (report.errors.length) faults.push(`page errors: ${report.errors[0]}`);
} finally {
  await browser.close();
}
report.faults = faults;
if (JSON_OUT) writeFileSync(JSON_OUT, `${JSON.stringify(report, null, 1)}\n`);
console.log(`pictures in ${OUT}`);
console.log(faults.length ? `crowd-range-fail: ${faults.join('; ')}` : 'crowd-range-ok');
