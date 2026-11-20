#!/usr/bin/env node
// WHICH SHADER PROGRAMS ARE LINKED IN THE MIDDLE OF A GUN FIGHT (anim-2). A material of a kind the renderer has not
// drawn yet has its program built and linked the first time something with it is seen: a hitch, mid-fight. This
// plays the fight you steer with a gun (the fight page, real keys, the new gun bodies) and lists every program
// the renderer did not have when the fight was called: its name, the fight's clock when it first appeared, and
// what in the scene is drawn with it (the object's name and its parents', the material's type). The server must run.
//
//   HK2_DEBUG_PORT=5750 node demo/tools/gun-programs.mjs --port 5498 [--gun doorman] [--level raid] [--secs 14] [--guns old]
//   [--max 0]   fail when more than that many are linked after the fight is on
import { launch } from './chrome.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const at = args.indexOf(name);
  return at === -1 ? fallback : args[at + 1];
};
const port = opt('--port', 5498);
const gun = opt('--gun', 'doorman');
const level = opt('--level', 'raid');
const secs = Number(opt('--secs', '14'));
const MAX = opt('--max', null) === null ? null : Number(opt('--max', null));
const url = `http://127.0.0.1:${port}/demo/?mode=fight&nostairs=1&guns=${opt('--guns', 'new')}`;
const browser = await launch({ width: 1600, height: 1000 });
let fail = null;
try {
  const page = await browser.open(url);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "pick"', 180000);
  await page.sleep(2500);
  // (the programs the renderer has, by id; and for a new one, what is drawn with it)
  await ev(`(() => { const R = window.__city.renderer; const W = (window.__progs = { seen: new Map(), fresh: [] });
    const scan = t => { for (const p of R.info.programs) { if (W.seen.has(p.id)) continue; W.seen.set(p.id, t);
      if (t === null) continue;
      const users = []; window.__city.scene.traverse(o => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of [...ms, o.customDepthMaterial, o.customDistanceMaterial].filter(Boolean)) { const pr = R.properties.get(m); const progs = pr && pr.programs ? [...pr.programs.values()] : pr && pr.currentProgram ? [pr.currentProgram] : [];
          if (progs.some(q => q.id === p.id)) { let n = o.name || o.type, q = o.parent; for (let k = 0; k < 3 && q; k++, q = q.parent) n = (q.name || q.type) + ' > ' + n; users.push(n + ' [' + m.type + (m.name ? ' ' + m.name : '') + ']'); } } });
      W.fresh.push({ id: p.id, name: p.name, t, phase: window.__demo.hud.phase, users: [...new Set(users)].slice(0, 6) }); } };
    W.scan = scan; scan(null); })()`);
  await ev(`window.__demo.hud.pick(${JSON.stringify({ weapon: gun, gear: [], ally: false, earl: 'front', level })})`);
  await page.sleep(600);
  await ev('window.__progs.scan(-1)');
  const VK = { KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68, Enter: 13 };
  const keyDU = (type, code) => page.send('Input.dispatchKeyEvent', { type, code, key: code === 'Enter' ? 'Enter' : code.slice(3).toLowerCase(), windowsVirtualKeyCode: VK[code], nativeVirtualKeyCode: VK[code] });
  await keyDU('keyDown', 'Enter');
  await keyDU('keyUp', 'Enter');
  // (every frame from the press: a program is found the frame it is linked)
  await ev(`(() => { const tick = () => { const h = window.__demo.hud; if (window.__progs.stop) return; window.__progs.scan(h.phase === 'fight' && h.fight ? +h.fight.t.toFixed(2) : -0.5); requestAnimationFrame(tick); }; requestAnimationFrame(tick); })()`);
  await page.waitFor('window.__demo.hud.phase === "fight"', 60000, 30);
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
  const t0 = Date.now();
  for (;;) {
    const h = await ev('(h => ({ phase: h.phase, m: h.driveMove() }))(window.__demo.hud)').catch(() => null);
    if (h) {
      if (h.phase !== 'fight') break;
      await hold(h.m);
    }
    if (Date.now() - t0 > secs * 1000) break;
    await page.sleep(90);
  }
  await hold([0, 0]);
  await page.sleep(500);
  const fresh = await ev('(() => { window.__progs.stop = true; return window.__progs.fresh; })()');
  const total = await ev('window.__progs.seen.size');
  const mid = fresh.filter(p => p.t >= 0);
  console.log(`${gun}, ${level}${opt('--guns', 'new') === 'old' ? ' (the old bodies)' : ''}: ${total} programs in all; ${fresh.length} new since the fight was picked, ${mid.length} of them after it was on`);
  for (const p of fresh) console.log(`  ${p.t < 0 ? (p.t === -1 ? 'at the pick' : 'before the first tick') : `at ${p.t} s`}: ${p.name} (#${p.id}) drawn on: ${p.users.join(' | ') || '(nothing in the scene holds it now)'}`);
  if (MAX !== null && mid.length > MAX) fail = `${mid.length} programs linked after the fight was on (over ${MAX})`;
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
  if (bad.length) fail = `page errors: ${[...new Set(bad)].slice(0, 3).join(' | ').slice(0, 500)}`;
} catch (err) {
  fail = String(err?.stack ?? err).slice(0, 600);
} finally {
  await browser.close();
  console.log(fail ? `programs-fail: ${fail}` : 'programs-ok');
  process.exit(fail ? 1 : 0);
}
