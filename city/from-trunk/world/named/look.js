// THE NAMED CAST · the preview page (look.html): draws a named person, or anyone the city can roll, as the review pictures. Read only:
// it builds figures with the city's own door to characters (style/city/cast.js) and the named pool (./index.js), and hands pictures
// back as data URLs (window.__named). Driven headless by shoot.mjs; opened by hand it shows every named person at the game's size.
// The light and the 34° view are the city's item-icon baker's (style/city/ui/icons/tools/bake.js): the sun high from the viewer's
// left, a sky-gradient environment, the hemisphere, NeutralToneMapping. Three cameras:
//   close  head and shoulders, a perspective lens 10° down, framed on the head (a portrait: no scale)
//   whole  the whole figure, orthographic, 12° down, a FIXED 125 px a metre with the feet on one line: sizes compare across people
//   game   the run's own camera, 64° down, 46 px a metre at a 1000 px tall view (the size a person is in the game, about 55 px), drawn
//          at that true size from a 4× render
// A PROP (index.js § PROPS) with its owner: propPictures(name) → the game's camera by day and night (one sample a pixel, the strict
// test), four close-ups, side on, and the contact sheet (shoot.mjs --prop). (Measured 2026-11-19: the cart man stands 70 px tall at 46.)
import * as THREE from 'three';
import * as CH from '../../style/city/cast.js';
import * as N from './index.js';
import { tierize, meshOf } from '../../style/city/gpu.js';
import { packFull } from '../../style/city/lod.js';
import { HOLD } from '../cast/fit/held.js';
import { propBank } from './props/build.js';

const AZ = 34 * Math.PI / 180, CLOSE_EL = 10 * Math.PI / 180, WHOLE_EL = 12 * Math.PI / 180, GAME_EL = 64 * Math.PI / 180;
export const PPM_GAME = 46, PPM_WHOLE = 125;
const BONE = '#e6e1d6', PAVE = '#c9c5ba';

// ── the stage
const R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
R.setPixelRatio(1); R.setClearColor(0x000000, 0); R.toneMapping = THREE.NeutralToneMapping; R.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
{ const sky = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { top: { value: new THREE.Color(0x2f9bff) }, hor: { value: new THREE.Color(0x9fdcff) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top, hor; varying vec3 vD; void main(){ float h = vD.y; gl_FragColor = vec4(h > 0. ? mix(hor, top, pow(clamp(h,0.,1.), .5)) : hor, 1.);\n#include <colorspace_fragment>\n}' });
  const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), sky));
  scene.environment = new THREE.PMREMGenerator(R).fromScene(es, 0.02).texture; scene.environmentIntensity = 0.55; }
const sun = new THREE.DirectionalLight(0xfff2dc, 3.0); scene.add(sun, sun.target);
const sunDir = new THREE.Vector3(-0.55, 0.85, 0.62).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), AZ * 0.5);
const hemi = new THREE.HemisphereLight(0xd6ecff, 0xe0cfb0, 1.05); scene.add(hemi);
const persp = new THREE.PerspectiveCamera(18, 1, 0.01, 400), ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
const viewOf = el => new THREE.Vector3(Math.sin(AZ) * Math.cos(el), Math.sin(el), Math.cos(AZ) * Math.cos(el));
const V = new THREE.Vector3();

// ── who: the named person's own look, or how the game dresses someone today (a roll from a seed in a pool, an outfit, pieces over it:
// the stage's lookOf, demo/stage/actors.js), or a look given whole
const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
export function lookFor(who) {
  if (who.named) return N.lookOf(who.named);
  if (who.seed) { const L = CH.rollLook(typeof who.seed === 'number' ? who.seed : fnv(String(who.seed)) & 0xffffff, { pool: who.pool || 'agent' });
    if (who.outfit) CH.wear(L, CH.OUTFITS[who.outfit]); if (who.wear) CH.wear(L, who.wear); return L; }
  return who.look;
}
export function figure(who) {
  const L = lookFor(who), o = CH.build(L), s = who.named ? N.scaleOf(who.named) : (who.scale ?? 1);
  if (o.userData.open) { o.userData.open.visible = true; o.userData.shut.visible = false; }
  CH.pose(o, 0, 0); if (who.ry) o.rotation.y = who.ry; o.scale.multiplyScalar(s); o.updateMatrixWorld(true); return o;
}
function points(o, band) { o.updateMatrixWorld(true); const out = [];
  o.traverse(n => { if (!n.isMesh || !n.geometry) return; for (let p = n; p; p = p.parent) if (!p.visible) return; const pos = n.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { V.fromBufferAttribute(pos, i).applyMatrix4(n.matrixWorld); if (band && (V.y < band[0] || V.y > band[1])) continue; out.push(V.x, V.y, V.z); } });
  return out; }
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function shrink(src, w, h) { let s = src; while (s.width / 2 >= w && s.height / 2 >= h) { const t = canvasOf(Math.round(s.width / 2), Math.round(s.height / 2)), g = t.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(s, 0, 0, t.width, t.height); s = t; }
  if (s.width === w && s.height === h) return s; const t = canvasOf(w, h), g = t.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(s, 0, 0, w, h); return t; }
function shot(cam, w, h, o, focus) { sun.position.copy(focus).addScaledVector(sunDir, 20); sun.target.position.copy(focus); R.setSize(w, h, false);
  scene.add(o); R.render(scene, cam); scene.remove(o); const c = canvasOf(w, h); c.getContext('2d').drawImage(R.domElement, 0, 0); return c; }
const onBg = (pic, bg) => { const c = canvasOf(pic.width, pic.height), g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.drawImage(pic, 0, 0); return c; };

// close: head and shoulders, framed on the band from the chest up (so a hat or a bun stays in), perspective, square
export function close(o, px = 256, { lo = 12.5, hi = 42, pad = 0.06 } = {}) {
  const s = o.scale.x, P = points(o, [lo * s, hi * s]), box = new THREE.Box3(); for (let i = 0; i < P.length; i += 3) box.expandByPoint(V.set(P[i], P[i + 1], P[i + 2]));
  const c = box.getCenter(new THREE.Vector3()), r = Math.max(1e-3, box.getSize(new THREE.Vector3()).length() / 2), n = px * 4;
  persp.aspect = 1; persp.clearViewOffset(); persp.position.copy(c).addScaledVector(viewOf(CLOSE_EL), r / Math.sin(THREE.MathUtils.degToRad(persp.fov / 2)) * 1.05);
  persp.near = r * .05; persp.far = r * 40; persp.lookAt(c); persp.updateProjectionMatrix(); persp.updateMatrixWorld();
  let x0 = 1, x1 = -1, y0 = 1, y1 = -1; for (let i = 0; i < P.length; i += 3) { V.set(P[i], P[i + 1], P[i + 2]).project(persp); x0 = Math.min(x0, V.x); x1 = Math.max(x1, V.x); y0 = Math.min(y0, V.y); y1 = Math.max(y1, V.y); }
  const side = Math.max(x1 - x0, y1 - y0) * (1 + 2 * pad), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, full = n * 2 / side;
  persp.setViewOffset(full, full, (cx - side / 2 + 1) / 2 * full, (1 - (cy + side / 2)) / 2 * full, n, n);
  return shrink(shot(persp, n, n, o, c), px, px);
}
// an orthographic view at a fixed scale (ppm pixels a metre at the final size), the world origin (the feet) at pixel (fx, fy)
function fixed(o, w, h, el, ppm, fx, fy, ss = 4) {
  const v = viewOf(el), right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), v).normalize(), up = new THREE.Vector3().crossVectors(v, right).normalize();
  const T = right.clone().multiplyScalar((w / 2 - fx) / ppm).addScaledVector(up, (fy - h / 2) / ppm);
  Object.assign(ortho, { left: -w / 2 / ppm, right: w / 2 / ppm, top: h / 2 / ppm, bottom: -h / 2 / ppm, near: 0.01, far: 60 });
  ortho.position.copy(T).addScaledVector(v, 20); ortho.up.set(0, 1, 0); ortho.lookAt(T); ortho.updateProjectionMatrix(); ortho.updateMatrixWorld();
  return shrink(shot(ortho, w * ss, h * ss, o, new THREE.Vector3(0, 1, 0)), w, h);
}
export const whole = (o, w = 200, h = 300) => fixed(o, w, h, WHOLE_EL, PPM_WHOLE, w / 2, h - 10);
// the game's size: one figure in a w × h true-size frame, the feet at (w / 2, h − 16) (room for the biggest, Big Lou at 1.25)
export const game = (o, w = 76, h = 100) => fixed(o, w, h, GAME_EL, PPM_GAME, w / 2, h - 16);
// the figure's height on screen at the game's camera (its painted pixels, top to bottom)
export function heightPx(pic) { const d = pic.getContext('2d').getImageData(0, 0, pic.width, pic.height).data; let t = -1, b = -1;
  for (let y = 0; y < pic.height; y++) for (let x = 0; x < pic.width; x++) if (d[(y * pic.width + x) * 4 + 3] > 40) { if (t < 0) t = y; b = y; } return t < 0 ? 0 : b - t + 1; }

const url = (c, q = .92) => c.toDataURL('image/webp', q);
// the pictures the review asks for. who: { named } | { seed, pool, outfit, wear } | { look, scale }
function pictures(who, kinds = ['close', 'whole', 'game']) {
  const out = {};
  for (const k of kinds) { const o = figure(who);
    try { if (k === 'close') out.close = url(onBg(close(o), BONE));
      else if (k === 'whole') out.whole = url(onBg(whole(o), BONE));
      else if (k === 'game') { const g = game(o); out.game = url(g, 1); out.gamePx = heightPx(g); } }
    finally { CH.dispose(o); } }
  return out;
}

// ── PROPS (index.js § PROPS): a named person's prop as the city draws it (props/build.js propBank: the bank a block stamps, in the
// city's block materials, style/city/main.js MAT.full), with its owner on a patch of pavement, the sun casting shadows (the city's do).
// Day is the stage above (the city's day defaults); night is the city's night bundle (style/city/render/lighting.js BUNDLE.night: a
// moon of 0.35, the night fill and dome) and one street lamp's light (render/night.js: 0xffd79a × 22, cut-off 15 m, decay 1.4).
const PMAT = [tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0 })), tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .22, metalness: .1 })),
  tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: .85 })), tierize(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }))];
const WALK = 0xcdc5b8;   // (the sidewalk, style/city/style.js PAL.walk)
const dome = (top, hor) => { const sky = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { top: { value: new THREE.Color(top) }, hor: { value: new THREE.Color(hor) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top, hor; varying vec3 vD; void main(){ float h = vD.y; gl_FragColor = vec4(h > 0. ? mix(hor, top, pow(clamp(h,0.,1.), .5)) : hor, 1.);\n#include <colorspace_fragment>\n}' });
  const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), sky)); return new THREE.PMREMGenerator(R).fromScene(es, 0.02).texture; };
const DAY_ENV = scene.environment; let NIGHT_ENV = null;
const lamp = new THREE.PointLight(0xffd79a, 22, 15, 1.4);
function light(night) {
  if (night) { NIGHT_ENV ??= dome(0x0b1240, 0x3b2a7a); sun.color.set(0x8fa4ff); sun.intensity = .35; hemi.color.set(0x4050a0); hemi.groundColor.set(0x201830); hemi.intensity = .5; scene.environment = NIGHT_ENV; scene.environmentIntensity = .25; scene.add(lamp); }
  else { sun.color.set(0xfff2dc); sun.intensity = 3.0; hemi.color.set(0xd6ecff); hemi.groundColor.set(0xe0cfb0); hemi.intensity = 1.05; scene.environment = DAY_ENV; scene.environmentIntensity = .55; scene.remove(lamp); }
}
function shadows(on) { R.shadowMap.enabled = true; sun.castShadow = on; if (on) { const c = sun.shadow.camera; Object.assign(c, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 50 }); c.updateProjectionMatrix(); sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .01; } }
export function propObject(name) { const g = new THREE.Group(); packFull(propBank(name), [0, 0, 0]).forEach((t, li) => { if (t) g.add(meshOf(t, PMAT[li])); }); return g; }
const ground = () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: WALK, roughness: .92 })); m.receiveShadow = true; return m; };
const freeAll = G => G.traverse(n => { if (n.geometry) n.geometry.dispose(); });
// the owner with the prop, centred on the pair: pushing it (both arms in the prop's hold: holdArm's Rx(−pitch), the 'both' hold has no
// roll, yaw or twist; the cart at push.stand) or with it standing at their side (park). heading: the pair's turn about y (0: +z)
export function withProp(name, { mode = 'push', heading = 0, gait = 0, alone = false } = {}) {
  const P = N.propOf(name), G = new THREE.Group(), cart = propObject(P.key), at = mode === 'push' ? [0, 0, -P.push.stand[2]] : P.park;
  cart.position.set(...at); G.add(cart);
  if (!alone) { const man = figure({ named: name }), r = man.userData.rig; if (gait) CH.pose(man, gait, 1); if (mode === 'push') r.armL.rotation.x = r.armR.rotation.x = -HOLD[P.handle.hold].pose[0]; G.add(man); }
  const mid = new THREE.Vector3(at[0] / 2, 0, at[2] / 2).applyAxisAngle(new THREE.Vector3(0, 1, 0), heading);
  G.rotation.y = heading; G.position.set(-mid.x, 0, -mid.z); const W = new THREE.Group(); W.add(G); W.updateMatrixWorld(true); return W;
}
// the game's camera (64° down) at a given scale, true size: ss 1 is the strict test (one sample a pixel, the canvas's own MSAA)
export function propGame(name, { mode = 'push', heading = 0, gait = 0, night = false, w = 160, h = 120, ppm = PPM_GAME, ss = 1 } = {}) {
  const W = withProp(name, { mode, heading, gait }); W.add(ground()); if (night) lamp.position.set(4.6, 5.6, -3.2);
  light(night); shadows(true); try { return fixed(W, w, h, GAME_EL, ppm, w / 2, h * .6, ss); } finally { shadows(false); light(false); freeAll(W); }
}
// close up: the prop alone on the pavement, a perspective lens el° down from azimuth az (0: in front, its nose toward the viewer)
export function propClose(name, az, { px = 400, el = 24 } = {}) {
  const W = withProp(name, { alone: true }), P = points(W), box = new THREE.Box3(); for (let i = 0; i < P.length; i += 3) box.expandByPoint(V.set(P[i], P[i + 1], P[i + 2]));
  const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2, a = az * Math.PI / 180, e = el * Math.PI / 180, n = px * 4;
  W.add(ground()); persp.aspect = 4 / 3; persp.clearViewOffset(); persp.position.copy(c).add(new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(r / Math.sin(THREE.MathUtils.degToRad(persp.fov / 2)) * 1.02));
  persp.near = r * .05; persp.far = r * 40; persp.lookAt(c); persp.updateProjectionMatrix(); persp.updateMatrixWorld();
  light(false); shadows(true); try { return shrink(shot(persp, n, n * 3 / 4, W, c), px, px * 3 / 4); } finally { shadows(false); freeAll(W); }
}
// side on (8° down, 125 px a metre as the whole figure): the owner pushing it, or with it parked
export function propSide(name, { mode = 'push', w = 420, h = 300 } = {}) {
  const W = withProp(name, { mode, heading: AZ + Math.PI / 2 }); W.add(ground()); light(false); shadows(true);
  try { return fixed(W, w, h, 8 * Math.PI / 180, PPM_WHOLE, w / 2, h - 30, 4); } finally { shadows(false); freeAll(W); }
}
// every picture the review asks for, and the contact sheet. ppm70: the scale at which the owner stands 70 px tall at the game's camera
function propPictures(name, { ppm } = {}) {
  const P = N.propOf(name), g46 = game(figure({ named: name })), h46 = heightPx(g46), ppm70 = ppm ?? +(PPM_GAME * 70 / h46).toFixed(2);
  const H = [['toward', 0], ['across', Math.PI / 2], ['away', Math.PI], ['back across', -Math.PI / 2]];
  const shots = night => [...H.map(([t, hd]) => [`pushing, ${t}`, propGame(name, { heading: hd, night, ppm: ppm70 })]), ['walking', propGame(name, { heading: Math.PI / 4, gait: Math.PI / 2, night, ppm: ppm70 })],
    ['parked beside him', propGame(name, { mode: 'park', heading: Math.PI / 6, night, ppm: ppm70 })]];
  const day = shots(false), night = shots(true), sides = [['front', 0], ['right side', 90], ['back', 180], ['left side', 270]].map(([t, a]) => [t, propClose(P.key, a + 25)]);
  const pushSide = propSide(name), parkSide = propSide(name, { mode: 'park' });
  // the sheet: each game-size shot at true size and three times up (nearest neighbour), then the close-ups, then side on
  const K = 2, tw = 160 * K, th = 120 * K, pad = 10, cols = 6, Wd = pad + cols * (tw + pad), lab = 18;
  const rowH = th + lab + pad, Hs = 34 + 2 * rowH + 16 + (300 + lab + pad) + (300 + lab + pad);
  const S = canvasOf(Wd, Hs), g = S.getContext('2d'); g.fillStyle = BONE; g.fillRect(0, 0, Wd, Hs); g.fillStyle = '#17171b'; g.font = '600 15px system-ui, sans-serif';
  g.fillText(`${P.name} · the man with the shopping cart (scale ${P.scale}) · the game's camera, 64° down, ${ppm70} px a metre: he stands 70 px tall · true size in each corner, ×${K} beside it`, pad, 22);
  g.font = '12px system-ui, sans-serif'; let y = 34;
  for (const [row, set] of [['day', day], ['night', night]]) { set.forEach(([t, c], i) => { const x = pad + i * (tw + pad); g.imageSmoothingEnabled = false; g.drawImage(c, x, y + lab, tw, th); g.imageSmoothingEnabled = true;
      g.fillStyle = '#ffffff'; g.fillRect(x + tw - c.width - 4, y + lab + 2, c.width + 2, c.height + 2); g.drawImage(c, x + tw - c.width - 3, y + lab + 3); g.fillStyle = '#17171b'; g.fillText(`${row} · ${t}`, x, y + 13); }); y += rowH; }
  y += 16; sides.forEach(([t, c], i) => { const x = pad + i * (400 + pad); g.drawImage(c, x, y + lab); g.fillText(`close up · ${t}`, x, y + 13); }); y += 300 + lab + pad;
  [['side on · pushing (the handle in both fists)', pushSide], ['side on · parked beside him', parkSide]].forEach(([t, c], i) => { const x = pad + i * (420 + pad); g.drawImage(c, x, y + lab); g.fillText(t, x, y + 13); });
  const strip = (set, k = 1) => { const c = canvasOf(set.length * (160 * k + 4) + 4, 120 * k + 8), q = c.getContext('2d'); q.fillStyle = BONE; q.fillRect(0, 0, c.width, c.height); q.imageSmoothingEnabled = false; set.forEach(([, p], i) => q.drawImage(p, 4 + i * (160 * k + 4), 4, 160 * k, 120 * k)); return c; };
  const four = (() => { const c = canvasOf(2 * 400 + 12, 2 * 300 + 12), q = c.getContext('2d'); q.fillStyle = BONE; q.fillRect(0, 0, c.width, c.height); sides.forEach(([, p], i) => q.drawImage(p, 4 + (i % 2) * 404, 4 + (i >> 1) * 304)); return c; })();
  const jpg = (c, q = .86) => c.toDataURL('image/jpeg', q);
  return { ppm70, h46, files: { [`${P.key}-prop-sheet.jpg`]: jpg(S, .8), [`${P.key}-prop-game-day.jpg`]: jpg(strip(day, 3), .82), [`${P.key}-prop-game-night.jpg`]: jpg(strip(night, 3), .82),
    [`${P.key}-prop-game-true.jpg`]: jpg(strip([...day, ...night], 1), .95), [`${P.key}-prop-close.jpg`]: jpg(four, .82), [`${P.key}-prop-side.jpg`]: jpg(onBg(pushSide, BONE)) } };
}

window.__named = { N, CH, THREE, pictures, figure, close, whole, game, heightPx, lookFor, propPictures, propGame, propClose, propSide, withProp, people: N.PEOPLE.map(p => p.key), props: N.PROPS.map(p => p.key), problems: N.PROBLEMS, selfCheck: N.selfCheck() };
document.title = 'named-ready';

// opened by hand (no ?quiet): every named person at the game's size, three times up, with their whole figure
if (!/quiet/.test(location.search)) { const out = document.getElementById('out');
  for (const p of N.PEOPLE) { const r = pictures({ named: p.key }, ['whole', 'game']), d = document.createElement('div');
    d.innerHTML = `<div>${p.name} · ${p.scale}</div><img src="${r.whole}"><img src="${r.game}" width="228" height="300" style="background:${PAVE}">`; out.append(d); } }
