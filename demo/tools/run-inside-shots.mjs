#!/usr/bin/env node
// Pictures of THE INSIDE VIEW (demo/stage/inside.js) in THE RUN: the crib by day and at 22:00, the door outside just
// before the fade, the fade, just inside after it, asleep on the bed; each at the game's own camera (1600×1000) and
// as a close-up on the player. The crib at phone width (400×860). And two strips of frames taken as fast as the page
// gives them, one across going in and one across coming out, each frame with the veil's opacity and whether the
// inside view was up. The server must be running: node demo/serve.mjs
//
//   node demo/tools/run-inside-shots.mjs --out <dir> [--port 5470] [--seed 3] [--only day,strips,door,bed,night,phone]
//
// The stage is held still for a picture (stage.setSpeed(0)) and goes on after; the fade is real time and is never
// held: the mid-fade pictures are taken while it runs (the close-up one from a close camera put up at the door before).
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-inside'));
const port = opt('--port', 5470);
const url = `http://127.0.0.1:${port}/demo/?mode=run&seed=${opt('--seed', '3')}`;
const only = opt('--only', null)?.split(',') ?? null;
const want = name => !only || only.includes(name);
const KEY = 'pad:a1';
mkdirSync(out, { recursive: true });

async function session(width, height, run) {
  const browser = await launch({ width, height });
  let page = null;
  try {
    page = await browser.open(url);
    await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 150000);
    await page.evaluate('window.__demo.stage.actors.audit(true)');
    await page.sleep(2500);
    await run(page);
    console.log('audit', JSON.stringify(await page.evaluate(`(a => a && { scenes: a.scenes, overlaps: a.overlaps, furniture: a.furniture, close: a.close, jumps: a.jumps, pops: a.pops, slides: a.slides, through: a.through, ex: a.examples.filter(e => /^(furniture|overlap|close|jump|pop|slide|through)/.test(e)).slice(0, 6) })(window.__demo.stage.actors.audit())`)));
    console.log('inside', JSON.stringify(await page.evaluate('(d => ({ switches: d.switches, blacks: d.blacks, lastMs: d.lastMs, furniture: d.furniture, examples: d.examples, fit: d.fit }))(window.__demo.stage.inside.debug())')));
    const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[stage\]|\[run\]|\[inside\]|\[crib\]/.test(l));
    console.log(bad.length ? `page errors:\n  ${[...new Set(bad)].slice(0, 10).join('\n  ').slice(0, 2500)}` : 'page errors: 0');
  } catch (err) {
    console.error(String(err));
    if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-10).join('\n').slice(0, 2500));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

const tools = page => {
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  const key = k => ev(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true }))`);
  const phase = p => page.waitFor(`window.__demo.hud.phase === ${JSON.stringify(p)}`, 120000, 100);
  const choose = async what => {
    const k = await ev(`window.__demo.hud.view.choices.find(c => c.choice.do === ${JSON.stringify(what)} && c.available)?.key ?? null`);
    if (!k) throw new Error(`no ${what} to choose`);
    await key(String(k));
    await key('Enter');
  };
  const until = (js, ms = 30000) => page.waitFor(js, ms, 25);
  const door = `window.__demo.stage.doorway.info(${JSON.stringify(KEY)}, 'a1')`;
  const veil = `(+getComputedStyle(document.getElementById('hk2-cut')).opacity)`;
  /** The close camera: the city's own, on the game camera's own line to the player, 4.4 m off; then given back. */
  const closeUp = `(() => { const c = window.__city, A = window.__demo.stage.actors.get('a1'), cp = c.camera.position;
      const t = [A.x, A.y + 0.9, A.z], [dx, dy, dz] = [cp.x - t[0], cp.y - t[1], cp.z - t[2]], d = Math.hypot(dx, dy, dz) || 1, k = Math.min(1, 4.4 / d);
      const p = [t[0] + dx * k, t[1] + dy * k, t[2] + dz * k];
      c.VIEWS.hk2close = { pos: p, tgt: t, fov: 45, sh: [(p[0] + t[0]) / 2, (p[2] + t[2]) / 2, 16] };
      c.cam?.toOrbit({ instant: true });
      c.setView('hk2close'); })()`;
  const giveBack = `(() => { const st = window.__demo.stage; st.camera.focus(null); st.focus('a1'); st.camera.arrived(); })()`;
  const saved = async name => console.log(`saved ${await page.shot(path.join(out, `${name}.jpg`))}`);
  /** The moment, held still: the game's own picture, then the close-up, then play goes on. */
  async function both(name, { hide = null } = {}) {
    await ev('window.__demo.stage.setSpeed(0)');
    if (hide) await ev(`document.querySelectorAll(${JSON.stringify(hide)}).forEach(e => (e.style.visibility = 'hidden'))`);
    await page.sleep(250);
    await saved(name);
    await ev(closeUp);
    await page.sleep(700);
    await saved(`${name}-close`);
    await ev(giveBack);
    await page.sleep(700);
    if (hide) await ev(`document.querySelectorAll(${JSON.stringify(hide)}).forEach(e => (e.style.visibility = ''))`);
    await ev('window.__demo.stage.setSpeed(1)');
  }
  /** Frames as fast as they come, from `from` until `to` has held for `after` ms: each with the veil and the view. */
  async function strip(name, from, to, { after = 1200, max = 70 } = {}) {
    await until(from, 40000);
    const dir = path.join(out, `strip-${name}`);
    mkdirSync(dir, { recursive: true });
    const log = [];
    const t0 = Date.now();
    let doneAt = null;
    for (let k = 0; k < max; k++) {
      const s = await ev(`JSON.stringify({ veil: ${veil}, up: window.__demo.stage.inside.up, on: window.__demo.stage.camera.state().on, door: ${door} })`);
      const r = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 1600, height: 1000, scale: 0.5 } });
      const file = path.join(dir, `${String(k).padStart(2, '0')}.jpg`);
      writeFileSync(file, Buffer.from(r.data, 'base64'));
      log.push({ k, t: Date.now() - t0, ...JSON.parse(s) });
      if (doneAt === null && (await ev(`!!(${to})`))) doneAt = Date.now();
      if (doneAt !== null && Date.now() - doneAt > after) break;
    }
    writeFileSync(path.join(dir, 'frames.json'), JSON.stringify(log, null, 1));
    console.log(`strip ${name}: ${log.length} frames in ${log.at(-1)?.t} ms · ${dir}`);
  }
  return { ev, key, phase, choose, until, both, strip, door, veil, closeUp, giveBack, saved };
};

await session(1600, 1000, async page => {
  const { ev, phase, choose, until, both, strip, door, veil, closeUp, saved } = tools(page);
  const inner = `window.__demo.stage.inside.up === ${JSON.stringify(KEY)}`;
  const floor = async name => console.log(`${name} floor on screen ${await ev('JSON.stringify(window.__demo.stage.inside.floorPx())')}`);
  if (want('day')) {
    await floor('day');
    await both('1-inside-day');
  }
  if (want('strips')) {
    // OUT: from a step short of the room's door until a second after the picture is back outside
    await choose('out');
    await strip('out', `(d => d && d.inside && d.dIn < 1.4)(${door})`, `!window.__demo.stage.inside.up && ${veil} < 0.02`);
    await phase('choose');
    await page.sleep(1500);
    // IN: from the step outside until a second after the picture is back inside
    await choose('inside');
    await strip('in', `(d => d && !d.inside && d.d < 2.2 && d.side > 0)(${door})`, `${inner} && ${veil} < 0.02`);
    await phase('choose');
    await page.sleep(1500);
  }
  if (want('door')) {
    await choose('out');
    await phase('choose');
    await page.sleep(1500);
    await both('2-park');
    await choose('inside');
    // just before the fade: the door open, on the stoop, the picture not yet going dark
    await until(`(d => d && !d.inside && d.k > 0.85 && d.d < 1.1)(${door}) && ${veil} < 0.02`, 40000);
    await both('3-door-before-fade');
    // mid-fade, the game's camera (the fade is never held)
    await until(`${veil} > 0.35 && ${veil} < 0.8`, 20000).catch(() => console.log('  (mid-fade was missed)'));
    await saved('4-mid-fade');
    // just inside after the fade
    await until(`${inner} && ${veil} < 0.03`, 20000);
    await both('5-just-inside');
    await phase('choose');
    await page.sleep(1200);
    // the mid-fade close-up: a close camera put up at the door before the fade, then the fade taken as it runs
    await choose('out');
    await phase('choose');
    await page.sleep(1500);
    await choose('inside');
    await until(`(d => d && !d.inside && d.k > 0.6 && d.d < 1.3)(${door}) && ${veil} < 0.02`, 40000);
    await ev('window.__demo.stage.setSpeed(0)');
    await ev(closeUp);
    await page.sleep(500);
    await ev('window.__demo.stage.setSpeed(1)');
    await until(`${veil} > 0.35 && ${veil} < 0.8`, 20000).catch(() => console.log('  (mid-fade close was missed)'));
    await saved('4-mid-fade-close');
    await until(`${inner} && ${veil} < 0.03`, 20000);
    await phase('choose');
    await page.sleep(1200);
  }
  if (want('bed')) {
    await phase('choose');
    await choose('sleep');
    await until(`(window.__demo.stage.actors.clipOf('a1')?.name ?? '') === 'sleep'`, 20000).catch(() => console.log('  (asleep was missed)'));
    await page.sleep(1200);
    await both('6-asleep', { hide: '.hk-overlay' });
    await ev(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`);
  }
  if (want('night')) {
    await phase('choose');
    await page.sleep(1000);
    await ev(`(async () => { const h = window.__demo.hud; const s = structuredClone(h.state); Object.assign(s, { place: 'crib', hour: 22 }); return await h.load(s); })()`);
    await page.sleep(3000);
    await floor('22:00');
    await both('7-inside-2200');
  }
});

if (want('phone')) {
  await session(400, 860, async page => {
    const { both, ev } = tools(page);
    console.log(`phone floor on screen ${await ev('JSON.stringify(window.__demo.stage.inside.floorPx())')}`);
    await both('8-phone-inside');
  });
}
