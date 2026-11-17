#!/usr/bin/env node
// THE FIGHT'S MOVES AT THE GAME'S CAMERA (demo/?mode=fight): pictures of what the owner judges, held still on the
// fight's own clock, each a few frames apart, at 1280 by 800 (the game's camera, not moved):
//   walkin-*     a round's first people walking in from out of the picture (the full build at the real stop)
//   gun-*        your shot (the chopper): the kick, the flash, the tracer and the puff on them; then back on aim
//   blade-*      your blow (the box cutter): the wind-up, the hit (the rules' damage tick), the follow-through
//   foeblow-*    their blow on you, the same three
//   foeshot-*    their shot at you (the shooter)
//   vest-*       a hit your stab vest takes (the handgun and the vest)
//   down-*       one of them going down, and lying still
// Each picture's name says the fight's clock. The server must be running: node demo/serve.mjs
//
//   node demo/tools/fight-moves.mjs --out <dir> [--port 5483] [--site mall]
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './chrome.mjs';

const opt = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
};
const out = path.resolve(opt('--out', 'demo/shots/fight-moves'));
const site = opt('--site', '');
mkdirSync(out, { recursive: true });
const browser = await launch({ width: 1280, height: 800 });
const notes = [];
const say = t => {
  console.log(t);
  notes.push(t);
};
let failed = false;
try {
  const page = await browser.open(`http://127.0.0.1:${opt('--port', 5483)}/demo/?mode=fight${site ? `&site=${site}` : ''}&nostairs=1`);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "pick"', 240000);
  await page.sleep(2500);
  const ev = js => page.evaluate(js);
  const CODES = { KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68, Digit1: 49, Digit2: 50, Digit3: 51, Digit4: 52, Digit5: 53, Enter: 13 };
  const key = (type, code) => page.send('Input.dispatchKeyEvent', { type, code, key: code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code, windowsVirtualKeyCode: CODES[code] });
  const down = new Set();
  async function keys(m) {
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
  /** Plays by keys (backing away while firing) until over or held. */
  async function drive(limit = 120) {
    const t0 = Date.now();
    for (;;) {
      const s = await ev('(h => ({ phase: h.phase, held: h.held, m: h.driveMove() }))(window.__demo.hud)');
      if (s.phase === 'over' || s.held) {
        await keys([0, 0]);
        return s.phase === 'over' ? 'over' : 'held';
      }
      if (s.phase === 'fight') await keys(s.m);
      if (Date.now() - t0 > limit * 1000) throw new Error('the fight did not end');
      await page.sleep(100);
    }
  }
  const shot = async name => {
    await page.sleep(350);
    const t = await ev('window.__demo.hud.fight?.t ?? 0');
    const file = await page.shot(path.join(out, `${name}-t${t.toFixed(2)}.jpg`));
    say(`saved ${file}`);
  };
  const go = () => ev('window.__demo.hud.holdOn({ type: "never" }); window.__demo.hud.pause(false)');
  /** Held on an event, then at each offset after it on the fight's clock. */
  async function strip(name, match, offsets) {
    await ev(`window.__demo.hud.holdOn(${JSON.stringify(match)}, ${offsets[0]})`);
    if ((await drive()) !== 'held') return say(`  (${name}: the round ended first)`);
    const e = await ev(`window.__demo.hud.lastEvent(${JSON.stringify(match)})`);
    await shot(`${name}-1`);
    for (let k = 1; k < offsets.length; k++) {
      await ev(`window.__demo.hud.holdAt(${e.t + offsets[k]}); window.__demo.hud.pause(false)`);
      await drive();
      await shot(`${name}-${k + 1}`);
    }
    await go();
    return e;
  }
  /** Held mid wind-up of `who`'s next blow, then on its landing tick, then after. */
  async function blow(name, who) {
    await ev(`window.__demo.hud.holdOnWind(0.12, ${JSON.stringify(who)})`);
    if ((await drive()) !== 'held') return say(`  (${name}: the round ended first)`);
    const b = await ev('window.__demo.hud.heldBlow');
    await shot(`${name}-1-windup`);
    for (const [k, dt, word] of [[2, 0, 'hit'], [3, 0.17, 'after']]) {
      await ev(`window.__demo.hud.holdAt(${b.t + dt}); window.__demo.hud.pause(false)`);
      await drive();
      await shot(`${name}-${k}-${word}`);
    }
    await go();
  }
  async function round(digit, level) {
    await ev(`window.__demo.hud.pick({ level: ${JSON.stringify(level)} })`);
    await key('keyDown', digit);
    await page.sleep(60);
    await key('keyUp', digit);
    // (join-1: the digit picks the loadout, Enter fights)
    await page.sleep(120);
    await key('keyDown', 'Enter');
    await page.sleep(60);
    await key('keyUp', 'Enter');
    await page.waitFor('window.__demo.hud.phase === "arrive"', 20000).catch(() => {});
  }
  const finish = async () => {
    await ev('window.__demo.hud.pause(false, 3)');
    await drive();
    await ev('window.__demo.hud.pause(false, 1)');
    await page.sleep(800);
  };

  // 1. THE WALK IN, the full build at the real stop: a picture every half second of the wait and the first seconds
  await round('Digit5', 'real');
  await page.waitFor('window.__demo.hud.phase === "fight" || (window.__demo.hud.phase === "arrive" && /coming/.test(document.querySelector(".fg-strip")?.textContent ?? ""))', 20000).catch(() => {});
  for (let k = 0; k < 4; k++) {
    await ev('window.__demo.hud.pause(true)');
    await shot(`walkin-${k + 1}`);
    await ev('window.__demo.hud.pause(false)');
    await page.sleep(450);
  }
  await page.waitFor('window.__demo.hud.phase === "fight"', 20000);
  for (const t of [0.8, 1.6, 2.4]) {
    await ev(`window.__demo.hud.holdAt(${t})`);
    await drive();
    await shot(`walkin-at-${t}`);
    await go();
  }
  // 2. YOUR SHOT (the chopper)
  await strip('gun', { type: 'shot', id: 'you', hit: true }, [0, 0.07, 0.3]);
  // 3. THEIR SHOT AT YOU (the shooter of the second wave)
  await strip('foeshot', { type: 'shot', to: 'you' }, [0, 0.07, 0.3]);
  await finish();
  // 4. YOUR BLOW (the box cutter), and theirs on you; one of them going down
  await round('Digit2', 'real');
  await page.waitFor('window.__demo.hud.phase === "fight"', 30000);
  await blow('blade', 'you');
  await blow('foeblow', 'foe');
  await strip('down', { type: 'down' }, [0, 0.35, 0.8, 1.6]);
  await finish();
  // 5. THE VEST (the handgun and the vest)
  await round('Digit4', 'real');
  await page.waitFor('window.__demo.hud.phase === "fight"', 30000);
  await strip('vest', { type: 'hit', id: 'you' }, [0, 0.1, 0.25]);
  await finish();
  say(`moves: ${JSON.stringify(await ev('window.__demo.hud.anim()'))}`);
  const fc = await ev('window.__demo.hud.frameCheck()');
  say(`frame check: ${fc.faults} came on or went off in the picture`);
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
  say(`page errors: ${bad.length ? bad.slice(0, 8).join(' | ') : 'none'}`);
  if (bad.length || fc.faults) failed = true;
} catch (err) {
  failed = true;
  console.error(String(err?.stack ?? err));
} finally {
  writeFileSync(path.join(out, 'fight-moves.log'), `${notes.join('\n')}\n`);
  await browser.close();
}
process.exit(failed ? 1 : 0);
