#!/usr/bin/env node
// THE GUNS, HELD STILL AND LOOKED AT FROM ALL ROUND (anim-1). The owner: every move is judged from several views the
// player can reach, not one. This plays the fight you steer on the fight page (demo/?mode=fight) with each gun, by
// real keys as a player backing away while firing would, and HOLDS it at the moments that matter (the page's own
// holdOn / pause, the stage's clock stopped): at rest before anybody comes, aimed, the kick, a third of a second on
// (the pump back, the bolt), mid-reload, and somebody just dropped. At each hold the game's camera is turned to each
// view in turn (the default bearing close in, low, a quarter round each way, from behind) and the picture is cut
// round you. One sheet a gun: a row a moment, a column a view.
//
//   HK2_DEBUG_PORT=5746 node demo/tools/gun-stills.mjs --port 5495 --out <dir> [--guns pistol,chopper,doorman,longeye]
//          [--old]   the bodies as they were before the hand-posed ones (the page's ?guns=old), for the before sheet
//          [--level jumped] [--ally]
//
// Writes <out>/<gun>[-old]/<moment>-<view>.jpg and prints what it held on. Sheets: demo/tools/gun-stills.py.
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './chrome.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const at = args.indexOf(name);
  return at === -1 ? fallback : args[at + 1];
};
const port = opt('--port', 5495);
const out = path.resolve(opt('--out', 'demo/shots/gun-stills'));
const OLD = args.includes('--old');
const GUNS = opt('--guns', 'pistol,chopper,doorman,longeye').split(',');
const level = opt('--level', 'jumped');
const url = `http://127.0.0.1:${port}/demo/?mode=fight&nostairs=1${OLD ? '&guns=old' : '&guns=new'}`;
/** The views: [name, bearing, degrees down, metres up]. The first is the game's own bearing, as near as the wheel takes it. */
const VIEWS = [['default', 90, 64, 7], ['low', 90, 22, 2.9], ['side-a', 0, 26, 3.3], ['side-b', 180, 26, 3.3], ['behind', 270, 26, 3.3]];
const only = opt('--moments', null)?.split(',') ?? null;

const browser = await launch({ width: 1500, height: 1000 });
const faults = [];
try {
  const page = await browser.open(url);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  const H = 'window.__demo.hud';
  await page.waitFor(`window.__demo && ${H} && ${H}.phase === "pick"`, 180000);
  await page.sleep(1500);
  const VK = { KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68, Enter: 13 };
  const keyDU = (type, code) => page.send('Input.dispatchKeyEvent', { type, code, key: code === 'Enter' ? 'Enter' : code.slice(3).toLowerCase(), windowsVirtualKeyCode: VK[code], nativeVirtualKeyCode: VK[code] });
  const down = new Set();
  const hold = async m => {
    const want = new Set();
    if (m[0] > 0.38) want.add('KeyD');
    if (m[0] < -0.38) want.add('KeyA');
    if (m[1] > 0.38) want.add('KeyS');
    if (m[1] < -0.38) want.add('KeyW');
    for (const k of [...down]) if (!want.has(k)) { await keyDU('keyUp', k); down.delete(k); }
    for (const k of want) if (!down.has(k)) { await keyDU('keyDown', k); down.add(k); }
  };
  /** Plays on by the keys until `stop()` (page js, a boolean) is true, the fight holds itself, or it is over. */
  async function drive(stopJs = 'false', limit = 60) {
    const t0 = Date.now();
    for (;;) {
      const s = await ev(`(h => ({ phase: h.phase, held: h.held, m: h.driveMove(), stop: !!(${stopJs}) }))(${H})`);
      if (s.phase !== 'fight') { await hold([0, 0]); return 'over'; }
      if (s.held || s.stop) { await hold([0, 0]); return s.held ? 'held' : 'stop'; }
      await hold(s.m);
      if (Date.now() - t0 > limit * 1000) { await hold([0, 0]); return 'late'; }
      await page.sleep(40);
    }
  }
  /** The pictures of this moment, one a view: the stage's clock is stopped while the camera goes round. */
  async function views(dir, moment, about = 'fight:you') {
    if (only && !only.includes(moment)) return;
    await ev(`${H}.pause(true)`);
    const rows = [];
    for (const [name, bearing, dn, high] of VIEWS) {
      await ev(`window.__demo.stage.camera.setAngle({ bearing: ${bearing}, down: ${dn}, high: ${high} })`);
      await page.sleep(380);
      const p = await ev(`window.__demo.stage.screenOf(${JSON.stringify(about)})`).catch(() => null);
      const file = path.join(dir, `${moment}-${name}.jpg`);
      await page.shot(file);
      rows.push({ view: name, file, at: p });
    }
    await ev('window.__demo.stage.camera.setAngle()');
    await page.sleep(200);
    return rows;
  }
  for (const gun of GUNS) {
    const dir = path.join(out, `${gun}${OLD ? '-old' : ''}`);
    mkdirSync(dir, { recursive: true });
    const said = [];
    const index = [];
    const keep = (moment, rows, note) => {
      if (rows) index.push({ moment, note, views: rows });
      said.push(`${moment}: ${note}`);
    };
    await ev(`${H}.pick(${JSON.stringify({ weapon: gun, gear: [], ally: args.includes('--ally'), earl: 'front', level })})`);
    await page.sleep(400);
    await keyDU('keyDown', 'Enter');
    await keyDU('keyUp', 'Enter');
    await page.waitFor(`${H}.phase === "fight"`, 60000, 30);
    // 1. AT REST: half a second in, nobody near yet; then walking with it
    await drive(`h.fight.t > 0.5`, 20);
    keep('rest', await views(dir, 'rest'), `t ${await ev(`${H}.fight.t.toFixed(2)`)}`);
    await ev(`${H}.pause(false)`);
    // 2. THE KICK, and a third of a second on, and aimed again: your shots, one after another
    const rate = await ev(`(() => { const F = ${H}.fight; return 1; })()`);
    void rate;
    for (const [moment, after] of [['kick', 0.04], ['after', gun === 'longeye' ? 0.55 : gun === 'doorman' ? 0.34 : 0.16], ['aimed', gun === 'chopper' ? 0.27 : gun === 'longeye' ? 1.2 : gun === 'doorman' ? 0.58 : 0.42]]) {
      await ev(`${H}.holdOn({ type: "shot", id: "you" }, ${after})`);
      const r = await drive('false', 40);
      if (r !== 'held') { said.push(`${moment}: the fight ended first (${r})`); break; }
      await page.sleep(120);
      const e = await ev(`(e => e ? { t: e.t, to: e.to, hit: e.hit } : null)(${H}.lastEvent({ type: "shot", id: "you" }))`);
      keep(moment, await views(dir, moment), `${after} s after your shot at ${e?.t} (${e?.hit ? 'hit' : 'missed'} ${e?.to})`);
      await ev(`${H}.holdOn({ type: "never" }); ${H}.pause(false)`);
    }
    // 3. SOMEBODY DROPPED: a quarter of a second into the fall, and when it is over; looked at round THEM
    for (const [moment, after] of [['drop', 0.22], ['down', 1.3]]) {
      await ev(`${H}.holdOn({ type: "down" }, ${after})`);
      const r = await drive('false', 40);
      if (r !== 'held') { said.push(`${moment}: nobody dropped before the fight ended (${r})`); break; }
      await page.sleep(120);
      const e = await ev(`(e => e ? { t: e.t, id: e.id, by: e.by } : null)(${H}.lastEvent({ type: "down" }))`);
      const about = e?.id === 'you' ? 'fight:you' : e?.id === 'earl' ? 'fight:earl' : `fight:${e?.id}`;
      keep(moment, await views(dir, moment, about), `${after} s after ${e?.id} was dropped by ${e?.by} at ${e?.t}`);
      await ev(`${H}.holdOn({ type: "never" }); ${H}.pause(false)`);
    }
    // 4. MID-RELOAD
    {
      const r = await drive(`(p => p.reload > 0 && p.reload < 0.62 * (p.reloadOf || 2))(h.fight.people[0])`, 40);
      if (r === 'stop') keep('reload', await views(dir, 'reload'), `reloading, ${await ev(`${H}.fight.people[0].reload.toFixed(2)`)} s to go`);
      else said.push(`reload: none before the fight ended (${r})`);
      await ev(`${H}.pause(false)`);
    }
    writeFileSync(path.join(dir, 'index.json'), `${JSON.stringify({ gun, old: OLD, moments: index }, null, 1)}\n`);
    console.log(`${gun}${OLD ? ' (the old bodies)' : ''}: ${said.join(' · ')}`);
    // (out of this fight: to its end, fast, and back to the pick)
    await ev(`${H}.holdOn({ type: "never" }); ${H}.pause(false, 4)`);
    const r = await drive('false', 90);
    await ev(`${H}.pause(false, 1)`);
    if (r !== 'over') faults.push(`${gun}: the fight did not end (${r})`);
    await page.sleep(600);
    await page.send('Page.navigate', { url });
    await page.sleep(1500);
    await page.waitFor(`window.__demo && ${H} && ${H}.phase === "pick"`, 180000);
    await page.sleep(1200);
  }
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
  if (bad.length) faults.push(`${bad.length} page errors: ${[...new Set(bad)].slice(0, 3).join(' | ').slice(0, 600)}`);
} catch (err) {
  faults.push(String(err?.stack ?? err).slice(0, 600));
} finally {
  await browser.close();
  console.log(faults.length ? `stills-fail: ${faults[0]}` : 'stills-ok');
  process.exit(faults.length ? 1 : 0);
}
