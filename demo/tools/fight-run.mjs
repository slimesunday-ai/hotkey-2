#!/usr/bin/env node
// THE FIGHT, PLAYED BY KEYS (demo/?mode=fight): this tool presses WASD the way a player backing away while firing
// would (src/fight/policies.mjs kite, read off the page each tenth of a second and sent as real key events), plays the
// Starter and the full build at the real stop at 1x, then a few more fights fast for the side-by-side results, and
// takes the pictures: the build panel, the start (up the stairs), a shot (bars, numbers, the streak, blood), someone
// down with their things on the ground, a pickup, the reload, the losing card, the winning card, the results; the
// panels again at 1280 wide. It reports page errors, how long each fight took and the frame times.
// It FAILS on any page error and on anyone who came on or went off inside the picture in any round (the page's frame
// check, demo/fight/watch.js: hud.frameCheck()).
// join-1: the page is in the run's frame now: a digit PICKS a loadout and Enter fights (the run's way), and the tool
// says how much of the picture the interface covers while choosing and while fighting (covered.mjs).
// The server must be running: node demo/serve.mjs
//
//   node demo/tools/fight-run.mjs --out <dir> [--port 5691] [--width 1568] [--site elm]   (the default site: the dead mall)
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { COVERED } from './covered.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/fight'));
const WIDTH = Number(opt('--width', 1568));
const HEIGHT = Math.round(WIDTH * 0.625);
const SITE = opt('--site', '');
const url = `http://127.0.0.1:${opt('--port', 5691)}/demo/?mode=fight${SITE ? `&site=${SITE}` : ''}`;
mkdirSync(out, { recursive: true });

const browser = await launch({ width: WIDTH, height: HEIGHT });
let page = null;
let failed = false;
const notes = [];
const say = text => {
  console.log(text);
  notes.push(text);
};
try {
  page = await browser.open(url);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "pick"', 180000);
  await page.sleep(2500);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  const shot = async name => say(`saved ${await page.shot(path.join(out, `${name}.jpg`))}`);
  const CODES = { KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68, Digit1: 49, Digit2: 50, Digit3: 51, Digit4: 52, Digit5: 53, Enter: 13 };
  const key = (type, code) => page.send('Input.dispatchKeyEvent', { type, code, key: code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code, windowsVirtualKeyCode: CODES[code] });
  const press0 = async code => {
    await key('keyDown', code);
    await page.sleep(60);
    await key('keyUp', code);
  };
  // (a loadout's digit picks it; Enter fights: the run's way, join-1)
  const press = async code => {
    await press0(code);
    if (code.startsWith('Digit')) {
      await page.sleep(120);
      await press0('Enter');
    }
  };
  const covered = async what => {
    const c = await ev(COVERED);
    say(`covered ${what}: ${c.pct}% of the picture (${c.boxes} boxes)`);
    return c;
  };
  const down = new Set();
  /** The keys for a move on the picture ([right, down]): the ones that should be held now are held. */
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
  const release = () => hold([0, 0]);
  /** Plays the fight by keys until it is over (or a hold stops it): → 'over' | 'held'. */
  async function drive(limitS = 100) {
    const t0 = Date.now();
    for (;;) {
      const s = await ev('(h => ({ phase: h.phase, held: h.held, m: h.driveMove() }))(window.__demo.hud)');
      if (s.phase === 'over') {
        await release();
        return 'over';
      }
      if (s.held) {
        await release();
        return 'held';
      }
      if (s.phase === 'fight') await hold(s.m);
      if (Date.now() - t0 > limitS * 1000) throw new Error(`the fight was not over in ${limitS} s`);
      await page.sleep(100);
    }
  }
  /** Plays on until the event matches, holds there `after` s on, takes the picture, lets go. → whether it came. */
  async function moment(name, match, after) {
    await ev(`window.__demo.hud.holdOn(${JSON.stringify(match)}, ${after})`);
    const r = await drive();
    if (r !== 'held') {
      say(`  (${name}: the fight ended before ${JSON.stringify(match)})`);
      return false;
    }
    await page.sleep(400);
    await shot(name);
    await ev('window.__demo.hud.holdOn({ type: "never" }); window.__demo.hud.pause(false)');
    return true;
  }
  const fightInfo = () => ev('(h => ({ phase: h.phase, t: h.fight?.t, over: h.fight?.over, last: h.last && { title: h.last.title, lines: h.last.lines }, frames: h.frameTimes() }))(window.__demo.hud)');

  // 1. THE BUILD PANEL
  await shot('01-panel');
  await covered('while choosing');

  // 2. THE STARTER at the real stop, 1x: up the stairs where the site has them, the first of them walking in, then
  // the fight, played by keys
  await press('Digit2');
  await page.waitFor('window.__demo.hud.phase === "arrive"', 20000);
  await page.sleep(2600);
  await shot('02-arrive');
  await page.waitFor('window.__demo.hud.phase === "fight"', 30000);
  let wall0 = Date.now();
  await page.sleep(1800);
  await shot('03-start');
  await covered('while fighting');
  await moment('04-starter-hit', { type: 'hit', by: 'you' }, 0.12);
  await moment('05-starter-down-and-loot', { type: 'drop' }, 1.1);
  await moment('06-pickup', { type: 'pickup' }, 0.2);
  if ((await drive()) !== 'over') throw new Error('the starter fight did not end');
  const starter = await fightInfo();
  say(`STARTER, real: ${starter.over.result} at ${starter.over.t} s fight time (${((Date.now() - wall0) / 1000).toFixed(1)} s on the wall), frames ${JSON.stringify(starter.frames)}`);
  say(`  card: ${starter.last.title} | ${starter.last.lines.join(' | ')}`);
  await page.sleep(1200);
  await shot(`07-card-${starter.over.result}`);

  // (the Starter wins about one in five: then bare hands at the real stop, fast, for the losing card)
  if (starter.over.result !== 'lost') {
    await press('Digit1');
    await page.waitFor('window.__demo.hud.phase === "fight"', 30000);
    await ev('window.__demo.hud.pause(false, 3)');
    await drive(60);
    await ev('window.__demo.hud.pause(false, 1)');
    const I = await fightInfo();
    say(`BARE HANDS, real (3x): ${I.over.result} at ${I.over.t} s · ${I.last.lines.join(' | ')}`);
    await page.sleep(1500);
    await shot(`07b-card-${I.over.result}`);
  }

  // 3. THE FULL BUILD at the real stop, 1x
  await press('Digit5');
  await page.waitFor('window.__demo.hud.phase === "fight"', 30000);
  wall0 = Date.now();
  await page.sleep(1500);
  await shot('08-full-start');
  await moment('09-full-shot', { type: 'shot', id: 'you', hit: true }, 0.05);
  await moment('10-full-reload', { type: 'reload', id: 'you' }, 0.7);
  await moment('11-full-down-and-loot', { type: 'drop' }, 1.2);
  if ((await drive()) !== 'over') throw new Error('the full fight did not end');
  const full = await fightInfo();
  say(`FULL (chopper + vest + Earl), real: ${full.over.result} at ${full.over.t} s fight time (${((Date.now() - wall0) / 1000).toFixed(1)} s on the wall), frames ${JSON.stringify(full.frames)}`);
  say(`  card: ${full.last.title} | ${full.last.lines.join(' | ')}`);
  await page.sleep(1200);
  await shot(`12-card-${full.over.result}`);

  // 4. MORE FIGHTS, FAST (the stage at 3x), for the side-by-side results
  for (const [digit, level] of [['Digit3', 'real'], ['Digit4', 'real'], ['Digit1', 'easy'], ['Digit2', 'easy'], ['Digit5', 'hard'], ['Digit3', 'hard']]) {
    await ev(`window.__demo.hud.pick({ level: ${JSON.stringify(level)} })`);
    await press(digit);
    await page.waitFor('window.__demo.hud.phase === "fight"', 30000);
    await ev('window.__demo.hud.pause(false, 3)');
    await drive(60);
    const I = await fightInfo();
    say(`  ${digit.slice(5)} at ${level} (3x): ${I.over.result} at ${I.over.t} s · ${I.last.lines[I.last.lines.length - 1]}`);
    await ev('window.__demo.hud.pause(false, 1)');
  }
  await ev('window.__demo.hud.pick({ level: "real" })');
  await page.sleep(1500);
  await shot('13-results');

  // 5. LEAVING (the stairs, or the way out): bare hands at the hard stop, a few steps off it and straight back onto it
  await ev('window.__demo.hud.pick({ level: "hard" })');
  await press('Digit1');
  await page.waitFor('window.__demo.hud.phase === "fight"', 30000);
  await hold([0, 1]);
  await page.sleep(900);
  await hold([0, -1]);
  await page.waitFor('window.__demo.hud.phase === "over"', 15000).catch(() => {});
  await release();
  const left = await fightInfo();
  say(`LEAVING: ${left.over?.result} at ${left.over?.t} s · ${left.last?.title} ${left.last?.lines.join(' ')}`);
  await page.sleep(2500);
  await shot('16-left');
  await ev('window.__demo.hud.pick({ level: "real" })');

  // 6. THE PANELS AT 1280
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await page.sleep(1500);
  await shot('14-results-1280');
  await press('Digit2');
  await page.waitFor('window.__demo.hud.phase === "fight"', 30000);
  await drive();
  await page.sleep(1200);
  await shot('15-card-1280');

  // NOBODY CAME ON OR WENT OFF IN THE PICTURE (demo/fight/watch.js: every picture of every round above, the fight's
  // people and the city's crowd round it, against the camera's frame at 1280 by 800)
  const fc = await ev('window.__demo.hud.frameCheck()');
  say(`frame check: ${fc.faults} came on or went off in the picture over ${fc.frames} pictures (${fc.seen} body-pictures watched; ${fc.hidden} let by where nobody can see: ${fc.hiddenFirst.map(h => `${h.id} ${h.what}`).join(', ') || 'none'}) · walked in ${fc.walkIn.started}, late ${fc.walkIn.late}, put down at the entry ${fc.walkIn.unwalked}, the waits for the first of them ${fc.walkIn.pre.join(', ')} s`);
  for (const f of fc.first) say(`  ${f.id} ${f.what} at ${f.at.join(', ')}${f.d !== undefined ? `, ${f.d} m in one picture` : ''}${f.t !== null ? ` (fight ${f.t} s)` : ' (no round on)'}`);
  const TH = fc.through;
  say(`through the arena: the city's cars in it at most ${TH.carsInArena} (${TH.carFrames} pictures), its walkers at most ${TH.walkersInArena} (${TH.walkerFrames} pictures); the city's own count of cars that came on or went off on screen: ${TH.carsOnScreen ? `${TH.carsOnScreen.onScreenSpawns} on, ${TH.carsOnScreen.onScreenRemovals} off` : 'not kept'}`);
  if (TH.carsInArena > 0 || TH.walkersInArena > 0) failed = true;
  if (fc.faults > 0 || fc.seen === 0) failed = true;
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
  say(`page errors: ${bad.length ? `\n  ${[...new Set(bad)].slice(0, 12).join('\n  ')}` : 'none'}`);
  const warn = page.logs.filter(l => l.startsWith('[warning]') && /fight|stage/.test(l));
  if (warn.length) say(`stage warnings:\n  ${[...new Set(warn)].slice(0, 8).join('\n  ')}`);
  if (page.failed.length) say(`failed requests:\n  ${[...new Set(page.failed)].slice(0, 8).join('\n  ')}`);
  if (bad.length) failed = true;
} catch (err) {
  failed = true;
  console.error(String(err?.stack ?? err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-12).join('\n').slice(0, 3000));
} finally {
  writeFileSync(path.join(out, 'fight-run.log'), `${notes.join('\n')}\n`);
  await browser.close();
}
process.exit(failed ? 1 : 0);
