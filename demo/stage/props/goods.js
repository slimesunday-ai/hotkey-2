// THE GAME'S OWN PROPS FOR ITS GOODS (lib-1; the owner, 2026-11-16: "if we need game assets for energy drink/selling
// cigarettes we should also build those"). The city's library has neither: its held pieces are a gallon of orange
// drink and a 99-cent tallboy of lemon tea (world/cast/fresh/held.js), its bodega has cigarettes only painted into the
// wall behind the counter (interiors/store bodega.js 'store-backbar'), never a pack or a carton you can hold. So these
// three are ours, in the city's own voxel format and look, made plain: no brand, no logo, no real name.
//
//   energy-can     a can of energy drink: an orange-red can, a yellow band, silver lid and base, the tab up
//   smokes-pack    a pack of cigarettes: a white pack, a deep green flip lid, a gold rule, one cigarette out of the top
//   smokes-carton  a carton of them: the same white and green, ten packs' worth, the gold rule along the front
//
// THE FORMAT is the city's for props (anim/cast/clips/errands-props.js, skate-board.js): cells of GRAIN m, each
// [x, y, z, colour, layer] (layer 0 matte · 1 gloss · 2 metal), the origin on the ground under the middle, +z the
// front. Twice a real one, as the city's toon props are (the fist is twice a hand). No three at the top level:
// propGeometry(THREE, id) meshes them as skate-board.js does (one quad per open face, the city's corner AO).
// Where the game shows these goods: the shop's drink and the smokes' tiles (demo/tools/item-tiles.js). The stage draws
// no prop for them today (the drink and smoke clips carry none: anim/cast/clips/game-port.js), and no new animation
// was asked for, so they are not put in anyone's hand.
export const GRAIN = 0.025;
// (craft-art-1) the things crafting names are drawn in props/craft.js and listed here with these: see the end of MODELS
import { CRAFT_MODELS, CRAFT_SCHEMES } from './craft.js';

export const SCHEMES = {
  'energy-can': { can: 0xff4a1c, canD: 0xd8360e, band: 0xffd21a, metal: 0xd9dbe0, tab: 0x8e939c },
  'smokes-pack': { body: 0xf7f4ec, lid: 0x1f7a4a, rule: 0xe0b23a, paper: 0xfbfaf5, tip: 0xe08a3a },
  'smokes-carton': { body: 0xf7f4ec, end: 0x1f7a4a, rule: 0xe0b23a, seam: 0xdedad0 },
};

const MODELS = {
  'energy-can'(K) {
    const out = [];
    const add = (x, y, z, c, l = 0) => out.push([x, y, z, c, l]);
    // a 4 × 4 column, its corners cut (round enough at this grain), 8 cells tall: 0.2 m, twice a tall can
    const inCan = (x, z) => !((x === -2 || x === 1) && (z === -2 || z === 1));
    for (let y = 0; y <= 7; y++) for (let x = -2; x <= 1; x++) for (let z = -2; z <= 1; z++) {
      if (!inCan(x, z)) continue;
      if (y === 0 || y === 7) { add(x, y, z, K.metal, 1); continue; }
      // a yellow band round the middle, the rest the can's red (darker at the rims)
      add(x, y, z, y === 3 || y === 4 ? K.band : y === 1 || y === 6 ? K.canD : K.can, 1);
    }
    // the tab on the lid
    add(0, 8, -1, K.tab, 1);
    return out;
  },
  'smokes-pack'(K) {
    const out = [];
    const add = (x, y, z, c, l = 0) => out.push([x, y, z, c, l]);
    // 4 wide, 6 tall, 2 deep (0.1 × 0.15 × 0.05 m): the lid the top two rows, a gold rule under it
    for (let y = 0; y <= 5; y++) for (let x = -2; x <= 1; x++) for (let z = -1; z <= 0; z++) add(x, y, z, y >= 4 ? K.lid : y === 3 ? K.rule : K.body, y === 3 ? 1 : 0);
    // one cigarette up out of the top: the paper two cells, the filter end under them
    add(0, 6, 0, K.tip);
    add(0, 7, 0, K.paper);
    return out;
  },
  'smokes-carton'(K) {
    const out = [];
    const add = (x, y, z, c, l = 0) => out.push([x, y, z, c, l]);
    // 12 long, 4 tall, 5 deep (0.3 × 0.1 × 0.125 m): green at both ends, a gold rule along the front, faint seams
    // where the packs inside meet (every second cell along the top)
    for (let x = -6; x <= 5; x++) for (let y = 0; y <= 3; y++) for (let z = -3; z <= 1; z++) {
      const end = x === -6 || x === 5;
      const rule = !end && z === 1 && y === 2;
      const seam = !end && y === 3 && x % 2 === 0 && z > -3 && z < 1;
      add(x, y, z, end ? K.end : rule ? K.rule : seam ? K.seam : K.body, rule ? 1 : 0);
    }
    return out;
  },
};

// (craft-art-1) what you buy, cook with, pack and carry for crafting: props/craft.js (its CRAFT lists them by build step)
Object.assign(MODELS, CRAFT_MODELS);
Object.assign(SCHEMES, CRAFT_SCHEMES);

export const PROPS = Object.keys(MODELS);
/** A prop's cells (scheme: SCHEMES' own colours, or some of them replaced). */
export function propCells(id, scheme = null) {
  const make = MODELS[id];
  if (!make) return null;
  return make({ ...SCHEMES[id], ...(scheme ?? {}) });
}

const DIRS = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const AOV = [0.55, 0.72, 0.87, 1];
const GEO = new Map();
/** A prop as geometries by layer ([matte, gloss, metal]: null where none), metres, memoised. */
export function propGeometry(THREE, id) {
  if (GEO.has(id)) return GEO.get(id);
  const cells = propCells(id);
  if (!cells) return null;
  const k = (x, y, z) => `${x},${y},${z}`;
  const M = new Set(cells.map(c => k(c[0], c[1], c[2])));
  const has = (x, y, z) => (M.has(k(x, y, z)) ? 1 : 0);
  const per = [0, 1, 2].map(() => ({ P: [], N: [], C: [], I: [], v: 0 }));
  const col = new THREE.Color();
  for (const [x, y, z, hex, layer] of cells) {
    const L = per[layer] ?? per[0];
    for (const d of DIRS) {
      const [nx, ny, nz] = d.n;
      if (has(x + nx, y + ny, z + nz)) continue;
      const a4 = d.c.map(c => {
        const t = [nx ? 0 : c[0] ? 1 : -1, ny ? 0 : c[1] ? 1 : -1, nz ? 0 : c[2] ? 1 : -1];
        const e = [];
        if (t[0]) e.push([t[0], 0, 0]);
        if (t[1]) e.push([0, t[1], 0]);
        if (t[2]) e.push([0, 0, t[2]]);
        const ax = x + nx, ay = y + ny, az = z + nz;
        const s1 = has(ax + e[0][0], ay + e[0][1], az + e[0][2]), s2 = has(ax + e[1][0], ay + e[1][1], az + e[1][2]), cr = has(ax + t[0], ay + t[1], az + t[2]);
        return s1 && s2 ? 0 : 3 - (s1 + s2 + cr);
      });
      col.setHex(hex);
      d.c.forEach((c, q) => {
        L.P.push((x + c[0]) * GRAIN, (y + c[1]) * GRAIN, (z + c[2]) * GRAIN);
        L.N.push(nx, ny, nz);
        const a = AOV[a4[q]];
        L.C.push(col.r * a, col.g * a, col.b * a);
      });
      const v = L.v;
      if (a4[0] + a4[2] < a4[1] + a4[3]) L.I.push(v + 1, v + 2, v + 3, v + 1, v + 3, v);
      else L.I.push(v, v + 1, v + 2, v, v + 2, v + 3);
      L.v += 4;
    }
  }
  const out = per.map(L => {
    if (!L.v) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(L.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(L.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(L.C, 3));
    g.setIndex(L.I);
    g.computeBoundingSphere();
    return g;
  });
  GEO.set(id, out);
  return out;
}
