#!/usr/bin/env node
// THE GUARD DOG ON THE RUN'S STAGE (assets-1): the older game's chain dog (demo/stage/props/dog.js) stood by his bed in the trailer
// (the kit's dog bed, owned and put down: set/crib.js stands him there) and out in the yard by the stoop, in each pose asked for. A
// pose to show: no rule. The server must be running.
//
//   node demo/tools/run-dog-shots.mjs --out <dir> [--port 5470] [--seed 3] [--modes sit,lie,sleep,bark] [--size 1600x1000]
//
// Pictures: dog-room-<mode>.jpg (the inside view, the camera brought near him), dog-room-wide.jpg (the game's own camera),
// dog-yard-<mode>.jpg (out by the stoop, the city round him). Exit 1 on any failure.
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-dog'));
const port = opt('--port', 5470);
const [W, H] = opt('--size', '1600x1000').split('x').map(Number);
const MODES = opt('--modes', 'sit,lie,sleep,bark').split(',');
const KEY = 'pad:a1';
mkdirSync(out, { recursive: true });
const url = `http://127.0.0.1:${port}/demo/?mode=run&seed=${opt('--seed', '3')}`;

const browser = await launch({ width: W, height: H });
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed += 1; };
try {
  const page = await browser.open(url);
  const ev = (js, ms = 120000) => page.evaluate(js, ms);
  const PL = `window.__demo.stage.inside.place(${JSON.stringify(KEY)})`;
  const A = `${PL}.arrange`;
  const saved = async name => console.log(`saved ${await page.shot(path.join(out, `${name}.jpg`))}`);
  await page.waitFor(`window.__demo?.hud?.phase === 'choose' && window.__demo.hud.state.place === 'crib' && window.__demo.stage.inside.up === ${JSON.stringify(KEY)}`, 240000, 200);
  await page.waitFor(`!!${A}`, 60000, 200);
  await ev(`${A}.ready()`);
  // the dog bed, owned and put down by the room's front (the API's own take-out and drop: the kit's rules)
  check(await ev(`(async () => { const h = window.__demo.hud; const s = structuredClone(h.state); s.things = { ...s.things, 'kit:dog-bed': true }; return await h.load(s); })()`), 'the run owns the dog bed');
  await page.waitFor(`${A}.tray().some(t => t.key === 'L:kit:dog-bed')`, 60000, 200);
  await ev(`${A}.enter()`);
  const t = await ev(`${A}.takeOut('L:kit:dog-bed')`);
  check(t?.ok, `the dog bed out of the tray (${t?.why ?? ''})`);
  const spots = (await ev(`${A}.debug()`)).spots;
  const q = spots.slice().sort((a, b) => Math.hypot(a.P.x - 17, a.P.z - 7) - Math.hypot(b.P.x - 17, b.P.z - 7))[0];
  await ev(`${A}.aimAt(${q.screen[0]}, ${q.screen[1]})`);
  const d = await ev(`${A}.drop()`);
  check(d?.ok, `the dog bed put down at cells ${q.P.x},${q.P.z} (${d?.why ?? 'ok'})`);
  await ev(`${A}.leave()`);
  await page.waitFor(`!!${PL}.dogNow()`, 60000, 300).catch(() => null);
  const now = await ev(`${PL}.dogNow()`);
  check(!!now && now.mode === 'sit' && !now.yard, `the room with a dog bed has its dog, sitting by it (${JSON.stringify(now)})`);
  await ev('window.__demo.stage.setSpeed(0)');
  await page.sleep(1500);
  await saved('dog-room-wide');
  const lookAt = (p, tgt, fov) => ev(`(() => { const c = window.__city; c.camera.position.set(${p}); c.controls.target.set(${tgt}); c.camera.fov = ${fov}; c.camera.updateProjectionMatrix(); c.controls.update(); })()`);
  for (const m of MODES) {
    const got = await ev(`${PL}.dog(${JSON.stringify(m)}, { settle: true })`);
    check(got === m, `in the room: ${m}`);
    const { at, ry } = await ev(`${PL}.dogNow()`);
    // (in front of him, a little to his left, looking down at him as the game's camera does)
    const fx = Math.sin(ry), fz = Math.cos(ry);
    await lookAt([at[0] + fx * 2.6 + fz * 1.0, at[1] + 2.2, at[2] + fz * 2.6 - fx * 1.0], [at[0], at[1] + 0.3, at[2]], 32);
    await page.sleep(m === 'bark' ? 300 : 900);
    await saved(`dog-room-${m}`);
  }
  // THE YARD: out by the stoop with his own bed, the city drawn round him (the camera's layers all on for the picture)
  for (const m of MODES) {
    const got = await ev(`${PL}.dog(${JSON.stringify(m)}, { yard: true, settle: true })`);
    const now2 = await ev(`${PL}.dogNow()`);
    check(got === m && now2?.yard, `in the yard: ${m} at ${JSON.stringify(now2?.at?.map(v => +v.toFixed(2)))}`);
    const { at, ry } = now2, fx = Math.sin(ry), fz = Math.cos(ry);
    await ev('window.__city.camera.layers.enableAll()');
    // (the trailer behind him: the camera out on the lot, in front of him and to his left)
    await lookAt([at[0] + fx * 3.4 + fz * 1.6, at[1] + 1.9, at[2] + fz * 3.4 - fx * 1.6], [at[0] - fx * 0.6, at[1] + 0.6, at[2] - fz * 0.6], 38);
    await page.sleep(m === 'bark' ? 300 : 900);
    await saved(`dog-yard-${m}`);
  }
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[crib\]|\[arrange\]/.test(l));
  console.log(`page errors ${bad.length}${bad.length ? `\n  ${[...new Set(bad)].slice(0, 8).join('\n  ')}` : ''}`);
  if (bad.length) failed += 1;
} catch (err) {
  console.error(String(err?.stack ?? err));
  failed += 1;
} finally {
  await browser.close();
}
console.log(failed ? `${failed} FAILED` : 'all ok');
process.exit(failed ? 1 : 0);
