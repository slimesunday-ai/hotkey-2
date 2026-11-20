#!/usr/bin/env node
// MR. PRUITT AT HIS WORKBENCH (notes-2, the owner 2026-11-19: "We should give him a work bench"). Plays THE RUN out of the
// door with real keys to the trailer park at noon, where Mr. Pruitt (npc:neighbour:2) hammers in his yard (the city's
// bench_hammer), and films him from the game's own camera and from a low camera at his side, a loop each. Measures,
// while he hammers (demo/stage/set/workbench.js):
//   · that he stands where the bench is made for (WORK's point, within 3 cm) and faces it (within 0.02 rad);
//   · that the hammer meets the anvil: the clip's own hammer face (CLIP.bench_hammer.prop.face(t), the city's, at
//     his size and on his feet) at its lowest over the loop against the drawn anvil's top (within 1 cm), and over the
//     anvil's top at each strike;
//   · that nobody of ours is ever in the bench (actors.solidAt says 'a workbench' at their middle), on any frame.
// The server must be running: node demo/serve.mjs --port 5513
//
//   node demo/tools/workbench-film.mjs --out <dir> [--port 5513] [--seed 3] [--before]
//
// --before  on code without the bench: films the same two views and does not measure (nothing to measure against)
// Writes <dir>/game/f-NNN.jpg, <dir>/low/f-NNN.jpg, <dir>/<view>.json ({ shots }) and prints the measures.
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/workbench'));
const port = opt('--port', 5513);
const url = `http://127.0.0.1:${port}/demo/?mode=run&seed=${opt('--seed', '3')}`;
const before = process.argv.includes('--before');
const ID = 'npc:neighbour:2';
const SPOT = 'home:a3:yard';
const CLIPS = '/city/from-trunk/style/city/anim/cast/clips/index.js';

const browser = await launch({ width: 1600, height: 1000 });
let failed = false;
const fail = what => {
  console.log(`FAIL ${what}`);
  failed = true;
};
try {
  const page = await browser.open(url);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  const press = k => ev(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true }))`);
  const phase = p => page.waitFor(`window.__demo.hud.phase === ${JSON.stringify(p)}`, 150000, 100);
  await phase('choose');
  await page.sleep(1500);
  // out of the door, the card that goes out (real keys), and the choice again outside in the park
  const card = await ev(`window.__demo.hud.view.choices.find(c => c.choice.do === 'out')?.key ?? null`);
  if (!card) throw new Error('no card goes out');
  const k = await ev(`window.__demo.hud.keyFor(${JSON.stringify(String(card))})`);
  if (k) await press(k);
  await ev(`window.__demo.hud.pick(${JSON.stringify(String(card))})`);
  await press('Enter');
  await page.sleep(1500);
  await phase('choose');
  // (whoever of ours stands in the bench, any frame from now: the page's own count)
  await ev(`(() => { const st = window.__demo.stage; window.__wb = { frames: 0, inside: 0, who: [] };
    st.actors.onFrame(() => { window.__wb.frames++; for (const A of st.actors.all()) { if (A.w?.hide) continue; if (st.actors.solidAt(A.x, A.z) === 'a workbench') { window.__wb.inside++; if (window.__wb.who.length < 6) window.__wb.who.push(A.id); } } }); })()`);
  // (the day's journal card over the top of the picture: put away with its own OK, as the player does)
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => /^\\s*OK/.test(x.textContent) && /STAYS IN THE JOURNAL/i.test(x.closest('section,div,aside')?.textContent ?? '')); b?.click(); return !!b; })()`).catch(() => false);
  // him at his work: a loop of it on him from its start, blended in
  const working = `(c => c.name === 'bench_hammer' && c.w > 0.9 && (c.t ?? 0) % 2.8 < 0.35)(window.__demo.stage.actors.clipOf(${JSON.stringify(ID)}))`;
  await page.waitFor(working, 120000, 30);

  async function roll(view, secs) {
    await page.waitFor(working, 120000, 30);
    const dir = path.join(out, view);
    mkdirSync(dir, { recursive: true });
    const shots = [];
    const t0 = Date.now();
    for (let n = 0; Date.now() - t0 < secs * 1000; n++) {
      const file = path.join(dir, `f-${String(n).padStart(3, '0')}.jpg`);
      await page.shot(file);
      shots.push({ file, t: +((Date.now() - t0) / 1000).toFixed(3), ...JSON.parse(await ev(`JSON.stringify({ clip: (c => [c.name, +(c.t ?? 0).toFixed(2)])(window.__demo.stage.actors.clipOf(${JSON.stringify(ID)})), screen: window.__demo.stage.actors.screenOf(${JSON.stringify(ID)}) })`)) });
    }
    writeFileSync(path.join(out, `${view}.json`), JSON.stringify({ shots }));
    console.log(`${view}: ${shots.length} frames filmed over ${secs} s, the loop on him in ${shots.filter(s => s.clip?.[0] === 'bench_hammer').length}`);
  }
  await roll('game', 3);

  if (!before) {
    // (measured while the loop is on him)
    await page.waitFor(working, 120000, 30);
    const M = JSON.parse(await ev(`(async () => {
      const st = window.__demo.stage, A = st.actors.get(${JSON.stringify(ID)}), P = st.director.people.get(${JSON.stringify(ID)});
      const WB = await import('/demo/stage/set/workbench.js');
      const at = WB.workAt(P.spot, 'bench_hammer');
      const { CLIP } = await import(${JSON.stringify(CLIPS)});
      const BP = await import('/city/from-trunk/style/city/anim/cast/clips/bench-props.js');
      const size = st.actors.sizeOf(${JSON.stringify(ID)});
      const face = t => CLIP.bench_hammer.prop.face(t).p;
      // the face's centre over the loop, in his body frame at the standard size (the clip's own forward kinematics)
      let low = Infinity, lowT = 0;
      const strikes = [];
      for (let t = 0; t <= CLIP.bench_hammer.dur + 1e-9; t += 0.005) {
        const f = face(t);
        if (f[1] < low) [low, lowT] = [f[1], +t.toFixed(3)];
      }
      for (const t of CLIP.bench_hammer.strikes ?? CLIP.bench_hammer.beats?.strikes ?? []) { const f = face(t); strikes.push([+f[0].toFixed(3), +f[1].toFixed(3), +f[2].toFixed(3)]); }
      const an = BP.BENCH.anvil;
      const overAnvil = strikes.every(([x, , z]) => Math.abs(x - an.x) <= an.w / 2 && Math.abs(z - an.z) <= an.d / 2);
      const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
      return JSON.stringify({ spot: P.spot, at, pos: [A.x, A.y, A.z, A.ry], size, off: at ? Math.hypot(A.x - at[0], A.z - at[1]) : null, turn: at ? Math.abs(wrap(A.ry - at[2])) : null,
        faceLow: low === Infinity ? null : +(A.y + low * size).toFixed(4), faceLowBody: low === Infinity ? null : +low.toFixed(4), lowT, strikes, overAnvil,
        anvilTop: st.workbench?.anvilTop(${JSON.stringify(SPOT)}) ?? null, bench: st.workbench?.state() ?? null });
    })()`, 60000));
    console.log('measure', JSON.stringify(M));
    if (!M.bench?.[0]?.shown) fail('the bench is not shown');
    if (!(M.off <= 0.03)) fail(`he stands ${M.off?.toFixed(3)} m off the bench's point`);
    if (!(M.turn <= 0.02)) fail(`he is turned ${M.turn?.toFixed(3)} rad off facing the bench`);
    if (M.faceLow === null) fail('the clip has no hammer pose to measure');
    else if (M.anvilTop === null || Math.abs(M.faceLow - M.anvilTop) > 0.01) fail(`the hammer's face at its lowest is ${M.faceLow} m, the anvil's top ${M.anvilTop} m`);
    else console.log(`the hammer's face at its lowest (t ${M.lowT} s): ${M.faceLow} m; the anvil's top ${M.anvilTop} m: ${((M.faceLow - M.anvilTop) * 1000).toFixed(1)} mm apart`);
    if (!M.overAnvil) fail(`a strike lands off the anvil's top: ${JSON.stringify(M.strikes)}`);
  }

  // the low view: from his tool hand's side and a little in front, at a standing eye's height, at the bench
  await ev(`(() => { const c = window.__city, A = window.__demo.stage.actors.get(${JSON.stringify(ID)});
    const ry = A.ry, f = [Math.sin(ry), Math.cos(ry)], l = [Math.cos(ry), -Math.sin(ry)];
    const t = [A.x + f[0] * 0.3, A.y + 0.85, A.z + f[1] * 0.3], d = [f[0] * 0.55 + l[0] * 0.85, f[1] * 0.55 + l[1] * 0.85], n = Math.hypot(d[0], d[1]);
    const p = [t[0] + (d[0] / n) * 4.2, A.y + 2.1, t[2] + (d[1] / n) * 4.2];
    c.VIEWS.hk2bench = { pos: p, tgt: t, fov: 45, sh: [(p[0] + t[0]) / 2, (p[2] + t[2]) / 2, 16] };
    c.cam?.toOrbit({ instant: true }); c.setView('hk2bench'); })()`);
  await page.sleep(900);
  await roll('low', 3);
  await ev(`(() => { const st = window.__demo.stage; st.camera.focus(null); st.focus('a1'); st.camera.arrived(); })()`);

  const wb = JSON.parse(await ev('JSON.stringify(window.__wb)'));
  console.log(`in the bench: ${wb.inside} body-frames of ${wb.frames} frames${wb.who.length ? ` (${wb.who.join(', ')})` : ''}`);
  if (!before && wb.inside) fail('somebody stood in the bench');
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
  console.log(`page errors: ${bad.length}${bad.length ? `\n  ${[...new Set(bad)].slice(0, 6).join('\n  ')}` : ''}`);
  if (bad.length) failed = true;
} catch (err) {
  console.error(String(err));
  failed = true;
} finally {
  await browser.close();
}
console.log(`workbench-film: ${before ? 'filmed (before)' : failed ? 'FAIL' : 'ok'}`);
process.exitCode = failed ? 1 : 0;
