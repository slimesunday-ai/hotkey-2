// AI CITY world v2 — the viewer: chunk streaming + meshing, day/night, agents, live mode, city map, HUD.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { build as buildChar, pose, LOOKS, rollLook } from './chars.js';
import { buildTileArray, BLOCKS, CUT, PANE, B, PROP_LAYER, PROP_GLOW, mulberry32, LEGACY_MAT } from './tiles.js';
import { propData, signMaterial, SIGN_MATS } from './props.js';
import { c as pc, ci, PAL, PAL_NAME, PALETTES } from './palettes.js';
import { P, G, WATER, CH, RG, DIST, hash3, sstep, kindAt, distOf, urban, column, interior, blockAt, ovMap, OVSTAT, inHollow, chunkProps, chunkSigns, chunkLamps,
  LOTS, LOT_BY_ID, TRAILER, addressAt, clearArea, compoundInterior, COMPOUNDS, HWY } from './city.js';
import { genRegion, ensureAround, buildLot, flushCars, scar, rebuildLot, CLAIMED, SITES, PLAZA, QUEUES } from './build.js';
import { NAMES } from './names.js';
import { findPath, snap, standY, walkDirty } from './walk.js';

const Q = new URLSearchParams(location.search);
const FREEZE = Q.has('t') ? parseFloat(Q.get('t')) : null;
const SMALL = Math.min(innerWidth, innerHeight) < 700, LIVE = Q.has('live') || Q.has('replay');
const errEl = document.getElementById('err');

// ───────────────────────── renderer, scene, block material (texture array + night glow from the tile alpha mask)
const canvas = document.getElementById('world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: Q.has('shot') });
renderer.toneMapping = THREE.NeutralToneMapping; renderer.shadowMap.enabled = !SMALL; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xcfdbe6, 110, SMALL ? 180 : 330);
const camera = new THREE.PerspectiveCamera(50, 1, .1, 4000);
const hemi = new THREE.HemisphereLight('#dbe7f6', '#6b7a5a', 1.2); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1dc', 2.3); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -130, right: 130, top: 130, bottom: -130, near: 1, far: 600 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = .06; scene.add(sun, sun.target);
const tileArray = buildTileArray(), U = { night: { value: 0 } };
const blockMat = new THREE.MeshLambertMaterial({ vertexColors: true });
blockMat.onBeforeCompile = sh => {
  sh.uniforms.tiles = { value: tileArray }; sh.uniforms.uNight = U.night;
  sh.vertexShader = 'attribute vec3 uvl;\nvarying vec3 vUvl;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vUvl = uvl;');
  sh.fragmentShader = 'uniform highp sampler2DArray tiles;\nuniform float uNight;\nvarying vec3 vUvl;\n' + sh.fragmentShader
    .replace('#include <map_fragment>', 'vec4 tx = texture(tiles, vUvl);\n  if (tx.a < .5) discard;\n  diffuseColor.rgb *= tx.rgb;')
    .replace('#include <emissivemap_fragment>', 'if (tx.a < .9) { vec3 ge = tx.a < .665 ? tx.rgb * vColor.rgb * 2.2 : tx.a < .745 ? vec3(.78, .87, 1.) * .7 : vec3(1., .72, .38) * 1.35; totalEmissiveRadiance += ge * uNight; }');
};
const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
depthMat.onBeforeCompile = sh => { sh.uniforms.tiles = { value: tileArray };
  sh.vertexShader = 'attribute vec3 uvl;\nvarying vec3 vUvl;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vUvl = uvl;');
  sh.fragmentShader = 'uniform highp sampler2DArray tiles;\nvarying vec3 vUvl;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n  if (texture(tiles, vUvl).a < .5) discard;'); };

// flora: crossed-quad sprites (tufts, tall grass, two flowers)
const floraTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 32; const g = c.getContext('2d'), r = mulberry32(9), GR = ['#6fae4f', '#7cbb5b', '#5f9c44', '#86c565'].map(pc);
  for (let s = 0; s < 2; s++) for (let i = 0; i < (s ? 22 : 12); i++) { const x = s * 32 + 3 + (r() * 26 | 0), hh = (s ? 12 : 6) + (r() * (s ? 16 : 8) | 0); for (let y = 0; y < hh; y++) { g.fillStyle = GR[r() * 4 | 0]; g.fillRect(x + (y > hh * .6 && r() < .4 ? (r() < .5 ? -1 : 1) : 0), 31 - y, 2, 1); } }
  for (const [s, pet, mid] of [[2, pc('#ffd23f'), '#8a5a00'], [3, pc('#f7f2f5'), '#f2b400']]) { g.fillStyle = pc('#4f8f3b'); g.fillRect(s * 32 + 15, 14, 2, 18); g.fillRect(s * 32 + 11, 22, 4, 2); g.fillStyle = pet; g.fillRect(s * 32 + 11, 6, 10, 8); g.fillRect(s * 32 + 13, 4, 6, 12); g.fillStyle = mid; g.fillRect(s * 32 + 14, 8, 4, 4); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t; })();
const floraMat = new THREE.MeshLambertMaterial({ map: floraTex, alphaTest: .5, side: THREE.DoubleSide });
// light pools under street lamps (additive, fade in at night)
const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.45, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, fog: false, toneMapped: false });

// ───────────────────────── chunk mesher: exposed faces + per-vertex AO, panes, merged voxel props, sign planes, lamp pools
const DIRS = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], f: 's' }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], f: 's' },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], f: 't' }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], f: 'b' },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], f: 's' }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], f: 's' },
];
const UVS = [[0, 0], [1, 0], [1, 1], [0, 1]], AO = [.5, .68, .85, 1], AOQ = [0, 0, 0, 0];
for (const d of DIRS) d.ao = d.c.map(c => { const [nx, ny, nz] = d.n, t = [nx ? 0 : (c[0] ? 1 : -1), ny ? 0 : (c[1] ? 1 : -1), nz ? 0 : (c[2] ? 1 : -1)], e = [];   // AO sample offsets per corner
  if (t[0]) e.push([t[0], 0, 0]); if (t[1]) e.push([0, t[1], 0]); if (t[2]) e.push([0, 0, t[2]]); return [...e[0], ...e[1], ...t]; });
const opq = (x, y, z) => { if (y < 0) return true; const id = blockAt(x, y, z); return id !== 0 && !CUT[id]; };
function meshChunk(cx, cz) {
  const M0 = 40; for (let rx = Math.floor((cx * CH - M0) / RG); rx <= Math.floor((cx * CH + CH + M0) / RG); rx++) for (let rz = Math.floor((cz * CH - M0) / RG); rz <= Math.floor((cz * CH + CH + M0) / RG); rz++) genRegion(rx, rz);
  ensureAround(cx * CH + 8, cz * CH + 8);
  const P3 = [], N3 = [], U3 = [], C3 = [], I = []; let v = 0;
  const face = (x, y, z, d, id) => {
    const ax = x + d.n[0], ay = y + d.n[1], az = z + d.n[2], A = d.ao;
    for (let q = 0; q < 4; q++) { const o = A[q], s1 = opq(ax + o[0], ay + o[1], az + o[2]), s2 = opq(ax + o[3], ay + o[4], az + o[5]), cr = opq(ax + o[6], ay + o[7], az + o[8]);
      AOQ[q] = s1 && s2 ? 0 : 3 - (s1 + s2 + cr); }
    const layer = BLOCKS[id][d.f];
    for (let q = 0; q < 4; q++) { const c = d.c[q]; P3.push(x + c[0], y + c[1], z + c[2]); N3.push(d.n[0], d.n[1], d.n[2]); U3.push(UVS[q][0], UVS[q][1], layer); const a = AO[AOQ[q]]; C3.push(a, a, a); }
    if (AOQ[0] + AOQ[2] < AOQ[1] + AOQ[3]) I.push(v + 1, v + 2, v + 3, v + 1, v + 3, v); else I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; };
  const pane = (x, y, z, id) => { const layer = BLOCKS[id].s, alongX = PANE[id] === 1;
    for (const s of [1, -1]) { const q = alongX ? [[x, y, z + .5], [x + 1, y, z + .5], [x + 1, y + 1, z + .5], [x, y + 1, z + .5]] : [[x + .5, y, z + 1], [x + .5, y, z], [x + .5, y + 1, z], [x + .5, y + 1, z + 1]];
      const order = s > 0 ? [0, 1, 2, 3] : [1, 0, 3, 2], n = alongX ? [0, 0, s] : [s, 0, 0];
      for (let k = 0; k < 4; k++) { const p = q[order[k]]; P3.push(...p); N3.push(...n); U3.push(UVS[k][0], UVS[k][1], layer); C3.push(1, 1, 1); } I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; } };
  const emit = (x, y, z, id) => { if (PANE[id]) return pane(x, y, z, id);
    for (const d of DIRS) { const X = x + d.n[0], Y = y + d.n[1], Z = z + d.n[2]; if (Y < 0) continue; const nb = blockAt(X, Y, Z); if (nb && (!CUT[nb] || nb === id)) continue; if (!nb && inHollow(X, Y, Z)) continue; face(x, y, z, d, id); } };
  const LO = new Int16Array(256), HI = new Int16Array(256);
  for (let x = cx * CH; x < cx * CH + CH; x++) for (let z = cz * CH; z < cz * CH + CH; z++) {
    const c = column(x, z), h = c.h; let lo = h - 1; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) lo = Math.min(lo, column(x + dx, z + dz).h);
    if (CUT[blockAt(x, h - 1, z)]) lo = Math.min(lo, h - 2); if (c.bridge) lo = Math.min(lo, c.th - 1);   // under a bridge deck: piers and the seabed   // a see-through top (rail, fence) exposes the block under it
    lo = Math.max(0, Math.min(lo, h - 1)); const li = ((x & 15) << 4) | (z & 15); LO[li] = lo; HI[li] = h;
    for (let y = lo; y < h; y++) { const id = blockAt(x, y, z); if (id) emit(x, y, z, id); } }
  const ov = ovMap(cx, cz);
  if (ov) for (const [k, id] of ov) { if (!id) continue; const y = k & 511, li = k >> 9; if (y >= LO[li] && y < HI[li]) continue; emit(cx * CH + (li >> 4), y, cz * CH + (li & 15), id); }
  // props → same arrays (white tile × vertex colour; lit voxels use the glow tile)
  const pl = chunkProps.get(cx + ',' + cz);
  if (pl) for (const p of pl) { const d = propData(p.type);
    const cs = [1, 0, -1, 0][p.rot], sn = [0, 1, 0, -1][p.rot];   // rot k turns +z toward [+z, +x, −z, −x]
    for (let i = 0; i < d.n; i++) { const x = d.P[i * 3], z = d.P[i * 3 + 2], nx = d.N[i * 3], nz = d.N[i * 3 + 2];
      P3.push(p.x + x * cs + z * sn, p.y + d.P[i * 3 + 1], p.z - x * sn + z * cs); N3.push(nx * cs + nz * sn, d.N[i * 3 + 1], -nx * sn + nz * cs); U3.push(.5, .5, d.G[i] ? PROP_GLOW : PROP_LAYER); C3.push(d.C[i * 3], d.C[i * 3 + 1], d.C[i * 3 + 2]); }
    for (const k of d.I) I.push(k + v); v += d.n; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P3, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N3, 3));
  g.setAttribute('uvl', new THREE.Float32BufferAttribute(U3, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C3, 3)); g.setIndex(I); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, blockMat); m.castShadow = m.receiveShadow = true; m.matrixAutoUpdate = false; m.customDepthMaterial = depthMat;
  const fl = floraChunk(cx, cz); if (fl) m.add(fl);
  const sl = chunkSigns.get(cx + ',' + cz); if (sl) for (const s of sl) { const sm = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), signMaterial(s.text, s.style, s.w, s.h, s.fg, s.bg));
    sm.position.set(s.x, s.y, s.z); if (s.n === 4) sm.rotation.x = -Math.PI / 2; else sm.rotation.y = [0, Math.PI / 2, Math.PI, -Math.PI / 2][s.n]; sm.receiveShadow = true; sm.updateMatrix(); sm.matrixAutoUpdate = false; m.add(sm); }
  const ll = chunkLamps.get(cx + ',' + cz); if (ll && ll.length) { const pp = [], uu = [], cc = [], ii = []; let k = 0, col = new THREE.Color();
    for (const L of ll) { col.setHex(ci(L.col)); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pp.push(L.x + a * L.r, L.y + .04, L.z + b * L.r); uu.push((a + 1) / 2, (b + 1) / 2); cc.push(col.r, col.g, col.b); } ii.push(k, k + 2, k + 1, k, k + 3, k + 2); k += 4; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute(uu, 2)); pg.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3)); pg.setIndex(ii);
    const pm = new THREE.Mesh(pg, poolMat); pm.renderOrder = 2; pm.matrixAutoUpdate = false; m.add(pm); }
  return m;
}
function floraChunk(cx, cz) {
  const P3 = [], Uv = [], N = [], I = []; let v = 0;
  for (let x = cx * CH; x < cx * CH + CH; x++) for (let z = cz * CH; z < cz * CH + CH; z++) {
    const c = column(x, z); if (c.kind === 'road' || c.h <= WATER + 1) continue; const d = c.dist, lawn = d === 'suburbs' || d === 'hospital' || d === 'jail';
    if (!(lawn || c.kind === '.' || c.kind === '~')) continue; if (blockAt(x, c.h, z) || blockAt(x, c.h - 1, z) !== B.GRASS) continue;
    const u = hash3(x, 77, z), dens = lawn ? .05 : .22; if (u > dens) continue;
    const s = lawn ? (u < dens * .25 ? 3 : u < dens * .5 ? 2 : 0) : (u < dens * .06 ? 2 : u < dens * .1 ? 3 : u < dens * .55 ? 1 : 0), sc = s === 1 ? 1.25 : .9, j = hash3(x, 5, z) - .5, px = x + .5 + j * .5, pz = z + .5 - j * .4, y = c.h, e = sc * .5 * Math.SQRT1_2;
    for (const [a, b] of [[[-e, -e], [e, e]], [[e, -e], [-e, e]]]) { P3.push(px + a[0], y, pz + a[1], px + b[0], y, pz + b[1], px + b[0], y + sc, pz + b[1], px + a[0], y + sc, pz + a[1]);
      Uv.push(s / 4, 0, (s + 1) / 4, 0, (s + 1) / 4, 1, s / 4, 1); N.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0); I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; } }
  if (!v) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P3, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(Uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setIndex(I);
  const m = new THREE.Mesh(g, floraMat); m.receiveShadow = true; m.matrixAutoUpdate = false; return m;
}
function disposeChunk(m) { scene.remove(m); m.geometry.dispose(); for (const c of m.children) c.geometry.dispose(); }

// ───────────────────────── sky + day/night
const sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { t: { value: 0 }, zen: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, night: { value: 0 }, dusk: { value: 0 } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }`,
  fragmentShader: `uniform float t, night, dusk; uniform vec3 zen, hor, sunDir; varying vec3 vDir;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
    float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s; }
    void main(){ vec3 d = normalize(vDir); float y = max(d.y, 0.); vec3 col = mix(hor, zen, pow(y, .55));
      float sd = max(dot(d, sunDir), 0.); col += vec3(1., .55, .25) * pow(sd, 6.) * dusk * .55;
      col += vec3(1., .95, .8) * smoothstep(.9975, .999, sd) * (1. - night);
      float md = max(dot(d, -sunDir), 0.); col += vec3(.85, .9, 1.) * smoothstep(.9985, .9992, md) * night;
      vec2 uv = d.xz / (d.y + .12) * .9 + vec2(t*.003, t*.001); float c = fbm(uv*1.1);
      float cov = smoothstep(.5, .7, c) * smoothstep(.0, .2, d.y); vec3 cc = mix(vec3(.72,.77,.86), vec3(1.), smoothstep(.55,.8,c)); cc = mix(cc, vec3(1., .7, .5), dusk*.6); cc = mix(cc, vec3(.12,.14,.2), night);
      col = mix(col, cc, cov * .9);
      vec2 g = floor(d.xz / (d.y + .05) * 90.); col += vec3(1.) * step(.9965, h(g)) * night * smoothstep(.05, .3, d.y) * (1.-cov);
      gl_FragColor = vec4(pow(col, vec3(2.2)), 1.); }` }));
scene.add(sky);
const waterTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = mulberry32(5); g.fillStyle = pc('#3d8fc4'); g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 40; i++) { g.fillStyle = r() < .6 ? pc('#5aa8d8') : pc('#2f7db3'); g.fillRect(r() * 60 | 0, r() * 64 | 0, 3 + (r() * 6 | 0), 1); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4000 / 16, 4000 / 16); return t; })();
const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ map: waterTex, transparent: true, opacity: .92 })); water.rotation.x = -Math.PI / 2; water.position.y = WATER - .2; water.receiveShadow = true; scene.add(water);
const KEY = [   // [time of day, zenith, horizon, sun colour, sun intensity, hemi intensity]
  [0.00, '#03050d', '#0d1424', '#8fa6d8', .35, .38], [0.22, '#0a1022', '#2a2f4a', '#ffb07a', .25, .42], [0.27, '#4a6aa0', '#f0a878', '#ffc48f', 1.2, .8],
  [0.34, '#5a8cc8', '#cfdbe6', '#fff0d8', 2.2, 1.15], [0.50, '#4f86c9', '#d2dfea', '#fff4e4', 2.4, 1.25], [0.66, '#5a8cc8', '#d9dde0', '#ffe9cc', 2.2, 1.15],
  [0.73, '#46598e', '#f39a62', '#ff9a5a', 1.3, .8], [0.78, '#141a33', '#3d3350', '#ff8a5a', .3, .45], [0.85, '#04060f', '#0f1628', '#8fa6d8', .35, .38], [1.00, '#03050d', '#0d1424', '#8fa6d8', .35, .38]];
const cA = new THREE.Color(), cB = new THREE.Color();
const SKY = PAL?.key || KEY;
function lerpKey(t, idx, out) { let a = SKY[0], b = SKY[1]; for (let i = 0; i < SKY.length - 1; i++) if (t >= SKY[i][0] && t <= SKY[i + 1][0]) { a = SKY[i]; b = SKY[i + 1]; break; } const f = (t - a[0]) / (b[0] - a[0] || 1);
  if (typeof a[idx] === 'string') return out.copy(cA.set(a[idx])).lerp(cB.set(b[idx]), f); return a[idx] + (b[idx] - a[idx]) * f; }
let tod = Q.has('tod') ? parseFloat(Q.get('tod')) : .42, cycle = !Q.has('tod'); const DAY_SECONDS = 360;
function applyTime(tx, tz) {
  const el = Math.sin((tod - .25) * Math.PI * 2), az = tod * Math.PI * 2, sd = new THREE.Vector3(Math.cos(az) * .75, el, Math.sin(az) * .55 + .35).normalize();
  const night = 1 - sstep(-.16, .06, el), dusk = Math.max(0, 1 - Math.abs(el) / .28) * (1 - night * .6);
  const Us = sky.material.uniforms; lerpKey(tod, 1, Us.zen.value); lerpKey(tod, 2, Us.hor.value); Us.sunDir.value.copy(sd); Us.night.value = night; Us.dusk.value = dusk;
  scene.fog.color.copy(Us.hor.value); lerpKey(tod, 3, sun.color); sun.intensity = lerpKey(tod, 4); hemi.intensity = lerpKey(tod, 5);
  hemi.color.copy(Us.hor.value).lerp(cA.set('#ffffff'), .55); hemi.groundColor.set(night > .5 ? (PAL?.hemiGroundNight || '#1a1f2e') : (PAL?.hemiGround || '#6b7a5a'));
  const L = el > -.05 ? sd : sd.clone().negate(); sun.position.set(tx + L.x * 300, Math.max(40, L.y * 300), tz + L.z * 300); sun.target.position.set(tx, 0, tz);
  U.night.value = sstep(.05, .75, night + dusk * .25); poolMat.opacity = U.night.value * .55;
  for (const m of SIGN_MATS.neon) m.emissiveIntensity = .35 + U.night.value * 1.6; for (const m of SIGN_MATS.lit) m.emissiveIntensity = U.night.value * .85;
  return night;
}

// ───────────────────────── chunk streaming
const chunks = new Map(); let RAD = Q.has('rad') ? +Q.get('rad') : SMALL ? 7 : 13;
function updateChunks(tx, tz, budgetMs) {
  const ccx = Math.floor(tx / CH), ccz = Math.floor(tz / CH), want = [];
  for (let dx = -RAD; dx <= RAD; dx++) for (let dz = -RAD; dz <= RAD; dz++) { if (dx * dx + dz * dz > RAD * RAD) continue; const k = (ccx + dx) + ',' + (ccz + dz); if (!chunks.has(k)) want.push([dx * dx + dz * dz, ccx + dx, ccz + dz, k]); }
  want.sort((a, b) => a[0] - b[0]); const t0 = performance.now();
  for (const [, cx, cz, k] of want) { if (performance.now() - t0 > budgetMs) break; const m = meshChunk(cx, cz); scene.add(m); chunks.set(k, m); }
  for (const [k, m] of chunks) { const [cx, cz] = k.split(',').map(Number); if ((cx - ccx) ** 2 + (cz - ccz) ** 2 > (RAD + 3) ** 2) { disposeChunk(m); chunks.delete(k); } }
  return want.length;
}
function remeshArea(x0, z0, x1, z1) { walkDirty(); for (let cx = Math.floor(x0 / CH); cx <= Math.floor(x1 / CH); cx++) for (let cz = Math.floor(z0 / CH); cz <= Math.floor(z1 / CH); cz++) {
  const k = cx + ',' + cz, m = chunks.get(k); if (!m) continue; disposeChunk(m); const nm = meshChunk(cx, cz); scene.add(nm); chunks.set(k, nm); } }

// ───────────────────────── views (districts) + the statue
const VIEWS = {
  downtown: { tg: [-6, G, 40], off: [70, 64, 120], d: 'downtown' }, plaza: { tg: [16, G, -20], off: [30, 26, 44], d: 'downtown' },
  suburbs: { tg: [20, G, 180], off: [40, 30, 52], d: 'suburbs' }, trailer: { tg: [-196, G, -44], off: [34, 26, 46], d: 'trailer' },
  industrial: { tg: [120, G, -196], off: [46, 36, 58], d: 'industrial' }, junkyard: { tg: [-30, G, -188], off: [36, 30, 46], d: 'junkyard' },
  docks: { tg: [60, G, -244], off: [-46, 34, 52], d: 'docks' }, jail: { tg: [256, G, -336], off: [-70, 46, 92], d: 'jail' }, mall: { tg: [-208, G, 44], off: [44, 36, 62], d: 'mall' }, bridge: { tg: [224, G, 470], off: [52, 26, 52], d: 'bridge' },
  hospital: { tg: [160, G, -22], off: [18, 48, 72], d: 'hospital' }, forest: { tg: [-420, 20, -150], off: [36, 24, 46], d: 'forest' },
  highway: { tg: [224, G, 170], off: [34, 18, 38], d: 'highway' }, motel: { tg: [242, G, 176], off: [-26, 16, -30], d: 'highway' }, fit: { tg: [-84, G, 5], off: [13, 7, -6], d: 'downtown' },
};
let statue = null;
function placeStatue() { if (statue || !PLAZA.statue) return; const L = { ...(LOOKS[3] || LOOKS[0]) }; statue = buildChar(L); const mat = new THREE.MeshStandardMaterial({ color: '#7f9a88', roughness: .55, metalness: .35 });
  statue.traverse(o => { if (o.isMesh) { o.material = mat; o.castShadow = true; } }); statue.scale.multiplyScalar(4); const [x, y, z] = PLAZA.statue; statue.position.set(x, y, z + .5); scene.add(statue); }

// ───────────────────────── agents: fit-check characters walking the sidewalks
const agents = [];
function blockLoop(i, j) { const R = interior(i, j); return [[R.x0 - 1, R.z0 - 1], [R.x1, R.z0 - 1], [R.x1, R.z1], [R.x0 - 1, R.z1]]; }
function spawnAgents() {
  const looks = LOOKS.slice(); for (let i = 0; i < 18; i++) looks.push(rollLook(0x1000 + i * 977));
  const SPOTS = [[0, 1, 'walk'], [-1, 0, 'walk'], [1, -2, 'walk'], [-2, 2, 'walk'], [0, 4, 'walk'], [2, 5, 'walk'], [-3, 6, 'walk'], [1, 7, 'walk'], [-1, 3, 'walk'], [3, 0, 'walk'],
    [4, -3, 'walk'], [-4, -2, 'walk'], [5, 4, 'walk'], [-5, 5, 'walk'], [2, -6, 'walk'], [0, -5, 'walk']];
  looks.forEach((L, i) => { const o = buildChar(L); scene.add(o); let a;
    if (i < SPOTS.length) { const [bi, bj] = SPOTS[i], loop = blockLoop(bi, bj), k = i % 4, [x, z] = loop[k]; a = { mode: 'loop', bi, bj, k, x: x + .5, z: z + .5 }; }
    else { const zones = [['trailer', TRAILER.R], ['junk', compoundInterior(COMPOUNDS[2])], ['yard', (() => { const R = compoundInterior(COMPOUNDS[3]); return { x0: R.x0 + 10, x1: R.x1 - 10, z0: R.z0 + 30, z1: R.z1 - 30 }; })()]], [zn, R] = zones[i % 3];
      a = { mode: 'rect', R, x: (R.x0 + R.x1) / 2 + (i % 5) * 3 - 6, z: (R.z0 + R.z1) / 2 + (i % 3) * 3 - 3 }; }
    Object.assign(a, { o, L, tx: a.x, tz: a.z, pause: 0, ph: i * 1.7, spd: 1.4 + (i % 3) * .3, fresh: true }); agents.push(a); });   // placed and routed once the camera is near
}
let queued = false;
function spawnQueue() { if (queued || !QUEUES.length) return; queued = true;
  QUEUES.forEach((q, i) => { const o = buildChar(rollLook(0x3000 + i * 131)); o.rotation.y = -Math.PI / 2; scene.add(o); agents.push({ o, mode: 'queue', x: q.x, z: q.z, tx: q.x, tz: q.z, pause: 0, ph: i * 2.1, spd: .6, q, face: -Math.PI / 2 }); }); }
// every walk is a routed path (walk.js): waypoints along sidewalks, never through walls, props or water
let routeDeadline = Infinity;   // routing gets a few ms per frame; the rest wait a beat
function route(a, x, z) { if (performance.now() > routeDeadline) { a.path = null; a.tx = a.x; a.tz = a.z; a.pause = .1 + Math.random() * .3; return true; }
  const p = findPath(a.x, a.z, x, z); if (p && p.length > 1) { a.path = p; a.pi = 1; [a.tx, a.tz] = p[1]; return true; } a.path = null; a.tx = a.x; a.tz = a.z; return false; }
function agentTarget(a) {
  if (a.mode === 'queue') { a.tx = a.q.x + (Math.random() - .5) * .3; a.tz = a.q.z + (Math.random() - .5) * .3; a.pause = 2 + Math.random() * 5; return; }
  if (a.mode === 'loop') { for (let tries = 0; tries < 3; tries++) { let bi = a.bi, bj = a.bj;
      if (Math.random() < .15) { const di = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.random() * 4 | 0]; if (urban(kindAt(bi + di[0], bj + di[1]))) { bi += di[0]; bj += di[1]; } }
      const k = (a.k + (Math.random() < .8 ? 1 : 3)) % 4, [x, z] = blockLoop(bi, bj)[k]; if (route(a, x + .5, z + .5)) { a.bi = bi; a.bj = bj; a.k = k; return; } } }
  else if (a.mode === 'rect') { for (let tries = 0; tries < 4; tries++) if (route(a, a.R.x0 + 2 + Math.random() * (a.R.x1 - a.R.x0 - 4), a.R.z0 + 2 + Math.random() * (a.R.z1 - a.R.z0 - 4))) return; }
}

// ───────────────────────── live: agents driven by the sim server (local models)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let liveState = null, lastEventId = 0, follow = null; const liveChars = new Map(), renderedHouse = new Map(), LOTMAP = new Map();
// the v1 sim hands out lots by its own grid; map each onto a real suburban lot near Oak St, in order
function mapLots(st) { const center = [16, 176], pool = LOTS.filter(l => l.kind === 'house').sort((a, b) => Math.hypot(a.x0 - center[0], a.z0 - center[1]) - Math.hypot(b.x0 - center[0], b.z0 - center[1]));
  st.lots.forEach((sl, i) => { const l = LOT_BY_ID.get(sl.id) || pool[i]; if (l) { LOTMAP.set(sl.id, l); if (sl.owner) CLAIMED.add(l.id); } }); }
function liveSpot(sa, i) { if (sa.loc === 'ruins') { const s = SITES.find(x => x.id === sa.site) || SITES[i % Math.max(1, SITES.length)]; if (s) { const a = i * 2.4; return [s.x + Math.cos(a) * 3, s.z + Math.sin(a) * 2]; } }
  const l = LOTMAP.get(sa.lot); if (!l) return [0, 0]; const F = { z: [l.x0 + l.sx / 2, l.z0 + l.sz + 1.5], '-z': [l.x0 + l.sx / 2, l.z0 - 1.5], x: [l.x0 + l.sx + 1.5, l.z0 + l.sz / 2], '-x': [l.x0 - 1.5, l.z0 + l.sz / 2] }[l.face];
  return [F[0] + ((i * 3) % 5) - 2, F[1]]; }
const feedEl = document.getElementById('feed'), boardEl = document.getElementById('board');
function addFeed(e) { const d = document.createElement('div'); d.className = 'ev ' + e.type;
  const body = e.type === 'say' ? `says${e.to && e.to !== 'all' ? ' to @' + esc(e.to) : ''}: &ldquo;${esc(e.text)}&rdquo;` : esc(e.text);
  d.innerHTML = `<span class="tm">${esc(e.t)}</span> ${e.who ? `<b>@${esc(e.who)}</b> ` : ''}${body}${e.think && e.type !== 'invalid' && e.type !== 'wait' ? `<div class="th">thinks: ${esc(e.think)}</div>` : ''}`;
  feedEl.prepend(d); while (feedEl.children.length > 90) feedEl.lastChild.remove(); }
const houseLabel = h => h ? `${h.floors}F ${esc(LEGACY_MAT[h.material] || h.material)}` : '&mdash;';
function renderBoard(st) { boardEl.innerHTML = st.agents.slice().sort((a, b) => b.score - a.score).map(a => `<tr data-h="${esc(a.handle)}" class="${follow === a.handle ? 'on' : ''}"><td>@${esc(a.handle)}</td><td>${houseLabel(a.house)}</td><td>${a.credits}</td><td>${esc(a.ring || '')}</td><td>${esc(a.action)}</td></tr>`).join(''); }
boardEl.addEventListener('click', e => { const tr = e.target.closest('tr'); if (!tr) return; follow = follow === tr.dataset.h ? null : tr.dataset.h; stopTour();
  document.getElementById('whisperRow').hidden = !follow || Q.has('replay'); document.getElementById('whTo').textContent = follow ? '@' + follow : ''; if (liveState) renderBoard(liveState); });
document.getElementById('whSend').onclick = async () => { const inp = document.getElementById('whText'); if (!follow || !inp.value.trim()) return;
  try { await fetch('/whisper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle: follow, text: inp.value.trim() }) }); inp.value = ''; } catch { } };
document.getElementById('whText').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('whSend').click(); });
for (const [id, pane] of [['tabFeed', 'feed'], ['tabAgents', 'agentsPane']]) document.getElementById(id).onclick = () => {
  for (const [i2, p2] of [['tabFeed', 'feed'], ['tabAgents', 'agentsPane']]) { document.getElementById(i2).classList.toggle('on', i2 === id); document.getElementById(p2).hidden = p2 !== pane; } };
function applyLive(st) {
  liveState = st;
  st.agents.forEach((sa, i) => {
    let ch = liveChars.get(sa.handle);
    if (!ch) { const L = sa.look < 100 ? LOOKS[sa.look % LOOKS.length] : rollLook(0x2000 + sa.look), o = buildChar(L); scene.add(o); const [x, z] = liveSpot(sa, i);
      const bub = document.createElement('div'); bub.className = 'bubble'; bub.hidden = true; document.body.appendChild(bub);
      const sp = snap(x, z, 10) || [x, z]; ch = { o, L, x: sp[0], z: sp[1], tx: sp[0], tz: sp[1], ph: i * 1.7, pause: 0, spd: 2.4, mode: 'live', bub, loc: sa.loc, handle: sa.handle }; liveChars.set(sa.handle, ch); agents.push(ch); }
    const [tx, tz] = liveSpot(sa, i); if (sa.loc !== ch.loc) { const sp = snap(tx, tz, 10) || [tx, tz]; ch.x = ch.tx = sp[0]; ch.z = ch.tz = sp[1]; ch.path = null; ch.goal = null; ch.loc = sa.loc; }
    if (!ch.goal || Math.hypot(ch.goal[0] - tx, ch.goal[1] - tz) > 3 || Math.random() < .25) { ch.goal = [tx + (Math.random() - .5) * 3, tz + (Math.random() - .5) * 1.4]; route(ch, ch.goal[0], ch.goal[1]); }
    ch.sa = sa; ch.say = sa.lastSay; if (sa.lastSay) ch.bub.innerHTML = `<b>@${esc(sa.handle)}</b> ${esc(sa.lastSay)}`;
    const l = LOTMAP.get(sa.lot); if (!l) return; const hv = sa.house ? sa.house.v + ':' + sa.house.floors : 'none';
    if (renderedHouse.get(l.id) !== hv) { const first = !renderedHouse.has(l.id); renderedHouse.set(l.id, hv); if (first && !sa.house) return;
      clearArea(l.x0, l.z0, l.x0 + l.sx - 1, l.z0 + l.sz - 1);
      if (sa.house && sa.house.floors > 0) { const f = sa.house.floors; buildLot(l, { kind: 'house', w: 6 + Math.min(3, f), d: 6 + (f > 1 ? 1 : 0), floors: f, material: sa.house.material, roof: sa.house.roof, extra: sa.house.extra, roofCol: ['dark', 'brown', 'red', 'green', 'blue'][hash3(l.x0, 1, l.z0) * 5 | 0] }); }
      else buildLot(l, null, { claimed: true });
      flushCars(); remeshArea(l.x0 - 4, l.z0 - 4, l.x0 + l.sx + 4, l.z0 + l.sz + 4); }
  });
  for (const e of st.events) if (e.id > lastEventId) { lastEventId = e.id; addFeed(e);
    if (e.type === 'bill' && /lost a floor/i.test(e.text || '')) { const sa = st.agents.find(a => a.handle === e.who), l = sa && LOTMAP.get(sa.lot); if (l && scar('boarded', { lot: l })) scarDirty.add(l); } }
  for (const sa of st.agents) { const l = LOTMAP.get(sa.lot); if (l && sa.ring && scar('tag', { lot: l, crew: sa.ring })) scarDirty.add(l); }
  for (const l of scarDirty) { if (l.lastBuild) { rebuildLot(l); remeshArea(l.x0 - 4, l.z0 - 4, l.x0 + l.sx + 4, l.z0 + l.sz + 4); } } scarDirty.clear();
  renderBoard(st);
}
const scarDirty = new Set();

// ───────────────────────── post: optional period colour depth (kept from v1; default clean)
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera)); composer.addPass(new OutputPass());
const PAL16 = ['000000', '800000', '008000', '808000', '000080', '800080', '008080', 'c0c0c0', '808080', 'ff0000', '00ff00', 'ffff00', '0000ff', 'ff00ff', '00ffff', 'ffffff'].map(h => new THREE.Vector3(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4), 16) / 255));
const GR = PAL?.grade || { amt: 0, sat: 1, sh: '#808080', hi: '#808080' };   // split-tone grade per palette (shadows / highlights)
const depthPass = new ShaderPass({ uniforms: { tDiffuse: { value: null }, mode: { value: 0 }, res: { value: new THREE.Vector2(1, 1) }, pal: { value: PAL16 },
  amt: { value: GR.amt }, sat: { value: GR.sat }, shT: { value: new THREE.Color(GR.sh) }, hiT: { value: new THREE.Color(GR.hi) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform int mode; uniform vec2 res; uniform vec3 pal[16]; uniform float amt, sat; uniform vec3 shT, hiT; varying vec2 vUv;
    float bayer(vec2 p){ int x = int(mod(p.x,4.)), y = int(mod(p.y,4.)); int i = x + y*4; float m[16]; m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
      for(int k=0;k<16;k++){ if(k==i) return (m[k]+.5)/16.; } return .5; }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); if (amt > 0.) { float l = dot(c.rgb, vec3(.2126, .7152, .0722)); c.rgb = mix(vec3(l), c.rgb, sat);
        c.rgb += (shT - .5) * (1. - smoothstep(.0, .6, l)) * amt + (hiT - .5) * smoothstep(.45, 1., l) * amt * .6; }
      if(mode==0){ gl_FragColor = c; return; } float b = bayer(floor(vUv*res));
      if(mode==1){ gl_FragColor = vec4(floor(c.rgb*5. + b)/5., 1.); return; } vec3 cc = c.rgb + (b-.5)*.30; float best = 1e9; vec3 o = vec3(0);
      for(int k=0;k<16;k++){ vec3 d = cc - pal[k]; float e = dot(d,d); if(e<best){ best=e; o=pal[k]; } } gl_FragColor = vec4(o,1.); }` });
composer.addPass(depthPass);

// ───────────────────────── camera, travel, tour
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = .08; controls.screenSpacePanning = false; controls.minDistance = 6; controls.maxDistance = 320; controls.maxPolarAngle = Math.PI * .47;
function setView(v) { controls.target.set(...v.tg); camera.position.set(v.tg[0] + v.off[0], v.tg[1] + v.off[1], v.tg[2] + v.off[2]); controls.update(); }
const startView = { ...(VIEWS[Q.get('view')] || VIEWS.downtown) };
if (Q.has('at')) { const [x, z] = Q.get('at').split(',').map(Number); startView.tg = [x, G, z]; } if (Q.has('off')) startView.off = Q.get('off').split(',').map(Number);
setView(startView);
const fadeEl = document.getElementById('fade'), fadeTxt = document.getElementById('fadeTxt'); let traveling = null;
function travel(v, label) { if (traveling) return; fadeTxt.textContent = label || ''; fadeEl.style.opacity = 1; traveling = { t0: performance.now(), v, done: false }; }
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let downAt = null;
canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; stopTour(); });
const keys = new Set(); addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) { keys.add(e.code); stopTour(); } }); addEventListener('keyup', e => keys.delete(e.code));
let tour = null; const tourBtn = document.getElementById('tour'), TOUR = ['downtown', 'plaza', 'fit', 'hospital', 'industrial', 'docks', 'jail', 'junkyard', 'trailer', 'mall', 'forest', 'suburbs', 'highway', 'bridge'];
function stopTour() { if (tour) { tour = null; tourBtn.classList.remove('on'); } }
tourBtn.onclick = () => { if (tour) return stopTour(); tour = { i: -1, next: performance.now() + 300 }; tourBtn.classList.add('on'); };
const gotoSel = document.getElementById('goto'); gotoSel.innerHTML = '<option value="">go to…</option>' + Object.keys(VIEWS).map(k => `<option value="${k}">${k}</option>`).join('');
gotoSel.onchange = () => { const v = VIEWS[gotoSel.value]; if (v) { stopTour(); travel(v, DIST[v.d].name); } gotoSel.value = ''; };
for (const b of document.querySelectorAll('#tod .btn')) b.onclick = () => { for (const o of document.querySelectorAll('#tod .btn')) o.classList.toggle('on', o === b); if (b.dataset.t === 'cycle') cycle = true; else { cycle = false; tod = +b.dataset.t; } };
if (Q.has('tod')) for (const o of document.querySelectorAll('#tod .btn')) o.classList.toggle('on', Math.abs(+o.dataset.t - tod) < .02);
document.getElementById('mapMin').onclick = () => document.getElementById('mapWin').classList.toggle('min');

// ───────────────────────── city map
const mapCv = document.getElementById('map'), mctx = mapCv.getContext('2d'), MAPW = 1280, MAPN = 256, mapBase = document.createElement('canvas'); mapBase.width = mapBase.height = MAPN;
{ const g = mapBase.getContext('2d'), img = g.createImageData(MAPN, MAPN);
  for (let j = 0; j < MAPN; j++) for (let i = 0; i < MAPN; i++) { const x = Math.round((i / MAPN - .5) * MAPW), z = Math.round((j / MAPN - .5) * MAPW), c = column(x, z); let col;
    if (c.h < WATER) col = '#3f86b8'; else if (c.kind === 'road') col = (c.top === B.WALK) ? '#9b978f' : '#3d3e44'; else if (c.kind === '.' || c.kind === '~') { const f = Math.min(1, (c.h - G) / 22); col = c.top === B.SAND ? '#d9c690' : c.top === B.DIRT ? '#8a6a48' : `rgb(${50 + f * 40 | 0},${104 + f * 20 | 0},${58 + f * 30 | 0})`; }
    else col = DIST[c.dist].col;
    const v = parseInt(col.slice(1), 16), o = (j * MAPN + i) * 4; if (col[0] === '#') { img.data[o] = v >> 16; img.data[o + 1] = (v >> 8) & 255; img.data[o + 2] = v & 255; } else { const m = col.match(/\d+/g); img.data[o] = +m[0]; img.data[o + 1] = +m[1]; img.data[o + 2] = +m[2]; } img.data[o + 3] = 255; }
  g.putImageData(img, 0, 0); g.font = '600 9px system-ui, sans-serif'; g.textAlign = 'center';
  const DN = NAMES.district, LBL = [[DN.downtown, 0, 0], [DN.suburbs, 0, 190], [DN.estates, -240, 150], [DN.trailer, -208, -48], [DN.industrial, 150, -178], [DN.junkyard, -64, -205], [DN.docks, 40, -266], [DN.jail, 256, -340], [DN.mall, -208, 40], [DN.bridge, 238, 500], [DN.hospital, 160, -32], [DN.forest, -420, -140], [DN.highway, 238, 330], [DN.sea, -200, -340]];
  for (const [t, x, z] of LBL) { const px = (x / MAPW + .5) * MAPN, pz = (z / MAPW + .5) * MAPN; g.fillStyle = 'rgba(0,0,0,.7)'; g.fillText(t, px + 1, pz + 1); g.fillStyle = '#fff'; g.fillText(t, px, pz); } }
mapCv.addEventListener('click', e => { const r = mapCv.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width - .5) * MAPW, z = ((e.clientY - r.top) / r.height - .5) * MAPW, c = column(Math.round(x), Math.round(z)); stopTour();
  const off = camera.position.clone().sub(controls.target); travel({ tg: [x, Math.max(c.h, WATER), z], off: [off.x, off.y, off.z] }, DIST[c.dist]?.name || ''); });
function drawMap() { mctx.drawImage(mapBase, 0, 0); const px = (controls.target.x / MAPW + .5) * MAPN, pz = (controls.target.z / MAPW + .5) * MAPN, a = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
  mctx.save(); mctx.translate(px, pz); mctx.rotate(-a); mctx.fillStyle = 'rgba(255,255,255,.3)'; mctx.beginPath(); mctx.moveTo(0, 0); mctx.lineTo(-14, -28); mctx.lineTo(14, -28); mctx.fill(); mctx.restore();
  mctx.fillStyle = '#ffd166'; mctx.fillRect(px - 2.5, pz - 2.5, 5, 5); mctx.strokeStyle = '#000'; mctx.strokeRect(px - 3, pz - 3, 6, 6);
  if (liveState) { mctx.fillStyle = '#ff5fa2'; for (const a of liveChars.values()) mctx.fillRect((a.x / MAPW + .5) * MAPN - 1, (a.z / MAPW + .5) * MAPN - 1, 3, 3); } }

// ───────────────────────── sizing, colours, loop
const colorsSel = document.getElementById('colors'); if (Q.has('colors')) colorsSel.value = Q.get('colors');
const palSel = document.getElementById('pal'); palSel.innerHTML = Object.keys(PALETTES).map(k => `<option value="${k}"${k === PAL_NAME ? ' selected' : ''}>${k}</option>`).join('');
palSel.onchange = () => { const u = new URL(location.href); u.searchParams.set('pal', palSel.value); u.searchParams.set('at', `${Math.round(controls.target.x)},${Math.round(controls.target.z)}`); const o = camera.position.clone().sub(controls.target); u.searchParams.set('off', [o.x, o.y, o.z].map(v => v.toFixed(1)).join(',')); location.href = u.toString(); };
function resize() { const w = innerWidth, h = innerHeight, pr = SMALL ? 1 : Math.min(devicePixelRatio, 1.5);
  renderer.setPixelRatio(pr); renderer.setSize(w, h, false); composer.setPixelRatio(pr); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); depthPass.uniforms.res.value.set(Math.round(w * pr), Math.round(h * pr)); }
addEventListener('resize', resize); resize();
colorsSel.onchange = () => depthPass.uniforms.mode.value = +colorsSel.value; colorsSel.onchange();
const stat = document.getElementById('stat'), dname = document.getElementById('dname'), daddr = document.getElementById('daddr');
if (Q.has('nohud')) for (const id of ['where', 'mapWin', 'bar', 'hint']) document.getElementById(id).hidden = true;
setTimeout(() => document.getElementById('hint').style.opacity = 0, 9000);
if (LIVE) { if (!Q.has('nohud')) document.getElementById('tapWin').hidden = false;
  const src = Q.has('replay') ? `/sim/runs/${encodeURIComponent(Q.get('replay'))}/state.json` : '/state';
  try { liveState = await (await fetch(src, { cache: 'no-store' })).json(); mapLots(liveState); }
  catch { errEl.textContent = 'live mode: no sim server here. Start it with: node sim/server.mjs, then open http://127.0.0.1:5250/world/?live=1\n'; } }
if (Q.get('scars') === 'demo' && !LIVE) { const near = LOTS.filter(l => l.kind === 'house').sort((a, b) => Math.hypot(a.x0 - 14, a.z0 - 172) - Math.hypot(b.x0 - 14, b.z0 - 172));
  scar('burned', { lot: near[2] }); scar('boarded', { lot: near[4] }); scar('boarded', { lot: near[7] }); scar('foreclosed', { lot: near[9] });
  [[0, 'NOOB GANG'], [1, '404 BOYZ'], [5, 'DIALUP'], [8, 'NOOB GANG'], [9, '404 BOYZ'], [4, 'DIALUP']].forEach(([k, crew]) => scar('tag', { lot: near[k], crew }));
  scar('scene', { x: 30, z: 150, rot: 0 }); scar('memorial', { x: 27, z: 143, handle: '@missing_texture', rot: 1 }); }
updateChunks(controls.target.x, controls.target.z, FREEZE !== null || Q.has('shot') ? 1e9 : 400);
if (LIVE && liveState) { applyLive(liveState); if (!Q.has('replay')) setInterval(async () => { try { applyLive(await (await fetch('/state', { cache: 'no-store' })).json()); } catch { } }, 1500); } else spawnAgents();
if (Q.has('follow')) follow = Q.get('follow');
const clock = new THREE.Clock(), tmpV = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3(); let lastD = '', frame = 0;
window.__city = { camera, controls, setView, VIEWS, chunks, agents, standY, blockAt, updateChunks, scene, meshChunk, floraChunk, propData, LOTMAP, applyLive, render: () => composer.render(0), renderer,
  tick: n => { for (let i = 0; i < (n || 1); i++) tick(); },
  save: async path => { tick(); const b = await new Promise(r => canvas.toBlob(r, 'image/jpeg', .92)); return (await fetch('/save?path=' + encodeURIComponent(path), { method: 'POST', body: b })).status; },
  saveMap: async path => { const c2 = document.createElement('canvas'); c2.width = c2.height = 1024; const g2 = c2.getContext('2d'); g2.imageSmoothingEnabled = false; g2.drawImage(mapBase, 0, 0, 1024, 1024);
    const b = await new Promise(r => c2.toBlob(r, 'image/png')); return (await fetch('/save?path=' + encodeURIComponent(path), { method: 'POST', body: b })).status; },
  get live() { return liveState; }, get tod() { return tod; }, set tod(v) { tod = v; cycle = false; } };
renderer.setAnimationLoop(() => tick());
function tick() {
  const dt = Math.min(clock.getDelta(), .05), t = FREEZE ?? clock.elapsedTime;
  if (cycle && FREEZE === null) tod = (tod + dt / DAY_SECONDS) % 1;
  if (traveling) { const k = (performance.now() - traveling.t0) / 900; if (k > .45 && !traveling.done) { traveling.done = true; setView(traveling.v); updateChunks(controls.target.x, controls.target.z, 260); }
    if (k > .6) fadeEl.style.opacity = 0; if (k > 1) traveling = null; }
  if (tour && !traveling && performance.now() > tour.next) { tour.i = (tour.i + 1) % TOUR.length; const v = VIEWS[TOUR[tour.i]]; travel(v, DIST[v.d].name); tour.next = performance.now() + 9000; }
  controls.autoRotate = !!(tour && !traveling); controls.autoRotateSpeed = .7;
  if (keys.size) { camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize(); right.crossVectors(fwd, camera.up).normalize(); const sp = dt * (40 + controls.getDistance() * .6); tmpV.set(0, 0, 0);
    if (keys.has('KeyW') || keys.has('ArrowUp')) tmpV.add(fwd); if (keys.has('KeyS') || keys.has('ArrowDown')) tmpV.sub(fwd); if (keys.has('KeyD') || keys.has('ArrowRight')) tmpV.add(right); if (keys.has('KeyA') || keys.has('ArrowLeft')) tmpV.sub(right);
    tmpV.multiplyScalar(sp); controls.target.add(tmpV); camera.position.add(tmpV); }
  const gy = Math.max(column(Math.round(controls.target.x), Math.round(controls.target.z)).h, WATER); const dy = (gy + 1 - controls.target.y) * Math.min(1, dt * 3); controls.target.y += dy; camera.position.y += dy;
  controls.update();
  updateChunks(controls.target.x, controls.target.z, traveling ? 30 : clock.elapsedTime < 6 ? 40 : 14); placeStatue(); spawnQueue();
  const tx = controls.target.x, tz = controls.target.z; applyTime(tx, tz); sky.material.uniforms.t.value = t;
  sky.position.copy(camera.position); water.position.x = Math.round(camera.position.x / 16) * 16; water.position.z = Math.round(camera.position.z / 16) * 16; waterTex.offset.set(water.position.x / 16 + t * .01, -water.position.z / 16 + t * .006);
  routeDeadline = performance.now() + 5;
  for (const a of agents) {
    const far = a.mode !== 'live' && Math.hypot(a.x - tx, a.z - tz) > (RAD - 1) * CH; a.o.visible = !far; if (far) continue;   // off-stream people wait where they are
    if (a.fresh) { a.fresh = false; const sp = snap(a.x, a.z, 12); if (sp) { a.x = a.tx = sp[0]; a.z = a.tz = sp[1]; } if (a.mode !== 'queue') agentTarget(a); }
    const dxa = a.tx - a.x, dza = a.tz - a.z, dist = Math.hypot(dxa, dza);
    let moved = 0;
    if (FREEZE === null) { if (a.pause > 0) a.pause -= dt;
      else if (dist < .3) { if (a.path && a.pi < a.path.length - 1) { a.pi++; [a.tx, a.tz] = a.path[a.pi]; } else { a.path = null; a.pause = .5 + Math.random() * 3; if (a.mode !== 'live') agentTarget(a); } }
      else { const s = Math.min(dist, a.spd * dt); moved = s; a.x += dxa / dist * s; a.z += dza / dist * s;
      if (a.mode !== 'queue') { const want = Math.atan2(dxa, dza); let d = want - a.o.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); a.o.rotation.y += d * Math.min(1, dt * 10); } } }   // turn smoothly toward the heading
    a.gait = (a.gait ?? a.ph) + moved * 6.2; a.walk = (a.walk ?? 0) + ((moved > 0 ? 1 : 0) - (a.walk ?? 0)) * Math.min(1, dt * 8);   // stride phase follows distance; blend in and out of the walk
    const sy = standY(Math.floor(a.x), Math.floor(a.z)); a.gy = a.gy === undefined ? Math.max(sy, WATER) : sy < 0 ? a.gy : a.gy + (sy - a.gy) * Math.min(1, dt * 12);   // ease over curbs and steps
    pose(a.o, a.gait, a.walk); const gyA = a.gy; a.o.position.set(a.x, gyA + Math.abs(Math.cos(a.gait)) * .05 * a.walk, a.z);
    const u = a.o.userData; u.head.rotation.z = Math.sin(t * .9 + a.ph) * .05; const blink = FREEZE === null && ((t + a.ph) % 4.3) < .14; u.open.visible = !blink; u.shut.visible = blink;
    if (a.bub) { tmpV.set(a.x, gyA + 3, a.z); const dcam = tmpV.distanceTo(camera.position); tmpV.project(camera);
      const show = !!a.say && tmpV.z < 1 && dcam < 140 && Math.abs(tmpV.x) < 1.05 && Math.abs(tmpV.y) < 1.05; a.bub.hidden = !show;
      if (show) { a.bub.style.left = ((tmpV.x + 1) / 2 * innerWidth) + 'px'; a.bub.style.top = ((1 - tmpV.y) / 2 * innerHeight) + 'px'; } }
    if (follow && a.handle === follow) { controls.target.x += (a.x - controls.target.x) * Math.min(1, dt * 2); controls.target.z += (a.z - controls.target.z) * Math.min(1, dt * 2); } }
  composer.render(dt);
  if (frame++ % 10 === 0) { const c = column(Math.round(tx), Math.round(tz)), dn = (c.kind === 'road' && Math.abs(tx - HWY * P) < 10) ? 'highway' : (c.kind === 'road' ? distOf(kindAt(c.i, c.j)) : c.dist);
    const nm = (DIST[dn] || DIST.forest).name; if (nm !== lastD) { lastD = nm; dname.textContent = nm; } { const ad = addressAt(Math.round(tx), Math.round(tz)); daddr.textContent = ad && ad !== nm ? ad : `${Math.round(tx)}, ${Math.round(tz)}`; }
    const hh = Math.floor(tod * 24), mm = Math.floor((tod * 24 - hh) * 60), clk = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
    if (LIVE && liveState) { const st = liveState, hs = st.agents.filter(a => a.house).length; stat.textContent = `${Q.has('replay') ? 'REPLAY' : 'LIVE'} ${st.t} / ${st.minutes}:00 · ${st.agents.length} agents · ${hs} houses · ${st.stats.offers} offers · ${st.stats.accepted} trades · ${st.stats.scams} scams${st.running ? '' : ' · ENDED'} · ${clk}`; }
    else stat.textContent = `${clk} · ${chunks.size} chunks · ${agents.length} people · ${OVSTAT.n.toLocaleString('en-US')} blocks`; drawMap(); }
}
