// ITEM TILES (tiles-1): every thing THE RUN sells, photographed from the model the game itself draws, as a square tile.
// Nothing here is drawn new: the pieces to wear are the city's cast (style/city/cast.js) cut out of a composed figure, the
// player's figure is the one the stage rolls for the player (stage/index.js: seed 'agent:You', the agent pool) dressed
// the way stage/actors.js dress() does it, the things for the trailer are the home kit's pieces (interiors/home buildObject,
// meshed the way stage/set/arrange.js meshes the piece it holds), the skateboard is the clip's own board
// (anim/cast/clips/skate-board.js). Which piece stands for which thing is read from the game's own tables: config
// `things` and the places' `shop` (src/run/config.mjs), WEAR_LOOK (demo/run/panels.js) and THINGS (stage/set/starter.js).
//
// The angle and the light are the city's own item-icon baker's (style/city/ui/icons/tools/bake.js): 34° round from the
// front toward +x, 30° down, the city's sun and hemisphere, a sky-gradient environment, NeutralToneMapping. One camera
// for everything; a tile is framed by the model's own vertices (or, worn, by the band of the body it is worn on).
//
// Imports nothing at load but three: kit() loads the rest, so the game page can import this module too and time it there
// (demo/tools/item-tiles.mjs). The page demo/tools/item-tiles.html exposes window.__tiles.
import * as THREE from 'three';

const CITY = new URL('../../city/from-trunk/style/city/', import.meta.url).href;
const ROOT = new URL('../../', import.meta.url).href;
export const BONE = '#E6E1D6';
export const WHITE = '#F4F1EA';
const INK = '#17171b';
const AZ = 34 * Math.PI / 180;
const EL = 30 * Math.PI / 180;
/** The player's look seed (stage/index.js actors.add: `agent:${a.name}`, the run's player is named 'You': run/scenes.js). */
export const PLAYER_SEED = 'agent:You';
/** The band of the body a thing is worn on, in cast voxels (chars.js: shoes y 0..3, legs to 10, torso 10..17, neck 17..18, head 19..33). */
const BAND = { head: [18, 40], top: [4.5, 19], neck: [12.5, 24], legs: [-1, 12], feet: [-1, 6.5] };
/** config slot → the cast slot WEAR_LOOK uses, for things that have no WEAR_LOOK (to say where they would go). */
const CAST_SLOT = { head: 'hat', top: 'top', neck: 'acc', feet: 'shoes' };

const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const dec = k => [(k >> 18) - 256, ((k >> 9) & 511) - 256, (k & 511) - 256];
const now = () => performance.now();

let KIT = null;
/** Loads the game's own modules (once). Returns them with how long the import took (ms). */
export async function kit() {
  if (KIT) return KIT;
  const t0 = now();
  const [CH, FRESH, HO, STORE, V, G, SB, CFG, LIB, PROPS, RIDE, VEH, STRIP, DOG] = await Promise.all([
    import(`${CITY}cast.js`), import(`${ROOT}city/from-trunk/world/cast/fresh/index.js`), import(`${CITY}interiors/home/index.js`),
    import(`${CITY}interiors/store/index.js`), import(`${CITY}vox.js`), import(`${CITY}glue.js`),
    import(`${CITY}anim/cast/clips/skate-board.js`), import(`${ROOT}src/run/config.mjs`), import(`${ROOT}src/run/library.mjs`),
    import(`${ROOT}demo/stage/props/goods.js`),
    // (assets-1: the city's own scooter, van and market stall drawn alone, the guard dog's poses)
    import(`${CITY}anim/cast/clips/ride-props.js`), import(`${CITY}vehicles/index.js`), import(`${CITY}districts/strip/props.js`),
    import(`${ROOT}demo/stage/props/dog.js`),
  ]);
  KIT = { CH, FRESH, HO, STORE, V, G, SB, LIB, PROPS, RIDE, VEH, STRIP, DOG, cfg: CFG.RUN_CONFIG, importMs: now() - t0 };
  return KIT;
}

// ── WHAT THE RUN SELLS, AND THE MODEL EACH ONE IS ─────────────────────────────────────────────────────────────────────
const inCast = (K, slot, id) => {
  const C = K.CH;
  const pool = slot === 'held' ? 'held' : C.CAST[slot]?.some(t => t.id === id) ? 'agent' : C.NPC_CAST[slot]?.some(t => t.id === id) ? 'npc' : C.UNIFORM_CAST[slot]?.some(t => t.id === id) ? 'uniform' : null;
  const raw = K.FRESH.entry(slot, id);
  return { pool, killed: !!raw && C.KILLED.has(raw.key), exists: !!raw, name: raw?.name ?? null };
};

/** A piece string of the game ('hat:id', 'held:id', 'kit:id', 'board:scheme', 'prop:id') as a model for alone()/worn(). */
export function modelOf(K, piece) {
  if (!piece) return null;
  const [kind, id] = [piece.slice(0, piece.indexOf(':')), piece.slice(piece.indexOf(':') + 1)];
  if (kind === 'kit') { const o = K.HO.byId.get(id); return o ? { type: 'kit', id, name: o.name, cat: o.cat, place: o.place } : null; }
  if (kind === 'board') return { type: 'board', id, name: `skate-board.js boardGeometry (${id})` };
  // (assets-1) the city's own vehicles and stall alone, the guard dog in a pose, a person of the run in their own look
  if (kind === 'city') return CITY_THINGS[id] ? { type: 'city', id, name: CITY_THINGS[id] } : null;
  if (kind === 'dog') return K.DOG.MODES.includes(id) ? { type: 'dog', id, name: `demo/stage/props/dog.js (${id})` } : null;
  if (kind === 'person') return PEOPLE[id] ? { type: 'person', id, name: PEOPLE[id].name } : null;
  if (kind === 'prop') return K.PROPS.PROPS.includes(id) ? { type: 'prop', id, name: `demo/stage/props/goods.js ${id}` } : null;
  const slot = kind;
  const c = inCast(K, slot, id);
  return c.exists && !c.killed ? { type: 'cast', slot, id, name: c.name, pool: c.pool } : null;
}
/** (assets-1) The city's own things that could not be drawn alone: each from the city's geometry, not redrawn. */
const CITY_THINGS = { scooter: 'anim/cast/clips/ride-props.js scooterGeometry (the rental scooter)', van: "vehicles/index.js vehicleProp('van')", stall: "districts/strip/props.js stall (the night market's stall)" };
/**
 * (assets-1) THE RUN'S PEOPLE, each in the look the run gives them (demo/fight/index.js LOOKS: the ally, the runner): the city's own cast
 * rolled from their seed, the named pieces over it. (Second art pass, 2026-11-17: the owner, "the muscle and lookout portraits borrow
 * their looks from the fight's enemies". Each now has a look of their own from the city's cast, worn by nobody else in the run: the
 * lookout, a corner watcher in a grey skully and an olive snorkel parka with a two-way beeper; the muscle, a wine silk durag, wraparound
 * shades, a white ribbed tank and the four-finger ring.)
 */
export const PEOPLE = {
  lookout: { name: 'a lookout', seed: 'run:lookout:2', pool: 'agent', wear: { top: 'old_opus_snorkel', hat: 'commissary_skully', acc: 'beeper' } },
  runner: { name: 'a runner', seed: 'fight:runner:1', pool: 'agent', wear: { top: 'old_hoodie', hat: 'old_bandana' } },
  muscle: { name: 'muscle', seed: 'run:muscle', pool: 'agent', wear: { top: 'ribbed_tank', hat: 'silk_durag', eyewear: 'getaway_wraps', acc: 'nameplate_ring', bottom: 'blackout_cargo' } },
  earl: { name: 'Cousin Earl', seed: 'npc:Cousin Earl', pool: 'agent', wear: { top: 'dock_vest', hat: 'dockhand_beanie' } },
};
/** The run slot's body band for a worn picture. */
const PART = { head: 'head', eyewear: 'head', top: 'top', bottom: 'legs', feet: 'feet', acc: 'top' };

/**
 * Every thing the run sells, in the config's order, with the model the game draws for it (config `piece`, lib-1), then
 * the food, then the goods (the pack sold loose and the carton a connect sells):
 *   { key, kind, label, part?, at, locked, model: { type: 'cast'|'kit'|'board'|'prop', ... } | null, why }
 */
export function catalog(K) {
  const out = [];
  for (const [key, t] of Object.entries(K.cfg.things ?? {})) {
    const model = modelOf(K, t.piece);
    out.push({ key, kind: t.kind, label: t.label, desc: t.desc, at: t.at, price: t.price, locked: !t.keeper, part: t.slot ?? null, model,
      why: model ? `${t.piece} (${model.name})` : t.piece ? `${t.piece}: not in the library` : 'no piece' });
  }
  for (const [place, p] of Object.entries(K.cfg.places ?? {})) {
    for (const it of p.shop ?? []) {
      if ((it.kind ?? 'food') !== 'food') continue;
      const model = modelOf(K, it.piece);
      out.push({ key: it.item, kind: 'food', label: it.label, at: place, price: it.price, locked: false, model, why: model ? `${it.piece} (${model.name})` : 'no piece' });
    }
  }
  for (const [g, good] of Object.entries(K.cfg.goods ?? {})) {
    for (const [k, piece, label] of [[g, good.piece, good.label], [`${g}:pack`, good.packPiece, good.pack]]) {
      const model = modelOf(K, piece);
      out.push({ key: k, kind: 'goods', label, at: good.at, price: k === g ? null : good.price, locked: false, model, why: model ? `${piece} (${model.name})` : 'no piece of its own' });
    }
  }
  return out;
}

// ── MODELS → three.js groups ────────────────────────────────────────────────────────────────────────────────────────
const HEAD_SLOTS = new Set(['hair', 'hat', 'eyewear', 'ears', 'mark', 'mouth']);
const STRING = new Set(['skin', 'eyes', 'mouth', 'mark']);   // (chars.js: the look's string slots)
/**
 * One piece of the cast on its own: the mannequin composed wearing it (chars.js compose), and only the cells that piece
 * drew kept (its tag on the head grid, its tag on the body grid, the shoe grid, the held grid; an accessory, whose cells
 * are tagged by the body part they ride, by what changed against the bare mannequin). Its face paint and fine voxels ride along.
 */
function castCells(K, slot, id) {
  const C = K.CH;
  const L = C.look({ [slot]: STRING.has(slot) ? id : { id } });
  const R = C.compose(L);
  const G = new C.Grid();
  const keep = (src, test) => {
    src.L.forEach((M, li) => { for (const [k, c] of M) if (test(k)) { G.L[li].set(k, c); const f = src.fp.get(k); if (f) G.fp.set(k, f); } });
  };
  const keepHalves = (src, test) => { for (const [k, v] of src.hv) if (test(k, v)) G.hv.set(k, v); };
  if (HEAD_SLOTS.has(slot)) {
    keep(R.H, k => R.htag.get(k) === slot);
    keepHalves(R.H, (k, v) => v[2] === slot);
  } else if (slot === 'top' || slot === 'bottom') {
    keep(R.B, k => R.tag.get(k) === slot);
    keepHalves(R.B, (k, v) => v[2] === slot);
  } else if (slot === 'shoes') {
    keep(R.SH, () => true);
    keepHalves(R.SH, () => true);
  } else if (slot === 'held') {
    // (with the fist that holds it: a held piece wraps the closed hand, and without it the grip shows as a bare bar)
    keep(R.HX, () => true);
    keepHalves(R.HX, () => true);
    keep(R.B, k => R.tag.get(k) === 'hands' && dec(k)[0] >= 0);
  } else {
    const B0 = C.compose(C.look({})).B;
    keep(R.B, k => { const [x, y, z] = dec(k); return B0.get(x, y, z) !== R.B.get(x, y, z); });
    keepHalves(R.B, (k, v) => v[2] === slot);
  }
  return G;
}
/** A cast grid as meshes, the way chars.js meshes a figure (one geometry per material layer, corner AO, face paint averaged). */
function castGroup(K, G) {
  const C = K.CH;
  const has = (x, y, z) => G.has(x, y, z);
  const half = [[], [], [], []];
  for (const [k, v] of G.hv) half[v[1]].push([k, v[0]]);
  const hasHalf = k => G.hv.has(k);
  const grp = new THREE.Group();
  G.L.forEach((M, i) => {
    if (!M.size && !half[i].length) return;
    grp.add(new THREE.Mesh(C.voxGeo(M, has, i !== 3, { fp: G.fp, sub: false, half: half[i], hasHalf }), C.MATS[i]));
  });
  grp.scale.setScalar(C.S);
  return grp;
}
/** The player's own look (the stage's roll for the player), dressed in `wear` ({ slot: id }) as actors.dress does. */
export function playerLook(K, wear = {}) {
  const L = K.CH.rollLook(fnv(PLAYER_SEED) & 0xffffff, { pool: 'agent' });
  return K.CH.wear(L, wear);
}
function figure(K, wear) {
  const o = K.CH.build(playerLook(K, wear));
  if (o.userData.open) { o.userData.open.visible = true; o.userData.shut.visible = false; }
  K.CH.pose(o, 0, 0);
  return o;
}
const KIT_MATS = () => [
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 }),
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.1 }),
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.85 }),
  new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
];
let kitMats = null;
/** A home-kit piece as stage/set/arrange.js pieceGroup builds it (variant 0, as starter.js THINGS puts every one; a sheet may ask for a variant and a state). */
function kitGroup(K, id, { variant = 0, seed = 1, state } = {}) {
  kitMats ??= KIT_MATS();
  const V = K.HO.buildObject(K.HO.byId.get(id), { variant, seed, state });
  const b = new K.V.Bank(true);
  K.V.meshVol(V, b);
  const grp = new THREE.Group();
  b.L.forEach((O, li) => { if (O.v) grp.add(new THREE.Mesh(K.G.geoOf(O), kitMats[li] ?? kitMats[0])); });
  return grp;
}
function cityGroup(K, id) {
  kitMats ??= KIT_MATS();
  const grp = new THREE.Group();
  if (id === 'scooter') { grp.add(new THREE.Mesh(K.RIDE.scooterGeometry(THREE, 'cyan'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }))); return grp; }
  const b = id === 'van' ? K.VEH.vehicleProp('van', { variant: 0 }) : K.STRIP.stall(3, 0xe8232a, 'discs');
  b.L.forEach((O, li) => { if (O.v) grp.add(new THREE.Mesh(K.G.geoOf(O), kitMats[li] ?? kitMats[0])); });
  return grp;
}
function storeGroup(K, id) {
  kitMats ??= KIT_MATS();
  const V = K.STORE.buildObject(id, {});
  const b = new K.V.Bank(true);
  K.V.meshVol(V, b);
  const grp = new THREE.Group();
  b.L.forEach((O, li) => { if (O.v) grp.add(new THREE.Mesh(K.G.geoOf(O), kitMats[li] ?? kitMats[0])); });
  return grp;
}
let boardMat = null;
function boardGroup(K, scheme = 'pink') {
  boardMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });   // (stage/rides/skate.js)
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(K.SB.boardGeometry(THREE, scheme), boardMat));
  return grp;
}
let propMats = null;
function propGroup(K, id) {
  propMats ??= [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.85 })];
  const grp = new THREE.Group();
  K.PROPS.propGeometry(THREE, id).forEach((g, li) => { if (g) grp.add(new THREE.Mesh(g, propMats[li])); });
  return grp;
}
/**
 * THE LOWER CAMERA (lib-1, after run53: from 30° down a cap is its crown and a shirt its shoulders): tops, caps and
 * the rest of the head's pieces are seen from LOW_EL down, the same 34° round. The tile camera only: the game's stays.
 */
export const LOW_EL = 12 * Math.PI / 180;
/**
 * THE HIGHER CAMERA (second art pass, 2026-11-17): a kit piece that lies flat on its side (a gun, knuckles, a box cutter, a tire
 * iron: the piece says `view: 'top'`, interiors FORMAT.md) is seen from HIGH_EL down, the same 34° round: from 30° its profile, drawn
 * on its top, came out at half its height. The tile camera only: the game's stays.
 */
export const HIGH_EL = 58 * Math.PI / 180;
const lowFor = model => model?.type === 'cast' && ['hat', 'top', 'eyewear'].includes(model.slot);
function dispose(grp, { keepGeo = false } = {}) { if (!keepGeo) grp.traverse(n => n.geometry?.dispose?.()); }

/**
 * A subject: what one tile shows. { group, band: [y0, y1] (world, m) | null, cast: grid voxels count }.
 *   alone(K, model)              the thing by itself
 *   worn(K, model, part)         the player wearing it, framed on the band of the body it is worn on
 */
export function alone(K, model) {
  if (!model) return null;
  if (model.type === 'cast') {
    const G = castCells(K, model.slot, model.id);
    let n = 0;
    for (const M of G.L) n += M.size;
    if (!n && !G.hv.size) return null;
    return { group: castGroup(K, G), band: null, voxels: n, el: lowFor(model) ? LOW_EL : null };
  }
  if (model.type === 'prop') return { group: propGroup(K, model.id), band: null, keepGeo: true };
  if (model.type === 'kit') return { group: kitGroup(K, model.id, model), band: null, el: K.HO.byId.get(model.id)?.view === 'top' ? HIGH_EL : null };
  if (model.type === 'store') return { group: storeGroup(K, model.id), band: null };
  if (model.type === 'board') return { group: boardGroup(K, model.id), band: null, keepGeo: true };
  if (model.type === 'city') return { group: cityGroup(K, model.id), band: null, keepGeo: model.id === 'scooter' };
  if (model.type === 'dog') { const d = K.DOG.createDog(THREE, K.V, K.G, { mode: model.id }); d.settle(); return { group: d.root, band: null }; }
  if (model.type === 'person') {
    const p = PEOPLE[model.id], o = K.CH.build(K.CH.wear(K.CH.rollLook(fnv(p.seed) & 0xffffff, { pool: p.pool }), p.wear));
    if (o.userData.open) { o.userData.open.visible = true; o.userData.shut.visible = false; }
    K.CH.pose(o, 0, 0);
    return { group: o, band: [9 * K.CH.S, 40 * K.CH.S], el: LOW_EL };
  }
  return null;
}
export function worn(K, model, part) {
  if (!model || model.type !== 'cast') return null;
  const o = figure(K, { [model.slot]: model.id });
  const got = o.userData.L?.[model.slot];
  const on = (got?.id ?? got) === model.id;
  // the band: the part's, stretched to the piece's own cells (a tall hat, a long coat)
  const S = K.CH.S;
  let [y0, y1] = BAND[PART[part] ?? part] ?? BAND.top;
  const G = castCells(K, model.slot, model.id);
  for (const M of G.L) for (const k of M.keys()) { const y = dec(k)[1]; if (y + 1 > y1) y1 = y + 1; if (y < y0) y0 = y; }
  return { group: o, band: [y0 * S, y1 * S], on, el: LOW_EL };   // (worn: always the lower camera, or the body above hides the legs and the feet)
}

// ── THE STAGE: one renderer, one camera, the city's icon light ────────────────────────────────────────────────────────
let R = null, scene = null, cam = null, sun = null, sunDir = null, stageMs = 0;
export function stage() {
  if (R) return { ms: stageMs };
  const t0 = now();
  R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  R.setPixelRatio(1);
  R.setClearColor(0x000000, 0);
  R.toneMapping = THREE.NeutralToneMapping;
  R.toneMappingExposure = 1.0;
  scene = new THREE.Scene();
  // (ui/icons/tools/bake.js, line for line: the sky-gradient environment, the sun high from the viewer's left, the hemisphere)
  const sky = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { top: { value: new THREE.Color(0x2f9bff) }, hor: { value: new THREE.Color(0x9fdcff) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top, hor; varying vec3 vD; void main(){ float h = vD.y; gl_FragColor = vec4(h > 0. ? mix(hor, top, pow(clamp(h,0.,1.), .5)) : hor, 1.);\n#include <colorspace_fragment>\n}' });
  const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), sky));
  const pm = new THREE.PMREMGenerator(R);
  scene.environment = pm.fromScene(es, 0.02).texture;
  scene.environmentIntensity = 0.55;
  cam = new THREE.PerspectiveCamera(18, 1, 0.01, 400);
  sun = new THREE.DirectionalLight(0xfff2dc, 3.0);
  scene.add(sun, sun.target);
  sunDir = new THREE.Vector3(-0.55, 0.85, 0.62).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), AZ * 0.5);
  scene.add(new THREE.HemisphereLight(0xd6ecff, 0xe0cfb0, 1.05));
  stageMs = now() - t0;
  return { ms: stageMs };
}
/**
 * (ui-3 leg 3, the run's tiles: demo/run/tiles.js) The renderer made and its shader programs compiled before the first
 * tile is wanted: a piece of the cast and one of the home kit, the two kinds of material a tile draws, compiled with
 * compileAsync (in parallel where the browser can, so the page is not held while they compile). → ms
 */
export async function warm(K, pieces = ['hat:lucky7_dad', 'kit:lava-lamp']) {
  const t0 = now();
  stage();
  const subs = pieces.map(p => alone(K, modelOf(K, p))).filter(Boolean);
  for (const s of subs) scene.add(s.group);
  try {
    await R.compileAsync(scene, cam);
  } finally {
    for (const s of subs) {
      scene.remove(s.group);
      dispose(s.group, { keepGeo: s.keepGeo });
    }
  }
  return now() - t0;
}
const viewOf = (el = EL) => new THREE.Vector3(Math.sin(AZ) * Math.cos(el), Math.sin(el), Math.cos(AZ) * Math.cos(el));
const _v = new THREE.Vector3();
/** The world-space vertices of a group (inside a y band, if one is given). */
function points(grp, band) {
  grp.updateMatrixWorld(true);
  const out = [];
  grp.traverse(n => {
    if (!n.isMesh || !n.visible || !n.geometry) return;
    let vis = true;
    for (let p = n.parent; p; p = p.parent) if (!p.visible) vis = false;
    if (!vis) return;
    const pos = n.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(n.matrixWorld);
      if (band && (_v.y < band[0] - 1e-4 || _v.y > band[1] + 1e-4)) continue;
      out.push(_v.x, _v.y, _v.z);
    }
  });
  return out;
}
/**
 * Renders a subject square at `px` (transparent), framed by its points: the camera on the one view direction, then a
 * view offset that crops the frame to the points' projected box, squared and padded by `pad` of its side.
 */
export function render(sub, px, pad = 0.08) {
  stage();
  const P = points(sub.group, sub.band);
  if (!P.length) return null;
  const box = new THREE.Box3();
  for (let i = 0; i < P.length; i += 3) box.expandByPoint(_v.set(P[i], P[i + 1], P[i + 2]));
  const c = box.getCenter(new THREE.Vector3()), r = Math.max(1e-3, box.getSize(new THREE.Vector3()).length() / 2);
  cam.aspect = 1;
  cam.clearViewOffset();
  cam.position.copy(c).addScaledVector(viewOf(sub.el ?? EL), r / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) * 1.05);
  cam.near = r * 0.05;
  cam.far = r * 40;
  cam.lookAt(c);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  let x0 = 1, x1 = -1, y0 = 1, y1 = -1;
  for (let i = 0; i < P.length; i += 3) {
    _v.set(P[i], P[i + 1], P[i + 2]).project(cam);
    if (_v.x < x0) x0 = _v.x; if (_v.x > x1) x1 = _v.x; if (_v.y < y0) y0 = _v.y; if (_v.y > y1) y1 = _v.y;
  }
  const side = Math.max(x1 - x0, y1 - y0) * (1 + 2 * pad), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const full = px * 2 / side;   // the whole frame's side in pixels at this crop
  cam.setViewOffset(full, full, (cx - side / 2 + 1) / 2 * full, (1 - (cy + side / 2)) / 2 * full, px, px);
  sun.position.copy(c).addScaledVector(sunDir, r * 4);
  sun.target.position.copy(c);
  R.setSize(px, px, false);
  scene.add(sub.group);
  R.render(scene, cam);
  scene.remove(sub.group);
  const out = document.createElement('canvas');
  out.width = out.height = px;
  out.getContext('2d').drawImage(R.domElement, 0, 0);
  return out;
}
/** Down to `size` in halving steps (clean minification, the icon baker's way). */
export function shrink(src, size) {
  let s = src;
  while (s.width / 2 >= size) {
    const t = document.createElement('canvas');
    t.width = t.height = Math.round(s.width / 2);
    const g = t.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(s, 0, 0, t.width, t.height);
    s = t;
  }
  if (s.width === size) return s;
  const t = document.createElement('canvas');
  t.width = t.height = size;
  const g = t.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(s, 0, 0, size, size);
  return t;
}
/** The icon baker's ink outline under a transparent picture (1 px a 64 px tile, scaled). */
export function outline(src, px = 1) {
  const n = src.width, g0 = src.getContext('2d'), d = g0.getImageData(0, 0, n, n).data, A = new Float32Array(n * n);
  for (let i = 0; i < A.length; i++) A[i] = d[i * 4 + 3] / 255;
  const offs = [];
  const k = Math.ceil(px);
  for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) { const dd = Math.hypot(dx, dy); if (dd <= px + 0.5) offs.push([dx, dy, Math.min(1, px + 0.5 - dd)]); }
  const ink = new ImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let m = 0;
    for (const [dx, dy, w] of offs) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue; const a = A[yy * n + xx] * w; if (a > m) m = a; }
    const i = (y * n + x) * 4;
    ink.data[i] = 0x17; ink.data[i + 1] = 0x17; ink.data[i + 2] = 0x1b; ink.data[i + 3] = Math.round(Math.min(1, m * 1.15) * 255);
  }
  const out = document.createElement('canvas');
  out.width = out.height = n;
  const g = out.getContext('2d');
  g.putImageData(ink, 0, 0);
  g.drawImage(src, 0, 0);
  return out;
}
/**
 * One tile picture of a subject at `size`: rendered at `ss` × size and shrunk (ss 4 for the sheets; the game would
 * use 2). Returns a transparent canvas, or null when the subject draws nothing.
 */
export function picture(sub, size, { ss = 4, ink = false } = {}) {
  if (!sub) return null;
  const big = render(sub, size * ss);
  if (!big) return null;
  const pic = shrink(big, size);
  return ink ? outline(pic, Math.max(1, size / 64)) : pic;
}

// ── SHEETS ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const FONT = '12px ui-monospace, Menlo, monospace';
function tile(g, x, y, size, bg, pic, blank = null) {
  g.fillStyle = bg;
  g.fillRect(x, y, size, size);
  if (pic) { g.drawImage(pic, x, y, size, size); return; }
  if (!blank) return;
  // a clearly marked blank: hatched, a red dashed edge, the word when it fits
  g.save();
  g.beginPath(); g.rect(x, y, size, size); g.clip();
  g.strokeStyle = 'rgba(200,30,30,.28)'; g.lineWidth = 1;
  for (let d = -size; d < size; d += 7) { g.beginPath(); g.moveTo(x + d, y + size); g.lineTo(x + d + size, y); g.stroke(); }
  g.restore();
  g.setLineDash([4, 3]); g.strokeStyle = '#c81e1e'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, size - 2, size - 2); g.setLineDash([]);
  g.fillStyle = '#c81e1e'; g.font = `700 ${size >= 96 ? 13 : size >= 64 ? 10 : 8}px ui-monospace, Menlo, monospace`; g.textAlign = 'center';
  if (size >= 48) { g.fillText('NO', x + size / 2, y + size / 2 - 2); g.fillText('MODEL', x + size / 2, y + size / 2 + (size >= 96 ? 13 : 10)); }
  g.textAlign = 'left';
}
function wrap(g, text, maxW) {
  const words = String(text).split(' '), lines = [];
  let cur = '';
  for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  return lines;
}
const SECTION = { wear: 'TO WEAR', home: 'FOR THE TRAILER', ride: 'A RIDE', food: 'FOOD', goods: 'GOODS' };

/** The pictures of every thing sold at `size`: { key → { alone: { bone?, white? } canvas, worn } } plus timings. */
export function shoot(K, rows, size, o = {}) {
  const pics = {};
  for (const r of rows) {
    const t0 = now();
    const a = alone(K, r.model);
    const pa = picture(a, size, o);
    if (a) dispose(a.group, { keepGeo: a.keepGeo });
    let pw = null, on = null;
    if (r.kind === 'wear' && r.model) {
      const w = worn(K, r.model, r.part);
      pw = picture(w, size, o);
      on = w?.on ?? null;
      if (w) K.CH.dispose(w.group);
    }
    pics[r.key] = { alone: pa, worn: pw, on, ms: now() - t0 };
  }
  return pics;
}

/** A contact sheet of every thing sold at one size: bone (alone, worn) and white (alone, worn) side by side. */
export function sheet(K, rows, size, o = {}) {
  const pics = shoot(K, rows, size, o);
  const LW = 360, GAP = 10, PADY = 8, HEAD = 84, SEC = 26, cols = [BONE, BONE, WHITE, WHITE];
  const rowH = Math.max(size, 44) + PADY * 2;
  const kinds = [...new Set(rows.map(r => r.kind))];
  const W = LW + cols.length * (size + GAP) + GAP + 6;
  const H = HEAD + kinds.length * SEC + rows.length * rowH + 16;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fbfaf7'; g.fillRect(0, 0, W, H);
  g.fillStyle = INK; g.font = '700 15px ui-monospace, Menlo, monospace';
  g.fillText(`${o.title ?? 'THE RUN · every thing sold'} · ${size} px tiles${o.ink ? ' · ink outline' : ''}`, 12, 22);
  g.font = FONT; g.fillStyle = '#555';
  wrap(g, o.sub ?? 'the model the game draws · 34° round, 30° down (tops, caps, eyewear and every worn tile 12° down) · the city icon light for all · red hatch: no model of its own', W - 24).slice(0, 2).forEach((t, i) => g.fillText(t, 12, 40 + i * 14));
  const x0 = LW;
  g.font = '700 10px ui-monospace, Menlo, monospace'; g.fillStyle = '#333';
  g.fillText(`bone ${BONE}`, x0 + GAP, HEAD - 20);
  g.fillText(`white ${WHITE}`, x0 + GAP + 2 * (size + GAP), HEAD - 20);
  g.font = '10px ui-monospace, Menlo, monospace';
  ['alone', 'worn', 'alone', 'worn'].forEach((t, i) => g.fillText(t, x0 + GAP + i * (size + GAP), HEAD - 6));
  let y = HEAD;
  for (const kind of kinds) {
    g.fillStyle = INK; g.font = '700 12px ui-monospace, Menlo, monospace';
    g.fillText(SECTION[kind] ?? kind.toUpperCase(), 12, y + 18);
    g.fillStyle = '#d8d3c8'; g.fillRect(12, y + SEC - 3, W - 24, 1);
    y += SEC;
    for (const r of rows.filter(q => q.kind === kind)) {
      const p = pics[r.key];
      g.fillStyle = INK; g.font = '700 12px ui-monospace, Menlo, monospace';
      g.fillText(`${r.key}${r.locked ? '  (corner: locked)' : ''}`, 12, y + PADY + 12);
      g.font = '11px ui-monospace, Menlo, monospace'; g.fillStyle = r.model ? '#444' : '#c81e1e';
      const said = r.model ? `${r.model.type === 'cast' ? `${r.model.slot}:${r.model.id}` : `${r.model.type}:${r.model.id}`}` : 'no model of its own';
      const lines = [r.label, said];
      if (r.kind === 'wear' && r.model && p.on === false) lines.push('NOT ON THE FIGURE');
      lines.forEach((t, i) => g.fillText(t.length > 46 ? `${t.slice(0, 45)}…` : t, 12, y + PADY + 27 + i * 13));
      const ty = y + PADY;
      const wear = r.kind === 'wear';
      cols.forEach((bg, i) => {
        const tx = x0 + GAP + i * (size + GAP);
        const isWorn = i % 2 === 1;
        if (isWorn && !wear) return;   // (nothing to wear: no worn tile)
        const pic = isWorn ? p.worn : p.alone;
        tile(g, tx, ty, size, bg, pic, pic ? null : true);
      });
      y += rowH;
    }
  }
  return { canvas: c, pics };
}

/** All four sizes on one sheet, bone only, to compare sizes: per thing, alone at 48 / 64 / 96 / 128, then worn at each. */
export function ladder(K, rows, sizes, o = {}) {
  const per = Object.fromEntries(sizes.map(s => [s, shoot(K, rows, s, o)]));
  const LW = 230, GAP = 8, sum = sizes.reduce((a, s) => a + s + GAP, 0), anyWear = rows.some(r => r.kind === 'wear');
  const W = LW + sum + (anyWear ? sum + 24 : 0) + 12;
  const rowH = Math.max(...sizes) + 14;
  const H = 70 + rows.length * rowH;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fbfaf7'; g.fillRect(0, 0, W, H);
  g.fillStyle = INK; g.font = '700 15px ui-monospace, Menlo, monospace';
  g.fillText(`THE RUN · the sizes side by side, on bone (${sizes.join(' / ')} px)${o.ink ? ' · ink outline' : ''}`, 12, 22);
  g.font = '11px ui-monospace, Menlo, monospace'; g.fillStyle = '#555';
  let hx = LW;
  for (const s of sizes) { g.fillText(s === sizes[0] ? `alone ${s}` : `${s}`, hx, 58); hx += s + GAP; }
  if (anyWear) { hx += 24; for (const s of sizes) { g.fillText(s === sizes[0] ? `worn ${s}` : `${s}`, hx, 58); hx += s + GAP; } }
  let y = 66;
  for (const r of rows) {
    g.fillStyle = INK; g.font = '700 12px ui-monospace, Menlo, monospace';
    g.fillText(r.key, 12, y + 16);
    g.font = '11px ui-monospace, Menlo, monospace'; g.fillStyle = r.model ? '#444' : '#c81e1e';
    g.fillText(r.model ? r.label : 'no model of its own', 12, y + 31);
    let x = LW;
    for (const s of sizes) { tile(g, x, y + rowH - 14 - s, s, BONE, per[s][r.key].alone, per[s][r.key].alone ? null : true); x += s + GAP; }
    if (r.kind === 'wear') { x += 24; for (const s of sizes) { tile(g, x, y + rowH - 14 - s, s, BONE, per[s][r.key].worn, per[s][r.key].worn ? null : true); x += s + GAP; } }
    y += rowH;
  }
  return { canvas: c, per };
}

/** A whole library slot on one sheet at `size`, on bone: each piece alone and on the player, its name under it. */
export function slotSheet(K, slot, size, { pools = ['agent', 'npc'], ink = false } = {}) {
  const C = K.CH;
  const groups = pools.map(p => [p, (p === 'agent' ? C.CAST : p === 'npc' ? C.NPC_CAST : C.UNIFORM_CAST)[slot] ?? []]);
  const part = { hat: 'head', eyewear: 'head', hair: 'head', top: 'top', shoes: 'feet', bottom: 'top', acc: 'top' }[slot] ?? 'top';
  const CW = size * 2 + 6 + 14, CHh = size + 30, COLS = Math.max(4, Math.floor(1800 / CW));
  let rowsN = 0;
  for (const [, list] of groups) rowsN += Math.ceil(list.length / COLS);
  const W = COLS * CW + 24, H = 50 + groups.length * 28 + rowsN * CHh + 10;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fbfaf7'; g.fillRect(0, 0, W, H);
  g.fillStyle = INK; g.font = '700 15px ui-monospace, Menlo, monospace';
  g.fillText(`THE CAST · every ${slot} the city rolls (${groups.map(([p, l]) => `${p} ${l.length}`).join(', ')}) · ${size} px on bone · alone | on the player`, 12, 24);
  const thumbs = {};
  let y = 44;
  for (const [pool, list] of groups) {
    g.fillStyle = INK; g.font = '700 12px ui-monospace, Menlo, monospace';
    g.fillText(`${pool} pool`, 12, y + 16);
    y += 28;
    list.forEach((t, i) => {
      const x = 12 + (i % COLS) * CW, yy = y + Math.floor(i / COLS) * CHh;
      const model = { type: 'cast', slot, id: t.id };
      const a = alone(K, model), pa = picture(a, size, { ink });
      if (a) dispose(a.group);
      const w = worn(K, model, part), pw = picture(w, size, { ink });
      if (w) K.CH.dispose(w.group);
      tile(g, x, yy, size, BONE, pa, pa ? null : true);
      tile(g, x + size + 4, yy, size, BONE, pw, pw ? null : true);
      g.fillStyle = '#333'; g.font = '9px ui-monospace, Menlo, monospace';
      const nm = t.name ?? t.id;
      g.fillText(nm.length > 30 ? `${nm.slice(0, 29)}…` : nm, x, yy + size + 12);
      thumbs[t.id] = { name: nm, pool, alone: pa };
    });
    y += Math.ceil(list.length / COLS) * CHh;
  }
  return { canvas: c, thumbs };
}

/**
 * How alike pictures are at their size: each composited on bone and brought to 16 × 16, the mean absolute difference
 * of their colours (0 the same picture, 255 opposite). Returns the closest pairs.
 */
export function alike(pics, top = 12) {
  const sig = {};
  for (const [k, p] of Object.entries(pics)) {
    if (!p) continue;
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    g.fillStyle = BONE; g.fillRect(0, 0, 16, 16);
    g.imageSmoothingQuality = 'high';
    g.drawImage(p, 0, 0, 16, 16);
    sig[k] = g.getImageData(0, 0, 16, 16).data;
  }
  const keys = Object.keys(sig), pairs = [];
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const a = sig[keys[i]], b = sig[keys[j]];
    let d = 0;
    for (let q = 0; q < a.length; q += 4) d += Math.abs(a[q] - b[q]) + Math.abs(a[q + 1] - b[q + 1]) + Math.abs(a[q + 2] - b[q + 2]);
    pairs.push([keys[i], keys[j], +(d / (256 * 3)).toFixed(1)]);
  }
  pairs.sort((p, q) => p[2] - q[2]);
  const ds = pairs.map(p => p[2]);
  const med = ds.length ? ds[Math.floor(ds.length / 2)] : null;
  return { n: keys.length, pairs: pairs.length, median: med, under10: ds.filter(d => d < 10).length, under15: ds.filter(d => d < 15).length, closest: pairs.slice(0, top) };
}

// ── WHAT THE LIBRARIES HOLD ──────────────────────────────────────────────────────────────────────────────────────────
export function counts(K) {
  const C = K.CH, F = K.FRESH;
  const per = (o, s) => (o[s] ?? []).length;
  const cast = {};
  for (const s of C.SLOTS) {
    const raw = Object.keys(F.REG[s] ?? {}).length, rawNpc = Object.keys(F.NPC_REG[s] ?? {}).length;
    cast[s] = { agent: per(C.CAST, s), npc: per(C.NPC_CAST, s), uniform: per(C.UNIFORM_CAST, s), registry: raw + rawNpc,
      killed: [...Object.values(F.REG[s] ?? {}), ...Object.values(F.NPC_REG[s] ?? {})].filter(t => C.KILLED.has(t.key)).length };
  }
  const home = {};
  for (const o of K.HO.OBJECTS) home[o.cat] = (home[o.cat] ?? 0) + 1;
  const store = {};
  for (const o of K.STORE.OBJECTS) store[o.cat ?? 'other'] = (store[o.cat ?? 'other'] ?? 0) + 1;
  const variants = K.HO.OBJECTS.reduce((n, o) => n + (o.variants ?? 1), 0);
  return {
    cast, castTotal: Object.values(cast).reduce((n, r) => n + r.agent + r.npc, 0), uniformTotal: Object.values(cast).reduce((n, r) => n + r.uniform, 0),
    home, homeTotal: K.HO.OBJECTS.length, homeVariants: variants, homeTrailerKit: K.HO.KITS?.trailer?.length ?? null,
    store, storeTotal: K.STORE.OBJECTS.length,
    accNames: (C.CAST.acc ?? []).map(t => `${t.id} (${t.name})`),
  };
}

// ── THE TWO WAYS OF MAKING THE PICTURES IN PLAY, MEASURED ────────────────────────────────────────────────────────────
/**
 * Snapshots taken in the page: kit (import), the renderer and its first render (shader programs), then every thing sold
 * at `size` (alone and, to wear, worn), rendered at ss × size. Each tile's time; the PNG bytes it would hold as a data URL.
 */
export async function timeSnapshots(rows, size = 64, ss = 2) {
  const t0 = now();
  const K = await kit();
  const tKit = now() - t0;
  const fresh = !R;
  const tS0 = now();
  stage();
  const tStage = now() - tS0;
  const per = [];
  let bytes = 0, first = null;
  for (const r of rows) {
    for (const how of r.kind === 'wear' ? ['alone', 'worn'] : ['alone']) {
      const a0 = now();
      const sub = how === 'alone' ? alone(K, r.model) : worn(K, r.model, r.part);
      const a1 = now();
      const pic = picture(sub, size, { ss });
      const a2 = now();
      let b = 0;
      if (pic) { const url = pic.toDataURL('image/png'); b = Math.round((url.length - 22) * 3 / 4); bytes += b; }
      const a3 = now();
      if (sub) (sub.group.userData?.rig ? K.CH.dispose(sub.group) : dispose(sub.group, { keepGeo: sub.keepGeo }));
      const row = { key: r.key, how, build: +(a1 - a0).toFixed(2), render: +(a2 - a1).toFixed(2), png: +(a3 - a2).toFixed(2), total: +(a3 - a0).toFixed(2), bytes: b, drawn: !!pic };
      if (!first && pic) first = row;
      per.push(row);
      await new Promise(res => requestAnimationFrame(res));
    }
  }
  const drawn = per.filter(p => p.drawn), tot = drawn.map(p => p.total).sort((a, b) => a - b);
  return { size, ss, freshRenderer: fresh, kitMs: +tKit.toFixed(1), kitImportMs: +K.importMs.toFixed(1), stageMs: +tStage.toFixed(1), first, tiles: drawn.length,
    sumMs: +tot.reduce((a, b) => a + b, 0).toFixed(1), medianMs: tot[Math.floor(tot.length / 2)], maxMs: tot[tot.length - 1], pngBytes: bytes, per };
}
/** A baked sheet loaded in the page: the PNG's bytes (handed over as base64), decoded, and sliced into tiles. */
export async function timeBaked(b64, cells, size) {
  const t0 = now();
  const bin = atob(b64), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const blob = new Blob([u8], { type: 'image/png' });
  const t1 = now();
  const bmp = await createImageBitmap(blob);
  const t2 = now();
  const tiles = [];
  for (const [x, y] of cells) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    c.getContext('2d').drawImage(bmp, x, y, size, size, 0, 0, size, size);
    tiles.push(c);
  }
  const t3 = now();
  return { bytes: u8.length, w: bmp.width, h: bmp.height, blobMs: +(t1 - t0).toFixed(2), decodeMs: +(t2 - t1).toFixed(2), sliceMs: +(t3 - t2).toFixed(2), tiles: tiles.length };
}
/** The baked atlas itself: every drawn tile of the things sold at `size`, in a grid, transparent, with its index. */
export function atlas(K, rows, size, { ss = 4, cols = 8 } = {}) {
  const t0 = now();
  const pics = shoot(K, rows, size, { ss });
  const list = [];
  for (const r of rows) {
    if (pics[r.key].alone) list.push([`${r.key}`, pics[r.key].alone]);
    if (pics[r.key].worn) list.push([`${r.key}:worn`, pics[r.key].worn]);
  }
  const c = document.createElement('canvas');
  c.width = cols * size;
  c.height = Math.ceil(list.length / cols) * size;
  const g = c.getContext('2d');
  const index = {};
  list.forEach(([k, p], i) => { const x = (i % cols) * size, y = Math.floor(i / cols) * size; g.drawImage(p, x, y); index[k] = [x, y]; });
  return { canvas: c, index, bakeMs: +(now() - t0).toFixed(1) };
}

// ── THE LIBRARY AS DATA (lib-1): what src/run/library-data.mjs is written from (demo/tools/library-catalog.mjs) ─────
/** The cast slots the run sells (and nothing else: no skin, hair, faces, ears, held). */
export const WEAR_SLOTS = ['hat', 'eyewear', 'top', 'bottom', 'shoes', 'acc'];
/**
 * Every wearable cast piece the city rolls (both pools; killed and uniform pieces left out, each with why) and every
 * home-kit piece, with what the rules and the tiles need: names, tiers (the cast's effective tier: slime's rank, else
 * the designer's; the kit's game.rarity), roll weight, and for the kit its placement, footprint and height.
 */
export function libraryData(K) {
  const C = K.CH, F = K.FRESH;
  const wear = [], out = [];
  for (const slot of WEAR_SLOTS) {
    for (const [pool, R] of [['agent', F.REG], ['npc', F.NPC_REG]]) {
      for (const t of Object.values(R[slot] ?? {})) {
        if (C.KILLED.has(t.key)) { out.push({ piece: `${slot}:${t.id}`, why: 'killed in the cast curation: the city never draws it' }); continue; }
        if (t.uniform) { out.push({ piece: `${slot}:${t.id}`, why: 'a uniform piece (worn only by a named outfit: the officer, the Cleaners): it marks a role the city reads at a glance' }); continue; }
        wear.push({ slot, id: t.id, name: t.name ?? t.id, pool, tier: C.tierOf(t), weight: C.TIER_W[C.tierOf(t)] });
      }
    }
  }
  const home = K.HO.OBJECTS.map(o => ({ id: o.id, name: o.name, cat: o.cat, place: o.place, foot: [...o.foot], h: o.h, tops: o.tops ?? null, kind: o.game?.kind ?? 'base',
    rarity: o.game?.rarity ?? 'common', tiers: [...(o.tiers ?? [])], variants: o.variants ?? 1, states: o.states ?? null, mount: o.mount ?? null }));
  return { wear, home, out };
}

/**
 * A sheet of the run's library (lib-1: src/run/library.mjs, exactly what the run sells) at `size`, on bone: each piece
 * alone and, to wear, on the player; its name and price under it. -> { canvas, blanks: [key], n }
 */
export function librarySheet(K, pick, size, title) {
  const lib = K.LIB.libraryOf(K.cfg);
  const list = lib.pieces.filter(pick);
  const wear = list.some(p => p.kind === 'wear');
  const CW = (wear ? size * 2 + 4 : size) + 16, CHh = size + 30, COLS = Math.max(4, Math.floor(1800 / CW));
  const W = COLS * CW + 24, H = 46 + Math.ceil(list.length / COLS) * CHh + 10;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fbfaf7'; g.fillRect(0, 0, W, H);
  g.fillStyle = INK; g.font = '700 15px ui-monospace, Menlo, monospace';
  g.fillText(`${title} · ${list.length} pieces · ${size} px on bone${wear ? ' · alone | on the player' : ''} · tops, caps, eyewear from 12° down`, 12, 26);
  const blanks = [];
  list.forEach((p, i) => {
    const x = 12 + (i % COLS) * CW, y = 40 + Math.floor(i / COLS) * CHh;
    const model = modelOf(K, p.named ? K.cfg.things[p.key].piece : p.key);
    const a = alone(K, model), pa = picture(a, size);
    if (a) dispose(a.group, { keepGeo: a.keepGeo });
    tile(g, x, y, size, BONE, pa, pa ? null : true);
    if (!pa) blanks.push(p.key);
    if (p.kind === 'wear') {
      const w = worn(K, model, p.slot), pw = picture(w, size);
      if (w) K.CH.dispose(w.group);
      tile(g, x + size + 4, y, size, BONE, pw, pw ? null : true);
      if (!pw) blanks.push(`${p.key} (worn)`);
    }
    g.fillStyle = '#333'; g.font = '9px ui-monospace, Menlo, monospace';
    const nm = `${p.name}`;
    g.fillText(nm.length > (wear ? 24 : 12) ? `${nm.slice(0, wear ? 23 : 11)}…` : nm, x, y + size + 11);
    g.fillStyle = ['#666', '#2457c5', '#7b3fc4', '#c08a00'][p.tier] ?? '#666';
    g.fillText(`$${p.price.toLocaleString('en-US')} · t${p.tier}`, x, y + size + 22);
  });
  return { canvas: c, blanks, n: list.length };
}
