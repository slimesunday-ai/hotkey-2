// Home objects · lived-in clutter (free rotation): pizza boxes, a laundry pile, a box fan, kicked-off sneakers. Seeds make every
// pile its own: no two heaps alike.
import { def, K, pick, cyl, line, glow, LIT, shade, mix, rng, hash, txtTop, M3, sneaker, fdisc, frect, ftxt, fsurf } from './lib.js';

export const pizzaBoxes = def({ id: 'pizza-boxes', name: 'Pizza boxes', cat: 'clutter', place: 'floor', foot: [2, 2], h: 0.5, rot: 45,
  tiers: ['trailer', 'apartment', 'house'], tags: ['clutter', 'late night', 'takeout'], variants: 3, vnames: ['stack of 3', 'stack of 5', 'one open'],
  build(V, { variant = 0, seed = 1 } = {}) {
    // THIRD PASS · the same stack of boxes; their print, edges and the open one's slice painted (fine)
    const r = rng(seed * 53 + 3), CB = 0xc98a4b, W = 0xf2efe6;
    const box = (x0, y, z0) => { V.box(x0, y, z0, x0 + 9, y + 1, z0 + 9, CB); V.box(x0 + 1, y, z0 + 1, x0 + 8, y + 1, z0 + 8, W); };
    if (variant < 2) { const n = variant ? 5 : 3; for (let k = 0; k < n; k++) box((r() * 2) | 0, k, (r() * 2) | 0); return; }
    box(0, 0, 1); const x0 = 1, z0 = 1, y = 1; V.box(x0, y, z0, x0 + 9, y + 1, z0 + 9, CB); V.box(x0 + 1, y, z0 + 1, x0 + 8, y + 1, z0 + 8, W);   // the open box on another
    V.box(x0 + 1, y + 1, z0 + 1, x0 + 8, y + 2, z0 + 8, -1);
    for (let x = 0; x < 7; x++) for (let z = 0; z < 7; z++) { const dx = x - 3, dz = z - 3, d = Math.hypot(dx, dz), a = Math.atan2(dz, dx); if (d > 3.4 || !(a > .2 && a < 1.6)) continue;   // a slice and a half left
      V.set(x0 + 1 + x, y + 1, z0 + 1 + z, d > 2.6 ? 0xd9a05b : K.yellow); }
    V.box(x0, y, 0, x0 + 9, y + 9, 1, CB); V.box(x0 + 1, y + 2, 0, x0 + 8, y + 8, 1, W);                                     // the lid up
  },
  fine(P, { variant = 0, seed = 1, V } = {}) {
    // the top lid: a red ring and a pie in it, PIZZA under it, a grease spot, a receipt taped on; the box edges' corrugation
    const r = rng(seed * 53 + 3), CB = 0xc98a4b;
    if (variant < 2) {
      let top = 0; for (let y = V.ny - 1; y >= 0 && !top; y--) for (let x = 0; x < V.nx && !top; x++) for (let z = 0; z < V.nz; z++) if (V.has(x, y, z)) { top = y; break; }
      let bx = 9, bz = 9; for (let x = 0; x < V.nx; x++) for (let z = 0; z < V.nz; z++) if (V.has(x, top, z)) { bx = Math.min(bx, x); bz = Math.min(bz, z); }
      fdisc(P, '+y', bx + 4.5, bz + 4.5, 3, d => (d > 2.6 ? K.red : d > 2.3 ? null : d < 1.9 ? (Math.hypot(1, 1) > 0 && ((d * 7) | 0) % 3 === 0 ? 0xc0303a : 0xe8a33a) : null));   // the ring, the pie
      ftxt(P, '+y', 'PIZZA', bx + 2.1, bz + 6.9, K.red);                                                               // its word (read from the front)
      fdisc(P, '+y', bx + 7, bz + 2, .8, 0xd8c08a);                                                                    // a grease spot
      frect(P, '+y', bx + .75, bz + .75, bx + 2.5, bz + 2.75, K.white); for (const z of [1.25, 1.75, 2.25]) frect(P, '+y', bx + 1, bz + z, bx + 2.25, bz + z + .2, 0x8a8e98);   // a receipt
      fsurf(P, V, '+z', 0, 0, 0, V.nx, V.ny, V.nz, (x, y, z, i, j) => (V.pal[V.d[x + z * V.nx + y * V.sxz]] === CB && j === 1 && i % 2 === 0 ? shade(CB, .78) : null));   // the corrugated edges
    } else {
      fsurf(P, V, '+y', 2, 0, 2, 9, V.ny, 9, (x, y, z, i, j) => { const X = x - 1 + (i + .5) / 4 - 3.5, Z = z - 1 + (j + .5) / 4 - 3.5; if (V.pal[V.d[x + z * V.nx + y * V.sxz]] !== K.yellow) return null; for (const [px, pz] of [[1.6, .8], [.6, 1.9], [2.2, 2]]) if (Math.hypot(X - px, Z - pz) < .45) return 0xc0303a; return null; });   // pepperoni, on the cheese
      ftxt(P, '+z', 'HOT', 3.5, 6.5, K.red);                                                                           // the lid's inside: HOT
    }
    void r;
  } });

export const laundryPile = def({ id: 'laundry-pile', name: 'Laundry pile', cat: 'clutter', place: 'floor', foot: [3, 3], h: 0.35, rot: 45,
  tiers: ['trailer', 'apartment', 'house'], tags: ['clutter', 'lived-in', 'bedroom'], variants: 3, vnames: ['darks', 'brights', 'whites + denim'],
  grain: 0.025, shaped: 'a pile of clothes: jeans, a hoodie and a tee draped over each other, folds, a sock',
  grain: 0.025, shaped: 'a pile of clothes: jeans, a hoodie and a tee draped over each other, folds, a sock',
  build(V, { variant = 0, seed = 1 } = {}) {
    // THIRD PASS · real clothes dropped in a heap, each laid over what is under it: a pair of jeans (two legs, the waistband, the
    // seams), a hoodie (body, two sleeves, the hood, its strings), a tee with a print, and a sock fallen off the side
    const [jean, hood, tee, sock] = pick([[0x34508f, K.oxblood, 0xa7a9b1, K.red], [K.cobalt, K.pink, K.yellow, K.lime], [0x4f7ac0, K.white, 0xe6e1d6, 0xa7a9b1]], variant);
    const r = rng(seed * 31 + variant), H = new Float32Array(30 * 30);
    // lay one garment: inside(x, z) → colour or null, its thickness; it drapes over the heap under it (the highest point near it)
    const lay = (fn, th) => { const add = [];
      for (let z = 0; z < 30; z++) for (let x = 0; x < 30; x++) { const c = fn(x + .5, z + .5); if (c === null) continue;
        let base = 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Z = z + dz; if (X >= 0 && Z >= 0 && X < 30 && Z < 30) base = Math.max(base, H[X + Z * 30] - (dx || dz ? .6 : 0)); }
        const fold = Math.sin(x * .7 + z * .35) > .92 ? 1 : 0; add.push([x, z, Math.round(base), th + fold, c]); }
      for (const [x, z, b, t, c] of add) { for (let y = b; y < b + t; y++) V.set(x, y, z, typeof c === 'function' ? c(y - b, t) : c, 0); H[x + z * 30] = Math.max(H[x + z * 30], b + t); } };
    const rot = (x, z, cx, cz, a) => { const c = Math.cos(a), s = Math.sin(a); return [(x - cx) * c + (z - cz) * s, -(x - cx) * s + (z - cz) * c]; };
    // the jeans: two legs from the waist at the back, splayed toward the front
    lay((x, z) => { for (const a of [.35, -.15]) { const [u, v] = rot(x, z, 10, 6, a + Math.PI / 2 - .5); if (u > 0 && u < 21 && Math.abs(v - (a > 0 ? 2.4 : -2.4)) < 2.6) return u < 1.5 ? shade(jean, .8) : Math.abs(v - (a > 0 ? 2.4 : -2.4)) < .4 ? mix(jean, K.white, .3) : u > 19.5 ? mix(jean, K.white, .15) : jean; } return null; }, 2);
    // the hoodie: body, two sleeves out to the sides, the hood at the back
    lay((x, z) => { const [u, v] = rot(x, z, 17, 12, .5); if (Math.abs(u) < 5 && v > -5 && v < 6) return Math.abs(u) < .4 && v < -2 && v > -4.5 ? K.white : v > 4.5 ? shade(hood, .82) : hood;   // body, its strings, the cuff
      if (v > -4.6 && v < -1.2 && Math.abs(u) > 4.5 && Math.abs(u) < 12.5) return Math.abs(u) > 12 ? shade(hood, .82) : hood;   // sleeves
      if (Math.hypot(u, v + 6.5) < 3.6) return shade(hood, .9); return null; }, 2);                                   // the hood
    // the tee, on top, a print on its chest
    lay((x, z) => { const [u, v] = rot(x, z, 10, 19.5, -.4); if (Math.abs(u) < 5 && Math.abs(v) < 5.5) return Math.hypot(u, v + .5) < 2 ? (variant === 1 ? K.purple : K.red) : tee;
      if (v < -2.2 && v > -5.5 && Math.abs(u) < 8.5) return Math.abs(u) > 7.6 ? shade(tee, .85) : tee; return null; }, 1);
    // a sock, half off the heap
    lay((x, z) => { const [u, v] = rot(x, z, 25, 24, .9); return Math.abs(u) < 3.6 && Math.abs(v) < 1.1 ? (u > 2.4 ? K.white : sock) : null; }, 1);
    void r;
  } });

export const boxFan = def({ id: 'box-fan', name: 'Box fan', cat: 'clutter', place: 'floor', foot: [2, 1], h: 0.55, rot: 45,
  tiers: ['trailer', 'apartment', 'house'], tags: ['summer', 'no AC', 'trailer'], variants: 2, vnames: ['white', 'putty'], far: true,
  build(V, { variant = 0 } = {}) {
    // THIRD PASS · the square box keeps its outline; inside it, a dark well the round grille and blades are painted on (fine)
    const c = pick([K.white, 0xcfc8b4], variant);
    for (const x of [1, 7]) V.box(x, 0, 0, x + 2, 1, 5, shade(c, .85));                                                // the feet
    V.box(0, 1, 1, 10, 11, 4, c); V.box(1, 2, 2, 9, 10, 4, -1); V.box(4, 10, 1, 6, 11, 4, -1);                        // the frame, the handle notch
    V.box(1, 2, 2, 9, 10, 3, 0x30333b);                                                                                // the well behind the grille
    V.box(8, 10, 2, 9, 11, 3, K.ink); V.set(8, 11 - 1, 3, -1);                                                          // the speed knob, on the top rail
  },
  fine(P, { variant = 0 } = {}) {
    // the round grille (a ring, three thin rings, eight spokes), the three blades seen through it, the badge on the hub
    const c = pick([K.white, 0xcfc8b4], variant), blade = pick([0x9fb8cc, 0xb8ad94], variant);
    fdisc(P, '+z', 5, 6, 4, (d, th) => {
      if (d > 3.75) return c;                                                                                          // the ring
      if (d < .7) return d < .35 ? K.ink : K.white;                                                                    // the badge
      if ([1.55, 2.4, 3.2].some(r => Math.abs(d - r) < .13)) return shade(c, .9);                                      // the thin rings
      if (Math.abs(((th / (Math.PI / 4)) % 1 + 1) % 1 - .5) > .44 && d > .7) return shade(c, .9);                     // the spokes
      const b = ((th + d * .18) / (2 * Math.PI / 3) % 1 + 1) % 1; return b < .34 ? blade : null;                        // a blade, or the dark between
    });
    frect(P, '+z', 0, 1, 10, 2, shade(c, .92)); frect(P, '+z', 1.5, 1.25, 3.5, 1.75, K.ink);                            // the speed dial strip: 1 2 3
    for (const k of [0, 1, 2]) frect(P, '+z', 6 + k, 1.25, 6.5 + k, 1.75, k === 1 ? K.red : K.ink);
  } });
function cylZ3(V, cx, cy, r, z, c) { for (let x = Math.floor(cx - r - 1); x <= cx + r; x++) for (let y = Math.floor(cy - r - 1); y <= cy + r; y++) if (Math.hypot(x + .5 - cx, y + .5 - cy) <= r) V.set(x, y, z, c); }

export const sneakersKicked = def({ id: 'sneakers-kicked', name: 'Kicked-off sneakers', cat: 'clutter', place: 'floor', foot: [2, 2], h: 0.2, rot: 45,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['clutter', 'sneakers', 'doorway'], variants: 3, vnames: ['white + red', 'black + pink', 'cobalt + yellow'],
  grain: 0.0125,
  grain: 0.0125,
  grain: 0.0125,
  build(V, { variant = 0 } = {}) {
    // THIRD PASS · at a quarter of the block: two real sneakers, kicked off: one upright and turned, one on its side, sole to the room.
    // Each: a white sole with a coloured line, a rounded toe cap, the opening at the ankle, a tongue, laces across the vamp, a side
    // stripe and a heel tab (invented, no marks)
    const [a, b] = pick([[K.white, K.red], [K.ink, K.pink], [K.cobalt, K.yellow]], variant), sole = K.white;
    // the shoe in its own frame: t 0 (heel) … 22 (toe), w −4 … 4 across, h 0 … 9 up → colour or null
    const shoe = (t, w, h) => {
      if (t < 0 || t > 22) return null;
      const half = t < 3 ? 2.6 + Math.sqrt(Math.max(0, t * (6 - t))) * .5 : t > 18 ? 3.9 * Math.sqrt(Math.max(0, 1 - ((t - 18) / 4.2) ** 2)) : t < 10 ? 3.4 + (t - 3) * .05 : 3.4 + (t - 10) * .06;
      if (Math.abs(w) > half) return null;
      if (h < 0) return null;
      if (h < 1.8) return h < .7 ? (Math.round(t) % 3 ? 0xb9bcc4 : 0x8a8e98) : (h > 1.15 && Math.abs(w) > half - .8 ? b : sole);   // the outsole, the white midsole, its line
      const top = t < 6 ? 8.6 : t < 12 ? 8 - (t - 6) * .15 : 8 - (t - 6) * .15 - (t - 12) * .32;
      if (h > top) return null;
      if (t > 5.5 && t < 11 && h > 6 && Math.abs(w) < half - 1.1) return t > 9 ? a : null;                        // the opening, the tongue's root
      if (t > 15 && h < 4.4) return sole;                                                                          // the toe cap
      if (t > 9.5 && t < 15.5 && h > top - 1.1 && Math.abs(w) < 2.2) return (Math.round(t) % 2 ? (a === K.white ? K.ink : K.white) : shade(a, .8));   // the laces
      if (t < 2.4 && h > 3.4) return b;                                                                              // the heel tab
      const s = h - 2.2 - (t - 2) * .3; if (Math.abs(w) > half - 1.2 && s > -.2 && s < 2.2 && t > 2 && t < 16) return b;   // the side stripe
      return a;
    };
    const put = (x0, z0, ang, side) => { const ca = Math.cos(ang), sa = Math.sin(ang);
      for (let x = 0; x < 40; x++) for (let y = 0; y < 16; y++) for (let z = 0; z < 40; z++) {
        const px = x + .5 - x0, pz = z + .5 - z0, t = px * ca + pz * sa, q = -px * sa + pz * ca;
        const c = side ? shoe(t, (y + .5) - 4.2, 4.2 - q + 4.4) : shoe(t, q, y + .5); if (c !== null) V.set(x, y, z, c, c === sole ? 0 : 1); } };
    put(6, 9, .35, false);                                                                                         // upright, turned a little
    put(12, 29, -.25, true);                                                                                       // on its side, its sole to the room
  } });

export const CLUTTER = [pizzaBoxes, laundryPile, boxFan, sneakersKicked];
