#!/usr/bin/env node
// ARRANGE MODE, PLAYED ON THE REAL PAGE (demo/run/arrange.js, demo/stage/set/arrange.js) with real mouse and key
// events (the DevTools protocol's own input, as a person's), and the pictures that prove it. The server must be
// running: node demo/serve.mjs
//
//   node demo/tools/run-arrange.mjs --out <dir> [--port 5470] [--seed 3] [--size 1869x882] [--crib a|b]
//
//   1. the run at the crib, owning the four things for the trailer, two packs of smokes at home and a visor to wear
//   2. what must not move: the dock's height, C G O M N F, the Step out card's Take and Goods (each pressed, looked at, put
//      back), what you wear in the You panel (ui-3, leg 2: the keys of the dock; W A S D are never the run's)
//   3. V: arrange. The beanbag picked up (a click on it), carried to a lit spot (the pointer), turned (E), put down (a
//      click); the fish tank picked up and put away (Delete); taken out of the tray (a click on it) and put down
//      elsewhere; undo once (Ctrl+Z); done (Esc). What the page says at each step, and the arrangement kept
//   4. the page reloaded (the same run): the arrangement read back, the room as it was
//   5. a second arrangement with the bed and the chair moved, written out (`bedchair.json`) for run-stage.mjs
//      (--query arrange=…), and every arrangement's layout for crib-check.mjs (`layout-*.json`)
//   6. slept in: the player walks to the moved bed and lies on it (the audit says nobody went through furniture)
// Pictures: held.jpg (a piece held, the valid spots lit) · tray.jpg · arranged.jpg (the room in play) · reloaded.jpg
// · asleep-moved-bed.jpg
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-arrange'));
const port = opt('--port', 5470);
const crib = opt('--crib', 'a');
const seed = opt('--seed', '3');
const [W, H] = opt('--size', '1869x882').split('x').map(Number);
const url = `http://127.0.0.1:${port}/demo/?mode=run&seed=${seed}${crib === 'b' ? '&crib=b' : ''}`;
const KEY = 'pad:a1';
mkdirSync(out, { recursive: true });

const browser = await launch({ width: W, height: H });
let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failed += 1;
};
try {
  const page = await browser.open(url);
  const ev = (js, ms = 60000) => page.evaluate(js, ms);
  const A = `window.__demo.stage.inside.place(${JSON.stringify(KEY)}).arrange`;
  // (ui-3, leg 2: the run's keys, one meaning each; in arranging E turns, Delete puts away, Ctrl+Z undoes)
  const KEYS = { v: [86, 'KeyV'], e: [69, 'KeyE'], z: [90, 'KeyZ'], c: [67, 'KeyC'], g: [71, 'KeyG'], o: [79, 'KeyO'], m: [77, 'KeyM'], n: [78, 'KeyN'], f: [70, 'KeyF'],
    w: [87, 'KeyW'], a: [65, 'KeyA'], s: [83, 'KeyS'], d: [68, 'KeyD'], 1: [49, 'Digit1'], Delete: [46, 'Delete'], ArrowUp: [38, 'ArrowUp'], Escape: [27, 'Escape'] };
  // (`modifiers`: the DevTools protocol's bits, 2 Ctrl, 8 Shift)
  async function press(k, modifiers = 0) {
    const [code, name] = KEYS[k];
    const text = k.length === 1 && !(modifiers & 2) ? k : undefined;
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: name, windowsVirtualKeyCode: code, modifiers, ...(text ? { text } : {}) });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: name, windowsVirtualKeyCode: code, modifiers });
    await page.sleep(250);
  }
  async function moveTo(x, y, steps = 6) {
    const from = moveTo.at ?? [W / 2, H / 2];
    for (let k = 1; k <= steps; k++) await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from[0] + ((x - from[0]) * k) / steps, y: from[1] + ((y - from[1]) * k) / steps });
    moveTo.at = [x, y];
    await page.sleep(120);
  }
  async function click(x, y) {
    await moveTo(x, y);
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await page.sleep(60);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    await page.sleep(350);
  }
  const clickEl = async sel => {
    const r = await ev(`(el => el && (r => [r.left + r.width / 2, r.top + r.height / 2])(el.getBoundingClientRect()))(document.querySelector(${JSON.stringify(sel)}))`);
    if (!r) throw new Error(`nothing at ${sel}`);
    await click(r[0], r[1]);
  };
  const bar = () => ev(`(el => el ? el.innerText.replace(/\\s+/g, ' ').trim() : null)(document.querySelector('.rn-arrange'))`);
  const debug = () => ev(`${A}.debug()`);
  const pieceAt = async key => (await debug()).pieces.find(p => p.key === key);
  const cardH = () => ev(`Math.round(document.querySelector('.rn-card').getBoundingClientRect().height)`);
  const saved = async name => console.log(`saved ${await page.shot(path.join(out, `${name}.jpg`))}`);
  const owned = { things: { beanbag: true, fishtank: true, lavalamp: true, boxfan: true, visor: true }, stash: { smokes: 2 } };
  const loadOwned = async () => {
    const ok = await ev(`(async () => { const h = window.__demo.hud; const s = structuredClone(h.state); Object.assign(s, ${JSON.stringify(owned)}); return await h.load(s); })()`);
    await page.waitFor(`(window.__demo.stage.inside.place(${JSON.stringify(KEY)}).room ?? '').includes('+beanbag') && window.__demo.stage.inside.up === ${JSON.stringify(KEY)}`, 60000, 100);
    await page.sleep(800);
    return ok;
  };
  const ready = async () => {
    await page.waitFor(`window.__demo?.hud?.phase === 'choose' && window.__demo.hud.state.place === 'crib' && window.__demo.stage.inside.up === ${JSON.stringify(KEY)}`, 240000, 200);
    await page.waitFor(`!!${A}`, 60000, 200);
    await ev(`${A}.ready()`);
  };

  // ── 1. at the crib, owning the things
  await ready();
  check(await loadOwned(), 'the run at the crib owns the beanbag, the fish tank, the lava lamp, the box fan, a visor; two smokes at home');
  console.log(`room: ${await ev(`window.__demo.stage.inside.place(${JSON.stringify(KEY)}).room`)}`);

  // ── 2. what must not move
  const h0 = await cardH();
  check(h0 > 0, `the dock outside arrange mode: ${h0} px`);
  const sheet = () => ev(`window.__demo.hud.root.querySelector('.rn-sheet')?.hidden === false ? window.__demo.hud.root.querySelector('.rn-sheet').getAttribute('aria-label') ?? window.__demo.hud.root.querySelector('.rn-sheet h2, .rn-sheet h1')?.textContent ?? 'open' : null`);
  for (const k of ['c', 'g', 'o', 'm']) {
    await press(k);
    const open = await sheet();
    const extra = k === 'g' ? await ev(`[...document.querySelectorAll('.rn-sheet .rn-job-head b')].some(b => b.textContent === 'Arrange')`) : null;
    check(!!open, `${k.toUpperCase()} opens its panel (${open})${k === 'g' ? `; the Guide lists Arrange: ${extra}` : ''}`);
    if (k === 'g' && !extra) failed += 1;
    await press(k);
    check(!(await sheet()), `${k.toUpperCase()} again closes it`);
  }
  const numbers = () => ev(`document.querySelector('.u-stats')?.classList.contains('is-folded') ?? null`);
  const rail0 = await numbers();
  await press('n');
  const rail1 = await numbers();
  await press('n');
  check(rail0 !== rail1 && rail0 === (await numbers()), `N folds and opens your numbers (folded ${rail0} → ${rail1} → back)`);
  const sheetWas = await sheet();
  for (const k of ['w', 'a', 's', 'd']) await press(k);
  check((await sheet()) === sheetWas && !(await ev(`${A}.active`)), 'W A S D do nothing in the run');
  await press('f');
  const f1 = await ev(`document.querySelector('.rn-card').dataset.fit`);
  await press('f');
  const f2 = await ev(`document.querySelector('.rn-card').dataset.fit`);
  check(f1 === 'folded' && f2 === 'open' && (await cardH()) === h0, `F folds the dock and opens it again (${f1} → ${f2}, ${await cardH()} px)`);
  // (the Step out card, 1: its cash ↑ a dollar; its goods − and + by their buttons)
  const take = () => ev(`document.querySelector('.u-dock .u-take b.u-sign')?.textContent ?? null`);
  await press('1');
  const t0 = await take();
  await press('ArrowUp');
  const t1 = await take();
  // (the take no longer starts at $0: with goods at home it starts at the fares; ↑ is one dollar more than it was)
  check(/^\$\d+$/.test(t0 ?? '') && t1 === `$${Number(t0.slice(1)) + 1}`, `1 then ↑: Take +1 (${t0} → ${t1})`);
  const goods = () => ev(`document.querySelector('.u-dock .u-take:not(:has(.u-sign)) b')?.textContent ?? null`);
  const g0 = await goods();
  await clickEl('.u-dock .u-take:not(:has(.u-sign)) .u-step');
  const g1 = await goods();
  check(!!g0 && g0 !== g1, `Goods: − (${g0} → ${g1})`);
  await clickEl('.u-dock .u-take:not(:has(.u-sign)) .u-step:last-of-type');
  await press('Escape');
  // (what you wear is the You panel's: not on the dock, its Put on there)
  const wear = await ev(`(h => { const c = h.view.choices.find(c => c.choice.do === 'wear'); return c ? { key: c.key, dock: h.keyFor(c.key) } : null; })(window.__demo.hud)`);
  check(!!wear && wear.dock === null, `Wear: a choice (${wear?.key}) the You panel's, not the dock's (${wear?.dock})`);
  // (the arrange key on the crib's rail)
  const btn = await ev(`(el => el && el.innerText.replace(/\\s+/g, ' '))(document.querySelector('.rn-key-arrange'))`);
  check(!!btn, `the crib's rail shows the arrange key: "${btn}"`);

  // ── 3. ARRANGE
  await moveTo(W / 2, H / 2);
  await press('v');
  check(await ev(`${A}.active && document.querySelector('.hk.rn').classList.contains('is-arranging')`), 'V: arrange mode is up');
  console.log(`  bar: ${await bar()}`);
  const hA = await ev(`Math.round(document.querySelector('.rn-arrange').getBoundingClientRect().height)`);
  const camBefore = await ev(`(c => [c.position.x, c.position.y, c.position.z].map(v => +v.toFixed(3)).join(','))(window.__city.camera)`);
  console.log(`  the arrange bar ${hA} px in the bar's place (the bar under it ${await cardH()} px); camera ${camBefore}`);
  // the beanbag: picked up
  const bb = await pieceAt('t:beanbag');
  console.log(`  the beanbag at cells ${bb.x},${bb.z} turned ${bb.rot}, on the screen ${bb.screen}`);
  await click(bb.screen[0], bb.screen[1]);
  let held = await ev(`${A}.held`);
  check(held?.key === 't:beanbag', `a click on it picks up the beanbag: ${JSON.stringify(held)}`);
  console.log(`  bar: ${await bar()}`);
  // carried to a lit spot on the open floor right of where the player stands (the pointer, in steps)
  const spots = (await debug()).spots;
  const want = spots.slice().sort((a, b) => Math.hypot(a.P.x - 19, a.P.z - 6) - Math.hypot(b.P.x - 19, b.P.z - 6))[0];
  await moveTo(want.screen[0], want.screen[1], 10);
  held = await ev(`${A}.held`);
  check(held.at.x === want.P.x && held.at.z === want.P.z, `the pointer carries it to a lit spot: cells ${held.at.x},${held.at.z} (${held.spots} spots lit)`);
  await page.sleep(500);
  await saved('held');
  await press('e');
  held = await ev(`${A}.held`);
  check(held.rot === 90, `E turns it: ${held.rot}° (put at ${held.at.x},${held.at.z})`);
  const at = (await debug()).spots.find(q => q.P.x === held.at.x && q.P.z === held.at.z);
  await click(at.screen[0], at.screen[1]);
  check(!(await ev(`${A}.held`)), 'a click on the lit spot puts it down');
  console.log(`  kept: ${await ev(`localStorage.getItem('hk2.run.arrange.${crib}.${seed}')`)}`);
  await page.sleep(400);
  // the fish tank: picked up and put away
  const ft = await pieceAt('t:fishtank');
  await click(ft.screen[0], ft.screen[1]);
  check((await ev(`${A}.held`))?.key === 't:fishtank', `a click on the fish tank (cells ${ft.x},${ft.z}) picks it up`);
  await press('Delete');
  check((await ev(`${A}.tray().map(t => t.key)`)).includes('t:fishtank') && !(await pieceAt('t:fishtank')), 'Delete puts it away: the fish tank is in the tray, not in the room');
  console.log(`  bar: ${await bar()}`);
  await moveTo(W * 0.5, H * 0.45);
  await page.sleep(500);
  await saved('tray');
  // taken out of the tray and put down elsewhere
  await clickEl('.rn-ar-chip[data-key="t:fishtank"]');
  held = await ev(`${A}.held`);
  check(held?.key === 't:fishtank' && held.from === 'tray', `a click on it in the tray takes it out (${held?.spots} spots lit)`);
  const fs = (await debug()).spots.filter(q => q.P.x <= 8 && q.P.z >= 8).sort((a, b) => a.P.x - b.P.x || b.P.z - a.P.z)[0] ?? (await debug()).spots[0];
  await click(fs.screen[0], fs.screen[1]);
  const ft2 = await pieceAt('t:fishtank');
  check(!!ft2 && (ft2.x !== ft.x || ft2.z !== ft.z), `put down elsewhere: cells ${ft2?.x},${ft2?.z} (it was ${ft.x},${ft.z})`);
  const before = await ev(`JSON.stringify(${A}.record())`);
  console.log(`  arrangement: ${before}`);
  writeFileSync(path.join(out, 'layout-session-before-undo.json'), JSON.stringify(await ev(`${A}.layout()`), null, 1));
  await press('z', 2);
  await page.sleep(400);
  const undone = await ev(`JSON.stringify(${A}.record())`);
  check(undone !== before && (await ev(`${A}.tray().map(t => t.key)`)).includes('t:fishtank'), `Ctrl+Z undoes once: the fish tank back in the tray · ${undone}`);
  console.log(`  bar: ${await bar()}`);
  await press('Escape');
  check(!(await ev(`${A}.active`)) && !(await ev(`!!document.querySelector('.rn-arrange')`)), 'Esc: arrange mode is done');
  const camAfter = await ev(`(c => [c.position.x, c.position.y, c.position.z].map(v => +v.toFixed(3)).join(','))(window.__city.camera)`);
  check(camAfter === camBefore, `the camera never moved (${camAfter})`);
  check((await cardH()) === h0, `the dock after: ${await cardH()} px`);
  const kept = await ev(`localStorage.getItem('hk2.run.arrange.${crib}.${seed}')`);
  console.log(`  kept for the run (localStorage hk2.run.arrange.${crib}.${seed}): ${kept}`);
  writeFileSync(path.join(out, 'session.json'), kept ?? 'null');
  writeFileSync(path.join(out, 'layout-session.json'), JSON.stringify(await ev(`${A}.layout()`), null, 1));
  await moveTo(W * 0.92, H * 0.2);
  await page.sleep(600);
  await saved('arranged');
  const where = JSON.stringify((await debug()).pieces.filter(p => p.key.startsWith('t:')).map(p => [p.key, p.x, p.z, p.rot]));
  console.log(`  the things in the room: ${where}`);

  // ── 4. reloaded: the same run
  await page.send('Page.reload');
  await page.sleep(3000);
  await ready();
  await loadOwned();
  const back = await ev(`JSON.stringify(${A}.record())`);
  check(back === kept, `after a reload of the same run the arrangement came back: ${back}`);
  const where2 = JSON.stringify((await debug()).pieces.filter(p => p.key.startsWith('t:')).map(p => [p.key, p.x, p.z, p.rot]));
  check(where2 === where, `the things stand where they were: ${where2}`);
  check((await ev(`${A}.tray().map(t => t.key).join(',')`)) === 't:fishtank', 'the fish tank is still in the tray');
  console.log(`  room: ${await ev(`window.__demo.stage.inside.place(${JSON.stringify(KEY)}).room`)}`);
  await moveTo(W * 0.92, H * 0.2);
  await page.sleep(600);
  await saved('reloaded');

  // ── 5. the bed and the chair moved (for the auto-play), by the stage's own handle
  const bc = await ev(`(async () => {
    const A = ${A};
    await A.reset();
    // (the lit spot farthest from where it stands)
    const far = key => { A.pick(key); const d = A.debug(); const o = A.held.at; const q = d.spots.slice().sort((a, b) => Math.hypot(b.P.x - o.x, b.P.z - o.z) - Math.hypot(a.P.x - o.x, a.P.z - o.z))[0]; if (!q) return false; A.aimAt(q.screen[0], q.screen[1]); return A.held.at; };
    const bed = far('i3');
    await A.drop();
    const chair = far('i9');
    await A.drop();
    return { bed, chair, record: A.record(), layout: A.layout() };
  })()`);
  console.log(`  the bed to ${JSON.stringify(bc.bed)}, the chair to ${JSON.stringify(bc.chair)}`);
  writeFileSync(path.join(out, 'bedchair.json'), JSON.stringify(bc.record));
  writeFileSync(path.join(out, 'layout-bedchair.json'), JSON.stringify(bc.layout, null, 1));
  // and slept in where it stands now: the walk to it and the sleeper on it are the moved bed's
  await page.waitFor(`(window.__demo.stage.inside.place(${JSON.stringify(KEY)}).room ?? '').includes('|ar-')`, 20000, 100);
  await page.sleep(600);
  const sk = await ev(`window.__demo.hud.view.choices.find(c => c.choice.do === 'sleep' && c.available)?.key ?? null`);
  const bedSpot = await ev(`(b => b && [+b.x.toFixed(2), +b.z.toFixed(2)])(window.__demo.stage.inside.place(${JSON.stringify(KEY)}).spots('bed')[0])`);
  await ev(`window.__demo.stage.actors.audit(true)`);
  // (ui-3, leg 2: Z, Sleep, picks it; Enter goes)
  const zk = await ev(`window.__demo.hud.keyFor(${JSON.stringify(String(sk))})`);
  check(zk === 'Z', `sleeping is Z on the dock (${zk})`);
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, text: 'z' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90 });
  await page.sleep(200);
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await page.waitFor(`(window.__demo.stage.actors.clipOf('a1')?.name ?? '') === 'sleep'`, 30000, 50).catch(() => null);
  await page.sleep(1500);
  const lying = await ev(`(A => ({ at: [+A.x.toFixed(2), +A.z.toFixed(2)], clip: window.__demo.stage.actors.clipOf('a1')?.name ?? null }))(window.__demo.stage.actors.get('a1'))`);
  const audit = await ev(`(a => ({ overlaps: a.overlaps, furniture: a.furniture, vanish: a.vanish }))(window.__demo.stage.actors.audit())`);
  const ins = await ev(`(d => ({ furniture: d.furniture, examples: d.examples.slice(0, 4) }))(window.__demo.stage.inside.debug())`);
  check(lying.clip === 'sleep' && bedSpot && Math.hypot(lying.at[0] - bedSpot[0], lying.at[1] - bedSpot[1]) < 0.05, `asleep on the moved bed: the player at ${lying.at}, the bed's spot ${bedSpot}, ${lying.clip}`);
  check(!audit.overlaps && !audit.furniture && !audit.vanish && !ins.furniture, `on the way to it and in it: ${JSON.stringify(audit)} · inside ${JSON.stringify(ins)}`);
  await ev(`document.querySelectorAll('.hk-overlay').forEach(e => (e.style.visibility = 'hidden'))`);
  await saved('asleep-moved-bed');
  await ev(`document.querySelectorAll('.hk-overlay').forEach(e => (e.style.visibility = ''))`);
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[stage\]|\[run\]|\[inside\]|\[crib\]|\[arrange\]/.test(l));
  console.log(`page errors ${bad.length}${bad.length ? `\n  ${[...new Set(bad)].slice(0, 10).join('\n  ').slice(0, 2500)}` : ''}`);
  if (bad.length) failed += 1;
} catch (err) {
  console.error(String(err?.stack ?? err));
  failed += 1;
} finally {
  await browser.close();
}
console.log(failed ? `run-arrange: ${failed} failed` : 'run-arrange: all ok');
process.exitCode = failed ? 1 : 0;
