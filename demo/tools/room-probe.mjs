#!/usr/bin/env node
// (room-3, a probe) The fight you are jumped in at the market (and beaten: run-styles 4-jumped-lost), played again and
// again in one page, and the room's measure of each printed, with who came onto its ground or stayed at its edge.
//   HK2_DEBUG_PORT=5777 node demo/tools/room-probe.mjs --port 5512 --times 8 [--out file.json] [--kind lost|won]
//     [--strip <dir>]: a picture of each fight every 0.5 s of the stage's clock (the stage paused for each), from its
//     call to its end, with where its ground and its room's edge are on the screen (<dir>/fight-<k>.json); put
//     together by demo/tools/room-strip.py
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launch } from './chrome.mjs';
import { roomCheck } from './room-check.mjs';
import { RUN_CONFIG as cfg, newRun, step, deal } from '../../src/run/index.mjs';

const opt = (n, f) => (process.argv.indexOf(n) === -1 ? f : process.argv[process.argv.indexOf(n) + 1]);
const port = opt('--port', 5512);
const times = Number(opt('--times', 6));
const kind = opt('--kind', 'lost');
const SEED = 3;
const at = (o = {}) => ({ ...newRun({ seed: SEED, cfg }), place: 'market', energy: 5, ...o });
let found = null;
for (let day = 2; day < 40 && !found; day++) {
  for (let hour = 14; hour < 20 && !found; hour++) {
    const s0 = at({ day, hour, hoursThere: 2, energy: 4 });
    const s = { ...s0, carried: s0.carried + 60, books: { ...s0.books, earned: s0.books.earned + 60 } };
    const choice = { do: 'job', id: deal(cfg, s)[0].id };
    const e = step(cfg, s, choice).events.find(x => x.type === 'jumped');
    if (!e?.duel) continue;
    if (kind === 'lost' ? e.duel.result === 'lost' : e.duel.result === 'won' && e.outcome === 'fail') found = { state: s, choice };
  }
}
const browser = await launch({ width: 1600, height: 1000 });
const all = [];
let bad = 0;
try {
  const page = await browser.open(`http://127.0.0.1:${port}/demo/?mode=run&seed=${SEED}&speed=2${opt('--qs', '')}`);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose" && !window.__demo.hud.odds?.pending', 180000);
  for (let k = 1; k <= times; k++) {
    await page.waitFor('window.__demo.hud.phase === "choose" && !window.__demo.hud.duel.active', 180000, 100);
    await page.evaluate(`window.__demo.hud.load(${JSON.stringify(found.state)})`, 60000);
    await page.waitFor('window.__demo.hud.phase === "choose" && !window.__demo.hud.odds?.pending && !window.__demo.hud.duel.active', 120000, 100);
    await page.sleep(1500 + 700 * k);
    const v = await page.evaluate('window.__demo.hud.view');
    const want = v.choices.find(x => x.choice.do === found.choice.do && x.choice.id === found.choice.id);
    await page.evaluate(`window.__demo.hud.pick(${JSON.stringify(want.key)})`);
    await page.sleep(300);
    for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await page.waitFor('window.__demo.hud.duel.active', 90000, 50);
    const strip = opt('--strip', null);
    if (strip) {
      // (a picture every 0.5 s of the stage's clock, paused for each; where the ring is on the screen, from the game's camera)
      mkdirSync(strip, { recursive: true });
      const frames = [];
      const t0 = await page.evaluate('window.__demo.stage.actors.clock');
      for (let n = 0; n < 60; n++) {
        await page.waitFor(`!window.__demo.hud.duel.active || window.__demo.stage.actors.clock >= ${t0 + n * 0.5}`, 30000, 20);
        if (!(await page.evaluate('window.__demo.hud.duel.active'))) break;
        await page.evaluate('window.__demo.stage.setSpeed(0)');
        await page.sleep(120);
        const at = await page.evaluate(`(() => {
          const c = window.__city, T = c.THREE, R = window.__demo.stage.room.state, cam = c.camera, V = new T.Vector3();
          if (!R.c) return null;
          cam.updateMatrixWorld();
          const W = innerWidth, H = innerHeight;
          const ring = rr => Array.from({ length: 48 }, (_, k) => { const a = k / 48 * Math.PI * 2; V.set(R.c[0] + Math.sin(a) * rr, window.__demo.stage.actors.groundAt(R.c[0], R.c[1]) + 0.05, R.c[1] + Math.cos(a) * rr).project(cam); return [Math.round((V.x + 1) / 2 * W), Math.round((1 - V.y) / 2 * H)]; });
          return { t: +(window.__demo.stage.actors.clock - ${t0}).toFixed(2), ground: ring(R.r), edge: ring(R.edge), taken: R.taken };
        })()`);
        const file = path.join(strip, `fight-${k}-${String(n).padStart(2, '0')}.jpg`);
        await page.shot(file);
        frames.push({ file, ...at });
        await page.evaluate('window.__demo.stage.setSpeed(2)');
      }
      writeFileSync(path.join(strip, `fight-${k}.json`), `${JSON.stringify(frames)}\n`);
    }
    await page.waitFor('!window.__demo.hud.duel.active', 120000, 50);
    const D = await page.evaluate('window.__demo.hud.duel');
    const rec = D.log[D.log.length - 1];
    const faults = [];
    roomCheck(`fight ${k}`, rec, w => faults.push(w));
    if (faults.length) bad += 1;
    for (const w of rec?.slow ?? []) faults.push(w);
    console.log(`  fight ${k}: the first blow ${rec?.open ?? '(none)'} s after the call; ${faults.length ? `FAULT ${faults.join('; ')}` : 'clean'}`);
    all.push({ k, faults, open: rec?.open ?? null, room: rec?.anim?.crowd ?? null, stats: await page.evaluate('window.__demo.stage.room.state.stats') });
    await page.waitFor('["choose", "report", "held"].includes(window.__demo.hud.phase)', 60000, 100);
    if ((await page.evaluate('window.__demo.hud.phase')) !== 'choose') {
      for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
      await page.sleep(1500);
    }
  }
  const errs = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || l.includes('[room]'));
  if (errs.length) console.log(`page said: ${[...new Set(errs)].slice(0, 5).join(' | ').slice(0, 1500)}`);
} finally {
  if (opt('--out', null)) writeFileSync(opt('--out'), `${JSON.stringify(all, null, 1)}\n`);
  await browser.close();
}
console.log(`probe: ${bad} of ${all.length} fights over the room's limits`);
