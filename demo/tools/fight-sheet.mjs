#!/usr/bin/env node
// A STAGED FIGHT, LOOKED AT MOMENT BY MOMENT (anim-1). A fight the page plays is a score written before its first frame
// (demo/fight/puppet/choreo.js), so any moment of it can be put on the stage's own people and held: this tool does
// that for a row of moments and saves each twice, from the game's own camera (does it read from there?) and from a
// close view of the tool's (is it right?). For making and judging a move: a blow frame by frame at a sixtieth of a
// second if need be. The clips at the game's own speed are fight-film.mjs's.
// The server must be running: node demo/serve.mjs --port 5493 --quiet
//
//   HK2_DEBUG_PORT=5746 node demo/tools/fight-sheet.mjs --port 5493 --out <dir> --name <sheet>
//        [--you hands] [--foe brawler] [--seed 7] [--jump] [--from -1] [--to 3] [--every 0.05] [--views game,close]
//        [--place park] [--at "t1,t2,…"]
//
// Writes <dir>/<name>/<view>-<k>.jpg and <dir>/<name>/sheet.json (the moments, the box round the fight on each
// picture, the fight's beats), for demo/tools/fight-sheet.py, which lays out the sheets.
import path from 'node:path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { duelInputs, jumpInputs } from './fight-score.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const at = args.indexOf(name);
  return at === -1 ? fallback : args[at + 1];
};
const out = path.resolve(opt('--out', 'demo/shots/fight-sheet'));
const name = opt('--name', 'sheet');
const port = opt('--port', 5493);
const seed = Number(opt('--seed', '7'));
const jump = args.includes('--jump');
const inputs = jump ? jumpInputs(opt('--you', 'hands')) : duelInputs(opt('--you', 'hands'), opt('--foe', 'brawler'));
const views = opt('--views', 'game,close').split(',');
const every = Number(opt('--every', '0.05'));
const dir = path.join(out, name);
if (existsSync(dir)) rmSync(dir, { recursive: true });
mkdirSync(dir, { recursive: true });

const browser = await launch({ width: 1600, height: 1000 });
let failed = null;
try {
  const page = await browser.open(`http://127.0.0.1:${port}/demo/?mode=run&seed=3`);
  const ev = (js, ms = 60000) => page.evaluate(js, ms);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 180000);
  await page.sleep(1200);
  await ev(`(async () => { const h = window.__demo.hud, s = structuredClone(h.state); Object.assign(s, { place: ${JSON.stringify(opt('--place', 'park'))}, hour: 12, hoursThere: 0 }); await h.load(s); })()`);
  await page.waitFor('window.__demo.hud.phase === "choose"', 120000);
  await page.sleep(3500);
  const cast = await ev(`(async () => {
    const { createStudio } = await import(new URL('fight/puppet/studio.js', new URL('./', location.href)).href);
    const { scriptOf, stageFight } = await import(new URL('fight/puppet/choreo.js', new URL('./', location.href)).href);
    const st = window.__demo.stage, city = window.__city;
    const S = (window.__studio = await createStudio({ stage: st, city }));
    const c = S.cast(${jump ? 3 : 2});
    st.setSpeed(0);
    S.view('game');
    await new Promise(r => setTimeout(r, 600));
    // the way to the camera from the mark, along the ground
    const cam = city.camera.position, d = [cam.x - c.at[0], cam.z - c.at[1]], l = Math.hypot(d[0], d[1]) || 1;
    const script = scriptOf(${JSON.stringify(inputs)}, ${seed});
    const AC = st.actors;
    const who = {};
    script.people.forEach((p, k) => { const A = AC.get(c.ids[k]); who[p.id] = { at: [A.x, A.z] }; });
    const fight = stageFight({ script, ground: { c: c.at }, cam: [d[0] / l, d[1] / l], cast: who, seed: ${seed} });
    S.play(fight);
    return { ...c, t0: fight.t0, t1: fight.t1, over: script.over, beats: script.beats.map(b => ({ t: b.t, by: b.by, to: b.to, hit: b.hit, dmg: b.dmg, down: b.down, staged: b.staged ?? null })), cam: [d[0] / l, d[1] / l] };
  })()`);
  console.log(`the cast: ${cast.names.join(', ')} at ${cast.at.map(v => v.toFixed(1)).join(', ')}; the fight ${cast.over.result} in ${cast.over.t} s (${cast.beats.length} blows); the score runs ${cast.t0} to ${cast.t1}`);
  const from = Number(opt('--from', String(cast.t0)));
  const to = Number(opt('--to', String(Math.min(cast.t1, from + 3))));
  const times = opt('--at', null)?.split(',').map(Number) ?? Array.from({ length: Math.floor((to - from) / every + 1e-6) + 1 }, (_, k) => +(from + k * every).toFixed(4));
  // (the clip blends in on the stage's own clock: a moment of it running, then held)
  await ev('window.__demo.stage.setSpeed(1)');
  await ev(`window.__studio.seek(${times[0]})`);
  await page.waitFor('window.__studio.bodies().every(b => b.ready)', 20000, 100);
  await ev('window.__demo.stage.setSpeed(0)');
  const rows = [];
  for (const view of views) {
    await ev(`window.__studio.view(${JSON.stringify(view)})`);
    await page.sleep(view === 'game' ? 900 : 700);
    for (const [k, t] of times.entries()) {
      await ev(`window.__studio.seek(${t})`);
      await ev('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))))');
      const file = path.join(dir, `${view}-${String(k).padStart(3, '0')}.jpg`);
      await page.shot(file);
      const box = await ev(`window.__studio.box(${view === 'game' ? 2.3 : 1.7})`);
      rows.push({ view, k, t, file, box });
    }
  }
  const ready = await ev('window.__studio.bodies().map(b => [b.id, b.name, b.weight])');
  writeFileSync(path.join(dir, 'sheet.json'), `${JSON.stringify({ name, inputs, seed, cast, times, rows, ready })}\n`);
  console.log(`${rows.length} pictures → ${dir} (the bodies' clips: ${JSON.stringify(ready)})`);
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
  if (bad.length) throw new Error(`page errors: ${[...new Set(bad)].slice(0, 4).join(' | ').slice(0, 900)}`);
} catch (err) {
  failed = err;
  console.error(String(err?.stack ?? err));
} finally {
  await browser.close();
  console.log(failed ? `sheet-fail: ${failed.message}` : 'sheet-ok');
  process.exitCode = failed ? 1 : 0;
}
