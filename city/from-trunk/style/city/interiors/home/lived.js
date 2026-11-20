// Home objects · HARDENING pass (2026-10-05) · the pieces a room needed to read as lived in, or as empty on purpose: moving boxes, the
// FOR RENT board, a paint kit (fresh paint between tenants), crushed cans, a leaning fit-check mirror, a tall floor vase.
// Base = no stakes: never stolen, no buff (the layouts and the vacant sets use them). Brands and lettering are invented.
import { def, K, pick, cyl, line, shade, rng, txt, M3, prune, lathe, ball, plate, prof, frect, fsurf } from './lib.js';
import { base } from './bits.js';

const CARD = 0xc49a62, CARD_D = 0xa0784a, TAPE = 0xe3cf9e;

// a cardboard box (x0..x1 × y0..y1 × z0..z1): flaps seam across the top, tape down the middle, a marker word on the front
function carton(V, x0, y0, z0, x1, y1, z1, word, ink, seed) {
  V.box(x0, y0, z0, x1, y1, z1, CARD);
  V.box(x0, y1 - 1, z0, x1, y1, z1, shade(CARD, 1.06));                                          // the lid, a shade lighter
  const mx = (x0 + x1) >> 1; V.box(mx, y1 - 1, z0, mx + 1, y1, z1, TAPE); V.box(mx, y1 - 3, z1 - 1, mx + 1, y1, z1, TAPE);   // tape over the seam, down the front
  V.box(x0, y0, z1 - 1, x0 + 1, y1, z1, CARD_D); V.box(x1 - 1, y0, z1 - 1, x1, y1, z1, CARD_D);    // the front's folded edges
  if (word && y1 - y0 >= 6) { const M = M3(word), w = M.w; if (w <= x1 - x0 - 2) txt(V, M, x0 + 1 + (((x1 - x0 - 2 - w) / 2) | 0), y1 - 2, z1 - 1, ink); }
}
export const boxesMoving = def({ id: 'boxes-moving', name: 'Moving boxes', cat: 'clutter', place: 'floor', foot: [3, 3], h: 0.8, rot: 45,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['moving', 'vacant', 'day one', 'clutter'], variants: 3, vnames: ['two high', 'three high', 'one open'], far: true,
  game: base(),
  build(V, { variant = 0, seed = 1 } = {}) {
    const r = rng(seed * 17 + variant), W = ['KIX', 'TV', 'BKS', 'MOM', 'ETC', 'PAN'];
    const word = k => W[(seed * 7 + k * 3 + variant) % W.length];
    if (variant === 2) {                                                                         // one open: flaps up, a hoodie and a pan inside
      carton(V, 1, 0, 1, 14, 8, 14, word(0), K.ink, seed); V.box(2, 7, 2, 13, 8, 13, -1);
      V.box(2, 5, 2, 13, 7, 13, shade(CARD, .7)); V.ell(5, 7, 6, 3, 1.2, 3, K.red); cyl(V, 10, 9, 2.2, 7, 8, K.gun, 2); V.box(10, 7, 11, 11, 8, 14, K.gun, 2);
      V.box(1, 8, 1, 14, 12, 2, shade(CARD, 1.06)); V.box(1, 8, 13, 14, 11, 14, CARD); return; }   // the back flap up, the front flap half up
    const n = variant ? 3 : 2; let y = 0;
    for (let k = 0; k < n; k++) { const w = 13 - k * 2 - ((r() * 2) | 0), d = 12 - k * 2, ox = 1 + ((15 - 1 - w) >> 1) + ((r() * 3) | 0) - 1, oz = 1 + ((14 - d) >> 1), h = k === 2 ? 4 : 6;
      carton(V, Math.max(0, ox), y, oz, Math.min(15, ox + w), y + h, oz + d, word(k), k === 1 ? K.red : K.ink, seed + k); y += h; }
  } });

// the FOR RENT board, leaning on its strut: trailer = hand-lettered cardboard, apartment = the red hardware-store sign, house = the realtor's
export const signRent = def({ id: 'sign-rent', name: 'FOR RENT board', cat: 'decor', place: 'floor', foot: [4, 1], h: 0.75, rot: 90,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['vacant', 'for rent', 'sign'], variants: 3, vnames: ['cardboard 4 RENT', 'red FOR RENT', 'KEYMASTER realty'], far: true,
  game: base(),
  build(V, { variant = 0 } = {}) {
    const [bg, fg, edge] = pick([[CARD, K.ink, CARD_D], [K.red, K.white, K.white], [K.navy, K.white, K.gold]], variant);
    V.box(0, 1, 2, 20, 15, 4, bg); V.box(0, 1, 2, 20, 15, 3, shade(bg, .8));                         // the board (2 thick, its back a shade down), front at +z
    if (variant) { V.box(0, 14, 3, 20, 15, 4, edge); V.box(0, 1, 3, 20, 2, 4, edge); V.box(0, 1, 3, 1, 15, 4, edge); V.box(19, 1, 3, 20, 15, 4, edge); }
    for (const x of [2, 17]) V.box(x, 0, 1, x + 1, 1, 4, shade(bg, .7));                               // the feet
    V.box(9, 0, 0, 11, 12, 1, K.woodD); V.box(9, 11, 1, 11, 12, 2, K.woodD);                             // the strut behind
    if (variant === 0) { txt(V, M3('4'), 4, 13, 3, K.red); V.box(9, 12, 3, 17, 13, 4, K.red); txt(V, M3('RENT'), 3, 8, 3, fg); return; }   // marker on cardboard: a red 4 + a dash, the word
    if (variant === 1) { txt(V, M3('FOR'), 5, 13, 3, fg); txt(V, M3('RENT'), 3, 7, 3, fg); return; }
    txt(V, M3('LEASE'), 1, 12, 3, fg); V.box(2, 6, 3, 18, 7, 4, K.gold); txt(V, M3('KEY'), 3, 5, 3, K.gold, 2);   // the realtor: LEASE, a rule, KEY + a little key
    V.box(16, 3, 3, 18, 5, 4, K.gold, 2); V.box(14, 4, 3, 16, 5, 4, K.gold, 2);
  } });

// between tenants: two paint cans (one open, wet white), a roller in its tray, a drip on the floor
export const paintKit = def({ id: 'paint-kit', name: 'Paint cans + roller', cat: 'clutter', place: 'floor', foot: [3, 2], h: 0.35, rot: 45,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['vacant', 'fresh paint', 'clutter'], variants: 2, vnames: ['landlord white', 'bone'], far: true,
  game: base(),
  build(V, { variant = 0 } = {}) {
    const paint = pick([K.white, K.bone], variant);
    cyl(V, 3, 3, 2.6, 0, 6, K.steelL, 2); cyl(V, 3, 3, 2.6, 2, 4, K.red);                                  // can one: a red label band
    cyl(V, 3, 3, 2.6, 6, 7, K.steelL, 2); cyl(V, 3, 3, 1.9, 6, 7, paint, 1);                              // open, wet
    V.box(5, 3, 2, 6, 6, 3, paint, 1);                                                                   // a drip down its side
    cyl(V, 3, 7.4, 2.3, 0, 5, K.steelL, 2); cyl(V, 3, 7.4, 2.3, 2, 4, K.cobalt); cyl(V, 3, 7.4, 2.3, 5, 6, K.steelD, 2);   // can two: lid on
    V.box(8, 0, 1, 15, 1, 9, K.ink); V.box(9, 1, 2, 14, 2, 8, K.ink); V.box(9, 1, 2, 14, 2, 5, paint, 1);   // the tray, paint in its well
    V.box(9, 2, 5, 14, 4, 7, paint); V.box(11, 3, 7, 12, 4, 9, K.steelD, 2); V.box(11, 3, 9, 12, 4, 10, K.amber);   // the roller, its handle
    V.box(6, 0, 7, 9, 1, 9, paint, 1);                                                                  // a splash on the floor
  } });

// a night's crushed cans (free rotation): invented labels, just colour blocks
export const beerCans = def({ id: 'beer-cans', name: 'Crushed cans', cat: 'clutter', place: 'floor', foot: [2, 2], h: 0.15, rot: 45,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['clutter', 'late night', 'party'], variants: 3, vnames: ['DOGG silver', 'red + gold', 'tall greens'],
  game: base(),
  grain: 0.0125,
  build(V, { variant = 0, seed = 1 } = {}) {
    // THIRD PASS · at a quarter of the block: two cans crushed flat on their sides and one stood up, squashed at the waist;
    // round bodies, silver ends, a band of colour, a ring-pull on the standing one
    const [a, b] = pick([[K.steelL, K.cobalt], [K.red, K.gold], [K.green, K.white]], variant), SIL = 0xc9ced6;
    const can = (t, rho, len, r0) => { if (t < 0 || t > len || rho > r0) return null; if (t < .9 || t > len - .9) return rho > r0 - .9 ? SIL : shade(SIL, .8);
      return Math.abs(t - len * .55) < len * .14 ? b : a; };
    // lying along x, crushed in the middle (the waist pinched, the body flattened)
    for (let x = 4; x < 18; x++) for (let y = 0; y < 7; y++) for (let z = 4; z < 14; z++) { const t = x - 4, pinch = 1 - .38 * Math.exp(-(((t - 7) / 2.6) ** 2)), ry = 2.7 * pinch, rz = 2.7 * (2 - pinch);
      const rho = Math.hypot((y + .5 - 2.7) / ry, (z + .5 - 8.6) / rz) * 2.7; const c = can(t, rho, 13, 2.7); if (c !== null && y + .5 < 2 * ry + .2) V.set(x, y, z, c, c === a || c === b ? 1 : 2); }
    // lying along z, stamped flat
    for (let x = 20; x < 34; x++) for (let y = 0; y < 4; y++) for (let z = 18; z < 32; z++) { const t = z - 18, rho = Math.hypot((x + .5 - 26.5) / 1.45, (y + .5 - 1.6) / .62);
      const c = can(t, rho * 2.6 / 2.4, 13, 2.6); if (c !== null && rho <= 2.4) V.set(x, y, z, c, c === a || c === b ? 1 : 2); }
    // standing, squashed: the waist pushed in, the lid tilted; a ring-pull
    const cx = 12.5, cz = 26.5;
    for (let y = 0; y < 10; y++) { const t = y, pinch = 1 - .32 * Math.exp(-(((t - 5) / 1.6) ** 2)), r = 2.7 * pinch;
      for (let x = 8; x < 18; x++) for (let z = 22; z < 32; z++) { const rho = Math.hypot(x + .5 - cx - (t - 5) * .12, z + .5 - cz); const c = can(t, rho, 10, r); if (c !== null) V.set(x, y, z, c, c === a || c === b ? 1 : 2); } }
    V.box(12, 10, 25, 14, 11, 28, 0xdfe3e8, 2); V.set(12, 10, 28, 0xdfe3e8, 2);                                        // the ring-pull
    void seed;
  } });

// the fit-check mirror leaning on the wall: a tall gloss pane, a frame, a sticker in the corner
export const mirrorLean = def({ id: 'mirror-lean', name: 'Fit-check mirror', cat: 'decor', place: 'floor', foot: [3, 1], h: 1.8, rot: 90,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['fit check', 'hypebeast', 'bedroom'], variants: 3, vnames: ['black', 'gold', 'white'], far: true,
  game: base(),
  build(V, { variant = 0 } = {}) {
    const fr = pick([K.ink, K.gold, K.white], variant), l = variant === 1 ? 2 : 0;
    V.box(0, 0, 0, 15, 36, 3, fr, l); V.box(1, 1, 2, 14, 35, 3, K.glassHi, 1);                          // frame, then the pane on its front
    for (let k = 0; k < 9; k++) { V.set(3 + k, 12 + k, 2, K.glint, 1); V.set(3 + k, 13 + k, 2, K.glint, 1); }   // the glint
    V.box(10, 28, 2, 13, 31, 3, K.pink); V.set(11, 29, 2, K.white);                                      // a sticker
    V.box(1, 0, 3, 14, 1, 5, shade(fr, .8), l);                                                          // the foot rail
  } });

// a tall glossy floor vase with dried branches: the money's quiet corner piece
export const vaseFloor = def({ id: 'vase-floor', name: 'Floor vase', cat: 'decor', place: 'floor', foot: [2, 2], h: 1.5, rot: 90,
  tiers: ['house', 'penthouse'], tags: ['gallery', 'quiet money', 'corner'], variants: 3, vnames: ['white gloss', 'black gloss', 'terracotta'], far: true,
  game: base(),
  grain: 0.025, shaped: 'a vase of flowers: the round body, the slim neck, the stems, leaves and blooms',
  grain: 0.025, shaped: 'a vase of flowers: the round body, the slim neck, the stems, leaves and blooms',
  grain: 0.025, shaped: 'a vase of flowers: the round body, the slim neck, the stems, leaves and blooms',
  grain: 0.025, shaped: 'a vase of flowers: the round body, the slim neck, the stems, leaves and blooms',
  build(V, { variant = 0, seed = 1 } = {}) {
    // THIRD PASS · a tall gloss vase (a round belly, a slim neck, a lip) holding a few long stems: leaves, and open blooms on top
    const c = pick([K.white, K.ink, K.terracotta], variant), cx = 10, cz = 10, r = rng(seed * 13 + 5);
    const blooms = pick([[K.pink, 0xe8232a, K.yellow, K.pink, K.white], [K.white, K.yellow, 0xe8232a, K.white, K.yellow], [K.orange, K.yellow, K.white, K.tang, K.cream]], variant);
    lathe(V, cx, cz, 0, 37, prof([[0, 4], [1, 4.6], [6, 6.6], [13, 7.4], [20, 6.8], [25, 5.2], [29, 3], [31, 2.5], [34, 2.5], [35, 3.4], [37, 3.4]]), (x, y) => (y === 0 ? shade(c, .8) : c), 1, y => (y > 35 ? 2.3 : -1));
    cyl(V, cx, cz, 2.3, 35, 36, K.ink);                                                                             // the water, dark in the neck
    // five stems: out of the neck, a slight bow, each to its bloom; two of them carry a leaf
    const S = [[5, 51, 6, 0], [15, 53, 7, 1], [10, 56, 12, 2], [15, 46, 14, 3], [4, 45, 13, 4], [10, 49, 4, 0], [9, 42, 16, 1]];
    for (const [bx, by, bz, k] of S) {
      const sx = cx + (bx > cx ? 1 : bx < cx ? -1 : 0), sz = cz + (bz > cz ? 1 : -1), mx = (sx + bx) / 2 + (bx - cx) * .25, mz = (sz + bz) / 2 + (bz - cz) * .25, my = (36 + by) / 2;
      line(V, sx, 35, sz, mx, my, mz, K.leafD, 0); line(V, mx, my, mz, bx, by - 2, bz, K.leafD, 0);
      if (k === 1 || k === 4 || k === 2) { const a = Math.atan2(bz - cz, bx - cx) + (k === 2 ? 1.6 : .5), d = [Math.cos(a) * .8, .55, Math.sin(a) * .8], n = Math.hypot(...d);
        const D = d.map(t => t / n), S2 = [-Math.sin(a), 0, Math.cos(a)];
        plate(V, [mx + D[0] * 4, my + D[1] * 4, mz + D[2] * 4], D, S2, 4.6, 1.9, (u, v) => v * v <= (1 - u * u) * (u < 0 ? 1 : 1 - u * .3), (x, y, z, u, v) => (Math.abs(v) < .2 ? K.leafL : K.leaf), 1); }
      // the bloom: a round head of petals, its heart showing on top
      const pc = blooms[k];
      ball(V, bx, by, bz, 3.3, 2.5, 3.3, (x, y, z, u, v, w) => (v > .45 && u * u + w * w < .2 ? (pc === K.yellow ? K.orange : K.yellow) : v < -.5 ? shade(pc, .78) : pc), 0);
      ball(V, bx, by - 2.6, bz, 1.3, .9, 1.3, K.leafD);                                                      // the green cup under it
    }
    void r;
  },
  fine(P, { variant = 0, V } = {}) {
    // a band round the belly and a thin line under it, in gold, cobalt or cream on the glaze: it reads glazed and made, not plain
    const band = pick([K.cobalt, K.gold, K.cream], variant);
    for (const f of ['+z', '+x', '-x', '-z']) fsurf(P, V, f, 0, 15, 0, 20, 17, 20, (x, y, z, i, j) => ((y === 15 && j >= 2) || (y === 16 && j === 2) ? band : null));
  } });

export const LIVED = [boxesMoving, signRent, paintKit, beerCans, mirrorLean, vaseFloor];
