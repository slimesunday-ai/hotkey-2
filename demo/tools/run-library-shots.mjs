#!/usr/bin/env node
// THE LIBRARY ON THE STAGE (lib-1), on the run's own page: the player wearing library pieces from three slots; three
// library home pieces taken out of the tray and put down in the trailer (set/arrange.js, the kit's own footprints);
// the deadbolt's locks on the door's leaf; and trying on (stage.tryOn / tryOff), with the run's state compared before
// and after. The server must be running.
//
//   node demo/tools/run-library-shots.mjs --out <dir> [--port 5470] [--seed 3] [--size 1600x1000]
//        [--wear hat:id,eyewear:id,bottom:id] [--home kit:id,kit:id,kit:id] [--try top:id]
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-library'));
const port = opt('--port', 5470);
const [W, H] = opt('--size', '1600x1000').split('x').map(Number);
const WEAR = opt('--wear', 'hat:old_bucket,eyewear:precinct_aviators,bottom:old_drop_p_lockbox_cargo').split(',');
const HOME = opt('--home', 'kit:boombox,kit:plant-monstera,kit:arcade-cab').split(',');
const TRY = opt('--try', 'top:old_chenille').split(',');
// (notes-1: old_baggy and old_varsity_jacket, the defaults since lib-1 c86d13f, were never pieces the run sells: the
// library's bottoms and the chenille varsity stand in for them)
const KEY = 'pad:a1';
mkdirSync(out, { recursive: true });
const url = `http://127.0.0.1:${port}/demo/?mode=run&seed=${opt('--seed', '3')}`;

const browser = await launch({ width: W, height: H });
let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failed += 1;
};
try {
  const page = await browser.open(url);
  const ev = (js, ms = 120000) => page.evaluate(js, ms);
  const A = `window.__demo.stage.inside.place(${JSON.stringify(KEY)}).arrange`;
  const saved = async name => console.log(`saved ${await page.shot(path.join(out, `${name}.jpg`))}`);
  await page.waitFor(`window.__demo?.hud?.phase === 'choose' && window.__demo.hud.state.place === 'crib' && window.__demo.stage.inside.up === ${JSON.stringify(KEY)}`, 240000, 200);
  await page.waitFor(`!!${A}`, 60000, 200);
  await ev(`${A}.ready()`);
  const pieceOf = k => k.split(':');
  // the pieces asked for must be the run's (the rules' library, not anything of the cast)
  const lib = await ev(`(async () => { const L = await import('/src/run/library.mjs'); const { RUN_CONFIG } = await import('/src/run/config.mjs'); const l = L.libraryOf(RUN_CONFIG); return ${JSON.stringify([...WEAR, ...HOME, ...TRY])}.map(k => [k, !!l.byKey.get(k), l.byKey.get(k)?.slot ?? null]); })()`);
  for (const [k, ok] of lib) check(ok, `${k} is a piece the run sells`);
  const slots = Object.fromEntries(lib.map(([k, , s]) => [k, s]));

  // ── 1. WEARING three library pieces from three slots (owned, worn: the state as a run that bought them)
  const worn = Object.fromEntries(WEAR.map(k => [slots[k], k]));
  const things = Object.fromEntries([...WEAR, ...HOME].map(k => [k, true]));
  check(await ev(`(async () => { const h = window.__demo.hud; const s = structuredClone(h.state); s.things = { ...s.things, ...${JSON.stringify(things)} }; s.worn = { ...s.worn, ...${JSON.stringify(worn)} }; return await h.load(s); })()`), 'the run loaded owning them, the three worn');
  await page.waitFor(`${A}.tray().length >= ${HOME.length}`, 60000, 200);
  await page.sleep(2500);
  const look = await ev(`window.__demo.stage.actors.all().find(a => a.id === 'a1').look`);
  for (const k of WEAR) {
    const [slot, id] = pieceOf(k);
    check((look[slot]?.id ?? look[slot]) === id, `the figure wears ${k} (${slot}: ${look[slot]?.id ?? look[slot]})`);
  }
  await saved('wearing-three');
  // ── 3. THREE HOME PIECES out of the tray and put down (each at the spot nearest the room's middle)
  await ev(`${A}.enter()`);
  for (const k of HOME) {
    const r = await ev(`(async () => { const a = ${A}; const r = a.takeOut(${JSON.stringify(`L:${k}`)}); if (!r.ok) return { ok: false, why: r.why }; const h = a.held; const d = await a.drop(); return { ok: d.ok, why: d.why, spots: h.spots, at: h.at }; })()`, 300000);
    check(r.ok, `${k} out of the tray and put down (${r.ok ? `${r.spots} spots; at ${JSON.stringify(r.at)}` : r.why})`);
  }
  await ev(`${A}.leave()`);
  await page.sleep(2500);
  const dbg = await ev(`${A}.debug()`);
  for (const k of HOME) check(dbg?.pieces.some(p => p.key === `L:${k}`), `${k} stands in the room (${JSON.stringify(dbg?.pieces.find(p => p.key === `L:${k}`) ?? null)})`);
  await saved('trailer-three-placed');

  // ── 4. THE DEADBOLT on the door: owned, the leaf inside swung half open
  await ev(`(async () => { const h = window.__demo.hud; const s = structuredClone(h.state); s.things = { ...s.things, deadbolt: true }; return await h.load(s); })()`);
  await page.waitFor(`(window.__demo.stage.inside.place(${JSON.stringify(KEY)}).room ?? '').includes('door')`, 60000, 200).catch(() => null);
  await page.sleep(2500);
  await ev(`window.__demo.stage.inside.place(${JSON.stringify(KEY)}).leaf('in', 0.55)`);
  await page.sleep(500);
  await saved('deadbolt-door');
  await ev(`window.__demo.stage.inside.place(${JSON.stringify(KEY)}).leaf('in', 0)`);
  // close up: the city camera on the player
  const pos = await ev(`(a => [a.x, a.y, a.z, a.ry])(window.__demo.stage.actors.all().find(a => a.id === 'a1'))`);
  const lookAt = (p, t, fov = 30) => ev(`(() => { const c = window.__city; c.camera.position.set(${p}); c.controls.target.set(${t}); c.camera.fov = ${fov}; c.camera.updateProjectionMatrix(); c.controls.update(); })()`);
  const fwd = [Math.sin(pos[3]), Math.cos(pos[3])];
  await ev('window.__demo.stage.setSpeed(0)');
  await lookAt([pos[0] + fwd[0] * 3.2 + fwd[1] * 0.9, pos[1] + 1.6, pos[2] + fwd[1] * 3.2 - fwd[0] * 0.9], [pos[0], pos[1] + 0.95, pos[2]], 30);
  await page.sleep(900);
  await saved('wearing-three-close');

  // ── 2. TRYING ON: a piece not owned, on the figure; off again; the run's state exactly as before
  const before = await ev('JSON.stringify(window.__demo.hud.state)');
  const tried = await ev(`(async () => { const L = await import('/src/run/library.mjs'); const { RUN_CONFIG } = await import('/src/run/config.mjs'); const t = L.tryOn(RUN_CONFIG, window.__demo.hud.state, ${JSON.stringify(TRY)}); return { ok: window.__demo.stage.tryOn(t.dress), dress: t.dress }; })()`);
  await page.sleep(600);
  const lookT = await ev(`window.__demo.stage.actors.all().find(a => a.id === 'a1').look`);
  const [ts, tid] = pieceOf(TRY[0]);
  check(tried.ok && (lookT[ts]?.id ?? lookT[ts]) === tid, `trying on ${TRY[0]}: the figure shows it (${lookT[ts]?.id})`);
  await saved('trying-on');
  check(await ev('window.__demo.stage.tryOff()'), 'tryOff');
  await page.sleep(500);
  const lookB = await ev(`window.__demo.stage.actors.all().find(a => a.id === 'a1').look`);
  check(JSON.stringify(lookB) === JSON.stringify(look), 'off again: the figure as it really is');
  check((await ev('JSON.stringify(window.__demo.hud.state)')) === before, 'the run\'s state is exactly as before trying on');
  await ev('window.__demo.stage.setSpeed(1)');

  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[arrange\]|\[crib\]|\[run\]/.test(l));
  console.log(`page errors ${bad.length}${bad.length ? `\n  ${[...new Set(bad)].slice(0, 8).join('\n  ')}` : ''}`);
  writeFileSync(path.join(out, 'library-shots.json'), JSON.stringify({ look, lookTried: lookT, dbg, failed }, null, 1));
} catch (err) {
  console.error(String(err?.stack ?? err));
  failed += 1;
} finally {
  await browser.close();
}
console.log(failed ? `${failed} FAILED` : 'all ok');
process.exit(failed ? 1 : 0);
