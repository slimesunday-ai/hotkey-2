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
// --odd     THE PLAYER'S ODD JOB FOR HIM (notes-2): the card "An odd job for Mr. Pruitt" picked with real keys, and
//           the player filmed and measured at his hammering instead: that he stands at the bench's point (3 cm) facing
//           it (0.02 rad); the clip's hammer face at HIS size (1) at its lowest against the anvil's top (within
//           3 cm: the bench is drawn at Mr. Pruitt's 1.05, so the player's face lands 2.5 cm into its top, never
//           above it), and over its top at each strike; and that the two of them never stand in each other while he
//           is at the bench (their heads' gap, actors.headGap, middle to middle, every frame), nor anybody in the
//           bench (the rest of the job, the pay, is reported, not judged: the hands' own work).
//           With --before, filmed and measured on code that does not stand him there (it fails). The whole job is
//           filmed, from the game's camera, or with --low from a low camera at the bench.
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
const odd = process.argv.includes('--odd');
/** (--odd) The player, and how near the hammer's face comes to the anvil's top for him (m): into it, never above it. */
const YOU = 'a1';
const ODD_TOL = 0.03;
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
  // him at his work: a loop of it on him from its start, blended in (--odd: the player at it, for Mr. Pruitt)
  const WHO = odd ? YOU : ID;
  const working = `(c => c.name === 'bench_hammer' && c.w > 0.9 && (c.t ?? 0) % 2.8 < 0.35)(window.__demo.stage.actors.clipOf(${JSON.stringify(WHO)}))`;
  if (odd) {
    // (the card for his odd job, with real keys; and from now, every frame, the two of them: how near their middles
    // come against the gap their heads ask for, and where the player is while he hammers)
    const job = await ev(`window.__demo.hud.view.choices.find(c => c.choice.do === 'job' && /odd job for Mr\\. Pruitt/.test(c.label ?? c.title ?? ''))?.key ?? null`);
    if (!job) throw new Error('no card for an odd job for Mr. Pruitt');
    await ev(`(() => { const st = window.__demo.stage, A = st.actors; window.__odd = { near: null, frames: 0, hammer: 0 };
      A.onFrame(() => { const a = A.get(${JSON.stringify(YOU)}), b = A.get(${JSON.stringify(ID)}); if (!a || !b || a.w?.hide || b.w?.hide) return; const O = window.__odd; O.frames++;
        const d = Math.hypot(a.x - b.x, a.z - b.z), gap = A.headGap(${JSON.stringify(YOU)}, ${JSON.stringify(ID)}), c = A.clipOf(${JSON.stringify(YOU)});
        if (c.name === 'bench_hammer') { O.hammer++; if (c.w > 0.9 && !O.pose) O.pose = [a.x, a.y, a.z, a.ry]; }
        // (at the bench: hammering, or within half a metre of its point on his way to it; elsewhere, in the hand-over or not)
        const atBench = c.name === 'bench_hammer' || (!O.hammer && Math.hypot(a.x - ${-242.7}, a.z - ${-49.1}) < 0.5);
        const contact = !!a.contact && a.contact === b.contact, k = atBench ? 'nearBench' : contact ? 'nearContact' : 'near';
        if (d - gap < 0) O['short_' + k] = (O['short_' + k] ?? 0) + 1;
        if (d < 6 && (!O[k] || d - gap < O[k].short)) O[k] = { d: +d.toFixed(3), gap: +gap.toFixed(3), short: +(d - gap).toFixed(3), clip: c.name, other: A.clipOf(${JSON.stringify(ID)}).name, contact, t: +A.clock.toFixed(2), at: [+a.x.toFixed(2), +a.z.toFixed(2), +b.x.toFixed(2), +b.z.toFixed(2)] }; }); })()`);
    const k2 = await ev(`window.__demo.hud.keyFor(${JSON.stringify(String(job))})`);
    if (k2) await press(k2);
    await ev(`window.__demo.hud.pick(${JSON.stringify(String(job))})`);
    await press('Enter');
  }
  if (!odd) await page.waitFor(working, 120000, 30);

  async function roll(view, secs, wait = working, until = null) {
    await page.waitFor(wait, 120000, 30);
    const dir = path.join(out, view);
    mkdirSync(dir, { recursive: true });
    const shots = [];
    const t0 = Date.now();
    for (let n = 0; Date.now() - t0 < secs * 1000 && !(until && (await ev(`!!(${until})`).catch(() => false))); n++) {
      const file = path.join(dir, `f-${String(n).padStart(3, '0')}.jpg`);
      await page.shot(file);
      shots.push({ file, t: +((Date.now() - t0) / 1000).toFixed(3), ...JSON.parse(await ev(`JSON.stringify({ clip: (c => [c.name, +(c.t ?? 0).toFixed(2)])(window.__demo.stage.actors.clipOf(${JSON.stringify(WHO)})), screen: window.__demo.stage.actors.screenOf(${JSON.stringify(WHO)}) })`)) });
    }
    writeFileSync(path.join(out, `${view}.json`), JSON.stringify({ shots }));
    console.log(`${view}: ${shots.length} frames filmed over ${secs} s, the loop on ${WHO} in ${shots.filter(s => s.clip?.[0] === 'bench_hammer').length}`);
  }
  // (--odd: his hammering is two loops of the scene's, not an hour's routine: measured first, then filmed, the low view
  // as soon as the game's is done)
  if (!odd) await roll('game', 3);
  // (--odd: THE WHOLE JOB filmed, from the card to the choice again: up to him, the talk, the hammer, the pay; from the
  // game's camera, or with --low from a low camera at the bench (the game's camera left as it is: only the picture is
  // taken from there, in the city's own frame before it is drawn). Measured on the pose he hammered in)
  if (odd) {
    const lowCam = process.argv.includes('--low');
    if (lowCam) await ev(`(async () => { const c = window.__city, WB = await import('/demo/stage/set/workbench.js'); const [x, z, ry] = WB.workAt(${JSON.stringify(SPOT)}, 'bench_hammer'), y = 0.3;
      const f = [Math.sin(ry), Math.cos(ry)], l = [Math.cos(ry), -Math.sin(ry)];
      // (square to his side at the bench, on the side Mr. Pruitt is not: he is not stood between it and the work)
      const A = window.__demo.stage.actors; let side = 1;
      const t = [x + f[0] * 0.45, y + 0.85, z + f[1] * 0.45], pAt = sd => [x + f[0] * 1.3 + l[0] * 3.3 * sd, y + 1.25, z + f[1] * 1.3 + l[1] * 3.3 * sd];
      const br = c.scene.onBeforeRender; window.__lowBr = br; window.__lowFov = c.camera.fov;
      c.scene.onBeforeRender = function (...a) { const K = A.get(${JSON.stringify(ID)}); if (K) { const lat = (K.x - x) * l[0] + (K.z - z) * l[1]; if (Math.abs(lat) > 0.5) side = -Math.sign(lat); }
        const p = pAt(side); if (a[2] === c.camera) { c.camera.position.set(...p); c.camera.up.set(0, 1, 0); c.camera.lookAt(...t); c.camera.updateMatrixWorld(true); if (c.camera.fov !== 50) { c.camera.fov = 50; c.camera.updateProjectionMatrix(); } } return br?.apply(this, a); };
      return true; })()`);
    await roll(lowCam ? 'low' : 'game', 40, 'true', `window.__demo.hud.phase !== 'playing' && window.__odd.hammer > 0`);
    if (lowCam) await ev('(() => { const c = window.__city; c.scene.onBeforeRender = window.__lowBr; c.camera.fov = window.__lowFov; c.camera.updateProjectionMatrix(); return true; })()');
  }
  async function measure() {
    // (measured while the loop is on him; --odd: on the pose he hammered in, the job over)
    if (!odd) await page.waitFor(working, 120000, 30);
    const M = JSON.parse(await ev(`(async () => {
      const st = window.__demo.stage, A0 = st.actors.get(${JSON.stringify(WHO)}), P = st.director.people.get(${JSON.stringify(ID)});
      const A = ${odd ? `(q => (q ? { x: q[0], y: q[1], z: q[2], ry: q[3] } : A0))(window.__odd.pose)` : 'A0'};
      const WB = await import('/demo/stage/set/workbench.js');
      const at = WB.workAt(${odd ? JSON.stringify(SPOT) : 'P.spot'}, 'bench_hammer');
      const { CLIP } = await import(${JSON.stringify(CLIPS)});
      const BP = await import('/city/from-trunk/style/city/anim/cast/clips/bench-props.js');
      const size = st.actors.sizeOf(${JSON.stringify(WHO)});
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
    else if (M.anvilTop === null || (odd ? M.faceLow - M.anvilTop > 0.002 || M.anvilTop - M.faceLow > ODD_TOL : Math.abs(M.faceLow - M.anvilTop) > 0.01)) fail(`the hammer's face at its lowest is ${M.faceLow} m, the anvil's top ${M.anvilTop} m`);
    else console.log(`the hammer's face at its lowest (t ${M.lowT} s): ${M.faceLow} m; the anvil's top ${M.anvilTop} m: ${((M.faceLow - M.anvilTop) * 1000).toFixed(1)} mm apart`);
    if (!M.overAnvil) fail(`a strike lands off the anvil's top: ${JSON.stringify(M.strikes)}`);
  }
  if (!before || odd) await measure();

  // the low view: from his tool hand's side and a little in front, at a standing eye's height, at the bench
  if (!odd) await ev(`(() => { const c = window.__city, A = window.__demo.stage.actors.get(${JSON.stringify(WHO)});
    const ry = A.ry, f = [Math.sin(ry), Math.cos(ry)], l = [Math.cos(ry), -Math.sin(ry)];
    const t = [A.x + f[0] * 0.3, A.y + 0.85, A.z + f[1] * 0.3], d = [f[0] * 0.55 + l[0] * 0.85, f[1] * 0.55 + l[1] * 0.85], n = Math.hypot(d[0], d[1]);
    const p = [t[0] + (d[0] / n) * 4.2, A.y + 2.1, t[2] + (d[1] / n) * 4.2];
    c.VIEWS.hk2bench = { pos: p, tgt: t, fov: 45, sh: [(p[0] + t[0]) / 2, (p[2] + t[2]) / 2, 16] };
    c.cam?.toOrbit({ instant: true }); c.setView('hk2bench'); })()`);
  if (!odd) {
    await page.sleep(900);
    await roll('low', 3);
    await ev(`(() => { const st = window.__demo.stage; st.camera.focus(null); st.focus('a1'); st.camera.arrived(); })()`);
  }
  if (odd) {
    // (the job played out, the pay included: the two of them, every frame of it)
    const O = JSON.parse(await ev('JSON.stringify(window.__odd)'));
    const say = n => (n ? `${n.d} m middle to middle against a heads' gap of ${n.gap} m (${n.short >= 0 ? `${n.short} m to spare` : `${-n.short} m SHORT`}), the player ${n.clip}, Mr. Pruitt ${n.other}, at ${JSON.stringify(n.at)}, clock ${n.t}` : 'never near');
    console.log(`the two of them, while the player is at the bench: nearest ${say(O.nearBench)} (${O.short_nearBench ?? 0} frames short)`);
    console.log(`  elsewhere in the job: nearest ${say(O.near)} (${O.short_near ?? 0} frames short); in the hand-over (heads may be close for it: the pay) ${say(O.nearContact)}; ${O.hammer} frames of the player hammering of ${O.frames}`);
    if (!O.nearBench || O.nearBench.short < 0) fail('the player and Mr. Pruitt stood in each other at the bench');
  }

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
console.log(`workbench-film${odd ? ' (the odd job)' : ''}: ${before && !odd ? 'filmed (before)' : failed ? 'FAIL' : 'ok'}`);
process.exitCode = failed ? 1 : 0;
