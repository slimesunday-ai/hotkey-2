#!/usr/bin/env node
// THE NEW AND REWORKED PIECES IN THE TRAILER (assets-1), on the run's own page: the run at the crib owning the pieces asked for,
// each taken out of the tray and put down in the trailer (set/arrange.js, the kit's own footprints and rules), one of them with a
// REAL mouse (its chip in the tray pressed, then a lit spot pressed: Input.dispatchMouseEvent, as a person's), then the inside view
// at the game's own camera and one wheel step nearer (a real wheel event). Optionally the Library opened on a piece. The server
// must be running.
//
//   node demo/tools/run-assets-shots.mjs --out <dir> --home kit:a@x:z,kit:b [--mouse kit:c@x:z] [--prefix after-] [--port 5470]
//        [--seed 3] [--size 1600x1000] [--library <name words>]
//
//   @x:z         the piece goes on the lit spot nearest this cell (0.25 m cells of the room; without it: the room's middle);
//                in the order given, so a desk listed before the PC is there for the PC to stand on
//   --library <category>[:kit:<id>]   after the pictures: the Library opened on that category of home pieces (the page's own
//                handles), the piece named pinned on its card, pictured (<prefix>library.jpg)
// Pictures: <prefix>inside.jpg (the game's camera), <prefix>inside-wheel.jpg (one wheel step nearer), <prefix>held.jpg (the mouse
// piece held over its lit spots). Exit 1 on any failure.
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-assets'));
const port = opt('--port', 5470);
const [W, H] = opt('--size', '1600x1000').split('x').map(Number);
const parse = s => { const [k, at] = s.split('@'); return { k, near: at ? at.split(':').map(Number) : null }; };
const HOME = opt('--home', '').split(',').filter(Boolean).map(parse);
const MOUSE = opt('--mouse', null) ? parse(opt('--mouse')) : null;
const PREFIX = opt('--prefix', '');
const LIB = opt('--library', null);
const KEY = 'pad:a1';
mkdirSync(out, { recursive: true });
const url = `http://127.0.0.1:${port}/demo/?mode=run&seed=${opt('--seed', '3')}`;

const browser = await launch({ width: W, height: H });
let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failed += 1;
};
try {
  const page = await browser.open(url);
  const ev = (js, ms = 120000) => page.evaluate(js, ms);
  const A = `window.__demo.stage.inside.place(${JSON.stringify(KEY)}).arrange`;
  const saved = async name => console.log(`saved ${await page.shot(path.join(out, `${PREFIX}${name}.jpg`))}`);
  let at = [W / 2, H / 2];
  async function moveTo(x, y, steps = 8) {
    for (let k = 1; k <= steps; k++) await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at[0] + ((x - at[0]) * k) / steps, y: at[1] + ((y - at[1]) * k) / steps });
    at = [x, y];
    await page.sleep(150);
  }
  async function click(x, y) {
    await moveTo(x, y);
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await page.sleep(70);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    await page.sleep(400);
  }
  await page.waitFor(`window.__demo?.hud?.phase === 'choose' && window.__demo.hud.state.place === 'crib' && window.__demo.stage.inside.up === ${JSON.stringify(KEY)}`, 240000, 200);
  await page.waitFor(`!!${A}`, 60000, 200);
  await ev(`${A}.ready()`);
  const all = [...HOME, ...(MOUSE ? [MOUSE] : [])].map(p => p.k);
  const lib = await ev(`(async () => { const L = await import('/src/run/library.mjs'); const { RUN_CONFIG } = await import('/src/run/config.mjs'); const l = L.libraryOf(RUN_CONFIG); return ${JSON.stringify(all)}.map(k => [k, !!l.byKey.get(k)]); })()`);
  for (const [k, ok] of lib) check(ok, `${k} is a piece the run sells`);
  const things = Object.fromEntries(all.map(k => [k, true]));
  check(await ev(`(async () => { const h = window.__demo.hud; const s = structuredClone(h.state); s.things = { ...s.things, ...${JSON.stringify(things)} }; return await h.load(s); })()`), 'the run loaded owning them');
  await page.waitFor(`${A}.tray().length >= ${all.length}`, 60000, 200);
  await page.sleep(2000);
  // the spot nearest the cell asked for (or the room's middle), among the lit ones
  const nearest = async NEAR => {
    const d = await ev(`${A}.debug()`);
    if (!d?.spots?.length) return null;
    const xs = d.spots.map(q => q.P.x), zs = d.spots.map(q => q.P.z);
    const [tx, tz] = NEAR ?? [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
    const xr = [Math.min(...xs), Math.max(...xs)], zr = [Math.min(...zs), Math.max(...zs)];
    const q = d.spots.slice().sort((a, b) => Math.hypot(a.P.x - tx, a.P.z - tz) - Math.hypot(b.P.x - tx, b.P.z - tz))[0];
    console.log(`  ${d.spots.length} lit spots, x ${xr.join('..')}, z ${zr.join('..')}; nearest to ${tx},${tz}: ${q.P.x},${q.P.z}`);
    return q;
  };
  // arrange mode, by its key (V), as a person enters it: the tray's chips are up
  await moveTo(W / 2, H / 2);
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86, text: 'v' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86 });
  await page.sleep(800);
  check(await ev(`${A}.active`), 'V: arrange mode is up');
  for (const { k, near } of HOME) {
    const t = await ev(`${A}.takeOut(${JSON.stringify(`L:${k}`)})`);
    if (!t?.ok) { check(false, `${k} out of the tray (${t?.why})`); continue; }
    const q = await nearest(near);
    if (q) await ev(`${A}.aimAt(${q.screen[0]}, ${q.screen[1]})`);
    const r = await ev(`(async () => { const h = ${A}.held; const d = await ${A}.drop(); return { ok: d.ok, why: d.why, spots: h?.spots, at: h?.at }; })()`, 300000);
    check(r.ok, `${k} put down (${r.ok ? `${r.spots} spots; at ${JSON.stringify(r.at)}` : r.why})`);
  }
  if (MOUSE) {
    // THE REAL MOUSE: its chip in the tray, pressed; then the lit spot, pressed
    await page.sleep(600);
    const M = MOUSE.k;
    const chip = await ev(`(el => el && (r => [r.left + r.width / 2, r.top + r.height / 2])(el.getBoundingClientRect()))(document.querySelector(${JSON.stringify(`.rn-ar-chip[data-key="L:${M}"]`)}))`);
    check(!!chip, `${M}: its chip is in the tray (${JSON.stringify(chip)})`);
    if (chip) {
      await click(chip[0], chip[1]);
      const held = await ev(`${A}.held`);
      check(held?.key === `L:${M}` && held.from === 'tray', `a press on the chip takes ${M} out (${held?.spots} spots lit)`);
      const q = await nearest(MOUSE.near);
      if (q) {
        await moveTo(q.screen[0], q.screen[1], 12);
        await page.sleep(500);
        await saved('held');
        const aimed = await ev(`${A}.held`);
        await click(q.screen[0], q.screen[1]);
        const placed = (await ev(`${A}.debug()`))?.pieces.find(p => p.key === `L:${M}`);
        check(!(await ev(`${A}.held`)) && !!placed, `a press on a lit spot puts it down: cells ${placed?.x},${placed?.z} (aimed at ${JSON.stringify(aimed?.at)})`);
      } else check(false, `${M}: no lit spot`);
    }
  }
  // done (Esc), as a person leaves it
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await page.sleep(600);
  if (await ev(`${A}.active`)) await ev(`${A}.leave()`);
  await page.sleep(3000);
  const dbg = await ev(`${A}.debug()`);
  for (const k of all) check(dbg?.pieces.some(p => p.key === `L:${k}`), `${k} stands in the room (${JSON.stringify(dbg?.pieces.find(p => p.key === `L:${k}`) ?? null)})`);
  await moveTo(W - 40, 60, 4);
  await page.sleep(800);
  await saved('inside');
  // ONE WHEEL STEP NEARER: a real wheel event over the room's middle
  await moveTo(W / 2, H * 0.45, 4);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: W / 2, y: H * 0.45, deltaX: 0, deltaY: -100 });
  await page.sleep(1800);
  console.log(`zoom ${JSON.stringify(await ev('window.__demo.stage.inside.debug().zoom ?? null'))}`);
  await saved('inside-wheel');
  writeFileSync(path.join(out, `${PREFIX}pieces.json`), JSON.stringify(dbg?.pieces ?? [], null, 1));
  if (LIB) {
    // THE LIBRARY, by the page's own handles (as run-library-ui-shots.mjs opens it): the home pieces of one category, one pinned
    const [cat, pinKey] = LIB.split(':kit:');
    const hud = 'window.__demo.hud';
    await ev(`${hud}.library.set({ kind: 'home', cat: ${JSON.stringify(cat)}, tier: 'all', show: 'all', sort: 'price' })`);
    await ev(`(() => { const s = document.querySelector('.rn-sheet'); if (!s || s.hidden || s.dataset.sheet !== 'library') ${hud}.panel('library'); return true; })()`);
    await page.sleep(2500);
    const shown = await ev(`${hud}.library.shown`);
    const fresh = all.filter(k => shown.includes(k));
    check(shown.length > 0, `the Library shows ${shown.length} home pieces in ${cat}, ${fresh.length} of them the ones placed here`);
    if (pinKey) { const ok = await ev(`(() => { const k = ${JSON.stringify('kit:' + pinKey)}; if (!${hud}.library.shown.includes(k)) return false; ${hud}.library.pin(k); return ${hud}.library.onCard === k; })()`); check(ok, `kit:${pinKey} on the Library's card`); }
    await page.sleep(4000);
    await saved('library');
    console.log(`library keys: ${shown.slice(0, 60).join(' ')}`);
  }
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[arrange\]|\[crib\]|\[run\]/.test(l));
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
