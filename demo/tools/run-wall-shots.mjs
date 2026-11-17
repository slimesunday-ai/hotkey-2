#!/usr/bin/env node
// WALL PIECES HUNG IN THE TRAILER (lib-1, part D), played on the run's own page with the page's own arrange mode (V)
// and real pointer events: three library wall pieces taken out of the tray and hung (each at the spot asked for,
// pointed at on the screen and clicked), a picture while one is held (its stretches of wall lit), the room after;
// then one more pointed at the door's stretch: refused, the stretch red, the bar saying why, and a click there
// changes nothing. The server must be running.
//
//   node demo/tools/run-wall-shots.mjs --out <dir> [--port 5470] [--seed 3] [--size 1600x1000]
//        [--hang kit:id@W:3,kit:id@N:14,kit:id@E:0] [--refuse kit:id@E:10]
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-walls'));
const port = opt('--port', 5470);
const [W, H] = opt('--size', '1600x1000').split('x').map(Number);
const parse = s => { const [key, at] = s.split('@'); const [side, a] = at.split(':'); return { key, side, a: Number(a) }; };
const HANG = opt('--hang', 'kit:art-graffiti@W:3,kit:frame-gilded-small@N:14,kit:photos-family@E:0').split(',').map(parse);
const REFUSE = parse(opt('--refuse', 'kit:poster@E:10'));
const KEY = 'pad:a1';
mkdirSync(out, { recursive: true });

const browser = await launch({ width: W, height: H });
let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failed += 1;
};
try {
  const page = await browser.open(`http://127.0.0.1:${port}/demo/?mode=run&seed=${opt('--seed', '3')}`);
  const ev = (js, ms = 120000) => page.evaluate(js, ms);
  const A = `window.__demo.stage.inside.place(${JSON.stringify(KEY)}).arrange`;
  const saved = async name => console.log(`saved ${await page.shot(path.join(out, `${name}.jpg`))}`);
  const bar = () => ev(`(el => el ? el.querySelector('.rn-ar-status')?.innerText ?? null : null)(document.querySelector('.rn-arrange'))`);
  let at = [W / 2, H / 2];
  async function moveTo(x, y, steps = 8) {
    for (let k = 1; k <= steps; k++) await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at[0] + ((x - at[0]) * k) / steps, y: at[1] + ((y - at[1]) * k) / steps });
    at = [x, y];
    await page.sleep(150);
  }
  async function click(x, y) {
    await moveTo(x, y);
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await page.sleep(60);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    await page.sleep(500);
  }
  async function key(k, code, vk) {
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, text: k.length === 1 ? k : undefined });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
    await page.sleep(300);
  }
  await page.waitFor(`window.__demo?.hud?.phase === 'choose' && window.__demo.hud.state.place === 'crib' && window.__demo.stage.inside.up === ${JSON.stringify(KEY)}`, 240000, 200);
  await page.waitFor(`!!${A}`, 60000, 200);
  await ev(`${A}.ready()`);
  const keys = [...HANG.map(h => h.key), REFUSE.key];
  check(await ev(`(async () => { const h = window.__demo.hud; const s = structuredClone(h.state); s.things = { ...s.things, ...Object.fromEntries(${JSON.stringify(keys)}.map(k => [k, true])) }; return await h.load(s); })()`), `the run owns ${keys.join(', ')}`);
  await page.waitFor(`${A}.tray().length >= ${keys.length}`, 60000, 200);
  await page.sleep(2000);
  await moveTo(W / 2, H / 2);
  await key('v', 'KeyV', 86);
  check(await ev(`${A}.active`), 'V: arrange mode is up');

  // ── THREE HUNG, each at the spot asked for: taken out of the tray, its spot pointed at, clicked
  for (const [i, h] of HANG.entries()) {
    const r = await ev(`${A}.takeOut(${JSON.stringify(`L:${h.key}`)})`);
    check(r.ok, `${h.key} out of the tray (${r.why ?? `${await ev(`${A}.held.spots`)} spots`})`);
    if (!r.ok) continue;
    await page.sleep(500);
    const dbg = await ev(`${A}.debug()`);
    const sp = dbg.spots.find(s => s.P.wall === h.side && s.P.x === h.a);
    check(!!sp, `${h.key}: ${h.side}:${h.a} is a lit spot (${dbg.spots.filter(s => s.P.wall === h.side).map(s => s.P.x).join(' ')})`);
    if (!sp) {
      await ev(`${A}.cancel()`);
      continue;
    }
    await moveTo(...sp.screen);
    await page.sleep(400);
    check(!(await ev(`${A}.held.refused`)), `${h.key}: aimed (${await bar()})`);
    if (i === 0) await saved('wall-held-lit');
    await click(...sp.screen);
    await page.sleep(1200);
    const p = (await ev(`${A}.debug()`)).pieces.find(q => q.key === `L:${h.key}`);
    check(!!p && p.x === h.a, `${h.key} hangs on ${h.side} at ${h.a} (${JSON.stringify(p ?? null)})`);
  }
  await moveTo(W - 40, 120);
  await page.sleep(1500);
  await saved('wall-three-hung');

  // ── REFUSED: over the door's stretch
  const r = await ev(`${A}.takeOut(${JSON.stringify(`L:${REFUSE.key}`)})`);
  check(r.ok, `${REFUSE.key} out of the tray`);
  const scr = await ev(`${A}.wallScreen(${JSON.stringify(REFUSE.key.slice(4))}, ${JSON.stringify(REFUSE.side)}, ${REFUSE.a})`);
  await moveTo(...scr);
  await page.sleep(600);
  const refused = await ev(`${A}.held.refused`);
  const said = await bar();
  check(!!refused, `${REFUSE.key} pointed at ${REFUSE.side}:${REFUSE.a}: refused (${refused}); the bar says "${said}"`);
  await saved('wall-refused-door');
  await click(...scr);
  const after = await ev(`${A}.held`);
  check(!!after && !(await ev(`${A}.debug()`)).pieces.some(q => q.key === `L:${REFUSE.key}`), `a click there hangs nothing; still held (${await bar()})`);
  await saved('wall-refused-click');
  await key('Escape', 'Escape', 27);
  await key('Escape', 'Escape', 27);
  // a closer look at the right wall's back corner: the photos beside the window (the city's camera moved for the
  // picture only; the game's own is not touched)
  await page.sleep(1500);
  await ev(`(() => { const P = window.__demo.stage.inside.place(${JSON.stringify(KEY)}).plan; const W = P.F.W; const t = P.w3(W - 0.3, 0.9); const c = P.w3(W * 0.42, 2.9); const k = window.__city; k.camera.position.set(c[0], c[1] + 1.7, c[2]); k.controls.target.set(t[0], t[1] + 1.25, t[2]); k.camera.fov = 45; k.camera.updateProjectionMatrix(); k.controls.update(); })()`);
  await page.sleep(1200);
  await saved('wall-beside-window-close');
  writeFileSync(path.join(out, 'wall-shots.json'), JSON.stringify({ refused, said, pieces: (await ev(`${A}.debug()`))?.pieces ?? null, failed }, null, 1));
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[arrange\]|\[crib\]/.test(l));
  console.log(`page errors ${bad.length}${bad.length ? `\n  ${[...new Set(bad)].slice(0, 8).join('\n  ')}` : ''}`);
} catch (err) {
  console.error(String(err?.stack ?? err));
  failed += 1;
} finally {
  await browser.close();
}
console.log(failed ? `${failed} FAILED` : 'all ok');
process.exit(failed ? 1 : 0);
