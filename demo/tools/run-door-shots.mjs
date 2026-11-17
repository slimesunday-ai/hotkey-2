#!/usr/bin/env node
// Pictures of THE RUN at home and on the way in and out, each one twice: the game's own camera at 1600×1000, and a
// close-up on the player (the stage's close angle). At each moment the stage is held still (stage.setSpeed(0)), the
// game's picture is taken, the camera comes in close, that picture is taken, and play goes on. Then the panels:
// the map closed and open, at 1600×1000 and at phone width. The server must be running: node demo/serve.mjs
//
//   node demo/tools/run-door-shots.mjs --out <dir> [--port 5470] [--seed 3] [--only door,home,bed,map]
//
// door   inside · at the door inside, it open · on the step, it open · walking off, the trailer whole · the trailer
//        park's spot (the locals apart)
// home   from the flea market: put down outside after the ride home · walking in · the banked reveal
// bed    asleep (the day's report lifted for the picture)
// map    the map closed and open; and at 400×860
import path from 'node:path';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-door'));
const port = opt('--port', 5470);
const url = `http://127.0.0.1:${port}/demo/?mode=run&seed=${opt('--seed', '3')}`;
const only = opt('--only', null)?.split(',') ?? null;
const want = name => !only || only.includes(name);
const KEY = 'pad:a1';

async function session(width, height, run) {
  const browser = await launch({ width, height });
  let page = null;
  try {
    page = await browser.open(url);
    await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 150000);
    await page.evaluate('window.__demo.stage.actors.audit(true)');
    await page.sleep(2000);
    await run(page);
    console.log('audit', JSON.stringify(await page.evaluate(`(a => a && { scenes: a.scenes, overlaps: a.overlaps, furniture: a.furniture, close: a.close, jumps: a.jumps, pops: a.pops, slides: a.slides, through: a.through, ex: a.examples.filter(e => /^(furniture|overlap|close|jump|pop|slide|through)/.test(e)).slice(0, 6) })(window.__demo.stage.actors.audit())`)));
    const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[stage\]|\[run\]/.test(l));
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
  // (ui-3, leg 2, THE DOCK: a rules' choice key is reached by its card's 1 to 3 or its verb's letter (B Shop, R Rob,
  // X Bins, T Travel, H Home, Z Sleep), and in the verb's list by its line; then Enter does it)
  const dockPress = async k => {
    const at = await ev(`window.__demo.hud.keyFor(${JSON.stringify(String(k))})`);
    if (at) await key(at);
    await ev(`window.__demo.hud.pick(${JSON.stringify(String(k))})`);
  };
  const phase = p => page.waitFor(`window.__demo.hud.phase === ${JSON.stringify(p)}`, 120000, 100);
  const choose = async k => {
    await dockPress(k);
    await key('Enter');
  };
  const door = () => ev(`window.__demo.stage.doorway.info(${JSON.stringify(KEY)}, 'a1')`);
  const until = (js, ms = 30000) => page.waitFor(js, ms, 30);
  /** The moment, held still: the game's own picture, then the close-up, then play goes on. */
  async function both(name, { hide = null } = {}) {
    await ev('window.__demo.stage.setSpeed(0)');
    if (hide) await ev(`document.querySelectorAll(${JSON.stringify(hide)}).forEach(e => (e.style.visibility = 'hidden'))`);
    await page.sleep(250);
    console.log(`saved ${await page.shot(path.join(out, `${name}.jpg`))}`);
    // (the close-up: the city's own camera set straight at the player, from the side the game's camera looks from,
    // four metres off and a little over head height; then given back to the stage)
    await ev(`(() => { const c = window.__city, A = window.__demo.stage.actors.get('a1'), cp = c.camera.position;
      const [dx, dz] = [cp.x - A.x, cp.z - A.z], d = Math.hypot(dx, dz) || 1;
      const p = [A.x + (dx / d) * 3.6, A.y + 3.4, A.z + (dz / d) * 3.6], t = [A.x, A.y + 0.8, A.z];
      c.VIEWS.hk2close = { pos: p, tgt: t, fov: 45, sh: [(p[0] + t[0]) / 2, (p[2] + t[2]) / 2, 16] };
      c.cam?.toOrbit({ instant: true });
      c.setView('hk2close'); })()`);
    await page.sleep(900);
    console.log(`saved ${await page.shot(path.join(out, `${name}-close.jpg`))}`);
    await ev(`(() => { const st = window.__demo.stage; st.camera.focus(null); st.focus('a1'); st.camera.arrived(); })()`);
    await page.sleep(1000);
    if (hide) await ev(`document.querySelectorAll(${JSON.stringify(hide)}).forEach(e => (e.style.visibility = ''))`);
    await ev('window.__demo.stage.setSpeed(1)');
  }
  return { ev, key, phase, choose, door, until, both };
};

await session(1600, 1000, async page => {
  const { ev, key, phase, choose, door, until, both } = tools(page);
  if (want('door')) {
    await both('1-inside');
    await choose(4);
    // at the door, inside, it open
    await until(`(d => d && d.k > 0.6 && d.side < -0.15)(window.__demo.stage.doorway.info(${JSON.stringify(KEY)}, 'a1'))`);
    await both('2-door-inside-open');
    // on the step, it open
    await until(`(d => d && d.side > 0.6 && d.k > 0.25)(window.__demo.stage.doorway.info(${JSON.stringify(KEY)}, 'a1'))`, 20000).catch(() => console.log('  (the step with the door open was missed)'));
    await both('3-step-door-open');
    // walking off, the room shut: the trailer whole
    await until(`!window.__demo.stage.debug().inside.length && window.__demo.stage.actors.get('a1').moving > 0.3`, 20000).catch(() => console.log('  (walking off was missed)'));
    await page.sleep(300);
    await both('4-walking-off');
    await phase('choose');
    await page.sleep(1500);
    await both('5-park-spot');
    console.log('door now', JSON.stringify(await door()));
  }
  if (want('home')) {
    // from the market, home: put down outside, walking in, the reveal
    await phase('choose');
    await ev(`(async () => { const h = window.__demo.hud; const s = structuredClone(h.state); Object.assign(s, { place: 'market', hour: 15, energy: 4, heat: 0, carried: 64, hoursThere: 2, rig: { chances: [99], rolls: [] } }); s.books.earned += (s.carried + s.banked) - (h.state.carried + h.state.banked); return await h.load(s); })()`);
    await page.sleep(2500);
    await key('h');
    await key('Enter');
    await page.sleep(2500);
    await key(' ');
    await until(`!window.__demo.stage.travelling && !window.__demo.stage.debug().dark && (d => d && d.step > 8)(window.__demo.stage.doorway.info(${JSON.stringify(KEY)}, 'a1'))`, 60000);
    await page.sleep(500);
    await both('6-put-down-outside');
    await until(`(d => d && d.k > 0.5 && d.side < 0.5 && d.side > -0.5)(window.__demo.stage.doorway.info(${JSON.stringify(KEY)}, 'a1'))`, 40000).catch(() => console.log('  (walking in was missed)'));
    await both('7-walking-in');
    await phase('choose');
    await page.sleep(1200);
    await both('8-banked-reveal');
  }
  if (want('bed')) {
    await phase('choose');
    await choose(await ev(`window.__demo.hud.view.choices.find(c => c.choice.do === 'sleep').key`));
    await until(`(window.__demo.stage.actors.clipOf('a1')?.name ?? '') === 'sleep'`, 20000).catch(() => console.log('  (asleep was missed)'));
    await page.sleep(1200);
    await both('9-asleep', { hide: '.hk-overlay' });
    await key('Enter');
  }
  if (want('map')) {
    await phase('choose');
    await page.sleep(800);
    console.log(`saved ${await page.shot(path.join(out, 'map-closed.jpg'))}`);
    await key('m');
    await page.sleep(500);
    console.log(`saved ${await page.shot(path.join(out, 'map-open.jpg'))}`);
    await key('Escape');
  }
});

if (want('map') || want('phone')) {
  await session(400, 860, async page => {
    const { key } = tools(page);
    console.log(`saved ${await page.shot(path.join(out, 'phone-closed.jpg'))}`);
    await key('m');
    await page.sleep(500);
    console.log(`saved ${await page.shot(path.join(out, 'phone-map-open.jpg'))}`);
  });
}
