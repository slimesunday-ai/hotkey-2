// WHAT IS HANDED OVER, DRAWN (anim-1): the money and the goods as small voxel things in the city's blocky look, each
// put where the staged deal has it (moves.js: in a fist, pointing at the camera; put away, it shrinks into the pocket
// it went to and is not drawn). The carton and the pack are the game's own props (demo/stage/props/goods.js), the ones
// the Library's tiles show; the rest are a few boxes each.
//
// A NEW ITEM'S HELD SHAPE is an entry in KINDS: `prop` (an id of props/goods.js) or `boxes` ([x0, x1, y0, y1, z0, z1,
// colour] in the hand's own frame: +z the way a held thing points (at the camera) from the fist, +y up, +x across;
// metres at a body of scale 1), `at` where its middle sits from the fist, `turn` its own turn in the hand (radians about x, y, z), `size`
// how much larger than told it is drawn (things are small and the camera is high: money at its true size is a speck).
//
//   const things = createThings(city)
//   things.show(id, T)   T: one thing of moves.js at(t).things: { kind, at, dir, up, show, since, scale }
//   things.clear()
import { propGeometry, propCells, GRAIN } from '../props/goods.js';
import { CRAFT } from '../props/craft.js';
import { warmMaterials } from '../../fight/puppet/gunmesh.js';
import { HOME } from '../../../src/run/library-data.mjs';

const NOTE = 0x3f9a52, NOTE_L = 0x9fe0a6, NOTE_D = 0x1f6b35, GOLD = 0xf0c040, GOLD_L = 0xffe27a, STEEL = 0xc9cfd8, DARK = 0x2a2c33, RED = 0xc4472e;
const QUARTER = Math.PI / 2;
// THE SIZE OF EACH HELD THING IS ONE NUMBER: `size`, how many times its told size it is drawn (the city's props are
// about twice life already; the camera is 24 m up and a note at its true size is two dots). Change it here and the
// drawing, the measures and the checks all follow.
// `off`: how far OUT from the fist, away from its holder's body, its middle is (m, before `size`): a held thing is
// beside the hand on the side away from the body, so it is never in the holder's own hip or under their own head.
// (+z is the way the thing points: at the camera, out in front of the heads. Each is LONG that way and NARROW across:
// held out beside a head a metre wide, anything wider than a quarter of a metre is in the head.)
export const KINDS = {
  // (the prop is long across and fronted +z: turned a quarter so its length is the way it points. `box`: its own
  // size as it then lies, across, up and along, for the measures: the prop's cells are props/goods.js's)
  carton: { prop: 'smokes-carton', box: [0.125, 0.1, 0.3], at: [0, 0.0, 0.17], turn: [0, QUARTER, 0], size: 2.2, off: 0.075 },
  pack: { prop: 'smokes-pack', box: [0.05, 0.175, 0.1], at: [0, 0.0, 0.08], turn: [0, QUARTER, 0], size: 2.6, off: 0.035 },
  // a fan of three notes and the band round them
  cash: { boxes: [[-0.045, 0.045, 0.004, 0.016, 0.0, 0.27, NOTE], [-0.06, 0.02, -0.006, 0.004, 0.03, 0.28, NOTE_L], [-0.02, 0.06, -0.016, -0.006, 0.02, 0.26, NOTE_L], [-0.05, 0.05, -0.02, 0.022, 0.1, 0.15, NOTE_D]], at: [0, 0.02, 0.0], turn: [0, 0, 0], size: 2.4, off: 0.07 },
  // three coins the size of saucers, in a row along the palm
  coins: { boxes: [[-0.035, 0.035, 0, 0.03, 0.0, 0.07, GOLD], [-0.03, 0.04, 0, 0.03, 0.08, 0.15, GOLD], [-0.04, 0.03, 0.0, 0.03, 0.16, 0.23, GOLD_L]], at: [0, 0.01, 0.0], turn: [0, 0, 0], size: 3.2, off: 0.05 },
  // a find: a small radio held end on, its dial gold, the aerial up
  find: { boxes: [[-0.05, 0.05, 0, 0.12, 0.0, 0.18, STEEL], [-0.035, 0.035, 0.02, 0.1, 0.18, 0.186, DARK], [-0.02, 0.02, 0.04, 0.08, 0.186, 0.196, GOLD], [0.03, 0.04, 0.12, 0.26, 0.03, 0.04, DARK], [-0.05, 0.05, 0.12, 0.13, 0.0, 0.18, RED]], at: [0, 0.0, 0.03], turn: [0, 0, 0], size: 2.3, off: 0.06, body: 1 },
  // (stage 2) a loose cigarette: the filter at the hand (or the lips), the paper, the end that is lit. `burn`: which
  // box is the paper and which the end, so it is smoked down (moves.js drag) and the end glows when it is drawn on
  cig: { boxes: [[-0.0055, 0.0055, -0.0055, 0.0055, 0.0, 0.026, 0xd9a35a], [-0.005, 0.005, -0.005, 0.005, 0.026, 0.088, 0xf4f1ea], [-0.0052, 0.0052, -0.0052, 0.0052, 0.088, 0.094, 0xe8e2d6]], at: [0, 0.006, 0.0], turn: [0, 0, 0], size: 3.0, off: 0.02, burn: { paper: 1, end: 2 } },
  // (stage 2) a bootleg disc in its case: black, the sleeve's pink showing, a gold sticker
  disc: { boxes: [[-0.068, 0.068, 0, 0.014, 0, 0.19, 0x1d1d24], [-0.062, 0.062, 0.014, 0.017, 0.006, 0.184, 0xc23a6b], [-0.03, 0.03, 0.017, 0.019, 0.12, 0.16, GOLD]], at: [0, 0, 0.0], turn: [0, 0, 0], size: 2.0, off: 0.075 },
  // a chopped cheese on a hero roll (the cast's own held piece is drawn by the cast: this is the same sandwich in boxes),
  // eaten from its far end (`burn`: all of it shortens)
  sandwich: { boxes: [[-0.045, 0.045, 0, 0.03, 0, 0.17, 0xd9a35a], [-0.047, 0.047, 0.03, 0.045, 0.005, 0.165, 0x7a3b22], [-0.05, 0.05, 0.045, 0.05, 0.01, 0.16, 0xf2c94c], [-0.045, 0.045, 0.05, 0.075, 0, 0.17, 0xe0b06a]], at: [0, -0.03, 0.0], turn: [0, 0, 0], size: 2.4, off: 0.06, burn: { paper: [0, 1, 2, 3] } },
  // an energy drink, its blue can held lying in the fist, tipped up at the lips (moves.js bite)
  can: { boxes: [[-0.033, 0.033, -0.033, 0.033, 0, 0.11, 0x2fb5e8], [-0.03, 0.03, -0.03, 0.03, 0.11, 0.122, STEEL], [-0.034, 0.034, -0.02, 0.02, 0.04, 0.07, 0xf2e94c]], at: [0, 0.0, 0.0], turn: [0, 0, 0], size: 2.6, off: 0.045 },
  // a wallet, brown, folded
  wallet: { boxes: [[-0.045, 0.045, 0, 0.02, 0, 0.11, 0x6b4428], [-0.04, 0.04, 0.02, 0.022, 0.01, 0.1, 0x8a5a36]], at: [0, 0, 0.0], turn: [0, 0, 0], size: 2.6, off: 0.06 },
  // the barber's scissors, red handles, steel blades out
  scissors: { boxes: [[-0.006, 0.006, 0, 0.004, 0.04, 0.15, STEEL], [0.004, 0.016, 0, 0.004, 0.04, 0.15, STEEL], [-0.02, 0, 0, 0.006, 0, 0.04, RED], [0, 0.02, 0, 0.006, 0, 0.04, RED]], at: [0, 0, 0.0], turn: [0, 0, 0], size: 2.6, off: 0.04 },
  // a box cutter, a yellow handle, the blade run out
  boxcutter: { boxes: [[-0.013, 0.013, 0, 0.02, 0, 0.12, 0xf2c230], [-0.004, 0.004, 0.005, 0.015, 0.12, 0.15, STEEL]], at: [0, 0, 0.0], turn: [0, 0, 0], size: 2.6, off: 0.04 },
  // (hands-2) THINGS TO WEAR, as handed over before they are put on (moves.js putOn: from then the figure wears the
  // piece itself). Each slot's own shape, read at a glance from above: a cap with its bill out front, a shirt folded
  // with its collar, a pair of high-tops side by side, sunglasses, folded jeans, a small bag. LIGHT, all of them: a navy
  // cap in the night market's dark was not there in the hand at all (the first film, 2026-11-19)
  'wear:hat': { boxes: [[-0.05, 0.05, -0.02, 0.022, 0, 0.1, 0xf2ead8], [-0.046, 0.046, -0.02, -0.01, 0.1, 0.165, RED], [-0.02, 0.02, 0.022, 0.028, 0.03, 0.07, GOLD]], at: [0, 0, 0], turn: [0, 0, 0], size: 2.4, off: 0.07 },
  'wear:top': { boxes: [[-0.06, 0.06, 0, 0.025, 0, 0.16, 0x4a4a5c], [-0.04, 0.04, 0.025, 0.03, 0.12, 0.155, 0xf4f1ea], [-0.055, -0.015, 0.025, 0.028, 0.01, 0.11, 0xd94f8a], [0.01, 0.05, 0.025, 0.028, 0.03, 0.1, GOLD]], at: [0, 0, 0], turn: [0, 0, 0], size: 2.3, off: 0.075 },
  'wear:shoes': { boxes: [[-0.055, -0.004, -0.018, 0.02, 0, 0.15, 0xf4f1ea], [0.004, 0.055, -0.018, 0.02, 0, 0.15, 0xf4f1ea], [-0.055, -0.004, -0.024, -0.016, 0, 0.15, 0xd94f8a], [0.004, 0.055, -0.024, -0.016, 0, 0.15, 0x7ed957], [-0.045, -0.014, 0.02, 0.03, 0, 0.05, 0x3fc6e0], [0.014, 0.045, 0.02, 0.03, 0, 0.05, 0x3fc6e0]], at: [0, 0, 0], turn: [0, 0, 0], size: 2.3, off: 0.07 },
  'wear:eyewear': { boxes: [[-0.05, 0.05, 0, 0.012, 0, 0.012, DARK], [-0.05, -0.008, -0.012, 0.012, 0.004, 0.05, 0x111118], [0.008, 0.05, -0.012, 0.012, 0.004, 0.05, 0x111118], [-0.052, -0.046, 0, 0.008, 0.012, 0.12, DARK], [0.046, 0.052, 0, 0.008, 0.012, 0.12, DARK]], at: [0, 0, 0], turn: [0, 0, 0], size: 2.6, off: 0.06 },
  'wear:bottom': { boxes: [[-0.055, 0.055, 0, 0.03, 0, 0.16, 0x4f74a8], [-0.055, 0.055, 0.03, 0.034, 0.13, 0.16, 0x6b4428]], at: [0, 0, 0], turn: [0, 0, 0], size: 2.3, off: 0.07 },
  'wear:acc': { boxes: [[-0.04, 0.04, -0.022, 0.022, 0, 0.11, 0x9a6a40], [-0.03, 0.03, 0.022, 0.027, 0.02, 0.08, GOLD]], at: [0, 0, 0], turn: [0, 0, 0], size: 2.4, off: 0.06 },
  // a cheap lighter, red, held upright in the fist: the flame comes out of its top (moves.js light)
  lighter: { boxes: [[-0.012, 0.012, 0.0, 0.052, 0.0, 0.02, RED], [-0.01, 0.01, 0.052, 0.06, 0.003, 0.017, STEEL]], at: [0, 0.0, 0.0], turn: [0, 0, 0], size: 2.2, off: 0.04 },
};
// (craft-art-1) EVERY THING CRAFTING NAMES, held (props/craft.js CRAFT): its own drawn piece, its box measured from its
// cells. 'flat' lies as drawn, its top up (long across, it is turned a quarter so its length is the way it points);
// 'side' lies on its side with its front up (a can, a bottle, a tub: the label is what the camera sees from above, its
// top away from the camera). Drawn as big as a hand allows ("keep it big for now", the owner): no wider than 0.29 m
// across (the measure below holds 0.3), no more than 0.45 m up (the pack is drawn 0.45: a held thing stays under the heads) and 0.7 m long (the
// carton is drawn 0.66), and never past its own ceiling (CRAFT `size`). A look of a thing (a bag of Zonk, a bottle of
// paint) is held as the thing is.
const CRAFT_IDS = new Set(CRAFT.map(T => T.id));
{
  const dims = new Map();
  for (const T of CRAFT) {
    if (!dims.has(T.base)) {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (const c of propCells(T.base) ?? []) for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], c[k]);
        hi[k] = Math.max(hi[k], c[k] + 1);
      }
      dims.set(T.base, lo.map((v, k) => +((hi[k] - v) * GRAIN).toFixed(4)));
    }
    const [dx, dy, dz] = dims.get(T.base);
    const side = T.held === 'side';
    const along = side ? dy : Math.max(dx, dz);
    const box = side ? [dx, dz, dy] : dx > dz ? [dz, dy, dx] : [dx, dy, dz];
    const turn = side ? [-QUARTER, 0, 0] : dx > dz ? [0, QUARTER, 0] : [0, 0, 0];
    const size = +Math.min(T.size, 0.29 / box[0], 0.45 / box[1], 0.7 / box[2]).toFixed(3);
    KINDS[T.id] = { prop: T.id, box, at: [0, 0, +(along / 2 + 0.02).toFixed(4)], turn, size, off: +(box[0] / 2 + 0.012).toFixed(4) };
  }
}
// ── THE HOME PIECES (stage 2): the kit's own pieces, the ones the Library's tiles show and the trailer is furnished
// with (city/from-trunk/style/city/interiors/home: built once each, the first time one is bought). A kind of them is
// `kit:<id>`, made the first time it is asked for (kitKind) from the piece's own size (src/run/library-data.mjs HOME:
// its footprint in quarter-metre cells and its height). A piece one hand can carry is held as anything else is; one
// that is not is never in a hand at all: it stands on the ground (`ground`) and is slid about there (moves.js
// bringOut, claim). That rule, and its numbers, are handHeld's.
const CELL = 0.25;
/** The plank a wall's piece is carried on: its thickness (m), and the door's own wood (demo/stage/set/crib.js leafM). */
const PLANK = 0.025;
const WOOD = 0x6b4428;
/** A home piece's own size as it stands in a room, at life size (m): [across, up, deep]; a piece for a wall: [across, up the wall, out of it]. */
export function pieceDims(id) {
  const row = HOME.find(r => r[0] === String(id).replace(/^kit:/, ''));
  if (!row) return null;
  const [, , , place, foot, h] = row;
  return place === 'wall' ? [foot[0] * CELL, foot[1] * CELL, h] : [foot[0] * CELL, h, foot[1] * CELL];
}
/**
 * CAN IT PASS HAND TO HAND? One hand carries a thing no wider than 0.3 m across its narrower way and no longer than
 * 0.8 m (the chain and locks, a lava lamp), or a flat one no bigger than 0.6 m (a tin sign). Anything else (a box fan,
 * a safe, a fish tank, a dog's bed) stays on the ground.
 */
export function handHeld(id) {
  const d = pieceDims(id);
  if (!d) return false;
  const [a, b, c] = [...d].sort((x, y) => x - y);
  return (b <= 0.3 && c <= 0.8) || (a <= 0.06 && c <= 0.6);
}
/** The axes of a piece (0 across, 1 up, 2 deep) as a held thing has them: its longest pointing out of the fist, its thinnest up, the other across. */
function heldAxes(d) {
  const order = [0, 1, 2].sort((p, q) => d[p] - d[q]);
  return { up: order[0], across: order[1], along: order[2] };
}
/**
 * The kind a home piece is drawn as: `kit:<id>`, made once. Held: no more than 0.28 m across nor 0.8 m long (a held
 * thing beside a head a metre wide), and at life size or under (the kit is drawn at life size, the props at about
 * twice it: the chain and locks are drawn 0.25 by 0.75 m, the carton 0.28 by 0.66). On the ground: at life size.
 */
export function kitKind(piece) {
  const id = String(piece).replace(/^kit:/, '');
  const key = `kit:${id}`;
  if (KINDS[key]) return key;
  const d = pieceDims(id);
  if (!d) return null;
  if (!handHeld(id)) {
    // (a piece for a wall, on the ground, lies flat on its back: a door bar is not stood on its end)
    if (HOME.find(r => r[0] === id)?.[3] === 'wall') {
      const A = heldAxes(d);
      const unit = k => [0, 1, 2].map(j => (j === k ? 1 : 0));
      const [ey, ez] = [unit(A.up), unit(A.along)];
      const ex = [ey[1] * ez[2] - ey[2] * ez[1], ey[2] * ez[0] - ey[0] * ez[2], ey[0] * ez[1] - ey[1] * ez[0]];
      KINDS[key] = { kit: id, ground: true, box: [d[A.across], d[A.up], d[A.along]], at: [0, 0, 0], basis: [ex, ey, ez], size: 1, off: 0 };
      return key;
    }
    KINDS[key] = { kit: id, ground: true, box: [...d], at: [0, 0, 0], basis: null, size: 1, off: 0 };
    return key;
  }
  // (a piece for a wall is carried on a plank: createThings make)
  const wall = HOME.find(r => r[0] === id)?.[3] === 'wall' && d[2] > 0.06;
  const d2 = wall ? [d[0] + 0.03, d[1] + 0.04, d[2] + PLANK] : d;
  const A = heldAxes(d2);
  const box = [d2[A.across], d2[A.up], d2[A.along]];
  const size = +Math.min(1, 0.28 / box[0], 0.8 / box[2]).toFixed(3);
  // (the piece's own axes for the thing's three: +z its longest, out of the fist; +y its thinnest, its face up; +x across, so that x = y × z)
  const unit = k => [0, 1, 2].map(j => (j === k ? 1 : 0));
  const [ey, ez] = [unit(A.up), unit(A.along)];
  const ex = [ey[1] * ez[2] - ey[2] * ez[1], ey[2] * ez[0] - ey[0] * ez[2], ey[0] * ez[1] - ey[1] * ez[0]];
  KINDS[key] = { kit: id, box, at: [0, 0, box[2] / 2 + 0.02], basis: [ex, ey, ez], size, off: box[0] / 2 + 0.03 / size, plank: wall };
  return key;
}
/**
 * THE SIZE BY THE CAMERA'S DISTANCE, off: with `on`, every held thing is drawn `size` × (the camera's distance from
 * it / `at`), kept between `least` and `most`: the same size on the picture from the game's own camera (26.7 m off)
 * and nearer its true size from a low one close in. One line to turn on; the measures use the plain `size`.
 */
export const SIZE_BY_DISTANCE = { on: false, at: 26.7, least: 0.5, most: 1.3 };
/** How far out from the fist a held thing's middle is drawn (m, at its `size`). */
export const offOf = kind => {
  const K = KINDS[kind] ?? KINDS[kitKind(kind) ?? 'find'] ?? KINDS.find;
  return (K.off ?? 0) * (K.size ?? 1);
};
/** A held thing's box in its own frame as drawn at a body of scale 1 (m): [x0, x1, y0, y1, z0, z1]; +z from the fist the way it points. */
export function boxOf(kind) {
  const K = KINDS[kind] ?? KINDS[kitKind(kind) ?? 'find'] ?? KINDS.find;
  let b = null;
  if (K.prop || K.kit) b = [-K.box[0] / 2, K.box[0] / 2, -K.box[1] / 2, K.box[1] / 2, -K.box[2] / 2, K.box[2] / 2];
  // (`body`: how many of its boxes, the first ones, are the thing itself: an aerial is not what goes through a head)
  else for (const q of K.boxes.slice(0, K.body ?? K.boxes.length)) b = b ? [Math.min(b[0], q[0]), Math.max(b[1], q[1]), Math.min(b[2], q[2]), Math.max(b[3], q[3]), Math.min(b[4], q[4]), Math.max(b[5], q[5])] : q.slice(0, 6);
  return b.map((v, k) => (v + K.at[k >> 1]) * K.size);
}

export function createThings(city) {
  const THREE = city.THREE;
  const live = new Map();
  const mats = new Map();
  const flat = c => {
    if (!mats.has(c)) mats.set(c, new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.3 }));
    return mats.get(c);
  };
  const tinted = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: 0.12 });
  // (craft-art-1) THE CRAFTING THINGS' MATERIAL: as `tinted`, but each vertex glows a little in its OWN colour, as the
  // boxes' `flat` does. With `tinted` (a white glow) every drawn prop held at night came out grey, the carton too (the
  // energy drink's boxes kept their blue): a bag of Zonk must still be blue by night
  const own = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: 0.3 });
  own.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n\ttotalEmissiveRadiance *= vColor.rgb;\n#endif');
  };
  own.customProgramCacheKey = () => 'hk2-things-own';
  // (the kinds of material drawn once now, out of the picture: their programs are not built in the middle of the
  // first deal: fight/puppet/gunmesh.js warmMaterials)
  warmMaterials(city, [flat(NOTE), tinted, own]);
  // THE KIT'S PIECES, built once each from the kit's own code (as the crib builds its door's locks: demo/stage/set/crib.js)
  const CITY = new URL('../../../city/from-trunk/style/city/', import.meta.url).href;
  let kitMods = null;
  const kitGeo = new Map();
  /** A home piece's geometry, built once: a promise of its layers, each centred on the piece's own middle. */
  function kitLayers(id) {
    if (!kitGeo.has(id)) {
      kitMods ??= Promise.all([import(`${CITY}interiors/home/index.js`), import(`${CITY}vox.js`), import(`${CITY}glue.js`)]);
      kitGeo.set(id, kitMods.then(([HO, V, G]) => {
        const o = HO.byId.get(id);
        if (!o) return [];
        const b = new V.Bank(true);
        V.meshVol(HO.buildObject(o, { variant: 0 }), b);
        const layers = b.L.map(O => (O.v ? G.geoOf(O) : null)).filter(Boolean);
        const box = new THREE.Box3();
        for (const g of layers) {
          g.computeBoundingBox();
          box.union(g.boundingBox);
        }
        const c = box.getCenter(new THREE.Vector3());
        for (const g of layers) g.translate(-c.x, -c.y, -c.z);
        return { layers, size: box.getSize(new THREE.Vector3()).toArray() };
      }).catch(err => {
        console.warn('[hands] the piece did not build:', id, err);
        return { layers: [], size: [0, 0, 0] };
      }));
    }
    return kitGeo.get(id);
  }
  function make(kind) {
    const K = KINDS[kind] ?? KINDS[kitKind(kind) ?? 'find'] ?? KINDS.find;
    const g = new THREE.Group();
    const inner = new THREE.Group();
    const parts = [];
    let end = null;
    if (K.prop) {
      const layers = propGeometry(THREE, K.prop) ?? [];
      const box = new THREE.Box3();
      for (const geo of layers) {
        if (!geo) continue;
        // (join-2: every drawn prop wears `own`, the carton and the pack too: with `tinted` they went grey in a hand by
        // night; the owner was told and did not object)
        const m = new THREE.Mesh(geo, own);
        m.castShadow = true;
        inner.add(m);
        geo.computeBoundingBox?.();
        if (geo.boundingBox) box.union(geo.boundingBox);
      }
      // (the prop stands on the ground under its middle: held, its middle is at the hand)
      if (!box.isEmpty()) inner.children.forEach(m => m.position.set(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2));
    } else if (K.kit) {
      // (the piece turned so its own axes are the held thing's: KINDS basis; on the ground, as it stands)
      const turn = new THREE.Group();
      if (K.basis) {
        const [ex, ey, ez] = K.basis;
        turn.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(ex[0], ex[1], ex[2], 0, ey[0], ey[1], ey[2], 0, ez[0], ez[1], ez[2], 0, 0, 0, 0, 1));
      }
      inner.add(turn);
      kitLayers(K.kit).then(({ layers, size }) => {
        for (const geo of layers) {
          const m = new THREE.Mesh(geo, tinted);
          m.castShadow = true;
          turn.add(m);
        }
        // (a piece for a wall, carried: on a plank of the door's own wood, as it came off one. Its own bits (a bolt, a
        // chain, a knob) are apart on a door; held, they read as specks, not one thing)
        if (K.plank) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(size[0] + 0.03, size[1] + 0.04, PLANK), flat(WOOD));
          m.position.set(0, 0, -size[2] / 2 - PLANK / 2);
          m.castShadow = true;
          turn.add(m);
        }
      });
    } else {
      for (const [k, [x0, x1, y0, y1, z0, z1, c]] of K.boxes.entries()) {
        const burnsEnd = K.burn?.end === k;
        // (the lit end its own: it glows)
        const mat = burnsEnd ? new THREE.MeshLambertMaterial({ color: c, emissive: 0xff5a1a, emissiveIntensity: 0 }) : flat(c);
        const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
        m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
        m.castShadow = true;
        inner.add(m);
        parts.push({ m, z0, z1 });
        if (burnsEnd) end = { m, mat, c };
      }
    }
    inner.rotation.set(...(K.turn ?? [0, 0, 0]));
    inner.position.set(...K.at);
    g.add(inner);
    g.name = `hk2:thing:${kind}`;
    city.scene.add(g);
    return { g, K, parts, end };
  }
  /** Burnt down (0 to 0.7 of the paper gone) and lit (the end glowing by `glow`). */
  function burnTo(M, T) {
    const B = M.K.burn;
    if (!B) return;
    let tip = 0;
    for (const k of [].concat(B.paper)) {
      const paper = M.parts[k];
      const len = (paper.z1 - paper.z0) * (1 - 0.7 * (T.burn ?? 0));
      paper.m.scale.z = len / (paper.z1 - paper.z0);
      paper.m.position.z = paper.z0 + len / 2;
      tip = Math.max(tip, paper.z0 + len);
    }
    if (B.end === undefined) return;
    const E = M.parts[B.end];
    E.m.position.z = tip + (E.z1 - E.z0) / 2;
    if (M.end) {
      const lit = (T.lit ?? 0) > 0.5;
      M.end.mat.color.setHex(lit ? 0x8a2a14 : M.end.c);
      M.end.mat.emissiveIntensity = lit ? 0.6 + 1.6 * (T.glow ?? 0) : 0;
    }
  }
  // WHAT NOBODY HOLDS (moves.js at(t).fx): smoke breathed out, three grey cubes growing and thinning as they rise; a
  // lighter's flame, a yellow tongue in an orange one
  const air = new Map();
  // (white and lit from inside, so it reads on the city's pale pavements, which are nearly its own grey)
  const puffMat = () => new THREE.MeshLambertMaterial({ color: 0xf4f6fa, emissive: 0xe8ecf4, emissiveIntensity: 0.75, transparent: true, opacity: 0.9, depthWrite: false });
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const flameMats = [new THREE.MeshBasicMaterial({ color: 0xff8a1e }), new THREE.MeshBasicMaterial({ color: 0xfff27a })];
  function airOf(key, X) {
    const id = `${key}|${X.kind}|${X.i}`;
    let A = air.get(id);
    if (!A) {
      const g = new THREE.Group();
      const mat = X.kind === 'puff' ? puffMat() : null;
      const bits = X.kind === 'puff' ? [0, 1, 2].map(() => new THREE.Mesh(cube, mat)) : X.kind === 'hair' ? [0, 1, 2].map(() => new THREE.Mesh(cube, flat(0x2a1a12))) : flameMats.map(m => new THREE.Mesh(cube, m));
      for (const b of bits) g.add(b);
      g.name = `hk2:air:${X.kind}`;
      city.scene.add(g);
      A = { g, bits, mat, key };
      air.set(id, A);
    }
    return A;
  }
  const X = new THREE.Vector3();
  const Y = new THREE.Vector3();
  const Z = new THREE.Vector3();
  const M4 = new THREE.Matrix4();
  return {
    show(id, T) {
      let M = live.get(id);
      if (!M || M.kind !== T.kind) {
        if (M) city.scene.remove(M.g);
        M = { kind: T.kind, ...make(T.kind) };
        live.set(id, M);
      }
      // (out of a pocket it grows into the hand over a tenth of a second; put away, it shrinks where it went)
      const k = T.show ? Math.min(1, (T.since ?? 1) / 0.1) : Math.max(0, 1 - (T.since ?? 1) / 0.12);
      M.g.visible = k > 0.02;
      if (!M.g.visible) return;
      Z.set(T.dir[0], T.dir[1], T.dir[2]).normalize();
      Y.set(T.up[0], T.up[1], T.up[2]);
      X.crossVectors(Y, Z);
      if (X.lengthSq() < 1e-6) X.set(1, 0, 0);
      X.normalize();
      Y.crossVectors(Z, X);
      M4.makeBasis(X, Y, Z);
      M.g.quaternion.setFromRotationMatrix(M4);
      M.g.position.set(T.at[0], T.at[1], T.at[2]);
      burnTo(M, T);
      const cam = city.camera?.position;
      const far = SIZE_BY_DISTANCE.on && cam ? Math.min(SIZE_BY_DISTANCE.most, Math.max(SIZE_BY_DISTANCE.least, Math.hypot(cam.x - T.at[0], cam.y - T.at[1], cam.z - T.at[2]) / SIZE_BY_DISTANCE.at)) : 1;
      M.g.scale.setScalar(k * (M.K.size ?? 1) * (T.scale ?? 1) * far);
    },
    /** The smoke and the flames of a deal (`key`) at this moment: what is not in the list is not drawn. */
    fx(key, list = []) {
      const on = new Set();
      for (const F of list) {
        const A = airOf(key, F);
        on.add(A);
        A.g.visible = true;
        A.g.position.set(F.at[0], F.at[1], F.at[2]);
        if (F.kind === 'hair') {
          for (const [j, b] of A.bits.entries()) {
            b.position.set((j - 1) * 0.05, j * 0.03, ((j * 7) % 3) * 0.02);
            b.scale.setScalar(0.035);
          }
          continue;
        }
        if (F.kind === 'puff') {
          // (each cube its own way out from the middle, growing; the cloud thinning to nothing)
          const s = 0.15 + 0.26 * F.k;
          for (const [j, b] of A.bits.entries()) {
            if (j >= F.n) {
              b.visible = false;
              continue;
            }
            b.visible = true;
            const a = F.i * 2.1 + j * 2.4;
            b.position.set(Math.cos(a) * 0.09 * (1 + 2 * F.k), j * 0.07 * (1 + F.k), Math.sin(a) * 0.09 * (1 + 2 * F.k));
            b.scale.setScalar(s * (1 - 0.2 * j));
            b.rotation.set(a, a * 0.7, 0);
          }
          A.mat.opacity = 0.95 * Math.min(1, 1.6 * (1 - F.k)) * Math.min(1, F.k * 8);
        } else {
          // (a flicker: up and down a little, every frame its own)
          const f = 1 + 0.25 * Math.sin(F.k * 40 + F.i);
          const grow = Math.min(1, F.k * 8) * Math.min(1, (1 - F.k) * 6);
          A.bits[0].scale.set(0.05 * grow, 0.11 * f * grow, 0.05 * grow);
          A.bits[0].position.set(0, 0.055 * f * grow, 0);
          A.bits[1].scale.set(0.026 * grow, 0.07 * f * grow, 0.026 * grow);
          A.bits[1].position.set(0, 0.04 * f * grow, 0.012);
        }
      }
      for (const A of air.values()) if (A.key === key && !on.has(A)) A.g.visible = false;
    },
    hide(id) {
      const M = live.get(id);
      if (M) M.g.visible = false;
    },
    /** Takes off the stage every thing (and its smoke) whose id starts with `prefix` (all of them, with none). */
    clear(prefix = '') {
      for (const [id, M] of live) {
        if (!id.startsWith(prefix)) continue;
        city.scene.remove(M.g);
        live.delete(id);
      }
      for (const [id, A] of air) {
        // (a deal's smoke is `${key}|kind|n`, its key the deal's prefix: it went on the scene and was only hidden before)
        if (!id.startsWith(prefix)) continue;
        city.scene.remove(A.g);
        A.mat?.dispose();
        air.delete(id);
      }
    },
    /** A kind's look ready to draw (a home piece is built the first time it is asked for). */
    ready(kind) {
      const K = KINDS[kind] ?? KINDS[kitKind(kind) ?? ''];
      return K?.kit ? kitLayers(K.kit).then(() => {}) : Promise.resolve();
    },
    get shown() {
      return [...live.entries(), ...[...air.entries()].map(([id, A]) => [id, A])].filter(([, M]) => M.g.visible).map(([id]) => id);
    },
  };
}
