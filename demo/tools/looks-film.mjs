#!/usr/bin/env node
// THE DRUG LOOKS, FILMED AS THE PLAYER SEES THEM (looks-1): the looks page (demo/?mode=looks, demo/looks/lab.js) at the
// game's own speed, every picture it presents saved with the time it was shown (Chrome's own screencast, as
// demo/tools/fight-film.mjs), from the game's camera or a low view, by day or by night; and THE FRAME MEASURE: every
// frame the page drew while the look was on, and the frames around its start and its end. demo/tools/fight-film.py
// makes the clip and the strip.
// The server must be running: node demo/serve.mjs --port 5515 --quiet
//
//   HK2_DEBUG_PORT=5779 node demo/tools/looks-film.mjs --port 5515 --out <dir> --look zonk [--look disco …]
//          [--hour 22|13] [--view low] [--zone market|projects] [--dry]   (--dry: no pictures, the measure only)
//          [--still t1,t2,…]  stills at those seconds of the timeline instead of a film
//          [--qs '&chunky=1' --tag chunky]   more of the page's switches, and a word for the film's name
// Writes <out>/<look>-<night|day>[-low]/f-*.jpg and film.json ({ frames, heads, marks, pageFrames, stats }), and prints
// the frame measure: the longest frame, the frames over 33 ms, and the extra drawings the looks made.
// (pot-3) AND EVERY FRAME'S BODIES MEASURED AS THE CITY DRAWS THEM: every pose handed to the walkers' shader while the
// film ran (demo/fight/puppet/reach.js LOG: the legs solved from their ankle targets, the cloth, the seat), and any part
// of a body further than 1.5 m from its hips is a `stretch` (the streak across the picture). The tool FAILS (exit 1,
// `looks-fail: …` last) on any stretch, any frame over 33 ms with the look on or ending, or any page error; else
// `looks-ok` last. Every look: `--look all`.
import path from 'node:path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { LOOKS } from '../stage/looks/index.js';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const at = args.indexOf(name);
  return at === -1 ? fallback : args[at + 1];
};
const all = name => args.flatMap((a, k) => (a === name ? [args[k + 1]] : []));
const port = opt('--port', 5515);
const out = path.resolve(opt('--out', 'demo/shots/looks-film'));
const DRY = args.includes('--dry');
const hour = Number(opt('--hour', 22));
const low = opt('--view', '') === 'low';
const zone = opt('--zone', 'market');
const STILL = opt('--still', null)?.split(',').map(Number) ?? null;
const W = Number(opt('--width', 1280));
const H = Number(opt('--height', 800));
/** `--qs '&chunky=1'`: more of the looks page's own switches (its name gets `--tag`) */
const QS = opt('--qs', '');
const TAG = opt('--tag', '');
const looks = all('--look');
if (!looks.length) looks.push('zonk');
if (looks.includes('all')) looks.splice(0, looks.length, 'zonk', 'disco', 'lowres', 'pukes', 'cooked');
const faults = [];
const debugPort = Number(process.env.HK2_DEBUG_PORT) || 5779;

const browser = await launch({ debugPort, width: W, height: H });
const results = [];
try {
  for (const look of looks) {
    const name = `${look}${TAG ? `-${TAG}` : ''}-${hour >= 19 || hour < 6 ? 'night' : 'day'}${low ? '-low' : ''}${zone !== 'market' ? `-${zone}` : ''}`;
    const dir = path.join(out, name);
    if (existsSync(dir)) rmSync(dir, { recursive: true });
    mkdirSync(dir, { recursive: true });
    const url = `http://127.0.0.1:${port}/demo/?mode=looks&zone=${zone}&look=${look}&hour=${hour}${low ? '&view=low' : ''}&auto=0&plain=1${QS}`;
    const page = await browser.open(url);
    const ev = expr => page.evaluate(expr);
    await page.waitFor('window.__demo && window.__demo.hud && window.__looksLab', 240000);
    // (the zone settles: blocks, walkers about)
    await page.sleep(4000);
    const frames = [];
    const heads = [];
    let n = 0;
    // THE SCREENCAST, on a second DevTools socket of the same tab
    const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r => r.json());
    const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error('film: no second DevTools socket'));
    });
    let nid = 0;
    const cast = (method, params = {}) => ws.send(JSON.stringify({ id: ++nid, method, params }));
    ws.onmessage = event => {
      const msg = JSON.parse(event.data);
      if (msg.method !== 'Page.screencastFrame') return;
      cast('Page.screencastFrameAck', { sessionId: msg.params.sessionId });
      if (STILL) return;
      const file = `f-${String(n).padStart(5, '0')}.jpg`;
      n += 1;
      if (!DRY) writeFileSync(path.join(dir, file), Buffer.from(msg.params.data, 'base64'));
      frames.push({ file, t: msg.params.metadata.timestamp });
    };
    // the drawings a frame, before any look (the city's own count: every pass, reset once a frame)
    const calls0 = await ev('(async () => { const out = []; for (let k = 0; k < 20; k++) { await new Promise(r => requestAnimationFrame(r)); out.push(window.__city.info.render.calls); } return out; })()');
    // (the stretch measure's count before the film: every pose the page hands the shader from here on is in it)
    const reach0 = await ev(`import('/demo/fight/puppet/reach.js').then(m => ({ poses: m.LOG.poses, bad: m.LOG.bad }))`);
    await ev('window.__demo.hud.run(window.__looksLab.look); window.__looksLab.frames.length = 0; true');
    if (!STILL) cast('Page.startScreencast', { format: 'jpeg', quality: 86, everyNthFrame: 1 });
    const t0 = Date.now();
    const calls = [];
    let stills = STILL ? [...STILL] : [];
    while (Date.now() - t0 < 90000) {
      const s = await ev(`(() => { const L = window.__looksLab; const S = window.__demo.stage; const h = S.screenOf ? S.screenOf(L.who) : null;
        return { phase: L.phase, t: L.marks.length ? +(window.__demo.stage.actors.clock).toFixed(2) : 0, marks: L.marks, h, calls: window.__city.info.render.calls, stats: S.looks.stats() }; })()`);
      if (s.h) heads.push({ at: Date.now() / 1000, you: { x: s.h.x, y: s.h.y }, st: { phase: s.phase } });
      calls.push([s.phase, s.calls, s.stats.bits.drawings]);
      if (STILL && stills.length) {
        const tl = await ev(`(() => { const L = window.__looksLab; const m = L.marks.find(x => x[1] === 'start'); return m ? (performance.timeOrigin + performance.now() - m[2]) / 1000 : 0; })()`);
        if (tl >= stills[0]) {
          await page.shot(path.join(dir, `still-${String(stills[0]).replace('.', '_')}.jpg`));
          stills.shift();
        }
      }
      if (s.phase === 'done') break;
      await page.sleep(STILL ? 60 : 120);
    }
    if (!STILL) cast('Page.stopScreencast');
    await page.sleep(300);
    const lab = await ev(`(() => { const L = window.__looksLab; return { marks: L.marks, frames: L.frames.slice(), slow: L.slow ?? [], crowd: L.crowd ?? null, stats: window.__demo.stage.looks.stats() }; })()`);
    const reach1 = await ev(`import('/demo/fight/puppet/reach.js').then(m => ({ poses: m.LOG.poses, bad: m.LOG.bad, worst: m.LOG.worst, last: m.LOG.last.slice(-4) }))`);
    const stretch = { poses: reach1.poses - reach0.poses, bad: reach1.bad - reach0.bad, last: reach1.bad > reach0.bad ? reach1.last : [] };
    ws.close();
    // THE FRAME MEASURE
    const pf = lab.frames.slice(2);
    const over = pf.filter(f => f > 33.4);
    const max = Math.max(...pf);
    const sorted = pf.slice().sort((a, b) => a - b);
    const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;
    // (the drawings a frame: with the camera on them before the look, and while it is on; the looks' own meshes)
    const before = calls.filter(c => c[0] === 'wait').map(c => c[1]);
    const onCalls = calls.filter(c => c[0] === 'on').map(c => c[1]);
    const med = a => (a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : 0);
    const extra = onCalls.length && before.length ? med(onCalls) - med(before) : null;
    const bitsDraw = Math.max(0, ...calls.map(c => c[2]));
    const film = { name, look, hour, low, zone, frames, heads, marks: lab.marks, pageFrames: lab.frames, slow: lab.slow, crowd: lab.crowd, calls0, calls, stats: lab.stats, measure: { frames: pf.length, max, p99, over: over.length } };
    writeFileSync(path.join(dir, 'film.json'), `${JSON.stringify(film)}\n`);
    const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[looks\]/.test(l));
    // (the frames over 33 ms while the look was on or ending, apart from any before it: the camera's cut to them)
    const during = (lab.slow ?? []).filter(x => x[2] !== 'wait');
    film.measure.overOn = during.length;
    film.measure.maxOn = during.length ? Math.max(...during.map(x => x[1])) : null;
    film.measure.stretch = stretch.bad;
    film.measure.poses = stretch.poses;
    film.stretch = stretch;
    writeFileSync(path.join(dir, 'film.json'), `${JSON.stringify(film)}\n`);
    if (stretch.bad) faults.push(`${name}: stretch ${stretch.bad} of ${stretch.poses} poses (${JSON.stringify(stretch.last)})`);
    if (during.length) faults.push(`${name}: ${during.length} frames over 33 ms with the look on or ending (${JSON.stringify(during.slice(0, 4))})`);
    // (a look with a body of its own hands a pose over every frame; the tape has none: the walker's own walk)
    if (!stretch.poses && LOOKS[look]?.move) faults.push(`${name}: no pose was measured (the measure did not run)`);
    const line = `${name}: ${frames.length} pictures; page frames ${pf.length}, longest ${max.toFixed(1)} ms, 99th ${p99.toFixed(1)} ms, over 33 ms: ${over.length} (with the look on or ending: ${during.length}); bodies measured ${stretch.poses} poses, stretch ${stretch.bad}; drawings a frame (the city's count, every pass) before ${med(before)}, with the look on ${med(onCalls)} (${extra === null ? '?' : (extra >= 0 ? '+' : '') + extra}); the looks' own meshes at most ${bitsDraw}; crowd ${lab.crowd ? lab.crowd.length : '-'}; marks ${JSON.stringify(lab.marks.map(m => [m[0], m[1]]))}`;
    console.log(line);
    if (lab.slow.length) console.log(`  slow frames [s into the timeline, ms, phase]: ${JSON.stringify(lab.slow)}`);
    if (bad.length) console.log(`  page said: ${[...new Set(bad)].slice(0, 6).join(' | ').slice(0, 900)}`);
    const errs = bad.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
    if (errs.length) faults.push(`${name}: ${errs.length} page errors (${errs[0].slice(0, 200)})`);
    results.push({ name, max, over: over.length, overOn: during.length, p99, extra, bitsDraw, stretch: stretch.bad, poses: stretch.poses });
    page.close();
  }
} catch (err) {
  faults.push(String(err?.stack ?? err));
} finally {
  await browser.close();
}
writeFileSync(path.join(out, 'measure.json'), `${JSON.stringify(results, null, 1)}\n`);
for (const f of faults) console.log(`  FAULT: ${f}`);
console.log(faults.length ? `looks-fail: ${faults[0].split('\n')[0]}` : `looks-ok: ${results.length} films, stretch 0, no frame over 33 ms with a look on`);
process.exitCode = faults.length ? 1 : 0;
