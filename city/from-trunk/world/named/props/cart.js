// THE MAN WITH THE SHOPPING CART · his cart (people/cart.js: "His cart, rattling with cans, is a prop that walks with him, not
// something in his hand"). A wire basket on a frame, four small casters, a push handle; heaped with crushed cans, a stuffed black bin
// bag in the front, a white carrier bag of cans tied to its right side; a little battered (a dent in the left rim, a wire gone and one
// bowed, rust on the base, the left front caster turned sideways). His one touch: a mustard rag (his hat's colour) knotted on the handle.
// The cans carry no brand, lettering or logo: flat colours and bare aluminium.
//
// Drawn at the HALF GRAIN of the shared figure (0.025 m, the grain of a face's fine voxels; the pool builds it at its owner's scale,
// index.js § PROPS), in half cells about its own origin: x across (x and −1 − x a mirror pair, as on the figure), y up from the
// ground, z along it, its nose toward +z, the handle at the back (−z). What reads at the game's size is the FRAME, drawn a whole
// figure-voxel thick (two half cells: the rim, the bottom edge, the corner posts, the base, the handle): it draws the basket's
// outline, the gap under it and the handle as lines two or three pixels wide. The mesh between is one half cell: a light veil over
// the cans at that size, wire up close. The basket is long and narrow and narrows to its nose, as a cart's does (a square one read as
// a crate); the handle is wider than the basket, its uprights flaring out to his fists.
import { shade, lerpHex, hash3 } from '../kit.js';

// ── colours (flat: no lettering anywhere). Steel is drawn glossy, not on the metal layer: metal mirrors the sky and the cart came out blue.
const STEEL = 0x6c7480, WIRE = 0x838b96, PLASTIC = 0x3a3e46, TYRE = 0x25252b, HUB = 0x9aa1aa, RUST = 0x8e5a36;
const MUSTARD = 0xb8962e;   // his hat's (people/cart.js MUSTARD): the one thing of his own on it
const BAG = 0x1e1f24, BAG_HI = 0x3d3f48, SACK = 0xe6e6de, SACK_D = 0xcacccc;
const ALU = [0xe2e5e9, 0xaeb4bc], DEEP = 0x4c5058;
const PAINT = [0xc04a40, 0x4a7d55, 0x4a6aa0, 0xe6e4dc, 0x2e3646, 0xc98040];
const MATTE = 0, GLOSS = 1;
const r01 = (x, y, z, s = 0) => hash3(x + s * 131, y + s * 17, z) / 4294967296;

// ── the basket's plan: the outer column of the left wall at z (the right wall is its mirror, −1 − x), 24 half cells wide at the back,
// 16 at the nose; 37 long, its back wall 5 in front of the handle (his shins clear its bottom edge at a full stride)
const ZB = -17, ZN = 20, RIM = 22, BOT = 10, HB = 12, HF = 8;
const edge = z => -HB + Math.round((Math.max(ZB, Math.min(ZN, z)) - ZB) * (HB - HF) / (ZN - ZB));
// the sloped front wall: its z at height y (the bottom's front edge 4 short of the rim's)
const front = y => ZN - 4 + Math.round((Math.max(BOT, Math.min(RIM + 1, y)) - BOT) * 4 / 13);
// the base rails' outer column (straight: under the basket's back, its casters peeping out past the narrow nose)
const rail = () => -11;

// a 6-connected run of cells from a to b (each step moves one axis: a thin wire never breaks at a corner)
function path(a, b) {
  const d = [0, 1, 2].map(i => b[i] - a[i]), n = d.map(Math.abs), s = d.map(Math.sign), p = a.slice(), out = [p.slice()], done = [0, 0, 0];
  for (let k = n[0] + n[1] + n[2]; k > 0; k--) { let best = -1, bv = Infinity; for (let i = 0; i < 3; i++) if (done[i] < n[i]) { const v = (done[i] + .5) / n[i]; if (v < bv) { bv = v; best = i; } }
    p[best] += s[best]; done[best]++; out.push(p.slice()); }
  return out;
}

function draw(C) {
  const put = (x, y, z, c, l = GLOSS) => C.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l);
  const both = (x, y, z, c, l) => { put(x, y, z, c, l); put(-1 - x, y, z, c, l); };
  // a frame member: a 2 × 2 × 2 brush (one figure voxel) at each cell of the run; mirrored when `m`
  const bar = (x, y, z, c, l = GLOSS, m = true) => { for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let e = 0; e < 2; e++) (m ? both : put)(x + a, y + b, z + e, c, l); };
  const rod = (a, b, c, l = GLOSS, m = true) => { for (const [x, y, z] of path(a, b)) bar(x, y, z, c, l, m); };
  const wire = (a, b, c = WIRE, m = true) => { for (const [x, y, z] of path(a, b)) (m ? both : put)(x, y, z, c, GLOSS); };
  // rust in patches along the base (a run of a few cells, not a speckle)
  const rusty = c => (x, y, z) => r01(x < 0 ? 0 : 1, 0, z >> 2, 7) < .3 && r01(x, y, z, 8) < .7 ? RUST : c;

  // ── THE CASTERS: a dark tyre four half cells round on a grey hub, a fork up into the base. (x0, z0): the low corner of the fork;
  // the wheel runs along z (true) or along x (swung sideways). Its contact patch is the fork's footprint either way.
  const caster = (x0, z0, along, m) => {
    for (let i = 0; i < 4; i++) for (let y = 0; y < 4; y++) { if ((i === 0 || i === 3) && (y === 0 || y === 3)) continue; const hub = y >= 1 && y <= 2 && i >= 1 && i <= 2;
      for (let w = 0; w < 2; w++) (m ? both : put)(along === 'z' ? x0 + w : x0 - 1 + i, y, along === 'z' ? z0 - 1 + i : z0 + w, hub ? HUB : TYRE, hub ? GLOSS : MATTE); }
    for (let a = 0; a < 2; a++) for (let e = 0; e < 2; e++) (m ? both : put)(x0 + a, 4, z0 + e, HUB, GLOSS);
  };
  caster(rail(), -15, 'z', true);                                           // the back pair, under the rails' back ends
  caster(-1 - rail(17) - 1, 16, 'z', false); caster(rail(17), 16, 'x', false);   // the front pair: the right one runs true, the left one has swung

  // ── THE BASE: a U of tube open at the back (carts nest), two rails and a front cross, rusting; a wire tray on it. It starts under
  // the basket's back, not behind it: his toes reach under the basket at a full stride (check.mjs § 6)
  for (let z = -15; z <= 17; z++) bar(rail(z), 5, z, rusty(STEEL));
  for (let x = rail(17); x <= -1; x++) bar(x, 5, 17, rusty(STEEL));
  for (const x of [-5]) wire([x, 7, -14], [x, 7, 14]);
  for (const z of [-14, 14]) wire([rail(z) + 1, 7, z], [-1, 7, z]);
  // the rear posts: from the rails' back ends slanting back up to the basket's back corners; the handle's uprights flare out from there
  rod([rail(), 7, -15], [edge(ZB), RIM - 1, ZB - 1], STEEL);
  rod([-HB, RIM, ZB], [-18, 25, -23], STEEL);
  // the front legs: straight up from the front cross to the basket's bottom front corners
  for (let y = 5; y <= BOT - 1; y++) bar(edge(front(BOT) - 1) - 1, y, front(BOT), STEEL);

  // ── THE BASKET. The frame a figure-voxel thick: the rim (dented on the left), the bottom edge, the four corner posts
  for (let z = ZB; z <= ZN - 1; z++) { bar(edge(z), z >= 1 && z <= 5 ? RIM - 1 : RIM, z, STEEL, GLOSS, false); bar(-2 - edge(z), RIM, z, STEEL, GLOSS, false); }
  for (let x = edge(ZB); x <= -1; x++) bar(x, RIM, ZB, STEEL);
  for (let x = edge(ZN - 1); x <= -1; x++) bar(x, RIM, ZN - 1, STEEL);
  for (let z = ZB; z <= front(BOT) - 1; z++) bar(edge(z), BOT, z, STEEL);
  for (let x = edge(ZB); x <= -1; x++) bar(x, BOT, ZB, STEEL);
  for (let x = edge(front(BOT) - 1); x <= -1; x++) bar(x, BOT, front(BOT) - 1, STEEL);
  for (let y = BOT; y <= RIM; y++) { bar(edge(ZB), y, ZB, STEEL); bar(edge(front(y) - 1), y, front(y) - 1, STEEL); }
  // the mesh, one half cell: on the sides, uprights every four and a rail between the bottom edge and the rim (the side's outer
  // column steps in toward the nose, so each rail gets a joining cell at a step). One upright is gone on the left; one is bowed out.
  for (let z = ZB + 4; z <= front(BOT) - 4; z += 4) for (let y = BOT + 2; y <= RIM - 1; y++) {
    if (z === ZB + 20) { put(-1 - edge(z), y, z, WIRE); continue; }                            // (gone on the left)
    const bow = z === ZB + 8 && y >= 14 && y <= 18 ? -1 : 0; put(edge(z) + bow, y, z, WIRE); put(-1 - edge(z), y, z, WIRE);
    if (bow && (y === 14 || y === 16 || y === 18)) put(edge(z), y, z, WIRE); }
  for (const y of [16]) for (let z = ZB + 1; z <= front(y) - 2; z++) { const a = edge(z), b = edge(z + 1); both(a, y, z, WIRE); if (b !== a) both(b, y, z, WIRE); }
  // the back (the gate) and the sloped front: uprights every four or five, and the same rail
  for (const x of [-3, -7]) wire([x, BOT + 2, ZB], [x, RIM - 1, ZB]);
  for (const x of [-4]) wire([x, BOT + 2, front(BOT + 2)], [x, RIM - 1, front(RIM - 1)]);
  for (const y of [16]) { for (let x = edge(ZB) + 2; x <= -1; x++) both(x, y, ZB, WIRE); for (let x = edge(front(y)) + 1; x <= -1; x++) both(x, y, front(y), WIRE); }
  // (the bottom's grid is not drawn: the cans cover it from above, and nothing in the city looks from below)

  // ── THE HANDLE: a bar through both his fists (index.js PROPS: at his hands in the city's two-hand hold), grey plastic over steel.
  // Straight where the fists hold it (x −16..15); between them it bows forward, round his long beard (people/cart.js: it hangs to his
  // third button, and the hold's fists sit just in front of it)
  const hz = x => x <= -11 ? -23 : x === -10 ? -22 : x === -9 ? -21 : -20;
  for (let x = -18; x <= -1; x++) bar(x, 25, hz(x), x >= -15 ? PLASTIC : STEEL);
  for (let y = 25; y <= 26; y++) for (let z = -23; z <= -22; z++) put(-13, y, z, STEEL);   // (a crack in the plastic, bare steel)

  // ── THE BIN BAG, stuffed, in the front of the basket, bulging over the rim; knotted on top
  const inside = (x, y, z) => { const e = edge(z) + (y >= RIM - 1 ? 2 : 1); return x >= e && x <= -1 - e && z >= ZB + (y >= RIM ? 2 : 1) && z <= front(y) - (y >= RIM ? 2 : 1) && y > BOT + 1; };
  const over = (x, y, z) => y >= RIM + 2 && x >= edge(z) && x <= -1 - edge(z) && z >= ZB && z <= ZN;
  const bag = [.5, 25, 12], br = [6.8, 6.6, 6.4];
  for (let x = -9; x <= 9; x++) for (let y = 16; y <= 33; y++) for (let z = 4; z <= 20; z++) {
    const u = (x + .5 - bag[0]) / br[0], v = (y + .5 - bag[1]) / br[1], w = (z + .5 - bag[2]) / br[2], q = u * u + v * v + w * w + (r01(x >> 2, y >> 2, z >> 2, 3) - .5) * .14;
    if (q > 1 || !(inside(x, y, z) || over(x, y, z)) || C.has(x, y, z)) continue;
    put(x, y, z, q > .72 && v > .25 && u + w > -.2 ? BAG_HI : BAG); }
  for (const [x, y, z] of [[0, 31, 12], [1, 31, 12], [0, 31, 13], [1, 31, 13], [0, 32, 12], [1, 32, 13], [-1, 32, 12], [2, 32, 13], [-1, 33, 12], [2, 33, 13]]) put(x, y, z, BAG);

  // ── THE CANS: the basket filled to a mound, crushed cans packed in layers (lying along z, then along x), mostly bare aluminium, some
  // in a flat colour with a bare end; dark where the heap's gaps show. The mound meets the walls just under the rim, so the rim stands
  // round it as a lip: the basket's outline at the game's size
  const top = (x, z) => { const u = (x + .5) / -edge(z), v = (z + 4) / 22;
    return RIM - 1 + Math.round(9 * (1 - u * u) * (1 - .6 * v * v) + (r01(x >> 2, 0, Math.floor(z / 6), 9) - .5) * 2.4); };
  const canOf = (x, y, z) => { const L = (y - BOT - 2) >> 1, alongZ = !(L & 1), off = L * 2 + 40;
    const i = alongZ ? (x + 40) >> 1 : Math.floor((x + off) / 3), k = alongZ ? Math.floor((z + off) / 3) : (z + 40) >> 1;
    const id = hash3(i * 7 + 3, L * 13 + 1, k * 11 + (alongZ ? 5 : 9)) / 4294967296, end = (alongZ ? z + off : x + off) % 3 === 2;
    if (id < .1) return DEEP;
    if (id < .7) return id < .3 ? ALU[0] : ALU[1];
    return end ? ALU[0] : PAINT[(id * 131 | 0) % PAINT.length]; };
  for (let z = ZB + 1; z <= ZN; z++) for (let x = edge(z) + 1; x <= -2 - edge(z); x++) { const t = top(x, z);
    for (let y = BOT + 2; y <= t; y++) { if (!(inside(x, y, z) || (y > RIM + 1 && over(x, y, z) && x > edge(z) + 1 && x < -2 - edge(z))) || C.has(x, y, z)) continue; put(x, y, z, canOf(x, y, z)); } }
  // loose cans thrown on top: upright (a bare top) or lying, crushed flat
  for (let n = 0; n < 16; n++) { const x = Math.round((r01(n, 1, 2, 11) - .5) * 16) - 1, z = -17 + Math.round(r01(n, 3, 4, 12) * 22), up = r01(n, 5, 6, 13) < .4;
    let y = 36; while (y > BOT && !C.has(x, y - 1, z)) y--; if (y > 33 || !inside(x, Math.min(y, RIM - 1), z)) continue;
    const id = r01(n, 7, 8, 14), body = id < .55 ? ALU[0] : PAINT[(id * 131 | 0) % PAINT.length];
    if (up) { for (let a = 0; a < 2; a++) for (let e = 0; e < 2; e++) { put(x + a, y, z + e, body); put(x + a, y + 1, z + e, body); put(x + a, y + 2, z + e, a + e === 1 ? ALU[1] : ALU[0]); } }
    else { const ax = r01(n, 9, 1, 15) < .5; for (let k = 0; k < 3; k++) for (let a = 0; a < 2; a++) put(ax ? x + k : x + a, y, ax ? z + a : z + k, k === 1 ? body : ALU[1]); } }

  // ── THE CARRIER BAG of cans, tied by its handles to the right side's rim, hanging outside: cans pressing through the white
  const sk = [14, 15, -8], sr = [3, 5.4, 4.2], wall = z => -1 - edge(z);
  for (let x = 9; x <= 19; x++) for (let y = 8; y <= 21; y++) for (let z = -14; z <= -2; z++) {
    if (x <= wall(z)) continue; const u = (x + .5 - sk[0]) / sr[0], v = (y + .5 - sk[1]) / sr[1], w = (z + .5 - sk[2]) / sr[2], q = u * u + v * v * (v > 0 ? .9 : 1.1) + w * w;
    if (q > 1 || C.has(x, y, z)) continue; const r = r01(x, y, z, 16);
    put(x, y, z, r < .13 ? lerpHex(SACK, ALU[1], .6) : r < .17 ? lerpHex(SACK, PAINT[(r * 997 | 0) % PAINT.length], .3) : q > .75 ? SACK_D : SACK); }
  for (const z of [-10, -6]) for (let y = 19; y <= 22; y++) put(wall(z) + 1, y, z, SACK);

  // ── HIS RAG: mustard, knotted over the handle's bow left of the middle (between his hands), its ends hanging down its front, toward
  // the basket (behind the bar is his beard)
  const rag = (x, y, z) => r01(x, y, z, 21) < .35 ? shade(MUSTARD, .82) : MUSTARD;
  for (let x = -7; x <= -4; x++) { for (const z of [-20, -19]) { put(x, 27, z, rag, MATTE); put(x, 24, z, rag, MATTE); } for (let y = 24; y <= 27; y++) put(x, y, -18, rag, MATTE); }
  for (const [x, y0] of [[-7, 20], [-6, 18], [-5, 21], [-4, 19]]) for (let y = y0; y < 24; y++) put(x, y, -18, rag, MATTE);
}

export default {
  key: 'cart', owner: 'cart', name: 'His shopping cart',
  line: 'A wire shopping cart heaped with crushed cans, a stuffed black bin bag in the front, a white bag of cans tied to its side; a dented rim, a wire gone, rust on the base, one front caster turned sideways; a mustard rag knotted on the handle.',
  // where it goes: with him (pushed in front of him in the city's two-hand hold, or standing beside him)
  goes: 'with',
  grain: 0.025,   // half the shared figure's block, built at the owner's scale (index.js)
  // in half cells (continuous: a cell x spans [x, x + 1)): the middle of the handle where the fists take it (span: its straight part, the
  // fists' width), the hold it is drawn for, and where each caster meets
  // the ground (the middle of its contact patch); index.js turns them into metres and finds where he stands to push it
  handle: { at: [0, 26, -22], span: [-16, 16], hold: 'both' },
  wheels: [[-10, 0, -14], [10, 0, -14], [-10, 0, 17], [10, 0, 17]],
  // standing still: where its origin is from his feet, beside him at his left hand (his +x), the same way round, its handle by his hand
  park: [36, 0, 20],
  box: { x: [-20, 19], y: [0, 38], z: [-26, 22] },
  draw,
};
