#!/usr/bin/env node
// THE STAGE'S CLOCK, PUT BACK (raidfight-5, docs/animation/raid-fight.md "By night"). The night look the owner chose (c)
// sets the stage's clock back to 19:00 while the raid plays, for a dusk light over the whole yard. This checks it is
// ALWAYS put back, however the scene ends, and that the run's own clock on your numbers never moves for it. The server
// must be running: node demo/serve.mjs --port 5506 --quiet
//
//   HK2_DEBUG_PORT=5771 node demo/tools/raid-clock.mjs --port 5506 --out <dir> [--only end,skip,throw,stop,dispose]
//
// THE CASES (the game's own night at the crib with the Sixes due, the rush against the Doorman, to bed with a real Enter;
// fight-film.mjs's `night:` case):
//   end      the raid played to its end
//   skip     a real Space 1.5 s into the fight
//   throw    the scene made to throw 1 s into the fight (window.__raidThrowAt, the scene's own hook for the tools)
//   stop     the run stopped 1.5 s into the fight (hud.stop(): the page leaving the scene)
//   dispose  the fight page's raid at night, the page taken off 1.5 s into it (hud.dispose(), as the run's try-out
//            stop does on its way back)
// For each: a still of the yard BEFORE anything of the raid's is put on it and one AFTER everything is off it, both
// under the black (the scene's own window.__raidWait hook; the stage's veil lifted for the picture only), and the light
// at each as numbers (the stage's clock, the night's lamp level, the spot's and the lamps' uniforms); the run's own
// clock (the dock's hour, the rules' state) before, during and after. FAILS on: the light after not the light before,
// the run's clock moved by the raid, a page error (but the throw asked for). Prints `clock-ok` or `clock-fail: <why>`.
// Writes <out>/<case>-before.jpg, -after.jpg, <case>-before-after.jpg (the two side by side, the mean brightness of each)
// and clock.json.
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
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
const out = path.resolve(opt('--out', 'demo/shots/raid-clock'));
const CASES = (opt('--only', null)?.split(',') ?? ['end', 'skip', 'throw', 'stop', 'dispose']);
mkdirSync(out, { recursive: true });
const SEED = 3;

// ── the night, found by the rules ──────────────────────────────────────────────────────────────────────────────────
function nightOf(crew, hold, result) {
  const s0 = newRun({ seed: SEED, cfg });
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
console.log(`the night: day ${N.state.day}, ${N.duel.them?.text}, ${N.duel.you?.label}: ${N.duel.result} in ${N.duel.seconds} s`);

// ── the page ───────────────────────────────────────────────────────────────────────────────────────────────────────
const KEYS = { ' ': ['Space', 32], Enter: ['Enter', 13], ArrowDown: ['ArrowDown', 40] };
const browser = await launch({ width: 1440, height: 900 });
const faults = [];
const report = { night: { day: N.state.day, result: N.duel.result }, cases: {} };
const fail = why => {
  faults.push(why);
  console.log(`  FAULT: ${why}`);
};
const THROWN = 'a throw asked for by the tools';
try {
  const page = await browser.open('about:blank');
  const ev = (js, ms = 60000) => page.evaluate(js, ms);
  async function key(k) {
    const [code, vk] = KEYS[k] ?? [`Key${k.toUpperCase()}`, k.toUpperCase().charCodeAt(0)];
    const keyName = k.length === 1 ? k.toLowerCase() : k;
    for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: keyName, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...(type === 'keyDown' && k.length === 1 ? { text: keyName } : {}) });
  }
  async function go(url, phase) {
    await page.send('Page.navigate', { url });
    await page.sleep(1500);
    await page.waitFor(`window.__demo && window.__demo.hud && window.__demo.hud.phase === "${phase}"`, 300000, 250);
    await page.sleep(1500);
  }
  /** The scene's wait hook: at 'before' and 'after', the veil lifted for one still, the light read, then on. */
  async function hook(name) {
    await ev(`(() => { window.__clockSeen = []; window.__raidWait = (phase, light) => new Promise(go => { window.__clockSeen.push({ phase, light, run: (h => h && { hour: h.state && h.state.hour, clock: h.view && h.view.clock, dock: [...document.querySelectorAll('b, span')].filter(e => e.children.length <= 1 && /^\\d{1,2}:\\d{2}$/.test(e.textContent.trim()) && e.getBoundingClientRect().width > 0).map(e => e.textContent.trim()).join(' ') || null })(window.__demo.hud) }); window.__clockAt = { phase, go }; }); return true; })()`);
    const seen = {};
    return async function waitPhase(phase, ms = 240000) {
      await page.waitFor(`window.__clockAt && window.__clockAt.phase === "${phase}"`, ms, 50);
      await ev(`(() => { const v = document.getElementById('hk2-cut'); v.dataset.was = v.style.opacity; v.style.transition = 'none'; v.style.opacity = '0'; for (const d of document.querySelectorAll('.u-dark-say')) d.style.visibility = 'hidden'; return true; })()`);
      await ev('new Promise(r => { let n = 0; const f = () => (++n > 30 ? r(true) : requestAnimationFrame(f)); requestAnimationFrame(f); })');
      seen[phase] = await page.shot(path.join(out, `${name}-${phase}.jpg`));
      await ev(`(() => { const v = document.getElementById('hk2-cut'); v.style.opacity = v.dataset.was; void v.offsetWidth; v.style.transition = ''; for (const d of document.querySelectorAll('.u-dark-say')) d.style.visibility = ''; const a = window.__clockAt; window.__clockAt = null; a.go(); return true; })()`);
      return seen[phase];
    };
  }
  const runClock = () => ev(`(h => ({ hour: h.state && h.state.hour, clock: h.view && h.view.clock, dock: [...document.querySelectorAll('b, span')].filter(e => e.children.length <= 1 && /^\\d{1,2}:\\d{2}$/.test(e.textContent.trim()) && e.getBoundingClientRect().width > 0).map(e => e.textContent.trim()).join(' ') || null, stage: window.__demo.stage.clock }))(window.__demo.hud)`);
  const lightNow = () => ev(`(() => { const U = window.__city.THREE.ShaderLib.standard.uniforms; const r = v => Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === 'number').map(([k, x]) => [k, +x.toFixed(4)]));
    return { clock: window.__demo.stage.clock ? { ...window.__demo.stage.clock } : null, night: window.__light.night.levelNow, spotP: r(U.citySpotP.value), spotK: r(U.citySpotK.value), lampK: r(U.cityLampK.value), lampX: r(U.cityLampX.value) }; })()`);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  for (const name of CASES) {
    console.log(`${name}:`);
    const C = (report.cases[name] = { name });
    const logs0 = page.logs.length;
    try {
      if (name === 'dispose') {
        await go(`http://127.0.0.1:${port}/demo/?mode=fight&guns=new&site=elm&nostairs=1&night=1&raid=rush:doorman:1:0:5`, 'pick');
        const waitPhase = await hook(name);
        await key('B');
        await page.sleep(600);
        const box = await ev(`(() => { const b = document.querySelector('[data-row="raid:go"]'); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
        if (!box) throw new Error('no Watch the raid');
        for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type, x: box[0], y: box[1], button: 'left', clickCount: 1 });
        await waitPhase('before');
        await page.waitFor('(s => s && s.phase === "fight")(window.__demo.hud.raid.state)', 60000, 50);
        await page.sleep(500);
        C.during = await lightNow();
        await page.shot(path.join(out, `${name}-during.jpg`));
        await page.sleep(1000);
        await ev('window.__demo.hud.dispose()');
        await page.sleep(1200);
        // (left: the scene does not wait for a black, and the page's own black is not down: the yard as it is now)
        await page.shot(path.join(out, `${name}-after.jpg`));
        C.after = await lightNow();
        C.before = (await ev('window.__clockSeen'))[0]?.light ?? null;
        C.rec = await ev('(L => L && L.length ? (({ skipped, left, threw, light }) => ({ skipped, left, threw, light }))(L[L.length - 1]) : null)(window.__demo.hud.raid ? window.__demo.hud.raid.log : null)').catch(() => null);
      } else {
        await go(`http://127.0.0.1:${port}/demo/?mode=run&seed=${SEED}&speed=1&new=1`, 'choose');
        if (!(await ev(`window.__demo.hud.load(${JSON.stringify(N.state)})`, 120000))) throw new Error('the page would not load the night');
        await page.waitFor('window.__demo.hud.phase === "choose" && !window.__demo.hud.odds?.pending', 150000, 100);
        await page.sleep(2000);
        const waitPhase = await hook(name);
        C.runBefore = await runClock();
        // (to bed, by the dock's key for Sleep, then a real Enter)
        const v = await ev('window.__demo.hud.view');
        const want = v.choices.find(x => x.choice.do === 'sleep');
        const k = await ev(`window.__demo.hud.keyFor(${JSON.stringify(want.key)})`);
        await key(k);
        await page.sleep(300);
        for (let n = 0; n < 30 && (await ev('window.__demo.hud.sel')) !== want.key; n++) {
          await key('ArrowDown');
          await page.sleep(120);
        }
        await key('Enter');
        await waitPhase('before');
        await page.waitFor('(s => s && s.phase === "fight")(window.__demo.hud.raid.state)', 60000, 50);
        await page.sleep(500);
        C.during = await lightNow();
        C.runDuring = await runClock();
        await page.shot(path.join(out, `${name}-during.jpg`));
        if (name === 'throw') await ev('window.__raidThrowAt = window.__demo.hud.raid.state.t + 0.5');
        await page.sleep(1000);
        if (name === 'skip') await key(' ');
        if (name === 'stop') {
          await ev('window.__demo.hud.stop()');
          await page.sleep(1200);
          // (the stopped run's own screens over the yard put aside for the still: the yard's light is what is looked at)
          await ev(`(() => { for (const e of document.querySelectorAll('.hk-screen, .hk-overlay, .u-dark-say')) e.style.visibility = 'hidden'; const v = document.getElementById('hk2-cut'); v.style.transition = 'none'; v.style.opacity = '0'; return true; })()`);
          await ev('new Promise(r => { let n = 0; const f = () => (++n > 30 ? r(true) : requestAnimationFrame(f)); requestAnimationFrame(f); })');
          await page.shot(path.join(out, `${name}-after.jpg`));
          C.after = await lightNow();
        } else await waitPhase('after');
        const S = await ev('window.__clockSeen');
        C.before = S.find(x => x.phase === 'before')?.light ?? null;
        if (name !== 'stop') C.after = S.find(x => x.phase === 'after')?.light ?? null;
        const log = (await ev('window.__demo.hud.raid')).log.at(-1);
        C.rec = log?.fight ? { skipped: log.fight.skipped, left: log.fight.left, threw: log.fight.threw, light: log.fight.light, seen: log.fight.seen } : { why: log?.why ?? null };
        if (name !== 'stop') {
          await page.waitFor('!!document.querySelector(".rn-raid-card")', 60000, 100);
          await page.sleep(500);
          C.runAfterCard = await runClock();
        } else {
          await page.sleep(500);
          C.runAfterCard = (C.rec.left ?? true) ? await runClock() : null;
        }
      }
      // THE CHECK: the light after is the light before; the clock while it played was set back; the run's own clock still
      const keys = ['clock', 'night', 'spotP', 'spotK', 'lampK', 'lampX'];
      C.same = !!C.before && !!C.after && keys.every(k2 => same(C.before[k2], C.after[k2]));
      C.differs = C.before && C.after ? keys.filter(k2 => !same(C.before[k2], C.after[k2])) : ['no reading'];
      console.log(`  before: ${JSON.stringify(C.before?.clock)} night ${C.before?.night}; during: ${JSON.stringify(C.during?.clock)} night ${C.during?.night}; after: ${JSON.stringify(C.after?.clock)} night ${C.after?.night}; the same light: ${C.same}${C.same ? '' : ` (differs: ${C.differs.join(', ')})`}`);
      console.log(`  the scene's record: ${JSON.stringify(C.rec)}`);
      if (!C.same) fail(`${name}: the light after is not the light before (${C.differs.join(', ')})`);
      if (C.during?.clock?.hour !== 19) fail(`${name}: the stage's clock was not set back to 19:00 while it played (${JSON.stringify(C.during?.clock)})`);
      if (C.runBefore) {
        console.log(`  the run's clock: before ${JSON.stringify(C.runBefore)}; during ${JSON.stringify(C.runDuring)}; after the card ${JSON.stringify(C.runAfterCard)}`);
        // (the hour on your numbers while it plays is the evening's, as the run holds it: the rules' night has been
        // stepped already, and its morning is shown with the night's card)
        if (C.runDuring && C.runDuring.dock !== C.runBefore.dock) fail(`${name}: the run's clock on your numbers moved while the raid played (${C.runBefore.dock} → ${C.runDuring.dock})`);
        if (/\b19:00\b/.test(C.runDuring?.dock ?? '')) fail(`${name}: your numbers say the stage's 19:00`);
      }
      if (name === 'throw' && !C.rec?.threw) fail('throw: the scene did not say it threw');
      if (name === 'skip' && !C.rec?.skipped) fail('skip: the raid was not skipped');
      const bad = page.logs.slice(logs0).filter(l => (l.startsWith('[error]') || l.startsWith('[exception]')) && !l.includes(THROWN) && !(name === 'throw' && l.includes('[raid] the scene threw')));
      if (bad.length) fail(`${name}: page errors: ${[...new Set(bad)].slice(0, 3).join(' | ').slice(0, 600)}`);
      // (the two stills side by side, the mean brightness of each)
      const sheet = path.join(out, `${name}-before-after.jpg`);
      const py = `import sys\nfrom PIL import Image, ImageDraw, ImageStat\na, b, o, t = sys.argv[1:5]\nA = Image.open(a).convert('RGB'); B = Image.open(b).convert('RGB')\nW, H = A.size\nla = ImageStat.Stat(A.convert('L')).mean[0]; lb = ImageStat.Stat(B.convert('L')).mean[0]\nS = Image.new('RGB', (W * 2, H + 28), (12, 12, 14)); S.paste(A, (0, 28)); S.paste(B, (W, 28))\nd = ImageDraw.Draw(S); d.text((8, 8), f'{t}: before the raid (mean {la:.1f})', fill=(255, 230, 120)); d.text((W + 8, 8), f'after it (mean {lb:.1f})', fill=(255, 230, 120))\nS.resize((W, (H + 28) // 2)).save(o, quality=88)\nprint(f'{la:.2f} {lb:.2f}')\n`;
      const [la, lb] = execFileSync('python3', ['-c', py, path.join(out, `${name}-before.jpg`), path.join(out, `${name}-after.jpg`), sheet, `${name}: ${C.same ? 'the same light' : 'NOT the same light'}`]).toString().trim().split(' ').map(Number);
      C.brightness = { before: la, after: lb };
      console.log(`  the stills: ${sheet} (mean brightness ${la} before, ${lb} after)`);
    } catch (err) {
      fail(`${name}: ${String(err?.stack ?? err).slice(0, 800)}`);
      console.error(page.logs.slice(-8).join('\n').slice(0, 2000));
    }
  }
} finally {
  report.faults = faults;
  writeFileSync(path.join(out, 'clock.json'), `${JSON.stringify(report, null, 1)}\n`);
  await browser.close();
  console.log(faults.length ? `clock-fail: ${faults[0]}` : 'clock-ok');
  process.exitCode = faults.length ? 1 : 0;
}
