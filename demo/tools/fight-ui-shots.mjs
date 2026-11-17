#!/usr/bin/env node
// THE FIGHT'S FRAME, PICTURED (join-1): the fight page (demo/?mode=fight) in the run's frame at 1280 by 800, by real
// keys: choosing (full), Build your own open (B), the results open (J), the three sizes (I: full, compact, hidden)
// while choosing and while a round is on, a round (with how much of the picture the interface covers), the result
// card; and the run's page beside it, choosing and while an hour plays (its covered share, measured the same way), for
// the shared look to be judged side by side. Fails on any page error.
// The server must be running: node demo/serve.mjs --port 5485
//
//   HK2_DEBUG_PORT=5724 node demo/tools/fight-ui-shots.mjs --port 5485 --out <dir>
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { COVERED } from './covered.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/fight-ui'));
const port = opt('--port', 5485);
mkdirSync(out, { recursive: true });
const notes = [];
const say = t => {
  console.log(t);
  notes.push(t);
};
let failed = false;
const CODES = { KeyB: 66, KeyJ: 74, KeyI: 73, KeyF: 70, Digit1: 49, Digit2: 50, Digit3: 51, Digit4: 52, Digit5: 53, Enter: 13, Escape: 27, ArrowUp: 38, ArrowDown: 40, KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68 };
const KEYS = { Enter: 'Enter', Escape: 'Escape', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown' };

async function onPage(url, fn) {
  const browser = await launch({ width: 1280, height: 800 });
  let page = null;
  try {
    page = await browser.open(url);
    const key = (type, code) => page.send('Input.dispatchKeyEvent', { type, code, key: KEYS[code] ?? (code.startsWith('Key') ? code.slice(3).toLowerCase() : code.slice(5)), windowsVirtualKeyCode: CODES[code] });
    const press = async (code, after = 350) => {
      await key('keyDown', code);
      await page.sleep(60);
      await key('keyUp', code);
      await page.sleep(after);
    };
    const shot = async name => say(`saved ${await page.shot(path.join(out, `${name}.jpg`))}`);
    const covered = async what => {
      const c = await page.evaluate(COVERED);
      say(`covered ${what}: ${c.pct}% of the picture`);
      return c.pct;
    };
    await fn({ page, key, press, shot, covered, ev: js => page.evaluate(js) });
    const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
    say(`page errors on ${url.replace(/^.*\?/, '?')}: ${bad.length ? `\n  ${[...new Set(bad)].slice(0, 8).join('\n  ')}` : 'none'}`);
    if (bad.length) failed = true;
  } catch (err) {
    failed = true;
    console.error(String(err?.stack ?? err));
    if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-12).join('\n'));
  } finally {
    await browser.close();
  }
}

// THE FIGHT PAGE
await onPage(`http://127.0.0.1:${port}/demo/?mode=fight`, async ({ page, press, shot, covered, ev, key }) => {
  const Hd = 'window.__demo.hud';
  await page.waitFor(`window.__demo && ${Hd} && ${Hd}.phase === "pick"`, 180000);
  await page.sleep(2500);
  // (this page's own memory of its frame starts fresh: a new browser profile)
  await press('Digit4');
  await shot('30-fight-choosing');
  await covered('the fight, choosing (full)');
  await press('KeyB', 500);
  await shot('31-fight-build-open');
  await press('KeyB');
  await press('KeyJ', 500);
  await shot('32-fight-results-open');
  await covered('the fight, choosing, the results open');
  await press('KeyJ');
  await press('KeyI', 600);
  await shot('33-fight-compact-choosing');
  await covered('the fight, choosing (compact)');
  await press('KeyI', 600);
  await shot('34-fight-hidden-choosing');
  await covered('the fight, choosing (hidden)');
  await press('KeyI', 600);
  // A ROUND
  await press('Enter', 200);
  await page.waitFor(`${Hd}.phase === "fight"`, 30000);
  await page.sleep(3200);
  await shot('35-fight-mid-round');
  const mid = await covered('the fight, mid-round (compact by itself)');
  if (mid >= 10) {
    failed = true;
    say(`FAIL: the interface covers ${mid}% while fighting (the target: under 10)`);
  }
  await press('KeyI', 600);
  await press('KeyI', 600);
  await shot('36-fight-hidden-round');
  await covered('the fight, mid-round (hidden)');
  await press('KeyI', 600);
  await ev(`${Hd}.pause(false, 3)`);
  const down = new Set();
  for (let t0 = Date.now(); Date.now() - t0 < 120000;) {
    const s = await ev(`(h => ({ phase: h.phase, m: h.driveMove() }))(${Hd})`);
    if (s.phase === 'over') break;
    const want = new Set([s.m[0] > 0.38 ? 'KeyD' : null, s.m[0] < -0.38 ? 'KeyA' : null, s.m[1] > 0.38 ? 'KeyS' : null, s.m[1] < -0.38 ? 'KeyW' : null].filter(Boolean));
    for (const c of [...down]) if (!want.has(c)) await key('keyUp', c), down.delete(c);
    for (const c of want) if (!down.has(c)) await key('keyDown', c), down.add(c);
    await page.sleep(100);
  }
  for (const c of down) await key('keyUp', c);
  await ev(`${Hd}.pause(false, 1)`);
  await page.sleep(1500);
  const r = await ev(`${Hd}.fight.over.result`);
  await shot(`37-fight-card-${r}`);
  await covered(`the fight, its result card (${r})`);
});

// THE RUN PAGE, for the same look beside it: choosing, and while an hour plays
await onPage(`http://127.0.0.1:${port}/demo/?mode=run&seed=3&new=1`, async ({ page, press, shot, covered }) => {
  const Hd = 'window.__demo.hud';
  await page.waitFor(`window.__demo && ${Hd} && ${Hd}.phase === "choose"`, 240000);
  await page.sleep(2000);
  await shot('38-run-choosing');
  await covered('the run, choosing (full)');
  await press('Digit1');
  await press('Enter', 0);
  await page.waitFor(`${Hd}.phase === "playing"`, 20000);
  await page.sleep(2500);
  await shot('39-run-scene');
  await covered('the run, while an hour plays');
});

say(failed ? 'fight-ui-fail' : 'fight-ui-ok');
writeFileSync(path.join(out, 'fight-ui-shots.log'), `${notes.join('\n')}\n`);
process.exit(failed ? 1 : 0);
