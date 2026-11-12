#!/usr/bin/env node
// CONTACT SHEETS of the ride scenes (demo/rides-dev.html), from the game's camera distance and from closer.
//
//   node demo/stage/rides/shots.mjs [--port 5474] [--scenes subway,scooter,subway2,cab,foot] [--out <dir>] [--n 1]
//                                   [--every 0.55] [--back] [--stairs 1] [--followed] [--tight]
//
// It needs the demo server up (node demo/serve.mjs --port 5474). One headless Chrome (demo/tools/chrome.mjs; its
// debug port is HK2_DEBUG_PORT, default 5483 here), the whole city built once, then each scene in turn: the stage is
// paused (actors.setSpeed(0)) for every frame while two cameras take it: the game's (24 m up, 64 degrees down, 11.7 m
// off) and one 5 m up, 8 m off, following the rider. Departure frames are shot on the place it starts from, arrival
// frames on the place it ends at, as the game's still camera would. Every frame's stage clock is written under it. Out: <out>/<scene>/f*.jpg (the
// frames: g the game's camera, n the close one, c the carriage), <out>/<scene>.html (the sheet: the frames in a grid) and
// <scene>.json (the frames' list and the trip's lengths), <out>/report.json (the lengths, the audit, the page's errors).
import { launch } from '../../tools/chrome.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const PORT = Number(arg('port', 5474));
const OUT = path.resolve(arg('out', '/tmp/hk2-rides'));
const SCENES = arg('scenes', 'subway,scooter,subway2,cab,foot').split(',');
const N = Number(arg('n', 1));
const EVERY = Number(arg('every', 0.55));
const BACK = process.argv.includes('--back');
const STAIRS = arg('stairs', null);
// --tight: only a close camera, 4.9 m off and 2.4 m up, on whoever rides (the feet on the deck, the door, the treads)
const TIGHT = process.argv.includes('--tight');
// --followed: subway trips play the city's carriage scene between the halves
const FOLLOWED = process.argv.includes('--followed');
const W = 800;
const H = 500;
mkdirSync(OUT, { recursive: true });

const B = await launch({ debugPort: Number(process.env.HK2_DEBUG_PORT) || 5483, width: W, height: H });
const report = { scenes: {}, errors: [], failed: [] };
try {
  const P = await B.open(`http://127.0.0.1:${PORT}/demo/rides-dev.html?plain=1&linger=0.6`);
  const up = await P.waitFor('window.__rides && window.__rides.rides', 600000);
  report.ready = up;
  console.log(`page up in ${up.toFixed(1)} s`);
  await P.evaluate('__rides.rides.ready');
  for (const name of SCENES) {
    const dir = path.join(OUT, name + (BACK ? '-back' : '') + (TIGHT ? '-tight' : ''));
    mkdirSync(dir, { recursive: true });
    await P.evaluate(`(() => { const R = __rides; R.actors.setSpeed(1); R.actors.audit(true); R.subject = null; R.run = R.play(${JSON.stringify(name)}, { follow: false, n: ${N}, back: ${BACK}, stairs: ${STAIRS === null ? 'undefined' : STAIRS !== '0'}, followed: ${FOLLOWED} }); R.run.catch(e => R.err = String(e.stack || e)); return true; })()`);
    const frames = [];
    let k = 0;
    let lastPhase = null;
    let still = null;
    const t0 = Date.now();
    // (pause, frame the camera, two pictures, play on for EVERY stage seconds; until the trip is done)
    for (;;) {
      const st = await P.evaluate(`(() => { const R = __rides, c = R.current; if (!c) return null; R.actors.setSpeed(0);
        const A = c.ids.map(id => R.actors.get(id)).find(a => a && !a.w.hide);
        const cab = R.rides.stats().cabs[0];
        if (A) R.subject = [A.x, A.z]; else if (cab) R.subject = [cab.x, cab.z];
        const s = R.subject || (c.phase === 'leave' ? c.from : c.to);
        return { phase: c.phase, clock: R.actors.clock, seen: !!A, x: s[0], z: s[1], from: c.from, to: c.to, err: R.err || null }; })()`);
      if (!st || st.phase === 'done' || st.err) {
        if (st?.err) report.errors.push(`${name}: ${st.err}`);
        break;
      }
      if (st.phase === 'cut') {
        await P.evaluate('(__rides.actors.setSpeed(1), true)');
        await P.sleep(150);
        continue;
      }
      // the still camera of the half: on the place it starts from or arrives at
      // (the departure's still is where it starts, the person's first place: a station scene starts at the station)
      if (st.phase !== lastPhase) {
        lastPhase = st.phase;
        still = st.phase === 'leave' ? [st.x, st.z] : Math.hypot(st.x - st.to[0], st.z - st.to[1]) > 20 && st.seen ? [st.x, st.z] : st.to;
      }
      const [cx, cz] = still;
      if (st.phase === 'carriage') {
        // (the city's carriage scene covers the page: one picture a step)
        const file = path.join(dir, `f${String(k).padStart(3, '0')}c.jpg`);
        await P.shot(file);
        frames.push({ file, near: false, phase: st.phase, t: +st.clock.toFixed(2) });
        k++;
        await P.evaluate('(__rides.actors.setSpeed(1), true)');
        await P.sleep(1200);
        continue;
      }
      for (const near of TIGHT ? [true] : [false, true]) {
        // (the game's still camera on the place; the close one follows whoever rides)
        const [tx, tz] = near ? [st.x, st.z] : [cx, cz];
        await P.evaluate(`(__rides.cam(${tx}, ${tz}, { near: ${near}, tight: ${TIGHT} }), true)`);
        await P.evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))))');
        const file = path.join(dir, `f${String(k).padStart(3, '0')}${near ? 'n' : 'g'}.jpg`);
        await P.shot(file);
        frames.push({ file, near, phase: st.phase, t: +st.clock.toFixed(2) });
      }
      k++;
      await P.evaluate('(__rides.actors.setSpeed(1), true)');
      await P.evaluate(`new Promise(r => { const R = __rides, end = R.actors.clock + ${EVERY}; const f = () => R.actors.clock >= end || R.current.phase !== ${JSON.stringify(st.phase)} ? r() : requestAnimationFrame(f); f(); })`);
      if (Date.now() - t0 > 240000 || k > 70) {
        report.errors.push(`${name}: the trip did not end in time`);
        break;
      }
    }
    await P.evaluate('(__rides.actors.setSpeed(1), true)');
    const res = await P.evaluate('__rides.run.then(r => r).catch(e => ({ error: String(e) }))', 120000).catch(e => ({ error: e.message }));
    const audit = await P.evaluate('(() => { const a = __rides.actors.audit(false); return a && { jumps: a.jumps, pops: a.pops, drops: a.drops, slides: a.slides, speedSteps: a.speedSteps, headingSnaps: a.headingSnaps, floating: a.floating, inRoad: a.inRoad, through: a.through, squeezes: a.squeezes, close: a.close, examples: a.examples.slice(0, 12) }; })()');
    report.scenes[name] = { result: res, audit, frames: frames.length };
    console.log(name, JSON.stringify(res), JSON.stringify(audit));
    // the sheet: an HTML page of the frames, in rows (game camera, close camera), shot by the same browser
    const cells = frames.map(f => `<figure class="${f.near ? 'n' : 'g'}"><img src="file://${f.file}"><figcaption>${f.phase} ${f.t.toFixed(1)} s${f.near ? ' · close' : ''}</figcaption></figure>`);
    const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#111;color:#eee;font:12px ui-monospace,Menlo,monospace}
      h1{font-size:14px;margin:8px}.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;padding:4px}figure{margin:0}img{width:100%;display:block}
      figcaption{padding:2px 4px}</style><h1>${name}${BACK ? ' (back)' : ''} · ${JSON.stringify(res).slice(0, 220).replace(/</g, '&lt;')}</h1><div class="grid">${cells.join('')}</div>`;
    const sheet = path.join(OUT, `${name}${BACK ? '-back' : ''}${TIGHT ? '-tight' : ''}.html`);
    writeFileSync(sheet, html);
    writeFileSync(path.join(OUT, `${name}${BACK ? '-back' : ''}${TIGHT ? '-tight' : ''}.json`), JSON.stringify({ name, result: res, frames }, null, 1));
    await P.evaluate('(__rides.rides.cancelAll(), __rides.actors.all().forEach(a => __rides.actors.remove(a.id)), true)');
  }
  report.errors.push(...P.logs.filter(l => /\[(error|exception)\]/.test(l)));
  report.failed = P.failed;
} finally {
  writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  await B.close();
}
console.log('errors:', report.errors.length ? report.errors.join('\n') : 'none');
