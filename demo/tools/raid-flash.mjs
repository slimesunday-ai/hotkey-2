#!/usr/bin/env node
// THE SHOT'S FLASH, HELD STILL (raidfight-5, docs/animation/raid-fight.md "By night"): the same round of the same night
// raid in the game, with the flash as it was (`&flash=old`: a key lamp at the muzzle for 0.07 s) and as it is now (the
// night look c's spot over the muzzle, full then gone in about eight pictures), each held still on the picture it is
// fired in (the scene's window.__raidHoldAt), from the game's own camera and from a low view. The server must run:
// node demo/serve.mjs --port 5506 --quiet
//
//   HK2_DEBUG_PORT=5771 node demo/tools/raid-flash.mjs --port 5506 --out <dir> [--at 3.63] [--low 90,22,2.9]
//
// The night: run-raid's and fight-film's (`night:rush:doorman:won`): three heavies, a Doorman, the run's night at the
// crib with the Sixes due, to bed with a real Enter. --at: the rules' clock of the round held (the Doorman's third, at
// 3.63 s). Writes <dir>/flash-<old|now>-<game|low>.jpg and <dir>/flash-before-after.jpg (top the game's camera, below the
// low view; left the flash as it was, right as it is), and prints how strong the spot's flash was in the held picture.
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { launch } from './chrome.mjs';
import { RUN_CONFIG as cfg, newRun, step } from '../../src/run/index.mjs';
import { crewFoes } from '../../src/run/raid.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const at = args.indexOf(name);
  return at === -1 ? fallback : args[at + 1];
};
const port = opt('--port', 5506);
const out = path.resolve(opt('--out', 'demo/shots/raid-flash'));
const AT = Number(opt('--at', '3.63'));
const LOW = opt('--low', '90,22,2.9').split(',').map(Number);
mkdirSync(out, { recursive: true });

function nightOf(crew, hold, result) {
  const s0 = newRun({ seed: 3, cfg });
  const c = crewFoes(cfg, crew, 1);
  for (let day = 3; day < 90; day++) {
    const sixes = { ...s0.sixes, marks: [{ why: 'refuse', text: `refused Dutch the tax (day ${day})`, n: 9, day }], did: day, word: day - 3, raid: { day, warned: day - 1, crew, size: 1, n: c.n, stake: 1500 } };
    const s = { ...s0, place: 'crib', day, hour: 21, energy: 4, stash: { smokes: 6 }, things: { sixshot: true, doorman: true, chopper: true, longeye: true, doorbar: true, camera: true }, ammo: { sixshot: 24, doorman: 12, chopper: 60, longeye: 10 }, holdWith: null, sixes, banked: s0.banked + 400, books: { ...s0.books, earned: s0.books.earned + 400 } };
    const held = step(cfg, s, { do: 'holdWith', with: hold }).state;
    const r = step(cfg, held, { do: 'sleep' });
    const e = r.events.find(x => x.type === 'raid' && x.kind === 'sixes' && x.duel);
    if (e && e.home && (!result || e.duel.result === result)) return { state: held, duel: e.duel };
  }
  throw new Error(`no night of ${crew} with ${hold}`);
}
const N = nightOf('rush', 'doorman', 'won');
const KEYS = { Enter: ['Enter', 13], ArrowDown: ['ArrowDown', 40] };
const browser = await launch({ width: 1440, height: 900 });
let failed = null;
try {
  const page = await browser.open('about:blank');
  const ev = (js, ms = 60000) => page.evaluate(js, ms);
  async function key(k) {
    const [code, vk] = KEYS[k] ?? [`Key${k.toUpperCase()}`, k.toUpperCase().charCodeAt(0)];
    const keyName = k.length === 1 ? k.toLowerCase() : k;
    for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: keyName, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...(type === 'keyDown' && k.length === 1 ? { text: keyName } : {}) });
  }
  for (const [name, qs] of [['old', '&flash=old'], ['now', '']]) {
    await page.send('Page.navigate', { url: `http://127.0.0.1:${port}/demo/?mode=run&seed=3&speed=1&new=1${qs}` });
    await page.sleep(1500);
    await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 300000, 250);
    if (!(await ev(`window.__demo.hud.load(${JSON.stringify(N.state)})`, 120000))) throw new Error('the page would not load the night');
    await page.waitFor('window.__demo.hud.phase === "choose" && !window.__demo.hud.odds?.pending', 150000, 100);
    await page.sleep(2000);
    await ev(`window.__raidHoldAt = ${AT}`);
    const v = await ev('window.__demo.hud.view');
    const want = v.choices.find(x => x.choice.do === 'sleep');
    await key(await ev(`window.__demo.hud.keyFor(${JSON.stringify(want.key)})`));
    await page.sleep(300);
    for (let n = 0; n < 30 && (await ev('window.__demo.hud.sel')) !== want.key; n++) {
      await key('ArrowDown');
      await page.sleep(120);
    }
    await key('Enter');
    await page.waitFor('window.__demo.hud.raid.active && window.__demo.stage.actors.speed === 0', 120000, 20);
    await page.sleep(700);
    const st = await ev('window.__demo.hud.raid.state');
    console.log(`${name}: held at the rules' clock ${st?.t} s; the spot's flash ${st?.flash ?? 'none'}`);
    await page.shot(path.join(out, `flash-${name}-game.jpg`));
    await ev(`window.__demo.stage.camera.setAngle({ bearing: ${LOW[0]}, down: ${LOW[1]}, high: ${LOW[2]} })`);
    await page.sleep(1500);
    await page.shot(path.join(out, `flash-${name}-low.jpg`));
    await ev('window.__demo.stage.camera.setAngle()');
    await ev('window.__demo.stage.setSpeed(1)');
    await page.waitFor('!window.__demo.hud.raid.active', 120000, 100);
  }
  const py = `import sys, os\nfrom PIL import Image, ImageDraw\nd, at = sys.argv[1], sys.argv[2]\nrows = []\nfor v in ('game', 'low'):\n    a = Image.open(os.path.join(d, f'flash-old-{v}.jpg')).convert('RGB'); b = Image.open(os.path.join(d, f'flash-now-{v}.jpg')).convert('RGB')\n    W, H = a.size; box = (int(W * .2), int(H * .12), int(W * .8), int(H * .88))\n    a = a.crop(box); b = b.crop(box); w, h = a.size\n    r = Image.new('RGB', (w * 2 + 8, h + 26), (12, 12, 14)); r.paste(a, (0, 26)); r.paste(b, (w + 8, 26))\n    t = ImageDraw.Draw(r); t.text((8, 7), f'the flash as it was ({v} view, held at {at} s)', fill=(255, 230, 120)); t.text((w + 16, 7), f'the flash now ({v} view)', fill=(255, 230, 120))\n    rows.append(r)\nS = Image.new('RGB', (rows[0].width, sum(r.height for r in rows) + 6), (12, 12, 14)); y = 0\nfor r in rows: S.paste(r, (0, y)); y += r.height + 6\nS.save(os.path.join(d, 'flash-before-after.jpg'), quality=88)\n`;
  execFileSync('python3', ['-c', py, out, String(AT)]);
  console.log(`the sheet: ${path.join(out, 'flash-before-after.jpg')}`);
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
  if (bad.length) failed = `page errors: ${[...new Set(bad)].slice(0, 3).join(' | ').slice(0, 600)}`;
} catch (err) {
  failed = String(err?.stack ?? err).slice(0, 1200);
} finally {
  await browser.close();
  console.log(failed ? `flash-fail: ${failed}` : 'flash-ok');
  process.exitCode = failed ? 1 : 0;
}
