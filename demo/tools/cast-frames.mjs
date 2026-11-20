#!/usr/bin/env node
// THE NAMED CAST'S FIRST FRAMES ON SCREEN (named-1, item 4): does dressing the named people cost a frame? Their looks are
// baked when the stage begins (actors.add, and the cart man's push hold: props/along.js attach), never while anything
// plays. This loads THE RUN, then goes to each place with named people (the trailer park, the Jay St night market, Low
// Tide Docks, Glasswall Plaza: hud.load of a state there, as the other tools do) and measures:
//   begin      every look baked when the stage began (count, ms in all, the longest), as the page timed them
//   during     every look baked or added after it (count, ms): it must be none
//   first      for each named person, the frame they are first drawn on screen, and the longest frame within two
//              frames of it (ms, the page's own frame interval), with whatever else was happening (a zone being built)
// Prints a row a person, the frames over 33 ms round a first appearance (an arrival builds the place's zone under them:
// run it again with --qs '&named=0', the same people undressed, to see which are the dressing's), and `frames-ok` or
// `frames-fail: <why>` (a look baked or added during play).
//   node demo/tools/cast-frames.mjs [--port 5470] [--json <file>]
import { writeFileSync, appendFileSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { RUN_CONFIG as cfg, newRun, step } from '../../src/run/index.mjs';

const opt = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
};
const port = Number(opt('--port', 5470));
/** `--qs <&a=b…>`: more of the page's query (`&named=0`: the people as they were before they were drawn, to compare). */
const QS = opt('--qs', '');
const LIMIT = 33;

// the states: the trailer park, then by subway each other place
let s0 = newRun({ seed: 3, cfg });
s0 = step(cfg, s0, { do: 'out', take: 0 }).state;
s0 = { ...s0, hour: 13, carried: s0.carried + 60, books: { ...s0.books, earned: s0.books.earned + 60 } };
const PLACES = { park: s0, ...Object.fromEntries(['market', 'docks', 'plaza'].map(to => [to, step(cfg, s0, { do: 'subway', to, hop: false }).state])) };

// before the page's own scripts: every frame's interval kept
const PRE = `(() => { const F = window.__frames = []; let last = 0; const raf = window.requestAnimationFrame.bind(window);
  const tick = t => { if (last) F.push([t, t - last]); last = t; raf(tick); }; raf(tick); })();`;

const browser = await launch({ width: 1600, height: 1000 });
if (process.env.HK2_PIDS) appendFileSync(process.env.HK2_PIDS, `${browser.pid}\n`);
let failed = [];
const slow = [];
const out = { begin: null, during: null, first: [] };
try {
  // (the bake is timed from its first call: the page's own LOOKS.bake, wrapped before the stage begins, through the
  // walker batches' addLook that every bake of ours goes into)
  const page = await browser.open('about:blank');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: PRE });
  await page.send('Page.navigate', { url: `http://127.0.0.1:${port}/demo/?mode=run&seed=3&speed=1${QS}` });
  const ev = (js, ms) => page.evaluate(js, ms);
  // the batches' addLook wrapped as soon as the city is up (before the stage adds anybody)
  await page.waitFor('window.__city && window.__city.peds && window.__city.peds.ready', 180000, 20);
  await ev(`(() => { const P = window.__city.peds, f = P.addLook.bind(P); window.__adds = []; P.addLook = l => { const t0 = performance.now(); const r = f(l); window.__adds.push([t0, performance.now() - t0]); return r; }; })()`);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 180000);
  await page.sleep(1500);
  const t0 = await ev('performance.now()');
  const begin = await ev(`JSON.stringify(window.__adds.length)`);
  out.begin = { looks: JSON.parse(begin) };
  // each named person's first frame drawn, from now on
  await ev(`(() => { const A = window.__demo.stage.actors; window.__firsts = {}; A.onFrame(() => { const now = performance.now();
    for (const B of A.all()) if ((B.named || B.spec?.named) && !(B.id in window.__firsts) && !B.w.hide && A.screenOf(B.id).visible) window.__firsts[B.id] = { at: now, name: B.name, size: B.size, zone: !!window.__demo.stage.loader?.busy }; }); })()`);
  for (const [place, state] of Object.entries(PLACES)) {
    if (place !== 'park' && !(await ev(`window.__demo.hud.load(${JSON.stringify(state)})`, 60000))) throw new Error(`the page would not load ${place}`);
    await page.waitFor('window.__demo.hud.phase === "choose"', 120000);
    await page.sleep(7000);
  }
  const R = JSON.parse(await ev(`JSON.stringify({ adds: window.__adds.filter(a => a[0] > ${t0}), frames: window.__frames, firsts: window.__firsts })`));
  out.during = { looks: R.adds.length, ms: +R.adds.reduce((s, a) => s + a[1], 0).toFixed(1) };
  if (R.adds.length) failed.push(`${R.adds.length} look(s) added during play (${out.during.ms} ms)`);
  for (const [id, f] of Object.entries(R.firsts)) {
    const near = R.frames.filter(([t]) => t >= f.at - 40 && t <= f.at + 40);
    const worst = near.reduce((m, [, d]) => Math.max(m, d), 0);
    out.first.push({ id, name: f.name, size: f.size, worst: +worst.toFixed(1) });
    console.log(`${f.name.padEnd(28)} ${String(f.size).padEnd(5)} first drawn; the longest frame round it ${worst.toFixed(1)} ms`);
    if (worst > LIMIT) slow.push(`${f.name} ${worst.toFixed(1)} ms`);
  }
  if (slow.length) console.log(`frames over ${LIMIT} ms round a first appearance (the place's own arrival is in them: compare --qs '&named=0'): ${slow.join(', ')}`);
  console.log(`begin: ${out.begin.looks} looks added before play; during play: ${out.during.looks} (${out.during.ms} ms); ${out.first.length} named people drawn`);
} catch (err) {
  failed.push(String(err?.message ?? err));
} finally {
  await browser.close();
}
if (opt('--json', null)) writeFileSync(opt('--json'), JSON.stringify(out, null, 1));
console.log(failed.length ? `frames-fail: ${failed.slice(0, 6).join(' · ')}` : 'frames-ok');
process.exit(failed.length ? 1 : 0);
