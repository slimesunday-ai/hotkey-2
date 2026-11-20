#!/usr/bin/env node
// THE TRY-OUT STOP, TAKEN FROM A RUN (join-1; demo/run/tryout.js, trip.js), in headless Chrome, by the keys a player
// would press: a new run, out into the trailer park, T (Travel's list, the try-out its last line), down to it, Enter;
// the fight behind the dead mall, played by keys (the kite, as fight-run.mjs drives it); Esc back to the run. Twice:
// once a loadout that wins, once one that loses. And once from the Map (M), its card's Go.
// IT FAILS when, after a trip, the run's saved text (localStorage hk2.run.save) or its state is not byte for byte what
// it was before it, on any page error, on anyone who came on or went off in the picture (the stage's audit, `vanish`,
// and the fight's own frame check), and when a trip does not come back to the run.
// It says how long going and coming back take, and takes the pictures (1280 by 800).
// The server must be running: node demo/serve.mjs --port 5485
//
//   HK2_DEBUG_PORT=5722 node demo/tools/run-tryout.mjs --port 5485 --out <dir> [--seed 3]
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { COVERED } from './covered.mjs';
import { LEVEL_KEYS } from '../fight/dock.js';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/tryout'));
const seed = Number(opt('--seed', 3));
const url = `http://127.0.0.1:${opt('--port', 5485)}/demo/?mode=run&seed=${seed}&new=1&speed=4`;
mkdirSync(out, { recursive: true });

const browser = await launch({ width: 1280, height: 800 });
let page = null;
let failed = false;
const notes = [];
const say = text => {
  console.log(text);
  notes.push(text);
};
const fail = why => {
  failed = true;
  say(`FAIL: ${why}`);
};
try {
  page = await browser.open(url);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 240000);
  await ev('window.__demo.stage.actors.audit(true)');
  await page.sleep(1500);
  const shot = async name => say(`saved ${await page.shot(path.join(out, `${name}.jpg`))}`);
  const CODES = { KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68, KeyT: 84, KeyM: 77, KeyI: 73, Digit1: 49, Digit2: 50, Digit3: 51, Digit4: 52, Digit5: 53, Enter: 13, Escape: 27, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39 };
  const KEYS = { Enter: 'Enter', Escape: 'Escape', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight' };
  const key = (type, code) => page.send('Input.dispatchKeyEvent', { type, code, key: KEYS[code] ?? (code.startsWith('Key') ? code.slice(3).toLowerCase() : code.slice(5)), windowsVirtualKeyCode: CODES[code] });
  const press = async (code, after = 250) => {
    await key('keyDown', code);
    await page.sleep(60);
    await key('keyUp', code);
    await page.sleep(after);
  };
  const H = 'window.__demo.hud';
  const F = 'window.__demo.fight';

  // 1. OUT INTO THE TRAILER PARK: the first card is stepping out; Enter does it
  await press('Digit1');
  await press('Enter');
  await page.waitFor(`${H}.phase === "choose" && ${H}.state.place !== "crib"`, 120000);
  await page.sleep(1500);
  say(`the run: day ${await ev(`${H}.state.day`)} ${await ev(`${H}.state.hour`)}:00 at ${await ev(`${H}.state.place`)}`);
  await shot('20-run-before');

  /** The run's save and state now, as text. */
  const snap = () => ev(`({ save: localStorage.getItem('hk2.run.save'), state: JSON.stringify(${H}.state), steps: ${H}.steps, phase: ${H}.phase, sel: ${H}.sel })`);
  const down = new Set();
  async function hold(m) {
    const want = new Set();
    if (m[0] > 0.38) want.add('KeyD');
    if (m[0] < -0.38) want.add('KeyA');
    if (m[1] > 0.38) want.add('KeyS');
    if (m[1] < -0.38) want.add('KeyW');
    for (const c of [...down]) if (!want.has(c)) {
      await key('keyUp', c);
      down.delete(c);
    }
    for (const c of want) if (!down.has(c)) {
      await key('keyDown', c);
      down.add(c);
    }
  }
  /** Plays the fight by keys until it is over. */
  async function drive(limitS = 150) {
    const t0 = Date.now();
    for (;;) {
      const s = await ev(`(h => ({ phase: h.phase, m: h.driveMove() }))(${F})`);
      if (s.phase === 'over') return hold([0, 0]);
      if (s.phase === 'fight') await hold(s.m);
      if (Date.now() - t0 > limitS * 1000) throw new Error(`the fight was not over in ${limitS} s`);
      await page.sleep(100);
    }
  }

  /** A real mouse press on the middle of `sel` (the browser's own pointer events); fails when something else is under it. */
  async function click(sel, after = 300) {
    const u = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); const [x, y] = [r.left + r.width / 2, r.top + r.height / 2]; const top = document.elementFromPoint(x, y); return { x, y, hit: !!top && (top === e || e.contains(top)) }; })()`);
    if (!u || !u.hit) return fail(`the mouse on ${sel}: ${u ? 'something else is under the pointer' : 'it is not on the page'}`);
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await page.send('Input.dispatchMouseEvent', { type, x: u.x, y: u.y, button: type === 'mouseMoved' ? 'none' : 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1 });
      await page.sleep(40);
    }
    await page.sleep(after);
  }
  /** One trip: there by Travel's list (or the map), a round, back by Esc (`mouse`: the round and the way back by the mouse). → { go, back, result } */
  async function trip(name, { digit, level, via = 'travel', pictures = false, card = false, mapShot = false, ask = false, mouse = false }) {
    if (via === 'travel') {
      // (T opens Travel's list on its first way; ↑ from the first goes round to the last: the try-out. Back from a
      // trip, the list is open as it was, on the try-out)
      const open = await ev(`!!document.querySelector('.u-list[data-list="travel"]')`);
      if (!open) await press('KeyT', 400);
      if ((await ev(`${H}.sel`)) !== 'tryout:mall') await press('ArrowUp', 400);
      const sel = await ev(`${H}.sel`);
      if (sel !== 'tryout:mall') fail(`${name}: ↑ on Travel's list picked ${sel}, not the try-out`);
      if (pictures) await shot('21-travel-list');
    } else {
      await press('KeyM', 1500);
      await page.waitFor(`${H}.map.ready`, 20000);
      await ev(`${H}.map.card('tryout')`);
      await page.sleep(700);
      if (pictures || mapShot) await shot('22-map-stop');
    }
    // (the run as it is when the trip is taken: what must be the same when it is back)
    const before = await snap();
    if (before.phase !== 'choose') throw new Error(`${name}: the run is not choosing (${before.phase})`);
    if (via === 'travel') await press('Enter', 0);
    else await ev(`document.querySelector('.rn-tryout-go').click()`);
    // (the black, with its words; then the fight's dock)
    const t0 = Date.now();
    await page.waitFor(`document.querySelector('.fg-trip .u-dark-say') && !document.querySelector('.fg-trip .u-dark-say').hidden`, 5000).catch(() => {});
    if (pictures) await shot('23-going-black');
    await page.waitFor(`${F} && ${F}.phase === "pick" && !${H}.trip.busy`, 60000);
    const go = (Date.now() - t0) / 1000;
    await page.sleep(pictures ? 300 : 800);
    if (pictures) await shot('24-arrived');
    if (!(await ev(`${H}.away`))) fail(`${name}: the run's frame is not away while the fight is up`);
    // (no run key does anything here: T, M, H, Z pressed on the fight's lot change nothing of the run's)
    await press('KeyT', 120);
    await press('KeyM', 120);
    if ((await ev(`${H}.sel`)) !== before.sel || (await ev(`${H}.phase`)) !== 'choose') fail(`${name}: a run key acted while the fight was up`);
    // THE ROUND: a loadout (its digit), how hard (the arrows), Enter
    await press(digit, 200);
    // (down to the first level, then up to the one wanted: fight-3 put Jumped first, below Easy)
    for (let k = 0; k < LEVEL_KEYS.length - 1; k++) await press('ArrowDown', 120);
    for (let k = 0; k < LEVEL_KEYS.indexOf(level); k++) await press('ArrowUp', 120);
    // (by the mouse: how hard by its own button; the main button below. A click on the loadout already picked would
    // start the round at once, so the loadout stays on its digit)
    if (mouse) await click(`.fg-dock [data-level="${level}"]`);
    const words = await ev(`document.querySelector('.fg-dock .u-go-t')?.textContent`);
    say(`  ${name}: the button says "${words}"`);
    if (mouse) await click('.fg-dock .u-go');
    else await press('Enter', 200);
    await page.waitFor(`${F}.phase === "fight"`, 40000);
    if (pictures) {
      await page.sleep(2500);
      const c = await ev(COVERED);
      say(`  covered while fighting, on the trip: ${c.pct}%`);
    }
    // (Esc mid-round asks first, in the page, the round held still; Enter stays and it goes on)
    if (ask) {
      await press('Escape', 500);
      const asked = await ev(`({ up: !!document.querySelector('.fg-ask:not([hidden])'), speed: window.__demo.stage.actors.speed, away: ${H}.away, phase: ${F}.phase })`);
      say(`  ${name}: Esc mid-round: asked ${asked.up}, the round held (speed ${asked.speed}), still on the lot ${asked.away && asked.phase === 'fight'}`);
      if (!asked.up || asked.speed !== 0 || !asked.away) fail(`${name}: Esc mid-round did not ask first`);
      if (pictures) await shot('24b-ask');
      await press('Enter', 400);
      const stayed = await ev(`({ up: !!document.querySelector('.fg-ask:not([hidden])'), speed: window.__demo.stage.actors.speed, phase: ${F}.phase })`);
      if (stayed.up || stayed.speed === 0 || stayed.phase !== 'fight') fail(`${name}: Enter did not stay: ${JSON.stringify(stayed)}`);
    }
    await ev(`${F}.pause(false, 3)`);
    await drive();
    await ev(`${F}.pause(false, 1)`);
    const res = await ev(`(h => ({ result: h.fight.over.result, t: h.fight.over.t, card: document.querySelector('.fg-res .u-res-head')?.textContent, frame: h.frameCheck() }))(${F})`);
    say(`  ${name}: ${res.result} at ${res.t} s · "${res.card}" · frame check: ${res.frame.faults} came on or went off over ${res.frame.frames} pictures`);
    if (res.frame.faults > 0) fail(`${name}: ${res.frame.faults} came on or went off in the fight's picture`);
    await page.sleep(1200);
    if (pictures || card) await shot(`25-card-${res.result}`);
    // BACK: Esc, from the result card (or its Back button, by the mouse)
    const t1 = Date.now();
    if (mouse) await click('.fg-res [data-move="back"]', 0);
    else await press('Escape', 0);
    await page.waitFor(`document.querySelector('.fg-trip .u-dark-say') && !document.querySelector('.fg-trip .u-dark-say').hidden`, 5000).catch(() => {});
    if (pictures) await shot('26-returning-black');
    await page.waitFor(`!${H}.away && !${H}.trip.busy && !${F}`, 60000);
    const back = (Date.now() - t1) / 1000;
    await page.sleep(pictures ? 200 : 600);
    if (pictures) await shot('27-returned');
    // (the fight took itself off: nobody of its on the stage, no overlay of its, no cover on the lot)
    const left = await ev(`({ actors: window.__demo.stage.actors.all().filter(A => String(A.id).startsWith('fight:')).length, fx: document.querySelectorAll('canvas.fx-layer').length, cover: !!window.__city.scene.getObjectByName('fight:cover'), frame: document.querySelectorAll('.rn.fg').length, zone: window.__demo.stage.loader.zone })`);
    if (left.actors || left.fx || left.cover || left.frame) fail(`${name}: the fight left something behind: ${JSON.stringify(left)}`);
    const after = await snap();
    const same = after.save === before.save && after.state === before.state && after.steps === before.steps && after.phase === 'choose' && after.sel === before.sel;
    say(`  ${name}: there ${go.toFixed(2)} s, back ${back.toFixed(2)} s (the page's own: ${JSON.stringify(await ev(`${H}.trip.log.slice(-2).map(n => [n.way, n.seconds, n.zone, n.built])`))}) · save ${after.save === before.save ? 'identical' : 'CHANGED'} (${before.save?.length ?? 0} characters) · state ${after.state === before.state ? 'identical' : 'CHANGED'} · steps ${before.steps} → ${after.steps} · picked ${before.sel} → ${after.sel}`);
    if (!before.save) fail(`${name}: no save to compare`);
    if (!same) fail(`${name}: the run is not as it was`);
    return { go, back, result: res.result };
  }

  const won = await trip('win', { digit: 'Digit5', level: 'easy', pictures: true, ask: true });
  if (won.result !== 'won') say(`  (the full loadout on Easy did not win this time: ${won.result})`);
  const lost = await trip('lose', { digit: 'Digit1', level: 'hard', card: true });
  if (lost.result !== 'lost') say(`  (bare hands on Hard did not lose this time: ${lost.result})`);
  const map = await trip('from the map', { digit: 'Digit2', level: 'real', via: 'map', mapShot: true, mouse: true });
  // (the run goes on after: an hour played as any other)
  await press('KeyT', 300);
  await press('Escape', 300);
  const results = [won.result, lost.result, map.result];
  if (!results.includes('won') || !results.includes('lost')) fail(`not once won and once lost: ${results.join(', ')}`);
  const A = await ev('window.__demo.stage.actors.audit(false)');
  say(`the stage's audit over the three trips: vanish ${A?.vanish ?? '-'} (came on or went off in the picture), pops ${A?.pops ?? '-'}, scenes ${A?.scenes ?? '-'}`);
  for (const e of (A?.examples ?? []).filter(x => /^vanish /.test(x)).slice(0, 6)) say(`  ${e}`);
  if ((A?.vanish ?? 0) > 0) fail(`${A.vanish} came on or went off in the picture`);
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
  say(`page errors: ${bad.length ? `\n  ${[...new Set(bad)].slice(0, 12).join('\n  ')}` : 'none'}`);
  if (bad.length) failed = true;
  const warn = page.logs.filter(l => l.startsWith('[warning]') && /trip|fight/.test(l));
  if (warn.length) say(`warnings:\n  ${[...new Set(warn)].slice(0, 8).join('\n  ')}`);
} catch (err) {
  failed = true;
  console.error(String(err?.stack ?? err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-15).join('\n').slice(0, 3000));
} finally {
  say(failed ? 'tryout-fail' : 'tryout-ok');
  writeFileSync(path.join(out, 'run-tryout.log'), `${notes.join('\n')}\n`);
  await browser.close();
}
process.exit(failed ? 1 : 0);
