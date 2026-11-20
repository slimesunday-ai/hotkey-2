#!/usr/bin/env node
// THE DOOR SWINGS AWAY FROM WHOEVER WALKS THROUGH IT (notes-1, the owner 2026-11-19: "the door should swing out from
// the direction you are walking so it doesnt pass through your body"). Plays THE RUN's own door both ways with real
// keys, films it from the game's own camera, and measures, every drawn frame, how near each drawn door leaf comes to
// every body of ours: the leaf as it is drawn (its box through its world matrix, wherever a mesh of the door leaf's
// size is shown), against each body as an upright cylinder of radius BODY from its feet to 1.8 m. Fails when a leaf
// meets a body (nearer than BODY to the body's middle) or the doorway's own measure (doorway.swept()) saw one.
// The server must be running: node demo/serve.mjs --port 5513
//
//   node demo/tools/door-swing.mjs --out <dir> [--port 5513] [--seed 3] [--only out,in] [--no-film] [--own deadbolt,doorbar]
//
// --own  the run's things owned first (the chain and deadbolt, the door bar: mounted on the room side of both leaves)
// out   at home, the card that goes out (real keys): across the room, the door, onto the step and off
// in    put at the market with cash on him, H and Enter (real keys) home: off the ride, up the step, in, to his place
// Writes <dir>/<way>/f-NNN.jpg (the film's frames), <dir>/<way>.json (every frame's measure), and prints the nearest.
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/door-swing'));
const port = opt('--port', 5513);
const url = `http://127.0.0.1:${port}/demo/?mode=run&seed=${opt('--seed', '3')}`;
const only = opt('--only', null)?.split(',') ?? null;
const want = name => !only || only.includes(name);
const film = !process.argv.includes('--no-film');
/**
 * A body on the ground (m): a square about its feet, square to its heading, this far each way from its middle. The
 * figures' heads are the widest of them: 0.89 m square seen from straight over a standing player (doorway.js BODY).
 */
const BODY = 0.45;
const KEY = 'pad:a1';

// (in the page: every frame, each shown door leaf, with what is mounted on it, against each body of ours: the body a
// square about its feet, square to its heading, BODY each way from its middle)
const RECORDER = `(() => {
  const c = window.__city, st = window.__demo.stage, T = c.THREE, BODY = ${BODY};
  const R = window.__doorRec = { frames: [], on: true, t0: performance.now() };
  let leaves = [], found = 0;
  const shown = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const inQ = (p, Q) => { let s = 0; for (let k = 0; k < 4; k++) { const cr = cross(Q[k], Q[(k + 1) % 4], p); if (Math.abs(cr) < 1e-12) continue; if (s && Math.sign(cr) !== s) return false; s = Math.sign(cr); } return true; };
  const segD = (p, u, v) => { const [ex, ez] = [v[0] - u[0], v[1] - u[1]]; const t = Math.max(0, Math.min(1, ((p[0] - u[0]) * ex + (p[1] - u[1]) * ez) / (ex * ex + ez * ez || 1))); return Math.hypot(p[0] - u[0] - ex * t, p[1] - u[1] - ez * t); };
  const meet = (p, q, r, s) => Math.sign(cross(p, q, r)) !== Math.sign(cross(p, q, s)) && Math.sign(cross(r, s, p)) !== Math.sign(cross(r, s, q));
  const gap = (a, b) => { if (a.some(p => inQ(p, b)) || b.some(p => inQ(p, a))) return 0; let d = Infinity; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const [p, q, r, s] = [a[i], a[(i + 1) % 4], b[j], b[(j + 1) % 4]]; if (meet(p, q, r, s)) return 0; d = Math.min(d, segD(p, r, s), segD(q, r, s), segD(r, p, q), segD(s, p, q)); } return d; };
  const body = A => { const [fx, fz] = [Math.sin(A.ry) * BODY, Math.cos(A.ry) * BODY], [sx, sz] = [fz, -fx]; return [[A.x + fx + sx, A.z + fz + sz], [A.x + fx - sx, A.z + fz - sz], [A.x - fx - sx, A.z - fz - sz], [A.x - fx + sx, A.z - fz + sz]]; };
  // (the leaf's box, and each shown thing mounted on it, in the leaf's own frame)
  const boxesOf = L => { L.updateWorldMatrix(true, true); const inv = L.matrixWorld.clone().invert(); const out = [new T.Box3(new T.Vector3(-0.53, -1.1, -0.03), new T.Vector3(0.53, 1.1, 0.03))];
    for (const c of L.children) { if (!shown(c)) continue; const b = new T.Box3(); c.traverse(o => { if (!o.geometry || !shown(o)) return; o.geometry.boundingBox ?? o.geometry.computeBoundingBox(); b.union(o.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld))); }); if (!b.isEmpty()) out.push(b); } return out; };
  const v = new T.Vector3();
  function tick() {
    if (!R.on) return;
    const now = performance.now();
    if (now - found > 500) {
      found = now;
      leaves = [];
      c.scene.traverse(o => { const p = o.geometry?.parameters; if (o.isMesh && p && Math.abs(p.width - 1.06) < 1e-3 && Math.abs(p.height - 2.2) < 1e-3 && Math.abs(p.depth - 0.06) < 1e-3) leaves.push(o); });
    }
    const f = { t: +((now - R.t0) / 1000).toFixed(3), up: st.inside?.up ?? null, door: st.doorway?.info?.(${JSON.stringify(KEY)}, 'a1') ?? null, leaves: [] };
    for (const L of leaves) {
      if (!shown(L) || (L.material?.transparent && L.material.opacity < 0.02)) continue;
      const qs = boxesOf(L).map(b => [[b.min.x, b.min.z], [b.max.x, b.min.z], [b.max.x, b.max.z], [b.min.x, b.max.z]].map(([x, z]) => (v.set(x, b.min.y, z).applyMatrix4(L.matrixWorld), [v.x, v.z])));
      const q = qs[0];
      const y0 = v.set(0, -1.1, 0).applyMatrix4(L.matrixWorld).y;
      const e = { which: y0 > 6 ? 'in' : 'out', near: null, mounted: L.children.filter(shown).length };
      for (const A of st.actors.all()) {
        if (!A || A.w?.hide || Math.abs(A.y - y0) > 1.5) continue;
        const d = Math.min(...qs.map(p => gap(p, body(A))));
        if (!e.near || d < e.near.d) e.near = { id: A.id, d: +d.toFixed(3), mid: +Math.hypot(A.x - (q[0][0] + q[2][0]) / 2, A.z - (q[0][1] + q[2][1]) / 2).toFixed(3) };
      }
      // (how far it is turned off the wall and which way: + into the building or room, - out of it)
      e.turn = +(L.parent?.rotation?.y ?? 0).toFixed(3);
      f.leaves.push(e);
    }
    R.frames.push(f);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return true;
})()`;

const browser = await launch({ width: 1600, height: 1000 });
let failed = false;
try {
  const page = await browser.open(url);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 150000);
  await page.evaluate('window.__demo.stage.actors.audit(true)');
  await page.sleep(2500);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  // (real keys: the page hears them as a player's)
  const KEYS = { Enter: ['Enter', 13], ' ': ['Space', 32] };
  const press = async k => {
    const [code, vk] = KEYS[k] ?? [/\d/.test(k) ? `Digit${k}` : `Key${k.toUpperCase()}`, k.toUpperCase().charCodeAt(0)];
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: k, windowsVirtualKeyCode: vk, text: k.length === 1 ? k : k === 'Enter' ? '\r' : undefined });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: k, windowsVirtualKeyCode: vk });
    await page.sleep(220);
  };
  const choose = async card => {
    const k = await ev(`window.__demo.hud.keyFor(${JSON.stringify(String(card))})`);
    await press(k);
    await press('Enter');
  };
  const phase = p => page.waitFor(`window.__demo.hud.phase === ${JSON.stringify(p)}`, 150000, 100);

  /** Films and measures from now until `done` is true in the page. */
  async function roll(way, done, ms = 60000) {
    const dir = path.join(out, way);
    mkdirSync(dir, { recursive: true });
    await ev(RECORDER);
    const shots = [];
    const t0 = Date.now();
    let n = 0;
    while (Date.now() - t0 < ms) {
      if (await ev(`!!(${done})`).catch(() => false)) break;
      if (film) {
        const t = await ev('+((performance.now() - window.__doorRec.t0) / 1000).toFixed(3)');
        const file = path.join(dir, `f-${String(n++).padStart(3, '0')}.jpg`);
        await page.shot(file);
        shots.push({ file, t });
      } else await page.sleep(100);
    }
    const frames = await ev('(R => (R.on = false, R.frames))(window.__doorRec)', 60000);
    writeFileSync(path.join(out, `${way}.json`), JSON.stringify({ shots, frames }));
    // the nearest a shown leaf came to a body, per leaf, over the whole walk
    const best = {};
    for (const f of frames) for (const e of f.leaves) if (e.near && (!best[e.which] || e.near.d < best[e.which].d)) best[e.which] = { ...e.near, t: f.t, turn: e.turn, door: f.door };
    // and the frame of the film nearest that moment, per leaf
    for (const b of Object.values(best)) b.shot = shots.reduce((m, s) => (!m || Math.abs(s.t - b.t) < Math.abs(m.t - b.t) ? s : m), null);
    const turns = {};
    for (const f of frames) for (const e of f.leaves) if (Math.abs(e.turn) > 0.3) (turns[e.which] ??= new Set()).add(Math.sign(e.turn) > 0 ? 'in' : 'out');
    console.log(`${way}: ${frames.length} frames measured, ${shots.length} filmed; the leaves swung: ${Object.entries(turns).map(([k, s]) => `${k === 'out' ? 'the trailer\'s' : 'the room\'s'} ${[...s].join('+')}`).join(', ') || 'none'}`);
    for (const [k, b] of Object.entries(best)) {
      console.log(`  ${k === 'out' ? 'the trailer\'s leaf (outside view)' : 'the room\'s leaf (inside view)'}: nearest ${b.id}, the body's edge ${b.d <= 0 ? 'MEETS the leaf — THROUGH HIM' : `${b.d.toFixed(3)} m clear`} (its middle ${b.mid} m from the leaf's) at t ${b.t} s; turned ${b.turn} rad; frame ${b.shot ? path.basename(b.shot.file) : '-'} (t ${b.shot?.t ?? '-'})`);
      if (b.d <= 0) failed = true;
    }
    return best;
  }

  const own = opt('--own', null)?.split(',') ?? [];
  if (own.length) {
    await ev(`(async () => { const h = window.__demo.hud; const s = structuredClone(h.state); s.things = { ...s.things, ${own.map(k => `${JSON.stringify(k)}: true`).join(', ')} }; return await h.load(s); })()`);
    await page.waitFor(`(window.__demo.stage.inside.place(${JSON.stringify(KEY)}).room ?? '').includes('door')`, 60000, 200).catch(() => console.log('  (the room did not say it has the door things)'));
    await phase('choose');
    await page.sleep(3000);
  }
  if (want('out')) {
    await choose(await ev(`window.__demo.hud.view.choices.find(c => c.choice.do === 'out').key`));
    await roll('out', `(d => !window.__demo.stage.debug().inside.length && d && d.step > 2.5)(window.__demo.stage.doorway.info(${JSON.stringify(KEY)}, 'a1'))`);
    await phase('choose');
    await page.sleep(1500);
  }
  if (want('in')) {
    await phase('choose');
    await ev(`(async () => { const h = window.__demo.hud; const s = structuredClone(h.state); Object.assign(s, { place: 'market', hour: 15, energy: 4, heat: 0, carried: 64, hoursThere: 2, rig: { chances: [99], rolls: [] } }); s.books.earned += (s.carried + s.banked) - (h.state.carried + h.state.banked); return await h.load(s); })()`);
    await page.sleep(2500);
    await press('h');
    await press('Enter');
    await page.sleep(2500);
    await press(' ');
    await page.waitFor(`!window.__demo.stage.travelling && !window.__demo.stage.debug().dark && (d => d && d.step < 6 && d.side > 0.3)(window.__demo.stage.doorway.info(${JSON.stringify(KEY)}, 'a1'))`, 90000, 50);
    await roll('in', `(d => d && d.inside && window.__demo.stage.actors.get('a1').moving < 0.05 && d.kIn < 0.01 && d.dIn > 0.6)(window.__demo.stage.doorway.info(${JSON.stringify(KEY)}, 'a1'))`);
  }
  const sw = await ev(`window.__demo.stage.doorway.swept?.() ?? null`);
  console.log(`the doorway's own measure: ${sw ? JSON.stringify(sw) : 'none (not in this build)'}`);
  if (sw && sw.through > 0) failed = true;
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
  console.log(bad.length ? `page errors:\n  ${[...new Set(bad)].slice(0, 8).join('\n  ')}` : 'page errors: 0');
  if (bad.length) failed = true;
} catch (err) {
  console.error(String(err));
  failed = true;
} finally {
  await browser.close();
}
console.log(failed ? 'door-swing: FAIL' : 'door-swing: ok');
process.exit(failed ? 1 : 0);
