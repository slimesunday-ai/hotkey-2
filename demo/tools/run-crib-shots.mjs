#!/usr/bin/env node
// Pictures of THE RUN'S CRIB (the starter pack: demo/stage/set/starter.js, set/crib.js) and of the run's OPENING over
// the city (demo/stage/opening.js), each named by what it shows. The server must be running: node demo/serve.mjs
//
//   node demo/tools/run-crib-shots.mjs --out <dir> [--port 5470] [--seed 3] [--size 1869x882]
//        [--crib a|b] [--only opening,skip,day,zoom,corners,walk,stash,home,sleep,bed,night]
//
//   opening  the opening as it plays, frame after frame as fast as the page gives them, each with its time; eight
//            of them, evenly spaced, saved on their own and on one contact sheet (opening-strip.jpg)
//   skip     a second page: Space half way through the opening, the frame before and after it
//   day      the whole room by day (the game's own camera) · zoom: the same after the wheel, nearer
//   corners  each of the room's four corners close up, twice from a little apart, and the doorway's stubs and sill
//   walk     a strip of walking out of the room to the step outside, and one of walking back in
//   stash    in from the park with cash: the stash beat at the floorboard
//   home     home from the market by the subway: up the lane, to the door and in (what the player holds, frame by frame)
//   sleep    asleep on the mattress · bed: the real bed bought at the crib (the room before and after), asleep on it
//   night    the room at 22:00
// Each page's audit (overlaps, furniture, vanish) and its errors are printed after it.
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-crib'));
const port = opt('--port', 5470);
const crib = opt('--crib', 'a');
const [W, H] = opt('--size', '1869x882').split('x').map(Number);
const only = opt('--only', null)?.split(',') ?? null;
const want = name => !only || only.includes(name);
const tag = `${crib}-${W}x${H}`;
const url = `http://127.0.0.1:${port}/demo/?mode=run&seed=${opt('--seed', '3')}${crib === 'b' ? '&crib=b' : ''}`;
const KEY = 'pad:a1';
mkdirSync(out, { recursive: true });

async function session(name, run) {
  const browser = await launch({ width: W, height: H });
  let page = null;
  try {
    page = await browser.open(url);
    await run(page);
    const audit = await page.evaluate(`(a => a && { overlaps: a.overlaps, furniture: a.furniture, vanish: a.vanish, close: a.close, through: a.through, ex: a.examples.filter(e => /^(furniture|overlap|vanish)/.test(e)).slice(0, 6) })(window.__demo.stage.actors.audit())`).catch(() => null);
    const ins = await page.evaluate('(d => ({ switches: d.switches, blacks: d.blacks, furniture: d.furniture, examples: d.examples, fit: d.fit }))(window.__demo.stage.inside.debug())').catch(() => null);
    console.log(`${name}: audit ${JSON.stringify(audit)} · inside ${JSON.stringify(ins)}`);
    const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[stage\]|\[run\]|\[inside\]|\[crib\]|\[opening\]|\[set\]/.test(l));
    console.log(`${name}: page errors ${bad.length}${bad.length ? `\n  ${[...new Set(bad)].slice(0, 10).join('\n  ').slice(0, 2500)}` : ''}`);
  } catch (err) {
    console.error(`${name}: ${String(err)}`);
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
  const phase = p => page.waitFor(`window.__demo.hud && window.__demo.hud.phase === ${JSON.stringify(p)}`, 150000, 100);
  const choose = async (what, extra = '') => {
    const k = await ev(`window.__demo.hud.view.choices.find(c => c.choice.do === ${JSON.stringify(what)} ${extra} && c.available)?.key ?? null`);
    if (!k) throw new Error(`no ${what} to choose`);
    await dockPress(k);
    await key('Enter');
  };
  const until = (js, ms = 30000) => page.waitFor(js, ms, 25);
  const saved = async name => console.log(`saved ${await page.shot(path.join(out, `${name}.jpg`))}`);
  const still = async (name, fn = null) => {
    await ev('window.__demo.stage.setSpeed(0)');
    if (fn) await fn();
    await page.sleep(400);
    await saved(name);
    await ev('window.__demo.stage.setSpeed(1)');
  };
  const load = patch => ev(`(async () => { const h = window.__demo.hud; const s = structuredClone(h.state); const p = ${JSON.stringify(patch)}; Object.assign(s, p, { owned: { ...s.owned, ...(p.owned ?? {}) } }); s.books.earned += Math.max(0, (s.carried + s.banked) - (h.state.carried + h.state.banked)); return await h.load(s); })()`);
  const veil = `(+getComputedStyle(document.getElementById('hk2-cut')).opacity)`;
  /** The city's camera put at `pos` looking at `tgt` (world m), held: the inside view lets a moved camera be. */
  const look = (pos, tgt, fov = 40) => ev(`(() => { const c = window.__city; c.camera.position.set(${pos}); c.controls.target.set(${tgt}); c.camera.fov = ${fov}; c.camera.updateProjectionMatrix(); c.controls.update(); })()`);
  const giveBack = () => ev(`(() => { const st = window.__demo.stage; st.camera.focus(null); st.focus('a1'); st.camera.arrived(); })()`);
  /** Frames as fast as they come, each with its time and the veil, while `go` holds (and `after` ms past it). */
  async function burst(dir, go, { max = 90, after = 0, scale = 0.5, info = 'null' } = {}) {
    mkdirSync(dir, { recursive: true });
    const log = [];
    const t0 = Date.now();
    let doneAt = null;
    for (let k = 0; k < max; k++) {
      const s = await ev(`JSON.stringify({ veil: ${veil}, up: window.__demo.stage?.inside.up ?? null, info: ${info} })`);
      const r = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 82, clip: { x: 0, y: 0, width: W, height: H, scale } });
      const file = path.join(dir, `${String(k).padStart(2, '0')}.jpg`);
      writeFileSync(file, Buffer.from(r.data, 'base64'));
      log.push({ k, t: Date.now() - t0, file, ...JSON.parse(s) });
      if (doneAt === null && !(await ev(`!!(${go})`))) doneAt = Date.now();
      if (doneAt !== null && Date.now() - doneAt >= after) break;
    }
    writeFileSync(path.join(dir, 'frames.json'), JSON.stringify(log, null, 1));
    return log;
  }
  /** A contact sheet of picture files with a label under each, drawn in the page and saved as one JPEG. */
  async function sheet(files, labels, file, cols = 4) {
    const { readFileSync } = await import('node:fs');
    const data = files.map(f => `data:image/jpeg;base64,${readFileSync(f).toString('base64')}`);
    const url2 = await ev(`(async () => {
      const srcs = ${JSON.stringify(data)}, labels = ${JSON.stringify(labels)}, cols = ${cols};
      const imgs = await Promise.all(srcs.map(s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; })));
      const w = imgs[0].width, h = imgs[0].height, rows = Math.ceil(imgs.length / cols), lab = 30;
      const c = document.createElement('canvas'); c.width = cols * w; c.height = rows * (h + lab);
      const g = c.getContext('2d'); g.fillStyle = '#17171b'; g.fillRect(0, 0, c.width, c.height);
      imgs.forEach((im, k) => { const x = (k % cols) * w, y = Math.floor(k / cols) * (h + lab); g.drawImage(im, x, y); g.fillStyle = '#ffc21a'; g.font = '600 18px monospace'; g.fillText(labels[k], x + 10, y + h + 21); });
      return c.toDataURL('image/jpeg', 0.88); })()`, 60000);
    writeFileSync(file, Buffer.from(url2.split(',')[1], 'base64'));
    console.log(`saved ${file}`);
  }
  return { ev, key, phase, choose, until, saved, still, load, veil, look, giveBack, burst, sheet };
};

// ── THE OPENING, played (and the room after it, the whole visit)
await session(`crib ${tag}`, async page => {
  const T = tools(page);
  const { ev, phase, choose, until, saved, still, load, look, giveBack, burst, sheet } = T;
  if (want('opening')) {
    await page.waitFor(`window.__demo && window.__demo.stage && /moving|fading|kept|falling|unstacking|bare|stacking/.test(window.__demo.stage.opening.debug().state)`, 150000, 20);
    const log = await burst(path.join(out, `opening-${tag}`), `/moving|fading|kept|falling|unstacking|bare|stacking/.test(window.__demo.stage.opening.debug().state) || window.__demo.stage.inside.up === null`, { after: 500, scale: 0.5, info: '(d => /moving|fading/.test(d.state) ? d.t : null)(window.__demo.stage.opening.debug())' });
    const moving = log.filter(f => f.info !== null && f.veil < 0.5);
    const end = log.find(f => f.up) ?? log.at(-1);
    // eight: six spread over the move, the black, and the first of the room
    const pick = [];
    for (let k = 0; k < 6; k++) pick.push(moving[Math.round((k * (moving.length - 1)) / 5)]);
    pick.push(log.find(f => f.veil > 0.95) ?? moving.at(-1));
    pick.push(log.find(f => f.up && f.veil < 0.02) ?? end);
    const labels = pick.map(f => `${(f.t / 1000).toFixed(2)} s${f.info !== null && f.info !== undefined ? ` · move ${(+f.info).toFixed(2)} s` : ''} · veil ${f.veil.toFixed(2)}${f.up ? ' · room' : ''}`);
    await sheet(pick.map(f => f.file), labels, path.join(out, `opening-strip-${tag}.jpg`));
    console.log(`opening: ${JSON.stringify(await ev('window.__demo.stage.opening.debug()'))}`);
  }
  await phase('choose');
  await ev('window.__demo.stage.actors.audit(true)');
  await page.sleep(2500);
  if (want('day')) await still(`room-day-${tag}`);
  if (want('zoom')) {
    const at = await ev(`[innerWidth / 2, innerHeight * 0.45]`);
    for (let k = 0; k < 4; k++) await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: at[0], y: at[1], deltaX: 0, deltaY: -240 });
    await page.sleep(1500);
    await still(`room-zoomed-${tag}`);
    console.log(`zoom ${JSON.stringify(await ev('window.__demo.stage.inside.debug().zoom'))}`);
    for (let k = 0; k < 4; k++) await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: at[0], y: at[1], deltaX: 0, deltaY: 240 });
    await page.sleep(1200);
  }
  if (want('corners')) {
    // each corner from a metre and a half out and a little up, then 0.2 m along and 0.1 m up from there
    const C = await ev(`(() => { const p = window.__demo.stage.inside.place(${JSON.stringify(KEY)}); const F = p.plan.F, y = p.plan.yF; const w = (x, z, h = 0) => { const [X, Z] = F.toWorld(x, z); return [X, y + h, Z]; };
      return { y, W: F.W, D: F.D, pts: { 'back-left': [0, 0], 'back-right': [F.W, 0], 'front-right': [F.W, F.D], 'front-left': [0, F.D] }, w: [[0, 0], [F.W, 0], [F.W, F.D], [0, F.D]].map(([x, z]) => w(x, z)), door: (s => [s[0], y, s[2]])(p.door().inside.sill),
        cam: Object.fromEntries([['back-left', [0.9, 1.0, 1.25]], ['back-right', [F.W - 0.9, 1.0, 1.25]], ['front-right', [F.W + 1.1, F.D + 1.2, 0.9]], ['front-left', [-1.1, F.D + 1.2, 0.9]]].map(([k, [x, z, h]]) => [k, w(x, z, h)])),
        cam2: Object.fromEntries([['back-left', [1.15, 1.1, 1.35]], ['back-right', [F.W - 1.15, 1.1, 1.35]], ['front-right', [F.W + 0.95, F.D + 1.35, 1.0]], ['front-left', [-0.95, F.D + 1.35, 1.0]]].map(([k, [x, z, h]]) => [k, w(x, z, h)])),
        tgt: Object.fromEntries([['back-left', [0, 0, 0.45]], ['back-right', [F.W, 0, 0.45]], ['front-right', [F.W, F.D, 0.25]], ['front-left', [0, F.D, 0.25]]].map(([k, [x, z, h]]) => [k, w(x, z, h)])),
        sill: [w(F.W / 2, F.D + 1.0, 0.8), w(F.W / 2, F.D, 0.1), w(F.W / 2 + 0.25, F.D + 1.1, 0.9)] }; })()`);
    await ev('window.__demo.stage.setSpeed(0)');
    for (const name of ['back-left', 'back-right', 'front-right', 'front-left']) {
      await look(C.cam[name], C.tgt[name], 42);
      await page.sleep(500);
      await saved(`corner-${name}-1-${tag}`);
      await look(C.cam2[name], C.tgt[name], 42);
      await page.sleep(500);
      await saved(`corner-${name}-2-${tag}`);
    }
    await look(C.sill[0], C.sill[1], 42);
    await page.sleep(500);
    await saved(`doorway-1-${tag}`);
    await look(C.sill[2], C.sill[1], 42);
    await page.sleep(500);
    await saved(`doorway-2-${tag}`);
    await giveBack();
    await ev('window.__demo.stage.setSpeed(1)');
    await page.sleep(1200);
  }
  if (want('walk')) {
    const door = `window.__demo.stage.doorway.info(${JSON.stringify(KEY)}, 'a1')`;
    await choose('out');
    const a = await burst(path.join(out, `walk-out-${tag}`), `!(!window.__demo.stage.inside.up && ${T.veil} < 0.02 && (${door})?.step < 0.3)`, { max: 120, after: 600, scale: 0.4 });
    console.log(`walk out: ${a.length} frames in ${a.at(-1).t} ms`);
    await phase('choose');
    await page.sleep(1500);
    await choose('inside');
    const b = await burst(path.join(out, `walk-in-${tag}`), `!(window.__demo.stage.inside.up && ${T.veil} < 0.02 && window.__demo.hud.phase === 'choose')`, { max: 200, after: 300, scale: 0.4 });
    console.log(`walk in: ${b.length} frames in ${b.at(-1).t} ms`);
    for (const [name, L] of [['out', a], ['in', b]]) {
      const pick = [];
      for (let k = 0; k < 8; k++) pick.push(L[Math.round((k * (L.length - 1)) / 7)]);
      await sheet(pick.map(f => f.file), pick.map(f => `${(f.t / 1000).toFixed(2)} s · veil ${f.veil.toFixed(2)}${f.up ? ' · room' : ''}`), path.join(out, `walk-${name}-strip-${tag}.jpg`));
    }
    await phase('choose');
    await page.sleep(1200);
  }
  if (want('stash')) {
    await load({ place: 'park', carried: 36, hour: 14 });
    await phase('choose');
    await page.sleep(1500);
    await choose('inside');
    await until(`(window.__demo.stage.actors.clipOf('a1')?.name ?? '').startsWith('floorboard')`, 40000).catch(() => console.log('  (the stash beat was missed)'));
    await page.sleep(700);
    await still(`stash-beat-${tag}`);
    console.log(`stash: clip ${JSON.stringify(await ev(`window.__demo.stage.actors.clipOf('a1')`))} at ${JSON.stringify(await ev(`(A => [+A.x.toFixed(2), +A.z.toFixed(2)])(window.__demo.stage.actors.get('a1'))`))}`);
    await phase('choose');
    await page.sleep(1200);
  }
  if (want('home')) {
    // home from the market by the subway: put down up the lane, the walk to the door and in. Every frame of it, what
    // the player holds (a clip's prop) and whether a ride's board is drawn near them
    await load({ place: 'market', hour: 15, energy: 4, heat: 0, carried: 64, hoursThere: 2, rig: { chances: [99], rolls: [] } });
    await phase('choose');
    await page.sleep(1500);
    await choose('subway', `&& c.choice.to === 'park' && !c.choice.hop`);
    const held = `(A => [...A.props.values()].filter(m => m.visible).map(m => m.name).join(',') + '|' + window.__city.scene.children.filter(o => /rides:board/.test(o.name) && o.visible && Math.hypot(o.matrixWorld.elements[12] - A.x, o.matrixWorld.elements[14] - A.z) < 2.5).length)(window.__demo.stage.actors.get('a1'))`;
    const L = await burst(path.join(out, `home-${tag}`), `!(window.__demo.stage.inside.up && ${T.veil} < 0.02 && window.__demo.hud.phase === 'choose')`, { max: 400, after: 300, scale: 0.4, info: held });
    const pick = [];
    for (let k = 0; k < 8; k++) pick.push(L[Math.round((k * (L.length - 1)) / 7)]);
    await sheet(pick.map(f => f.file), pick.map(f => `${(f.t / 1000).toFixed(1)} s · ${f.up ? 'room' : 'outside'} · holds ${f.info || '-'}`), path.join(out, `home-strip-${tag}.jpg`));
    const inRoom = L.filter(f => f.up && f.info && f.info !== '|0');
    console.log(`home: ${L.length} frames; while inside, anything held or a board near: ${inRoom.length} frames ${JSON.stringify([...new Set(inRoom.map(f => f.info))])}; outside: ${JSON.stringify([...new Set(L.filter(f => !f.up).map(f => f.info))])}`);
    await phase('choose');
    await page.sleep(1200);
  }
  if (want('sleep')) {
    await choose('sleep');
    await until(`(window.__demo.stage.actors.clipOf('a1')?.name ?? '') === 'sleep'`, 20000).catch(() => console.log('  (asleep was missed)'));
    await page.sleep(1800);
    await ev(`document.querySelectorAll('.hk-overlay').forEach(e => (e.style.visibility = 'hidden'))`);
    await still(`asleep-mattress-${tag}`);
    console.log(`asleep: ${JSON.stringify(await ev(`(A => ({ at: [+A.x.toFixed(2), +A.y.toFixed(2), +A.z.toFixed(2)], clip: window.__demo.stage.actors.clipOf('a1'), props: [...A.props.values()].filter(m => m.visible).map(m => m.name) }))(window.__demo.stage.actors.get('a1'))`))}`);
    await ev(`document.querySelectorAll('.hk-overlay').forEach(e => (e.style.visibility = ''))`);
    await T.key('Enter');
    await phase('choose');
    await page.sleep(1500);
  }
  if (want('bed')) {
    await load({ place: 'crib', banked: 200, carried: 0, hour: 15 });
    await phase('choose');
    await page.sleep(1500);
    await still(`bed-before-buying-${tag}`);
    await choose('buy', `&& c.choice.item === 'bed'`);
    await page.waitFor(`/-bed/.test(window.__demo.stage.inside.place(${JSON.stringify(KEY)}).room ?? '')`, 10000, 50);
    await page.sleep(1500);
    await still(`bed-after-buying-${tag}`);
    await choose('sleep');
    await until(`(window.__demo.stage.actors.clipOf('a1')?.name ?? '') === 'sleep'`, 20000).catch(() => console.log('  (asleep on the bed was missed)'));
    await page.sleep(1800);
    await ev(`document.querySelectorAll('.hk-overlay').forEach(e => (e.style.visibility = 'hidden'))`);
    await still(`asleep-bed-${tag}`);
    console.log(`asleep on the bed: ${JSON.stringify(await ev(`(A => ({ at: [+A.x.toFixed(2), +A.y.toFixed(2), +A.z.toFixed(2)], clip: window.__demo.stage.actors.clipOf('a1'), room: window.__demo.stage.inside.place('pad:a1').room }))(window.__demo.stage.actors.get('a1'))`))}`);
    await ev(`document.querySelectorAll('.hk-overlay').forEach(e => (e.style.visibility = ''))`);
    await T.key('Enter');
    await phase('choose');
    await page.sleep(1500);
  }
  if (want('night')) {
    await load({ place: 'crib', hour: 22 });
    await phase('choose');
    await page.sleep(3000);
    await still(`room-2200-${tag}`);
  }
});

// ── THE OPENING, skipped half way
if (want('skip')) {
  await session(`skip ${tag}`, async page => {
    const { ev, burst, sheet, phase } = tools(page);
    await page.waitFor(`window.__demo && window.__demo.stage && window.__demo.stage.opening.debug().state === 'moving' && window.__demo.stage.opening.debug().t > 1.4`, 150000, 20);
    const before = await page.shot(path.join(out, `opening-skip-before-${tag}.jpg`));
    const tb = await ev('window.__demo.stage.opening.debug().t');
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    const log = await burst(path.join(out, `opening-skip-${tag}`), `window.__demo.stage.inside.up === null || ${'(+getComputedStyle(document.getElementById(\'hk2-cut\')).opacity)'} > 0.02`, { after: 300, scale: 1 });
    const black = log.find(f => f.veil > 0.95) ?? log[0];
    const room = log.find(f => f.up && f.veil < 0.02) ?? log.at(-1);
    await sheet([before, black.file, room.file], [`before: move ${tb.toFixed(2)} s, Space`, `${(black.t / 1000).toFixed(2)} s after: black`, `${(room.t / 1000).toFixed(2)} s after: the room`], path.join(out, `opening-skipped-${tag}.jpg`), 3);
    console.log(`skip: ${JSON.stringify(await ev('window.__demo.stage.opening.debug()'))}`);
    await phase('choose');
  });
}
// (the page driver's own time limits are timers still pending: they would hold the process up to two minutes)
process.exit(process.exitCode ?? 0);
