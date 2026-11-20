#!/usr/bin/env node
// NO BLOOD LEFT IN THE AIR (anim-1; the owner, 2026-11-18: "a piece of blood splatter stays in the air and glitches in
// front of you"; blood-1, 2026-11-19, with a picture: "we still have that bug after fights where blood floats in front
// of the face in mid air"). This plays the fight page's one-on-one (the run's own fight, demo/run/duel.js) three times,
// the one you fight drawn as one of the city's named people at their own size (`?rivals=`: small Shaky Dee 0.90, Mr.
// Ambrose 1.00, Big Lou 1.25; you are 1.00), each picked and started by real mouse presses on the build panel's own
// buttons, the second skipped with a real Space key. Each fight is watched to its end, and then for AFTER seconds while
// the two stand (the idles nod and turn the head), turn round, and walk off a few metres:
//
//   · THE MARK ON A FACE: where it is drawn is within HAND (a hand's breadth) of the head's own surface AS IT IS DRAWN.
//     The head as drawn is measured here, not taken from the stage: its own triangles (head, hair and hat, as the near
//     batch has the look) posed by the city's own vertex shader (anim/cast/walk2.js) with the walker's own texels and
//     its instance matrix in the batch (feet, heading, tilt, size, seat), read back off the GPU. A mark that says where
//     it is in the body's own frame (`rest`) is posed the same way, here; else its world place is taken as it is.
//     Every frame (every other one) of the after, for every mark; and through the fight too;
//   · THE DRIP (the owner: "should youther face drip blood for a bit after the fight?"): each face that took a blow
//     drips after it; every drip drop starts within HAND of the head as drawn the frame it is made, none is made later
//     than the drip's own length (gore.js DRIP.secs) after the fight, and none is in the air more than DROP_AIR seconds;
//   · no drop is still in the air 2.5 s after the last blow landed; when it is over, nothing rides a body posed by hand;
//   · every size, small, standard and big, had a mark measured.
//
// The server must be running: node demo/serve.mjs --port 5518 --quiet
//
//   HK2_DEBUG_PORT=5782 node demo/tools/fight-blood.mjs --port 5518
//
// Prints a line a fight, then `blood-ok` or `blood-fail: <why>`.
import { launch } from './chrome.mjs';

const opt = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
};
const RIVALS = { brawler: 'dee', quick: 'lou', grabber: 'ambrose' };
const url = `http://127.0.0.1:${opt('--port', 5495)}/demo/?mode=fight&nostairs=1&rivals=${Object.entries(RIVALS).map(([s, n]) => `${s}:${n}`).join(',')}`;
/** A hand's breadth (m): how far off the head's surface as drawn a mark or the start of a drip may be. */
const HAND = 0.1;
/** The longest a drip's drop may be in the air (s). */
const DROP_AIR = 1.0;
/** How long the two are watched after a fight (s of the stage's clock): standing, turning round, walking off. */
const AFTER = 9;
const faults = [];
const fail = why => {
  faults.push(why);
  console.log(`  FAULT: ${why}`);
};

// THE HEAD AS DRAWN, in the page: the walker's own head posed by the city's own shader, read back off the GPU.
const DRAWN = `(async () => {
  if (window.__bloodCheck) return true;
  const demo = window.__demo, city = demo.city, THREE = city.THREE, A = demo.stage.actors;
  const W2 = await import(demo.CITY + 'anim/cast/walk2.js');
  const tex = W2.createAnimTexture2(1);
  const RT_W = 256;
  let rt = null, rtH = 0, installed = false;
  const mat = new THREE.ShaderMaterial({
    vertexShader: \`#include <batching_pars_vertex>
varying vec3 vW; uniform float uW, uH;
void main() {
#include <begin_vertex>
  vW = (modelMatrix * vec4(transformed, 1.)).xyz;
  float i = float(gl_VertexID);
  gl_Position = vec4((mod(i, uW) + .5) / uW * 2. - 1., (floor(i / uW) + .5) / uH * 2. - 1., 0., 1.);
  gl_PointSize = 1.;
}\`,
    fragmentShader: 'varying vec3 vW; void main() { gl_FragColor = vec4(vW, 1.); }',
    uniforms: { uW: { value: RT_W }, uH: { value: 1 } },
  });
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), M4 = new THREE.Matrix4();
  const cache = new Map();
  /** A look's head, hair and hat in the body's own frame, by triangle, off the near batch (the shader's part 5). */
  function restOf(B, gid) {
    if (cache.has(gid)) return cache.get(gid);
    const R = B.getGeometryRangeAt(gid), g = B.geometry, P = g.attributes.position, N = g.attributes.normal, K = g.attributes.aPart, I = g.index;
    const pos = [], nor = [], part = [];
    for (let t = R.indexStart; t < R.indexStart + R.indexCount; t += 3) {
      const v = [I.getX(t), I.getX(t + 1), I.getX(t + 2)];
      if (!v.every(j => Math.floor(K.getX(j) + 0.5) === 5)) continue;
      for (const j of v) { pos.push(P.getX(j), P.getY(j), P.getZ(j)); nor.push(N.getX(j), N.getY(j), N.getZ(j)); part.push(K.getX(j)); }
    }
    const out = { pos, nor, part, n: pos.length / 3 };
    cache.set(gid, out);
    return out;
  }
  /** Where a walker is drawn from: its near batch slot, or null. */
  function slotOf(id) {
    if (!A.has(id)) return null;
    const w = A.get(id).w, anim = city.peds.anim, k = anim.near.indexOf(w);
    if (w.hide || k < 0 || !anim.batch.getVisibleAt(k)) return null;
    return { w, anim, k };
  }
  /** The head's triangles in the world as drawn, and any extra rest points (body frame) posed as the head is. */
  function drawn(id, extra = []) {
    const S = slotOf(id);
    if (!S) return null;
    const { w, anim, k } = S;
    if (!installed) {
      W2.installAnim2(mat, { uAnim: { value: tex }, uKeys2: anim.uni.uKeys2, uB0: anim.uni.uB0, uB1: anim.uni.uB1, uB2: anim.uni.uB2 });
      installed = true;
    }
    const rest = restOf(anim.batch, anim.batch.getGeometryIdAt(k));
    if (!rest.n) return null;
    anim.batch.getMatrixAt(k, M4);
    // (an extra point is tagged as the head with the part of the head's nearest vertex: the look's hold rides in it)
    const pos = rest.pos.slice(), nor = rest.nor.slice(), part = rest.part.slice();
    for (const p of extra) {
      let best = 0, bd = Infinity;
      for (let i = 0; i < rest.n; i++) { const d = (rest.pos[i * 3] - p[0]) ** 2 + (rest.pos[i * 3 + 1] - p[1]) ** 2 + (rest.pos[i * 3 + 2] - p[2]) ** 2; if (d < bd) [bd, best] = [d, i]; }
      pos.push(...p); nor.push(0, 0, 1); part.push(rest.part[best]);
    }
    const n = pos.length / 3, H = Math.max(1, Math.ceil(n / RT_W));
    if (!rt || rtH < H) { rt?.dispose(); rtH = H; rt = new THREE.WebGLRenderTarget(RT_W, H, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false }); }
    mat.uniforms.uH.value = rtH;
    W2.writeGait2(tex.image.data, 1, 0, w.g);
    tex.needsUpdate = true;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
    const dots = new THREE.Points(geo, mat);
    dots.frustumCulled = false; dots.matrixAutoUpdate = false; dots.matrixWorldAutoUpdate = false; dots.matrixWorld.copy(M4);
    scene.add(dots);
    const r = city.renderer, before = r.getRenderTarget(), alpha = r.getClearAlpha(), px = new Float32Array(RT_W * rtH * 4);
    try { r.setRenderTarget(rt); r.setClearAlpha(0); r.clear(); r.render(scene, cam); r.readRenderTargetPixels(rt, 0, 0, RT_W, rtH, px); }
    finally { r.setRenderTarget(before); r.setClearAlpha(alpha); scene.remove(dots); geo.dispose(); }
    const tris = new Float32Array(rest.n * 3);
    for (let i = 0; i < rest.n; i++) for (let c = 0; c < 3; c++) tris[i * 3 + c] = px[i * 4 + c];
    return { tris, extra: extra.map((_, j) => [px[(rest.n + j) * 4], px[(rest.n + j) * 4 + 1], px[(rest.n + j) * 4 + 2]]) };
  }
  /** Distance from p to the triangle abc (the closest point on it: Ericson, Real-Time Collision Detection 5.1.5). */
  function triDist(p, T, i) {
    const a = [T[i], T[i + 1], T[i + 2]], b = [T[i + 3], T[i + 4], T[i + 5]], c = [T[i + 6], T[i + 7], T[i + 8]];
    const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]], dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const at = (o, u, s, v = [0, 0, 0], t = 0) => [o[0] + u[0] * s + v[0] * t, o[1] + u[1] * s + v[1] * t, o[2] + u[2] * s + v[2] * t];
    const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
    let q;
    if (d1 <= 0 && d2 <= 0) q = a;
    else {
      const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
      if (d3 >= 0 && d4 <= d3) q = b;
      else {
        const vc = d1 * d4 - d3 * d2;
        if (vc <= 0 && d1 >= 0 && d3 <= 0) q = at(a, ab, d1 / (d1 - d3));
        else {
          const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
          if (d6 >= 0 && d5 <= d6) q = c;
          else {
            const vb = d5 * d2 - d1 * d6;
            if (vb <= 0 && d2 >= 0 && d6 <= 0) q = at(a, ac, d2 / (d2 - d6));
            else {
              const va = d3 * d6 - d5 * d4;
              if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) q = at(b, sub(c, b), (d4 - d3) / (d4 - d3 + (d5 - d6)));
              else { const den = 1 / (va + vb + vc); q = at(a, ab, vb * den, ac, vc * den); }
            }
          }
        }
      }
    }
    return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  }
  const offOf = (T, p) => { let best = Infinity; for (let i = 0; i < T.length; i += 9) best = Math.min(best, triDist(p, T, i)); return best; };
  /** Every mark on a body now against its head as drawn: [{ id, kind, off, size, clip, posed }]. */
  function marks() {
    const g = demo.stage.gore, out = [];
    for (const r of g.riding()) {
      if (!A.has(r.id)) continue;
      const B = A.get(r.id), D = drawn(r.id, r.rest ? [r.rest] : []);
      const p = r.rest ? D?.extra[0] : [r.x, r.y, r.z];
      out.push({ id: r.id, kind: r.kind, off: D ? +offOf(D.tris, p).toFixed(3) : null, size: A.sizeOf(r.id), clip: B.clipName ?? null, posed: /^fight_body_/.test(B.clipName || '') });
    }
    return out;
  }
  // THE WATCH: from a fight's end (start()), every other frame of the stage: the marks, each new drip drop against its
  // head as drawn that frame, and the drops in the air
  const W = { on: false, frame: 0, t: 0, worst: {}, seen: {}, drips: [], air: 0, lastDrip: -1e9, samples: 0, sizes: {} };
  A.onFrame(dt => {
    if (!W.on) return;
    W.t += dt;
    W.frame += 1;
    const g = demo.stage.gore;
    const dr = g.dripped ? g.dripped() : [];
    for (const d of dr) {
      const key = d.id + ':' + d.t + ':' + d.at.join(',');
      if (W.seen[key]) continue;
      W.seen[key] = 1;
      const D = drawn(d.id);
      W.drips.push({ id: d.id, t: d.t, off: D ? +offOf(D.tris, d.at).toFixed(3) : null, size: A.sizeOf(d.id) });
      W.lastDrip = W.t;
    }
    // (a drip's drop in the air longer than DROP_AIR, once the fight's own drops are down: 2.5 s after it)
    if (W.t > 2.5 && g.stats().drops > 0 && W.t - W.lastDrip > ${DROP_AIR}) W.air += 1;
    if (W.frame % 2) return;
    for (const m of marks()) {
      if (m.off === null) continue;
      W.samples += 1;
      W.sizes[m.size] = (W.sizes[m.size] ?? 0) + 1;
      const k = m.id + ' (size ' + m.size + ')';
      if (!W.worst[k] || m.off > W.worst[k].off) W.worst[k] = { off: m.off, t: +W.t.toFixed(2), clip: m.clip };
    }
  });
  window.__bloodCheck = {
    marks,
    start() { Object.assign(W, { on: true, frame: 0, t: 0, worst: {}, seen: {}, drips: [], air: 0, lastDrip: -1e9, samples: 0, sizes: {} }); for (const d of demo.stage.gore.dripped?.() ?? []) W.seen[d.id + ':' + d.t + ':' + d.at.join(',')] = 1; },
    stop() { W.on = false; return { worst: W.worst, drips: W.drips, air: W.air, samples: W.samples, sizes: W.sizes, t: +W.t.toFixed(2) }; },
    /** After a fight: the two stand, turn round, and walk off a few metres each, away from each other. */
    async walkOff(ids) {
      await A.seconds(2.5);
      const [P, Q] = ids.map(id => A.get(id));
      const away = (S, T, d) => { const [dx, dz] = [S.x - T.x, S.z - T.z], l = Math.hypot(dx, dz) || 1; return [S.x + (dx / l) * d, S.z + (dz / l) * d]; };
      for (const [S, T] of [[P, Q], [Q, P]]) A.face(S.id, ...away(S, T, 3));
      await A.turned(ids, 2);
      await A.seconds(1);
      await Promise.all([[P, Q], [Q, P]].map(([S, T]) => A.stepTo(S.id, ...away(S, T, 3.5)).catch(() => false)));
      return true;
    },
  };
  return true;
})()`;

const browser = await launch({ width: 1600, height: 1000 });
let page = null;
const seen = { small: 0, standard: 0, big: 0 };
try {
  page = await browser.open(url);
  const ev = (js, ms = 60000) => page.evaluate(js, ms);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "pick"', 180000);
  await page.sleep(1200);
  await ev(DRAWN);
  const DRIP_SECS = await ev(`import(window.__demo.CITY.replace(/city\\/from-trunk\\/style\\/city\\/$/, '') + 'demo/stage/gore.js').then(m => m.DRIP?.secs ?? null, () => null)`);
  async function key(k, code, vk) {
    for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...(type === 'keyDown' && k.length === 1 ? { text: k } : {}) });
  }
  /** A real mouse press on the middle of the first visible thing a selector finds. */
  async function press(sel) {
    const b = await ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => x.getBoundingClientRect().width > 0); if (!e) return null; e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!b) throw new Error(`nothing to press: ${sel}`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y, button: 'none' });
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: b.x, y: b.y, button: 'left', clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', clickCount: 1 });
    await page.sleep(200);
  }
  /** What the blood is doing now during a fight. */
  const look = () => ev(`(() => { const g = window.__demo.stage.gore, d = window.__demo.hud.duel;
    if (!g || !g.riding) return { none: true };
    return { rows: window.__bloodCheck.marks(), drops: g.stats().drops, hits: d.state ? d.state.hits : null, phase: d.state ? d.state.phase : null, active: d.active }; })()`);

  async function fight(arm, foe, skipAt = null) {
    if (!(await ev(`!!document.querySelector('[data-row="duel:go"]')`))) await key('b', 'KeyB', 66);
    await page.sleep(400);
    await press(`[data-row="duel-arm:${arm}"]`);
    await press(`[data-row="duel-foe:${foe}"]`);
    await press('[data-row="duel:go"]');
    await page.waitFor('window.__demo.hud.duel.active', 60000, 30);
    const them = `fight:rival:${foe}`;
    let [n, worst, riders, lastHits, lastHitAt, late, skipped] = [0, 0, 0, 0, Date.now(), 0, false];
    const said = new Set();
    for (;;) {
      const L = await look();
      if (L.none) throw new Error('the stage has no blood to watch (gore.riding)');
      if (!L.active) break;
      n += 1;
      if (L.hits !== lastHits) [lastHits, lastHitAt] = [L.hits, Date.now()];
      for (const r of L.rows ?? []) {
        riders += 1;
        worst = Math.max(worst, r.off ?? 0);
        if (r.off !== null && r.off > HAND && !said.has(r.id)) {
          said.add(r.id);
          fail(`${arm} v ${foe}: a ${r.kind} mark on ${r.id} (size ${r.size}) is drawn ${r.off} m off its head as drawn, in the fight (${L.phase}${r.posed ? ', the body posed by hand' : ''})`);
        }
      }
      if (L.drops > 0 && Date.now() - lastHitAt > 2500) late += 1;
      if (skipAt !== null && !skipped && L.phase === 'fight' && L.hits >= skipAt) {
        skipped = true;
        await key(' ', 'Space', 32);
      }
      await page.sleep(90);
    }
    if (late) fail(`${arm} v ${foe}: drops still in the air 2.5 s after the last blow landed (${late} looks)`);
    // AFTER IT: standing, turning round, walking off, watched every other frame of the stage
    const size = await ev(`window.__demo.stage.actors.sizeOf(${JSON.stringify(them)})`);
    const bled = await ev(`window.__demo.stage.gore.riding().map(r => r.id)`);
    await ev(`window.__bloodCheck.start()`);
    await ev(`window.__bloodCheck.walkOff(['fight:you', ${JSON.stringify(them)}])`, 60000);
    await ev(`window.__demo.stage.actors.seconds(${AFTER}).then(() => true)`, 60000).catch(() => null);
    const S = await ev(`window.__bloodCheck.stop()`);
    const E = await look();
    for (const r of E.rows ?? []) if (r.posed) fail(`${arm} v ${foe}: after it, a ${r.kind} mark rides ${r.id}, the body still posed by hand`);
    for (const [who, w] of Object.entries(S.worst)) if (w.off > HAND) fail(`${arm} v ${foe}: after it, the mark on ${who} was drawn ${w.off} m off the head as drawn (${w.t} s after${w.clip ? ', in ' + w.clip : ''}); a hand's breadth is ${HAND} m`);
    for (const k of Object.keys(S.sizes)) seen[Number(k) < 0.99 ? 'small' : Number(k) > 1.01 ? 'big' : 'standard'] += S.sizes[k];
    // THE DRIP: each face with a mark dripped; each drop off the face as drawn, within the drip's length, none hanging
    const ids = [...new Set(bled)];
    for (const id of ids) if (!S.drips.some(d => d.id === id)) fail(`${arm} v ${foe}: ${id} has a mark and did not drip after the fight`);
    for (const d of S.drips) {
      if (d.off === null || d.off > HAND) fail(`${arm} v ${foe}: a drip's drop on ${d.id} (size ${d.size}) started ${d.off} m off the head as drawn`);
      if (DRIP_SECS === null || d.t > DRIP_SECS + 0.05) fail(`${arm} v ${foe}: a drip's drop on ${d.id} made ${d.t} s after the fight (the drip is ${DRIP_SECS} s)`);
    }
    if (S.air) fail(`${arm} v ${foe}: a drip's drop in the air more than ${DROP_AIR} s (${S.air} frames)`);
    const worstAfter = Object.entries(S.worst).map(([who, w]) => `${who} ${w.off} m`).join('; ') || 'none';
    console.log(`${arm} v ${foe} (${RIVALS[foe]}, size ${size})${skipped ? ' (skipped by Space)' : ''}: ${n} looks, ${lastHits} blows landed; in it the furthest mark ${worst.toFixed(3)} m off its head; after it (${S.t} s, ${S.samples} looks, standing, turning, walking off) the furthest: ${worstAfter}; drips ${S.drips.length} (${S.drips.map(d => `${d.id.replace('fight:', '')} at ${d.t} s, ${d.off} m off`).join(', ') || 'none'}); drops in the air too long: ${S.air} frames`);
    await page.waitFor('window.__demo.hud.phase === "pick"', 60000, 100);
    await page.sleep(600);
  }
  await fight('hands', 'brawler');
  await fight('haymaker', 'quick', 2);
  await fight('hands', 'grabber');
  for (const [k, v] of Object.entries(seen)) if (!v) fail(`no mark on a ${k} person was measured after a fight`);
  console.log(`marks measured after the fights: small ${seen.small}, standard ${seen.standard}, big ${seen.big}`);
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
  if (bad.length) fail(`${bad.length} page errors: ${[...new Set(bad)].slice(0, 3).join(' | ').slice(0, 600)}`);
} catch (err) {
  fail(String(err?.message ?? err));
} finally {
  await browser.close();
  console.log(faults.length ? `blood-fail: ${faults[0]}` : 'blood-ok');
  process.exitCode = faults.length ? 1 : 0;
}
